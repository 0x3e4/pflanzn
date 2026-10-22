"""Separate sign-in for the MCP consent page (MCP_LOGIN_PROVIDER).

By default the consent page uses the app's own login. With a login provider set,
users sign in there instead — any OIDC server (authentik, Pocket ID, Keycloak, …)
or GitHub, which only speaks plain OAuth2 — and are matched to their Pflanzn
account by verified email. Pflanzn itself stays the authorization server MCP
clients talk to, so dynamic client registration keeps working with every provider.
"""
import base64
import hashlib
import secrets
import time
from typing import Optional
from urllib.parse import urlencode

import httpx

from app.core.config import settings

GITHUB_AUTHORIZE_URL = "https://github.com/login/oauth/authorize"
GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token"
GITHUB_EMAILS_URL = "https://api.github.com/user/emails"

_DISCOVERY_SUFFIX = "/.well-known/openid-configuration"
_oidc_cache: dict = {"metadata": None, "fetched_at": 0.0}


class LoginError(Exception):
    """`code` is shown to the user on the consent page."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


def provider() -> str:
    """"github", "oidc", or "" (use the app's own login)."""
    return (settings.MCP_LOGIN_PROVIDER or "").strip().lower()


def display_name() -> str:
    return settings.MCP_LOGIN_NAME or {"github": "GitHub"}.get(provider(), "SSO")


def callback_url(base: str) -> str:
    return f"{base}/api/oauth/login/callback"


def new_pkce() -> tuple[str, str]:
    verifier = secrets.token_urlsafe(48)
    challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).rstrip(b"=").decode()
    return verifier, challenge


def _oidc_metadata() -> dict:
    if _oidc_cache["metadata"] and time.time() - _oidc_cache["fetched_at"] < 3600:
        return _oidc_cache["metadata"]
    url = settings.MCP_LOGIN_OIDC_URL.strip()
    if not url.endswith(_DISCOVERY_SUFFIX):
        url = url.rstrip("/") + _DISCOVERY_SUFFIX
    with httpx.Client(timeout=10) as client:
        metadata = client.get(url).raise_for_status().json()
    _oidc_cache.update(metadata=metadata, fetched_at=time.time())
    return metadata


def authorize_url(base: str, state: str, code_challenge: str) -> str:
    params = {
        "client_id": settings.MCP_LOGIN_CLIENT_ID,
        "redirect_uri": callback_url(base),
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }
    if provider() == "github":
        return f"{GITHUB_AUTHORIZE_URL}?{urlencode({**params, 'scope': 'user:email'})}"
    endpoint = _oidc_metadata()["authorization_endpoint"]
    return f"{endpoint}?{urlencode({**params, 'response_type': 'code', 'scope': 'openid email profile'})}"


def _exchange_code(token_url: str, base: str, code: str, verifier: str) -> str:
    with httpx.Client(timeout=10) as client:
        response = client.post(
            token_url,
            data={
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": callback_url(base),
                "code_verifier": verifier,
                "client_id": settings.MCP_LOGIN_CLIENT_ID,
                "client_secret": settings.MCP_LOGIN_CLIENT_SECRET,
            },
            headers={"Accept": "application/json"},
        )
    token = response.json() if response.status_code == 200 else {}
    if not token.get("access_token"):
        raise LoginError("login_failed")
    return token["access_token"]


def verified_emails(base: str, code: str, verifier: str) -> list[str]:
    """Exchanges the provider's code and returns the user's verified email addresses."""
    try:
        if provider() == "github":
            access_token = _exchange_code(GITHUB_TOKEN_URL, base, code, verifier)
            with httpx.Client(timeout=10) as client:
                response = client.get(GITHUB_EMAILS_URL, headers={
                    "Authorization": f"Bearer {access_token}",
                    "Accept": "application/vnd.github+json",
                })
            if response.status_code != 200:
                raise LoginError("login_failed")
            # GitHub only lists addresses the user owns; unverified ones are flagged.
            return [e["email"] for e in response.json() if e.get("verified") and e.get("email")]

        metadata = _oidc_metadata()
        access_token = _exchange_code(metadata["token_endpoint"], base, code, verifier)
        with httpx.Client(timeout=10) as client:
            response = client.get(metadata["userinfo_endpoint"], headers={"Authorization": f"Bearer {access_token}"})
        if response.status_code != 200:
            raise LoginError("login_failed")
        info = response.json()
    except httpx.HTTPError:
        raise LoginError("login_failed")

    email = info.get("email")
    if not email:
        raise LoginError("login_failed")
    if settings.OIDC_REQUIRE_VERIFIED_EMAIL and str(info.get("email_verified")).lower() != "true":
        raise LoginError("email_unverified")
    return [email]


def binding_hash(value: Optional[str]) -> str:
    return hashlib.sha256((value or "").encode()).hexdigest()
