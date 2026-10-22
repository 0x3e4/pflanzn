"""OAuth 2.1 authorization server backing the MCP endpoint.

Pflanzn issues its own opaque tokens for MCP clients instead of handing out the
browser session or the IdP's tokens. The user still authenticates through the
normal login (local password or the configured OIDC provider such as authentik)
before approving a client on the consent page, so every auth mode works and the
IdP does not need to support dynamic client registration.

Tokens are random strings; only their SHA-256 hashes are stored. Authorization
codes and pending consent requests are short-lived Redis entries.
"""
import base64
import hashlib
import hmac
import json
import secrets
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlencode, urlparse

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import redis_client
from app.models import OAuthClient, OAuthGrant

SCOPE_READ = "pflanzn:read"
SCOPE_WRITE = "pflanzn:write"
SUPPORTED_SCOPES = (SCOPE_READ, SCOPE_WRITE)
# What clients should request from an external OIDC server (MCP_OAUTH_ISSUER).
EXTERNAL_SCOPES = ("openid", "profile", "email", "offline_access")

ACCESS_TOKEN_TTL = timedelta(hours=1)
# Sliding: every refresh extends it, so an active connection never expires.
REFRESH_TOKEN_TTL = timedelta(days=30)
CODE_TTL_SECONDS = 300
REQUEST_TTL_SECONDS = 600

# Dynamic client registration is open (MCP clients self-register), so cap it per IP
# and in total — the total holds even if the client IP can't be trusted.
REGISTRATION_LIMIT_PER_HOUR = 20
REGISTRATION_GLOBAL_LIMIT_PER_HOUR = 200
# Clients that never got a grant are abandoned registrations; prune them after this.
UNUSED_CLIENT_TTL = timedelta(days=1)

MAX_REDIRECT_URIS = 10
MAX_REDIRECT_URI_LENGTH = 2000
_BLOCKED_REDIRECT_SCHEMES = {"javascript", "data", "file", "vbscript", "blob", "about"}
_LOOPBACK_HOSTS = {"localhost", "127.0.0.1", "[::1]", "::1"}


# ==============================================================================
# URLs
# ==============================================================================

def public_base(request) -> str:
    """Origin the outside world reaches Pflanzn on. DOMAIN wins; the request URL is a
    fallback for setups that left it empty."""
    return settings.public_base_url or f"{request.url.scheme}://{request.url.netloc}"


def mcp_resource_url(base: str) -> str:
    return f"{base}/api/mcp"


def protected_resource_metadata_url(base: str) -> str:
    # RFC 9728 path-suffixed form for the resource at /api/mcp.
    return f"{base}/.well-known/oauth-protected-resource/api/mcp"


def authorization_server_metadata(base: str) -> dict:
    return {
        "issuer": base,
        "authorization_endpoint": f"{base}/api/oauth/authorize",
        "token_endpoint": f"{base}/api/oauth/token",
        "registration_endpoint": f"{base}/api/oauth/register",
        "revocation_endpoint": f"{base}/api/oauth/revoke",
        "scopes_supported": list(SUPPORTED_SCOPES),
        "response_types_supported": ["code"],
        "response_modes_supported": ["query"],
        "grant_types_supported": ["authorization_code", "refresh_token"],
        "code_challenge_methods_supported": ["S256"],
        "token_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "revocation_endpoint_auth_methods_supported": ["none", "client_secret_post", "client_secret_basic"],
        "authorization_response_iss_parameter_supported": True,
    }


def protected_resource_metadata(base: str, authorization_server: Optional[str] = None,
                                scopes: tuple = SUPPORTED_SCOPES) -> dict:
    return {
        "resource": mcp_resource_url(base),
        "authorization_servers": [authorization_server or base],
        "scopes_supported": list(scopes),
        "bearer_methods_supported": ["header"],
        "resource_name": "Pflanzn",
    }


# ==============================================================================
# Tokens
# ==============================================================================

def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_token(prefix: str) -> str:
    # Prefixed so leaked tokens are recognisable (and greppable by secret scanners).
    return f"{prefix}_{secrets.token_urlsafe(32)}"


def verify_pkce(code_verifier: str, code_challenge: str) -> bool:
    digest = hashlib.sha256(code_verifier.encode()).digest()
    expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
    return hmac.compare_digest(expected, code_challenge)


def verify_client_secret(client: OAuthClient, secret: Optional[str]) -> bool:
    """Public clients (no stored secret) authenticate by PKCE alone."""
    if not client.client_secret_hash:
        return True
    if not secret:
        return False
    return hmac.compare_digest(client.client_secret_hash, hash_token(secret))


def issue_tokens(grant: OAuthGrant) -> dict:
    """Rotates both tokens on the grant and returns the RFC 6749 token response.
    The caller commits."""
    now = datetime.utcnow()
    access_token = new_token("pfz_at")
    refresh_token = new_token("pfz_rt")
    grant.access_token_hash = hash_token(access_token)
    grant.access_expires_at = now + ACCESS_TOKEN_TTL
    grant.refresh_token_hash = hash_token(refresh_token)
    grant.refresh_expires_at = now + REFRESH_TOKEN_TTL
    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": int(ACCESS_TOKEN_TTL.total_seconds()),
        "refresh_token": refresh_token,
        "scope": grant.scope,
    }


