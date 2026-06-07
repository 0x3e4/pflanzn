import logging
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
from urllib.parse import urlparse

import httpx
import redis
from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.orm import Session

from app.core.audit import record_audit
from app.core.config import settings
from app.core.security import create_access_token, create_refresh_token, decode_token, verify_password
from app.database import get_db
from app.models import User
from app.schemas import LoginRequest

router = APIRouter()
logger = logging.getLogger(__name__)

# Store failed login attempts
FAILED_LOGIN_ATTEMPTS = {}

# Load auth mode
AUTH_MODE = settings.AUTH_MODE

# OIDC Settings
OIDC_PROVIDER_URL = settings.OIDC_PROVIDER_URL
OIDC_CLIENT_ID = settings.OIDC_CLIENT_ID
OIDC_CLIENT_SECRET = settings.OIDC_CLIENT_SECRET
OIDC_REDIRECT_URI = settings.DOMAIN + "/api/auth/oidc/callback"

# Redis client
REDIS_URL = settings.REDIS_URL
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

# Cookie settings
def _is_truthy(value: Optional[str], default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}

parsed_domain = urlparse(settings.DOMAIN or "")
derived_secure = parsed_domain.scheme.lower() == "https"
cookie_secure_override = os.getenv("COOKIE_SECURE")
COOKIE_SECURE = _is_truthy(cookie_secure_override, default=derived_secure)
COOKIE_DOMAIN = None
COOKIE_SAMESITE = (os.getenv("COOKIE_SAMESITE") or ("none" if COOKIE_SECURE else "lax")).lower()
COOKIE_PATH = "/"

# Initialize OAuth for OIDC
oauth = OAuth()
if AUTH_MODE == "oidc":
    oauth.register(
        name="oidc",
        client_id=OIDC_CLIENT_ID,
        client_secret=OIDC_CLIENT_SECRET,
        server_metadata_url=OIDC_PROVIDER_URL,
        client_kwargs={
            "scope": "openid profile email offline_access",
            "response_type": "code"
        },
        redirect_uri=OIDC_REDIRECT_URI,
    )

# Helpers
def _utc_from_epoch(ts: int) -> datetime:
    return datetime.fromtimestamp(int(ts), tz=timezone.utc)

async def _get_oidc_metadata() -> Dict[str, Any]:
    # Works whether OIDC_PROVIDER_URL is issuer or full metadata URL
    if OIDC_PROVIDER_URL.endswith(("/.well-known/openid-configuration", "/.well-known/openid-configuration/")):
        meta_url = OIDC_PROVIDER_URL
    else:
        meta_url = OIDC_PROVIDER_URL.rstrip("/") + "/.well-known/openid-configuration"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(meta_url)
        r.raise_for_status()
        return r.json()

def _store_idp_tokens(email: str, token: Dict[str, Any]) -> None:
    """
    Persist IdP tokens with IdP-provided expiries.
    Keys:
      idp:access:<email>  (EXPIREAT to token['expires_at'] or 'expires_in')
      idp:refresh:<email> (EXPIREAT if refresh expiry known; else no TTL)
    """
    access_token = token.get("access_token")
    refresh_token = token.get("refresh_token")
    expires_at = token.get("expires_at")
    expires_in = token.get("expires_in")

    # Optional refresh expiry fields (provider-specific)
    rt_exp_abs = token.get("refresh_expires_at")
    rt_exp_in = token.get("refresh_expires_in")

    if access_token:
        key = f"idp:access:{email}"
        redis_client.set(key, access_token)
        if expires_at:
            redis_client.expireat(key, int(expires_at))
        elif expires_in:
            redis_client.expire(key, int(expires_in))

    if refresh_token:
        key = f"idp:refresh:{email}"
        redis_client.set(key, refresh_token)
        if rt_exp_abs:
            redis_client.expireat(key, int(rt_exp_abs))
        elif rt_exp_in:
            redis_client.expire(key, int(rt_exp_in))

def _set_auth_cookies(resp, access_token: str, access_expires_at: Optional[int],
                      refresh_token: Optional[str], refresh_expires_at: Optional[int]) -> None:
    resp.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        expires=_utc_from_epoch(access_expires_at) if access_expires_at else None,
        domain=COOKIE_DOMAIN,
        path=COOKIE_PATH,
    )
    if refresh_token:
        resp.set_cookie(
            key="refresh_token",
            value=refresh_token,
            httponly=True,
            secure=COOKIE_SECURE,
            samesite=COOKIE_SAMESITE,
            expires=_utc_from_epoch(refresh_expires_at) if refresh_expires_at else None,
            domain=COOKIE_DOMAIN,
            path=COOKIE_PATH,
        )

