"""Validates MCP access tokens issued by an external OAuth/OIDC server
(MCP_OAUTH_ISSUER, e.g. authentik) instead of Pflanzn's built-in one.

JWT access tokens are verified against the issuer's JWKS; opaque tokens (or JWTs
without an email claim) are checked at the userinfo endpoint. Results are cached
briefly so a chatty MCP session doesn't hit the IdP on every call.
"""
import json
import logging
import time
from typing import Optional

import httpx
from jose import JWTError, jwt

from app.core.config import settings
from app.core.security import redis_client
from app.services.mcp_oauth import hash_token

logger = logging.getLogger(__name__)

METADATA_TTL_SECONDS = 3600
USERINFO_CACHE_SECONDS = 300
_DISCOVERY_SUFFIX = "/.well-known/openid-configuration"

_cache: dict = {"metadata": None, "jwks": None, "fetched_at": 0.0}


def _discovery_url() -> str:
    issuer = settings.MCP_OAUTH_ISSUER.strip()
    return issuer if issuer.endswith(_DISCOVERY_SUFFIX) else issuer.rstrip("/") + _DISCOVERY_SUFFIX


def configured_issuer() -> str:
    return settings.MCP_OAUTH_ISSUER.strip().removesuffix(_DISCOVERY_SUFFIX)


def _load() -> dict:
    if _cache["metadata"] and time.time() - _cache["fetched_at"] < METADATA_TTL_SECONDS:
        return _cache["metadata"]
    with httpx.Client(timeout=10) as client:
        metadata = client.get(_discovery_url()).raise_for_status().json()
        jwks = client.get(metadata["jwks_uri"]).raise_for_status().json() if metadata.get("jwks_uri") else None
    _cache.update(metadata=metadata, jwks=jwks, fetched_at=time.time())
    return metadata


def issuer() -> str:
    """The issuer identifier exactly as the server publishes it (trailing slash and all)."""
    try:
        return _load()["issuer"]
    except Exception as exc:
        logger.warning(f"MCP: could not load {_discovery_url()}: {exc}")
        return configured_issuer()


def _verify_jwt(token: str, metadata: dict) -> Optional[dict]:
    if not _cache["jwks"]:
        return None
    try:
        algorithm = jwt.get_unverified_header(token).get("alg")
        return jwt.decode(
            token,
            _cache["jwks"],
            algorithms=[algorithm] if algorithm and algorithm != "none" else [],
            issuer=metadata["issuer"],
            audience=settings.MCP_OAUTH_AUDIENCE or None,
            options={"verify_aud": bool(settings.MCP_OAUTH_AUDIENCE), "verify_at_hash": False},
        )
    except JWTError:
        return None


def _userinfo(token: str, metadata: dict) -> Optional[dict]:
    endpoint = metadata.get("userinfo_endpoint")
    if not endpoint:
        return None
    key = f"mcp:ext:{hash_token(token)}"
    cached = redis_client.get(key)
    if cached:
        return json.loads(cached)
    with httpx.Client(timeout=10) as client:
        response = client.get(endpoint, headers={"Authorization": f"Bearer {token}"})
    if response.status_code != 200:
        return None
    claims = response.json()
    redis_client.setex(key, USERINFO_CACHE_SECONDS, json.dumps(claims))
    return claims


def verify_token(token: str) -> Optional[dict]:
    """Claims for a valid token (always including `email` when the IdP provides one),
    or None."""
    try:
        metadata = _load()
    except Exception as exc:
        logger.error(f"MCP: external OAuth server unreachable: {exc}")
        return None

    is_jwt = token.count(".") == 2
    claims = _verify_jwt(token, metadata) if is_jwt else None
    if is_jwt and claims is None:
        return None  # a JWT that fails verification is never accepted via userinfo
    if claims is None or not claims.get("email"):
        try:
            info = _userinfo(token, metadata)
        except httpx.HTTPError as exc:
            logger.error(f"MCP: userinfo request failed: {exc}")
            return None
        if info is None:
            return None
        claims = {**(claims or {}), **info}
    return claims


def token_scopes(claims: dict) -> list[str]:
    raw = claims.get("scope") or claims.get("scp") or ""
    return raw.split() if isinstance(raw, str) else list(raw)
