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
OIDC_REDIRECT_URI = settings.VITE_DOMAIN + "/api/auth/oidc/callback"

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
        client_kwargs={
            "scope": "openid profile email",
            "response_type": "code"
        },
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

@router.get("/oidc/callback")
async def oidc_callback(request: Request, db: Session = Depends(get_db)):
    """Handle OIDC callback with comprehensive error handling."""
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")
    
    try:
        # Get the authorization response
        token = await oauth.oidc.authorize_access_token(request)
        logger.info(f"Token response keys: {list(token.keys())}")
        
        # Log non-sensitive token parts
        for key, value in token.items():
            if key not in ['access_token', 'refresh_token']:
                logger.debug(f"Token[{key}]: {value}")
        
        user_info = None

        # Try to get user info from userinfo endpoint
        logger.debug("Attempting to get user info from userinfo endpoint")
        try:
            user_info = await oauth.oidc.userinfo(token=token)
            logger.debug(f"Userinfo endpoint response: {user_info}")
        except Exception as e:
            logger.error(f"Failed to get userinfo: {e}")
            raise HTTPException(status_code=400, detail=f"Failed to fetch user info: {str(e)}")
        
        if not user_info:
            logger.error("No user information received from OIDC provider")
            raise HTTPException(status_code=400, detail="No user information received from OIDC provider")

        # Extract user details
        email = user_info.get("email")
        username = (
            user_info.get("preferred_username") or 
            user_info.get("name") or 
            user_info.get("nickname") or
            user_info.get("sub") or 
            (email.split("@")[0] if email else None)
        )
        logger.debug(f"Extracted - Email: {email}, Username: {username}")
        
        if not email:
            logger.error(f"No email in user info. Available fields: {list(user_info.keys())}")
            raise HTTPException(status_code=400, detail="Email required from OIDC provider")

        # Find or create user
        user = db.query(User).filter(User.email == email).first()

        if not user:
            if not username:
                username = email.split("@")[0]
            
            role = "admin" if db.query(User).count() == 0 else "user"
            user = User(username=username, email=email, role=role, auth_type="oidc")
            db.add(user)
            db.commit()
            db.refresh(user)
            logger.info(f"Created new OIDC user: {user.email}")
        else:
            logger.info(f"Found existing OIDC user: {user.email}")

        # Store IdP access and refresh tokens securely in Redis
        idp_token_data = {}
        if 'access_token' in token:
            idp_token_data["access_token"] = token["access_token"]
        if 'refresh_token' in token:
            idp_token_data["refresh_token"] = token["refresh_token"]

        if idp_token_data:
            redis_key = f"idp:tokens:{user.email}"
            redis_client.hset(redis_key, mapping=idp_token_data)
            redis_client.expire(redis_key, token.get("expires_in", 3600))  # Default 1hr if not present
            logger.debug(f"Stored IDP tokens in Redis for {user.email}")

        # Create our own app tokens
        access_token_jwt = create_access_token({"sub": user.email}, expires_delta=timedelta(minutes=30))
        refresh_token_jwt = create_refresh_token({"sub": user.email})

        redis_client.setex(f"refresh:{user.email}", 86400, refresh_token_jwt)

        # Return cookies
        response = RedirectResponse(url="/", status_code=302)
        response.set_cookie(
            key="access_token", 
            value=access_token_jwt, 
            httponly=True, 
            secure=True, 
            samesite="Strict", 
            max_age=1800, 
            path="/"
        )
        response.set_cookie(
            key="refresh_token", 
            value=refresh_token_jwt, 
            httponly=True, 
            secure=True, 
            samesite="Strict", 
            max_age=86400, 
            path="/"
        )

        logger.info(f"OIDC login successful for {user.email}, redirecting to home")
        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected OIDC callback error: {str(e)}")
        logger.error(f"Request URL: {request.url}")
        import traceback
        logger.error(f"Full traceback: {traceback.format_exc()}")

        return RedirectResponse(url="/login?error=auth_failed", status_code=302)
        
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
        logger.info("No refresh token found in request")
        raise HTTPException(status_code=401, detail="No valid refresh token")

    try:
        payload = decode_token(refresh_token)
        username = payload.get("sub")

        stored_refresh_token = redis_client.get(f"refresh:{username}")

        logger.info(f"Stored refresh token: {stored_refresh_token}")
        logger.info(f"Received refresh token: {refresh_token}")

        if not stored_refresh_token or stored_refresh_token.strip() != refresh_token.strip():
            redis_client.delete(f"refresh:{username}")
            logger.info(f"Invalid refresh token for user {username}")
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
        logger.info(f"Refresh token expired for user {username}")
        raise HTTPException(status_code=401, detail="Refresh token expired, please login again")
    except jwt.PyJWTError as e:
        logger.error(f"JWT Error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid refresh token")