# Routes
@router.post("/login")
def login(user_data: LoginRequest, request: Request, db: Session = Depends(get_db)):
    """Handles user authentication and issues access & refresh tokens."""
    logger.debug(f"Login attempt for user: '{user_data.username}'")

    user = db.query(User).filter(User.username == user_data.username).first()

    if not user or not verify_password(user_data.password, user.password):
        record_audit(request, action="login_failed", entity_type="auth",
                     username=user_data.username, status_code=401,
                     details={"reason": "invalid_credentials"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Reject login if not 'local' user
    if user.auth_type != "local":
        record_audit(request, action="login_failed", entity_type="auth",
                     username=user_data.username, status_code=401,
                     details={"reason": "wrong_auth_type"})
        raise HTTPException(status_code=401, detail="User must log in via OIDC")

    # Reject login if password is missing
    if not user.password or not verify_password(user_data.password, user.password):
        record_audit(request, action="login_failed", entity_type="auth",
                     username=user_data.username, status_code=401,
                     details={"reason": "invalid_credentials"})
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate tokens
    now = int(time.time())
    access_expires_at = now + (30 * 60)
    refresh_expires_at = now + (24 * 60 * 60)
    access_token = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))
    refresh_token = create_refresh_token({"sub": user.username}, expires_delta=timedelta(days=1))

    # Store refresh token in Redis
    redis_client.setex(f"refresh:{user.username}", 86400, refresh_token)

    # Secure response with HTTP-only cookies
    response = JSONResponse(content={"message": "Login successful"})
    _set_auth_cookies(response, access_token, access_expires_at, refresh_token, refresh_expires_at)

    record_audit(request, action="login", entity_type="auth",
                 user_id=user.id, username=user.username, status_code=200)
    return response

@router.get("/oidc-login")
async def oidc_login(request: Request):
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC auth not enabled.")
    return await oauth.oidc.authorize_redirect(
        request,
        redirect_uri=OIDC_REDIRECT_URI,
        code_challenge_method="S256",
        nonce=os.urandom(16).hex()
    )

@router.get("/oidc/callback")
async def oidc_callback(request: Request, db: Session = Depends(get_db)):
    """
    Handle OIDC callback:
    - Exchange code for IdP tokens
    - Fetch userinfo and upsert user
    - Persist IdP tokens (server-side)
    - Mint APP access/refresh tokens whose lifetimes mirror the IdP's
    - Set APP cookies; browser never holds IdP tokens
    """
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")

    import time
    try:
        # 1) Exchange code for tokens at IdP
        token = await oauth.oidc.authorize_access_token(request)
        logger.debug(f"Token response keys: {list(token.keys())}")

        # 2) Pull userinfo from IdP
        try:
            user_info = await oauth.oidc.userinfo(token=token)
            logger.debug(f"Userinfo endpoint response: {user_info}")
        except Exception as e:
            logger.error(f"Failed to get userinfo: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch user info: {str(e)}")

        if not user_info:
            logger.error("No user information received from OIDC provider")
            raise HTTPException(status_code=400, detail="No user information received from OIDC provider")

        # 3) Extract identity
        email = user_info.get("email")
        username = (
            user_info.get("preferred_username")
            or user_info.get("name")
            or user_info.get("nickname")
            or user_info.get("sub")
            or (email.split("@")[0] if email else None)
        )
        if not email:
            logger.error(f"No email in user info. Available fields: {list(user_info.keys())}")
            raise HTTPException(status_code=400, detail="Email required from OIDC provider")

        # 4) Upsert user locally
        user = db.query(User).filter(User.email == email).first()
        created = False
        if not user:
            if not username:
                username = email.split("@")[0]
            role = "admin" if db.query(User).count() == 0 else "user"
            user = User(username=username, email=email, role=role, auth_type="oidc")
            db.add(user)
            db.commit()
            db.refresh(user)
            created = True
            logger.info(f"Created new OIDC user: {user.email}")
        else:
            logger.debug(f"Found existing OIDC user: {user.email}")

        # 5) Persist IdP tokens server-side (keep their expiries)
        _store_idp_tokens(user.email, token)

        # 6) Mirror IdP lifetimes for YOUR app tokens
        now = int(time.time())

        idp_at_expires_at = int(token.get("expires_at") or (now + int(token.get("expires_in", 3600))))
        idp_rt_expires_at = None
        if token.get("refresh_expires_at"):
            idp_rt_expires_at = int(token["refresh_expires_at"])
        elif token.get("refresh_expires_in"):
            idp_rt_expires_at = now + int(token["refresh_expires_in"])

        # Build deltas. App access mirrors IdP; app refresh is decoupled from
        # the IdP's refresh_expires_in so short-lived IdP refresh tokens don't
        # force a full re-login every hour — the IdP call may still fail
        # later, in which case we'll 401 on that attempt.
        access_delta_seconds = max(1, idp_at_expires_at - now)
        refresh_delta_seconds = max(
            30 * 24 * 3600,
            (idp_rt_expires_at - now) if idp_rt_expires_at else 0,
        )
        app_refresh_expires_at = now + refresh_delta_seconds

        app_access = create_access_token({"sub": user.email}, expires_delta=timedelta(seconds=access_delta_seconds))
        app_refresh = create_refresh_token({"sub": user.email}, expires_delta=timedelta(seconds=refresh_delta_seconds))

        # 7) Set APP cookies (access mirrors IdP; refresh uses app lifetime)
        response = RedirectResponse(url="/", status_code=302)
        _set_auth_cookies(
            resp=response,
            access_token=app_access,
            access_expires_at=idp_at_expires_at,
            refresh_token=app_refresh,
            refresh_expires_at=app_refresh_expires_at,
        )

        record_audit(request, action="login", entity_type="auth",
                     user_id=user.id, username=user.username, status_code=302,
                     details={"auth_type": "oidc", "new_user": created})
        logger.info(f"OIDC login successful for {user.email}, redirecting to home")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected OIDC callback error: {str(e)}")
        logger.error(f"Request URL: {request.url}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")
        record_audit(request, action="login_failed", entity_type="auth",
                     status_code=302, details={"auth_type": "oidc"})
        return RedirectResponse(url="/login?error=auth_failed", status_code=302)

