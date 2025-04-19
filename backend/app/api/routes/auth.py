import os
import time
import logging
import redis
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
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
OIDC_REDIRECT_URI = settings.DOMAIN + "/callback"

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
        server_metadata_url=OIDC_PROVIDER_URL,
        client_kwargs={"scope": "openid profile email"},
        redirect_uri=OIDC_REDIRECT_URI,
    )

@router.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    """Handles user authentication and issues access & refresh tokens."""
    logger.debug(f"Login attempt for user: '{user_data.username}'")

    user = db.query(User).filter(User.username == user_data.username).first()
    
    if not user or not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Reject login if not 'local' user
    if user.auth_type != "local":
        raise HTTPException(status_code=401, detail="User must log in via OIDC")

    # Reject login if password is missing
    if not user.password or not verify_password(user_data.password, user.password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Generate tokens
    access_token = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))
    refresh_token = create_refresh_token({"sub": user.username})

    # Store refresh token in Redis
    redis_client.setex(f"refresh:{user.username}", 86400, refresh_token)

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

@router.post("/oidc/code")
async def oidc_code_exchange(request: Request, db: Session = Depends(get_db)):
    body = await request.json()
    code = body.get("code")

    if not code:
        raise HTTPException(status_code=400, detail="Missing code")

    token = await oauth.oidc.authorize_access_token(request, code=code, redirect_uri=OIDC_REDIRECT_URI)
    user_info = await oauth.oidc.parse_id_token(request, token)

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to fetch user info")

    email = user_info.get("email")
    username = user_info.get("preferred_username") or email.split("@")[0]

    if not email:
        raise HTTPException(status_code=400, detail="Email required")

    user = db.query(User).filter(User.email == email).first()

    if not user:
        role = "admin" if db.query(User).count() == 0 else "user"
        user = User(username=username, email=email, role=role, auth_type="oidc")
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token = create_access_token({"sub": user.email}, expires_delta=timedelta(minutes=30))
    refresh_token = token.get("refresh_token")

    if refresh_token:
        redis_client.setex(f"refresh:{user.email}", 86400, refresh_token)

    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie("access_token", access_token, httponly=True, secure=True, samesite="Strict", max_age=1800, path="/")
    if refresh_token:
        response.set_cookie("refresh_token", refresh_token, httponly=True, secure=True, samesite="Strict", max_age=86400, path="/")

    return response

@router.post("/logout")
def logout():
    """Clears the authentication cookie."""
    response = JSONResponse(content={"message": "Logout successful"})
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return response

@router.post("/refresh")
def refresh_token(request: Request):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        logger.debug("No refresh token found in request")
        raise HTTPException(status_code=401, detail="No valid refresh token")

    try:
        payload = decode_token(refresh_token)
        username = payload.get("sub")

        stored_refresh_token = redis_client.get(f"refresh:{username}")

        logger.debug(f"Stored refresh token: {stored_refresh_token}")
        logger.debug(f"Received refresh token: {refresh_token}")

        if not stored_refresh_token or stored_refresh_token.strip() != refresh_token.strip():
            redis_client.delete(f"refresh:{username}")
            logger.debug(f"Invalid refresh token for user {username}")
            raise HTTPException(status_code=401, detail="Invalid refresh token")

        new_access_token = create_access_token({"sub": username}, expires_delta=timedelta(minutes=30))
        new_refresh_token = create_refresh_token({"sub": username})

        redis_client.setex(f"refresh:{username}", 86400, new_refresh_token)

        response = JSONResponse(content={"message": "Access token refreshed"})
        response.set_cookie(
            key="access_token",
            value=new_access_token,
            httponly=True,
            secure=True,
            samesite="None",
            max_age=1800,
            path="/"
        )
        response.set_cookie(
            key="refresh_token",
            value=new_refresh_token,
            httponly=True,
            secure=True,
            samesite="None",
            max_age=86400,
            path="/"
        )

        return response
    except jwt.ExpiredSignatureError:
        logger.debug(f"Refresh token expired for user {username}")
        raise HTTPException(status_code=401, detail="Refresh token expired, please login again")
    except jwt.PyJWTError as e:
        logger.error(f"JWT Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")
