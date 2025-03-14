import os
import redis
from jose import jwt
from passlib.hash import argon2
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from fastapi import Depends, HTTPException, Security, Request
from fastapi.security import OAuth2PasswordBearer
from app.database import get_db
from app.models import User
from app.schemas import UserCreate
from typing import Optional
from app.core.config import settings

# Environment variables / settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
AUTH_MODE = settings.VITE_AUTH_MODE.lower()  # "no", "local", "oidc"

# Redis client (optional)
REDIS_URL = settings.REDIS_URL
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

# OAuth2 setup for token-based login
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# ==============================================================================
# Password Management
# ==============================================================================

def hash_password(password: str) -> str:
    return argon2.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return argon2.verify(plain_password, hashed_password)

# ==============================================================================
# Token Creation & Validation
# ==============================================================================

def create_access_token(data: dict, expires_delta: timedelta) -> str:
    """Create JWT token and enforce session rotation in Redis."""
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})

    new_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    username = to_encode.get("sub")

    if is_session_management_enabled():
        # Invalidate previous session
        redis_client.delete(f"session:{username}")  
        
        # Store new session
        redis_client.setex(f"session:{username}", int(expires_delta.total_seconds()), new_token)

    return new_token

def create_refresh_token(data: dict) -> str:
    """Creates a long-lived refresh token (e.g., 24 hours)."""
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=1)
    to_encode.update({"exp": expire})

    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """Decodes a JWT token and returns the payload."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def validate_session(username: str, token: str, request: Request):
    """Checks if session is valid and detects token theft."""
    if is_session_management_enabled():
        stored_token = redis_client.get(f"session:{username}")
        if not stored_token or stored_token != token:
            redis_client.delete(f"session:{username}")
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Optional: Compare User-Agent/IP for anomaly detection
        user_agent = request.headers.get("User-Agent", "unknown")
        client_ip = request.client.host

        session_fingerprint = redis_client.get(f"session_fingerprint:{username}")
        expected_fingerprint = f"{client_ip}|{user_agent}"

        if session_fingerprint and session_fingerprint != expected_fingerprint:
            redis_client.delete(f"session:{username}")  # Kill session
            raise HTTPException(status_code=401, detail="Session anomaly detected")
            logger.warning(f"Session anomaly detected for {username}")

        # Store fingerprint
        redis_client.setex(f"session_fingerprint:{username}", 1800, expected_fingerprint)

# ==============================================================================
# Current User Helpers
# ==============================================================================

def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    """Retrieves the currently authenticated user from Secure Cookie."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_token(token)
    username = payload.get("sub")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")

    return user

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Ensures the current user is an admin."""
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

# ==============================================================================
# Admin User Bootstrap (for `local` mode)
# ==============================================================================

def create_admin_user():
    """Creates a default admin user if none exists (for local mode only)."""
    if AUTH_MODE != "local":
        return

    db = next(get_db())
    try:
        admin_user = db.query(User).filter(User.role == "admin").first()
        if not admin_user:
            new_admin = User(
                username=settings.ADMIN_USER,
                email=settings.ADMIN_EMAIL,
                password=hash_password(settings.ADMIN_PASSWORD),
                role="admin"
            )
            db.add(new_admin)
            db.commit()
            db.refresh(new_admin)
    finally:
        db.close()

# ==============================================================================
# Utility Helpers
# ==============================================================================

def is_session_management_enabled() -> bool:
    """Determines if session management (via Redis) is enabled."""
    return bool(REDIS_URL and AUTH_MODE in ["local", "oidc"])