def find_grant_by_access_token(db: Session, token: str) -> Optional[OAuthGrant]:
    grant = db.query(OAuthGrant).filter(OAuthGrant.access_token_hash == hash_token(token)).first()
    if not grant or not grant.access_expires_at or grant.access_expires_at <= datetime.utcnow():
        return None
    return grant


def find_grant_by_refresh_token(db: Session, token: str) -> Optional[OAuthGrant]:
    grant = db.query(OAuthGrant).filter(OAuthGrant.refresh_token_hash == hash_token(token)).first()
    if not grant or not grant.refresh_expires_at or grant.refresh_expires_at <= datetime.utcnow():
        return None
    return grant


# ==============================================================================
# Scopes & redirect URIs
# ==============================================================================

def parse_scopes(scope: Optional[str]) -> list[str]:
    """Known scopes from a space-separated request, in canonical order. Clients that
    ask for nothing we know (or nothing at all) get read + write."""
    requested = set((scope or "").split())
    granted = [s for s in SUPPORTED_SCOPES if s in requested]
    return granted or list(SUPPORTED_SCOPES)


def is_valid_redirect_uri(uri: str) -> bool:
    """https anywhere, http only on loopback (native apps), and private-use schemes
    for desktop clients. Never script-capable or local-file schemes."""
    if not isinstance(uri, str) or not uri or len(uri) > MAX_REDIRECT_URI_LENGTH:
        return False
    parsed = urlparse(uri)
    scheme = parsed.scheme.lower()
    if not scheme or scheme in _BLOCKED_REDIRECT_SCHEMES or parsed.fragment:
        return False
    if scheme == "https":
        return bool(parsed.hostname)
    if scheme == "http":
        return parsed.hostname in _LOOPBACK_HOSTS
    return True


def redirect_host(uri: str) -> str:
    parsed = urlparse(uri)
    return parsed.netloc or f"{parsed.scheme}:"


def build_redirect(redirect_uri: str, params: dict) -> str:
    query = urlencode({k: v for k, v in params.items() if v is not None})
    separator = "&" if urlparse(redirect_uri).query else "?"
    return f"{redirect_uri}{separator}{query}"


def client_redirect_uris(client: OAuthClient) -> list[str]:
    try:
        uris = json.loads(client.redirect_uris or "[]")
    except ValueError:
        return []
    return [u for u in uris if isinstance(u, str)]


# ==============================================================================
# Short-lived state in Redis
# ==============================================================================

def save_pending_request(data: dict) -> str:
    request_id = secrets.token_urlsafe(32)
    redis_client.setex(f"oauth:req:{request_id}", REQUEST_TTL_SECONDS, json.dumps(data))
    return request_id


def load_pending_request(request_id: str) -> Optional[dict]:
    raw = redis_client.get(f"oauth:req:{request_id}")
    return json.loads(raw) if raw else None


def update_pending_request(request_id: str, data: dict) -> None:
    redis_client.setex(f"oauth:req:{request_id}", REQUEST_TTL_SECONDS, json.dumps(data))


def drop_pending_request(request_id: str) -> None:
    redis_client.delete(f"oauth:req:{request_id}")


def save_login_state(data: dict) -> str:
    state = secrets.token_urlsafe(32)
    redis_client.setex(f"oauth:login:{hash_token(state)}", REQUEST_TTL_SECONDS, json.dumps(data))
    return state


def consume_login_state(state: str) -> Optional[dict]:
    raw = redis_client.getdel(f"oauth:login:{hash_token(state)}")
    return json.loads(raw) if raw else None


def save_authorization_code(data: dict) -> str:
    code = secrets.token_urlsafe(32)
    redis_client.setex(f"oauth:code:{hash_token(code)}", CODE_TTL_SECONDS, json.dumps(data))
    return code


def consume_authorization_code(code: str) -> Optional[dict]:
    """Single use: the code is gone after the first read, valid or not."""
    raw = redis_client.getdel(f"oauth:code:{hash_token(code)}")
    return json.loads(raw) if raw else None


def _within_hourly_limit(key: str, limit: int) -> bool:
    count = redis_client.incr(key)
    if count == 1:
        redis_client.expire(key, 3600)
    return int(count) <= limit


def registration_allowed(ip: Optional[str]) -> bool:
    return (
        _within_hourly_limit(f"oauth:register:{ip or 'unknown'}", REGISTRATION_LIMIT_PER_HOUR)
        and _within_hourly_limit("oauth:register:all", REGISTRATION_GLOBAL_LIMIT_PER_HOUR)
    )


def prune_unused_clients(db: Session) -> None:
    """Deletes registrations older than UNUSED_CLIENT_TTL that never got a grant."""
    used = select(OAuthGrant.client_id)
    db.query(OAuthClient).filter(
        OAuthClient.created_at < datetime.utcnow() - UNUSED_CLIENT_TTL,
        ~OAuthClient.id.in_(used),
    ).delete(synchronize_session=False)
