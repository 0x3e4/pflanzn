import os
import jwt
import redis
from passlib.context import CryptContext
from passlib.hash import argon2
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserCreate
from fastapi import Depends, HTTPException, Security
from fastapi.security import OAuth2PasswordBearer

SECRET_KEY = os.getenv("SECRET_KEY", "your_secret_key")
ALGORITHM = "HS256"
REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

# Initialize Redis client
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

def hash_password(password: str) -> str:
    return argon2.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return argon2.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: timedelta):
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    redis_client.setex(f"session:{to_encode['sub']}", expires_delta, token)  # Store token in Redis
    return token

def get_current_user(token: str = Security(oauth2_scheme), db: Session = Depends(get_db)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        stored_token = redis_client.get(f"session:{username}")
        if not stored_token or stored_token != token:
            raise HTTPException(status_code=401, detail="Invalid or expired session")
        user = db.query(User).filter(User.username == username).first()
        if user is None:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def get_current_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

def create_admin_user():
    db = next(get_db())
    admin_user = db.query(User).filter(User.role == "admin").first()
    if not admin_user:
        new_admin = User(username="admin", email="admin@example.com", password=hash_password("***REDACTED***"), role="admin")
        db.add(new_admin)
        db.commit()
        db.refresh(new_admin)
    db.close()