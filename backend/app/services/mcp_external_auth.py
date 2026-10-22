"""Validates MCP access tokens issued by an external OAuth/OIDC server
(MCP_OAUTH_ISSUER, e.g. authentik) instead of Pflanzn's built-in one.

Only JWT access tokens are accepted, verified against the issuer's JWKS with an
asymmetric algorithm and a mandatory audience (MCP_OAUTH_AUDIENCE). Without the
audience check any token the issuer minted for any other app would work here.
Opaque tokens can't be audience-checked and are refused. When a verified JWT lacks
an email claim, the userinfo endpoint fills it in (cached briefly).
"""
import json
import logging
import time
from typing import Optional

import httpx
from jose import jwt
from jose.exceptions import JOSEError

from app.core.config import settings
from app.core.security import redis_client
from app.services.mcp_oauth import hash_token

logger = logging.getLogger(__name__)

METADATA_TTL_SECONDS = 3600
USERINFO_CACHE_SECONDS = 300
_DISCOVERY_SUFFIX = "/.well-known/openid-configuration"

# The algorithm is never taken from the token header alone; HMAC is excluded so a
# public key can't be abused as a shared secret.
ALLOWED_ALGORITHMS = ["RS256", "RS384", "RS512", "PS256", "PS384", "PS512", "ES256", "ES384", "ES512", "EdDSA"]

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
        return jwt.decode(
            token,
            _cache["jwks"],
            algorithms=ALLOWED_ALGORITHMS,
            issuer=metadata["issuer"],
            audience=settings.MCP_OAUTH_AUDIENCE,
            options={"verify_aud": True, "verify_at_hash": False},
        )
    except JOSEError:  # bad signature/claims, but also key/alg mismatches (JWKError)
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
    if not settings.MCP_OAUTH_AUDIENCE:
        logger.error("MCP: MCP_OAUTH_ISSUER is set without MCP_OAUTH_AUDIENCE; refusing all tokens")
        return None
    if token.count(".") != 2:
        return None  # opaque token: its audience can't be checked
    try:
        metadata = _load()
    except Exception as exc:
        logger.error(f"MCP: external OAuth server unreachable: {exc}")
        return None

    claims = _verify_jwt(token, metadata)
    if claims is None:
        return None
    if not claims.get("email"):
        try:
            info = _userinfo(token, metadata)
        except httpx.HTTPError as exc:
            logger.error(f"MCP: userinfo request failed: {exc}")
            return None
        if info is None or info.get("sub") != claims.get("sub"):
            return None
        # Verified JWT claims win; userinfo only fills what the token left empty.
        claims = {**info, **{k: v for k, v in claims.items() if v is not None}}
    return claims


def token_scopes(claims: dict) -> list[str]:
    raw = claims.get("scope") or claims.get("scp") or ""
    return raw.split() if isinstance(raw, str) else list(raw)
