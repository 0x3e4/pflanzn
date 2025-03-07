import os
import logging
from fastapi import APIRouter, Depends, HTTPException, Request
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


from app.schemas import LoginRequest  # Add import

@router.post("/login", response_model=Token)
def login(user_data: LoginRequest, db: Session = Depends(get_db)):
    """Handles user authentication based on the selected AUTH_MODE."""
    logger.info(f"Login attempt for user: '{user_data.username}' in AUTH_MODE='{AUTH_MODE}'")

    if AUTH_MODE == "no":
        logger.warning(f"Login rejected for '{user_data.username}' because AUTH_MODE=no")
        raise HTTPException(status_code=403, detail="Authentication is disabled.")

    elif AUTH_MODE == "local":
        user = db.query(User).filter(User.username == user_data.username).first()
        if not user:
            logger.warning(f"Login failed: user '{user_data.username}' not found")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        logger.info(f"User '{user.username}' found. Verifying password...")
        if not verify_password(user_data.password, user.password):
            logger.warning(f"Login failed: incorrect password for user '{user.username}'")
            raise HTTPException(status_code=401, detail="Invalid credentials")

        access_token = create_access_token({"sub": user.username}, expires_delta=timedelta(minutes=30))
        logger.info(f"Login successful for '{user.username}'")
        return {"access_token": access_token, "token_type": "bearer"}

    elif AUTH_MODE == "oidc":
        logger.warning(f"Login attempt rejected for '{user_data.username}' because AUTH_MODE=oidc (wrong endpoint)")
        raise HTTPException(status_code=400, detail="Use the /auth/oidc-login endpoint for OIDC authentication.")

    else:
        logger.error(f"Invalid AUTH_MODE configured: '{AUTH_MODE}'")
        raise HTTPException(status_code=500, detail="Invalid AUTH_MODE configured.")

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
    return current_user

@router.get("/admin/users", response_model=list[UserResponse])
def list_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Admin endpoint to list all users."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can access this.")
    users = db.query(User).all()
    return users