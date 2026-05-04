import json
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import get_current_admin_user, get_current_user, hash_password, verify_password
from app.database import get_db
from app.models import User
from app.schemas import (
    UserCreate,
    UserPasswordUpdate,
    UserPreferencesResponse,
    UserPreferencesUpdate,
    UserResponse,
    UserUpdate,
)

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/profile", response_model=Optional[UserResponse])
def get_user_profile(current_user: Optional[User] = Depends(get_current_user)):
    """Returns the authenticated user's profile."""
    if not current_user:
        return None

    return UserResponse(
        id=current_user.id,
        username=current_user.username,
        email=current_user.email,
        role=current_user.role
    )


def _load_user_preferences(user: User) -> dict:
    if not user.preferences:
        return {}
    try:
        parsed = json.loads(user.preferences)
        return parsed if isinstance(parsed, dict) else {}
    except (json.JSONDecodeError, TypeError):
        return {}


@router.get("/me/preferences", response_model=UserPreferencesResponse)
def get_my_preferences(current_user: Optional[User] = Depends(get_current_user)):
    """Returns the current user's UI preferences as a JSON object."""
    if not current_user:
        # AUTH_MODE=no — frontend should fall back to localStorage; return empty.
        return UserPreferencesResponse(preferences={})
    return UserPreferencesResponse(preferences=_load_user_preferences(current_user))


@router.put("/me/preferences", response_model=UserPreferencesResponse)
def update_my_preferences(
    payload: UserPreferencesUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Merge-update the current user's UI preferences."""
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    merged = {**_load_user_preferences(current_user), **payload.preferences}
    current_user.preferences = json.dumps(merged)
    db.commit()
    db.refresh(current_user)
    return UserPreferencesResponse(preferences=merged)


@router.get("/", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    """Fetch all users - Requires admin authentication."""
    return db.query(User).all()

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Fetch user details - Requires authentication."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return user

@router.post("/", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """Create a new user with a securely hashed password."""
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    hashed_password = hash_password(user_data.password)

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        password=hashed_password,
        role=user_data.role
    )

    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    user_data: UserUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allow users to update their own profile, but only admins can update others."""

    # Fetch the user to be updated
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Authorization check: Allow self-update or admin update
    if current_user.id != user_id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Not authorized to update this user")

    # Prevent demoting the last admin
    update_fields = user_data.dict(exclude_unset=True)
    if update_fields.get("role") and update_fields["role"] != "admin" and user.role == "admin":
        admin_count = db.query(User).filter(User.role == "admin").count()
        if admin_count <= 1:
            raise HTTPException(status_code=400, detail="Cannot demote the last admin user")

    # Update only provided fields
    for key, value in update_fields.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

@router.put("/{user_id}/changepassword")
def update_password(
    user_id: int,
    password_data: UserPasswordUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Allow users to update their own password after verifying the old password."""

    # Ensure the logged-in user is only updating their own password
    if current_user.id != user_id:
        raise HTTPException(status_code=403, detail="You can only update your own password")

    # Fetch the user
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Verify old password using core/security.py function
    if not verify_password(password_data.old_password, user.password):
        raise HTTPException(status_code=400, detail="Incorrect old password")

    # Hash and update the new password
    user.password = hash_password(password_data.new_password)
    db.commit()

    return {"message": "Password updated successfully"}

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    """Delete a user (Admin-only)."""
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}