@router.post("/logout")
def logout(request: Request):
    """Clears the authentication cookie."""
    response = JSONResponse(content={"message": "Logout successful"})
    response.delete_cookie("access_token", domain=COOKIE_DOMAIN, path=COOKIE_PATH)
    response.delete_cookie("refresh_token", domain=COOKIE_DOMAIN, path=COOKIE_PATH)
    record_audit(request, action="logout", entity_type="auth", status_code=200)
    return response

@router.post("/refresh")
async def refresh_token(request: Request, db: Session = Depends(get_db)):
    # 1) Read and verify YOUR app refresh cookie
    app_rtok = request.cookies.get("refresh_token")
    if not app_rtok:
        raise HTTPException(status_code=401, detail="No valid refresh token")

    # Decode to get the subject (email) and ensure it's unexpired/valid
    try:
        payload = decode_token(app_rtok)
    except HTTPException:
        raise
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=401, detail="Invalid refresh token payload")

    if AUTH_MODE == "local":
        stored_refresh = redis_client.get(f"refresh:{subject}")
        if not stored_refresh or stored_refresh != app_rtok:
            raise HTTPException(status_code=401, detail="Refresh failed")

        user = db.query(User).filter(User.username == subject).first()
        if not user or user.auth_type != "local":
            raise HTTPException(status_code=401, detail="Refresh failed")

        now = int(time.time())
        access_expires_at = now + (30 * 60)
        refresh_expires_at = now + (24 * 60 * 60)

        app_access = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))
        app_refresh = create_refresh_token({"sub": user.username}, expires_delta=timedelta(days=1))
        redis_client.setex(f"refresh:{user.username}", 86400, app_refresh)

        response = JSONResponse(content={"message": "Access token refreshed"})
        _set_auth_cookies(response, app_access, access_expires_at, app_refresh, refresh_expires_at)
        return response

    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="Refresh not supported for current auth mode")

    # 2) Lock by user/email to avoid races
    lock_key = f"rt-lock:{subject}"
    if not redis_client.set(lock_key, "1", nx=True, ex=5):
        raise HTTPException(status_code=409, detail="Refresh already in progress")

    try:
        # 3) Get IdP metadata & RT
        meta = await _get_oidc_metadata()
        token_url = meta["token_endpoint"]
        idp_refresh = redis_client.get(f"idp:refresh:{subject}")
        if not idp_refresh:
            # app RT valid but we lost IdP RT -> force re-login
            raise HTTPException(status_code=401, detail="Refresh failed")

        # 4) Call IdP to refresh
        data = {"grant_type": "refresh_token", "refresh_token": idp_refresh}
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(token_url, data=data, auth=(OIDC_CLIENT_ID, OIDC_CLIENT_SECRET))
        if r.status_code >= 400:
            raise HTTPException(status_code=401, detail="Refresh failed")
        new_tok = r.json()

        # 5) Persist/rotate IdP tokens
        _store_idp_tokens(subject, new_tok)

        # 6) Mirror new IdP expiries for YOUR app tokens
        now = int(time.time())
        idp_at_expires_at = int(new_tok.get("expires_at") or (now + int(new_tok.get("expires_in", 3600))))
        idp_rt_expires_at = None
        if new_tok.get("refresh_expires_at"):
            idp_rt_expires_at = int(new_tok["refresh_expires_at"])
        elif new_tok.get("refresh_expires_in"):
            idp_rt_expires_at = now + int(new_tok["refresh_expires_in"])

        access_delta = timedelta(seconds=idp_at_expires_at - now)
        refresh_delta_seconds = max(
            30 * 24 * 3600,
            (idp_rt_expires_at - now) if idp_rt_expires_at else 0,
        )
        refresh_delta = timedelta(seconds=refresh_delta_seconds)
        app_refresh_expires_at = now + refresh_delta_seconds

        app_access = create_access_token({"sub": subject}, expires_delta=access_delta)
        app_refresh = create_refresh_token({"sub": subject}, expires_delta=refresh_delta)

        # 7) Set cookies (access mirrors IdP; refresh uses app lifetime)
        response = JSONResponse(content={"message": "Access token refreshed"})
        _set_auth_cookies(response, app_access, idp_at_expires_at, app_refresh, app_refresh_expires_at)
        return response

    finally:
        try:
            redis_client.delete(lock_key)
        except Exception:
            pass
