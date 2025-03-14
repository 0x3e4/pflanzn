import os
import time
import logging
import redis
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.core.security import get_current_user, verify_password, create_access_token, create_refresh_token
from app.models import User
from app.schemas import UserCreate, UserResponse, Token, LoginRequest
from authlib.integrations.starlette_client import OAuth
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Store failed login attempts
FAILED_LOGIN_ATTEMPTS = {}

# Load auth mode
AUTH_MODE = settings.VITE_AUTH_MODE

# OIDC Settings
OIDC_PROVIDER_URL = settings.OIDC_PROVIDER_URL
OIDC_CLIENT_ID = settings.OIDC_CLIENT_ID
OIDC_CLIENT_SECRET = settings.OIDC_CLIENT_SECRET
OIDC_REDIRECT_URI = settings.OIDC_REDIRECT_URI

# Redis client
REDIS_URL = settings.REDIS_URL
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

# Initialize OAuth for OIDC
oauth = OAuth()
if AUTH_MODE == "oidc":
    oauth.register(
        name="oidc",
        client_id=OIDC_CLIENT_ID,
        client_secret=OIDC_CLIENT_SECRET,
        server_metadata_url=f"{OIDC_PROVIDER_URL}/.well-known/openid-configuration",
        client_kwargs={"scope": "openid profile email"},
    )

@router.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    """Handles user authentication and issues access & refresh tokens."""
    logger.info(f"Login attempt for user: '{user_data.username}'")

    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate tokens
    access_token = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))
    refresh_token = create_refresh_token({"sub": user.username})

    # Store refresh token in Redis
    redis_client.setex(f"refresh:{user.username}", 86400, refresh_token)  # 1-day expiration

    # Secure response with HTTP-only cookies
    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="Strict", max_age=1800, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="Strict", max_age=86400, path="/")

    return response

@router.get("/oidc-login")
async def oidc_login(request: Request):
    """Redirects the user to the OIDC provider for authentication."""
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")
    return await oauth.oidc.authorize_redirect(request, OIDC_REDIRECT_URI)

@router.get("/callback")
async def oidc_callback(request: Request):
    """Handles OIDC login callback and retrieves refresh token if available."""
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")

    token = await oauth.oidc.authorize_access_token(request)
    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to retrieve user information.")

    access_token = create_access_token({"sub": user_info["email"]}, expires_delta=timedelta(minutes=30))
    refresh_token = token.get("refresh_token")  # Store this if available

    if refresh_token:
        redis_client.setex(f"refresh:{user_info['email']}", 86400, refresh_token)

    return {"access_token": access_token, "refresh_token": refresh_token, "user_info": user_info}

@router.post("/logout")
def logout():
    """Clears the authentication cookie."""
    response = JSONResponse(content={"message": "Logout successful"})
    response.delete_cookie("access_token")
    return response

@router.post("/refresh")
def refresh_token(request: Request):
    """Handles token refresh by rotating session ID and issuing new access tokens."""
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No valid refresh token")

    try:
        payload = decode_token(refresh_token)
        username = payload.get("sub")

        # Validate stored refresh token in Redis
        stored_refresh_token = redis_client.get(f"refresh:{username}")
        if not stored_refresh_token or stored_refresh_token != refresh_token:
            redis_client.delete(f"refresh:{username}")
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        # Generate a new access token
        new_access_token = create_access_token({"sub": username}, expires_delta=timedelta(minutes=30))

        # Securely set new access token in HTTP-only cookies
        response = JSONResponse(content={"message": "Access token refreshed"})
        response.set_cookie(key="access_token", value=new_access_token, httponly=True, secure=True, samesite="Strict", max_age=1800, path="/")

        return response
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired, please login again")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")