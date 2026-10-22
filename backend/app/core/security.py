from datetime import datetime, timedelta
from typing import Optional

import redis
from fastapi import Depends, HTTPException, Request
from jose import jwt
from passlib.hash import argon2
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models import User

# Environment variables / settings
SECRET_KEY = settings.SECRET_KEY
ALGORITHM = "HS256"
AUTH_MODE = settings.AUTH_MODE.lower()  # "no", "local", "oidc"
SHOW_PROTECTED_VIEW = settings.SHOW_PROTECTED_VIEW  # False = public read, login to edit

# Redis client
REDIS_URL = settings.REDIS_URL
redis_client = redis.StrictRedis.from_url(REDIS_URL, decode_responses=True)

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
    identifier = to_encode.get("sub")

    if is_session_management_enabled():
        # Invalidate previous session
        redis_client.delete(f"session:{identifier}")

        # Store new session
        redis_client.setex(f"session:{identifier}", int(expires_delta.total_seconds()), new_token)

    return new_token

def create_refresh_token(data: dict, expires_delta: timedelta) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + expires_delta
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> dict:
    """Decodes a JWT token and returns the payload."""
    try:
        return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM], options={"verify_aud": False})
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

def validate_session(identifier: str, token: str, request: Request):
    """Checks if session is valid and detects token theft."""
    if is_session_management_enabled():
        stored_token = redis_client.get(f"session:{identifier}")
        if not stored_token or stored_token != token:
            redis_client.delete(f"session:{identifier}")
            raise HTTPException(status_code=401, detail="Invalid or expired session")

        # Optional: Compare User-Agent/IP for anomaly detection
        user_agent = request.headers.get("User-Agent", "unknown")
        client_ip = request.client.host

        session_fingerprint = redis_client.get(f"session_fingerprint:{identifier}")
        expected_fingerprint = f"{client_ip}|{user_agent}"

        if session_fingerprint and session_fingerprint != expected_fingerprint:
            redis_client.delete(f"session:{identifier}")  # Kill session
            redis_client.delete(f"session_fingerprint:{identifier}")
            raise HTTPException(status_code=401, detail="Session anomaly detected")

        # Store fingerprint
        redis_client.setex(f"session_fingerprint:{identifier}", 1800, expected_fingerprint)

# ==============================================================================
# Current User Helpers
# ==============================================================================

def _is_valid_share_token(share_token: str, db: Session) -> bool:
    """Check if a share token is valid and not expired."""
    from datetime import datetime

    from app.models import ShareLink
    # Only the random token is a credential; the alias is an admin-chosen label
    # ("family", …) and would be trivially guessable.
    link = db.query(ShareLink).filter(ShareLink.token == share_token).first()
    if not link:
        return False
    if link.expires_at and link.expires_at < datetime.utcnow():
        return False
    return True


# Set by /api/share/validate and scoped to /api/uploads: <img> tags can't send the
# X-Share-Token header, so share viewers' image requests carry the token this way.
SHARE_COOKIE = "share_token"


def _get_share_token(request: Request) -> Optional[str]:
    """Reads the share token from the query string, the header, or the image cookie."""
    return (
        request.query_params.get("share_token")
        or request.headers.get("X-Share-Token")
        or request.cookies.get(SHARE_COOKIE)
    )


def find_user_by_subject(db: Session, identifier: str) -> Optional[User]:
    """Token subjects are a username (local) or an email (OIDC). If one string matches
    two accounts — e.g. someone renamed themselves to another user's email — refuse
    rather than guess, so a rename can never resolve to someone else's account."""
    matches = db.query(User).filter(
        (User.username == identifier) | (User.email == identifier)
    ).limit(2).all()
    return matches[0] if len(matches) == 1 else None


def identifier_in_use(db: Session, value: str, exclude_user_id: Optional[int] = None) -> bool:
    """Whether `value` is already some other account's username or email. Usernames and
    emails share one namespace because both act as token subjects."""
    query = db.query(User.id).filter((User.username == value) | (User.email == value))
    if exclude_user_id is not None:
        query = query.filter(User.id != exclude_user_id)
    return query.first() is not None


def _authenticate_from_cookie(request: Request, db: Session) -> User:
    """Resolves the session cookie to a User, or raises 401."""
    token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Missing access token")

    try:
        payload = decode_token(token)
        identifier = payload.get("sub")

        if not identifier:
            raise HTTPException(status_code=401, detail="Invalid token payload")

        # Validate session using Redis before returning the user
        validate_session(identifier, token, request)

        user = find_user_by_subject(db, identifier)

        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        return user

    except HTTPException:
        raise  # Re-raise HTTPExceptions as-is
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")


def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Retrieves the currently authenticated user from Secure Cookie."""

    # Check if auth is disabled
    if AUTH_MODE == "no":
        return None

    # Check for share token (read-only bypass)
    share_token = _get_share_token(request)
    if share_token and _is_valid_share_token(share_token, db):
        return None

    return _authenticate_from_cookie(request, db)


# Who is reading the collection — decides which locations they may see.
AUDIENCE_MEMBER = "member"  # logged in, or AUTH_MODE=no (open, no roles)
AUDIENCE_SHARE = "share"    # holds a valid share link
AUDIENCE_PUBLIC = "public"  # anonymous, allowed only when SHOW_PROTECTED_VIEW=false

LOCATION_VISIBILITY_BY_AUDIENCE = {
    AUDIENCE_MEMBER: ("private", "shared", "public"),
    AUDIENCE_SHARE: ("shared", "public"),
    AUDIENCE_PUBLIC: ("public",),
}


def require_read_access(request: Request, db: Session = Depends(get_db)) -> str:
    """Authorization gate for the collection data (plants, tags, locations, statistics,
    uploads). Returns the reader's audience; anonymous readers get 401 unless
    SHOW_PROTECTED_VIEW=false — the documented "browse publicly, log in to edit" mode.
    """
    if AUTH_MODE == "no":
        return AUDIENCE_MEMBER

    # A real session wins over a share token, as in require_write_access.
    session_error = None
    if request.cookies.get("access_token"):
        try:
            _authenticate_from_cookie(request, db)
            return AUDIENCE_MEMBER
        except HTTPException as exc:
            session_error = exc

    share_token = _get_share_token(request)
    if share_token and _is_valid_share_token(share_token, db):
        return AUDIENCE_SHARE

    if not SHOW_PROTECTED_VIEW:
        return AUDIENCE_PUBLIC

    # Re-raise the session failure so the client can tell an expired session from none.
    raise session_error or HTTPException(status_code=401, detail="Authentication required")


def require_write_access(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Authorization gate for state-changing endpoints.

    Returns the acting user for attribution, or None when AUTH_MODE=no (the app is
    open by design in that mode). Share links are read-only and are rejected here —
    unlike get_current_user, which returns None for them so reads can pass through.
    """
    if AUTH_MODE == "no":
        return None

    # A real session wins over a share token: the frontend attaches X-Share-Token to
    # every request once it is in sessionStorage, so a logged-in user who opened a
    # share link in the same tab must still be able to write.
    if not request.cookies.get("access_token") and _get_share_token(request):
        raise HTTPException(status_code=403, detail="Share links are read-only")

    return _authenticate_from_cookie(request, db)


def get_current_admin_user(current_user: Optional[User] = Depends(get_current_user)) -> User:
    """Ensures the current user is an admin."""
    if current_user is None:
        raise HTTPException(status_code=401, detail="Authentication required")
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
                role="admin",
                auth_type="local"
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
