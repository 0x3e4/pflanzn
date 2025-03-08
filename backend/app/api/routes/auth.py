import os
import time
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from datetime import timedelta
from app.database import get_db
from app.core.security import get_current_user, verify_password, create_access_token
from app.models import User
from app.schemas import UserCreate, UserResponse, Token
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


from app.schemas import LoginRequest

@router.post("/login")
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    """Handles user authentication using Secure Cookies."""
    logger.info(f"Login attempt for user: '{user_data.username}' in AUTH_MODE='{AUTH_MODE}'")

    user = db.query(User).filter(User.username == user_data.username).first()
    if not user or not verify_password(user_data.password, user.password):
        logger.warning(f"Login failed: incorrect credentials for '{user_data.username}'")
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # Create JWT token
    access_token = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))

    # Secure HTTPOnly cookie response
    response = JSONResponse(content={"message": "Login successful"})
    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        secure=True,
        samesite="Strict",
        max_age=1800,
        path="/"
    )
    
    return response

@router.get("/oidc-login")
async def oidc_login(request: Request):
    """Redirects the user to the OIDC provider for authentication."""
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")
    return await oauth.oidc.authorize_redirect(request, OIDC_REDIRECT_URI)

@router.get("/callback")
async def oidc_callback(request: Request):
    """Handles OIDC login callback and generates a JWT token."""
    if AUTH_MODE != "oidc":
        raise HTTPException(status_code=400, detail="OIDC authentication is not enabled.")
    
    token = await oauth.oidc.authorize_access_token(request)
    user_info = token.get("userinfo")

    if not user_info:
        raise HTTPException(status_code=400, detail="Failed to retrieve user information.")

    access_token = create_access_token({"sub": user_info["email"]}, expires_delta=timedelta(minutes=30))
    return {"access_token": access_token, "token_type": "bearer", "user_info": user_info}

@router.get("/profile", response_model=UserResponse)
def get_user_profile(current_user: User = Depends(get_current_user)):
    """Returns the currently authenticated user's profile."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role
    )

@router.get("/admin/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin endpoint to list all users."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this.")
    users = db.query(User).all()
    return users

@router.post("/logout")
def logout():
    """Clears the authentication cookie."""
    response = JSONResponse(content={"message": "Logout successful"})
    response.delete_cookie("access_token")
    return response