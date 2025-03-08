from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import UserResponse, UserCreate, UserUpdate
from typing import List
from app.core.security import get_current_user, get_current_admin_user

router = APIRouter()

@router.get("/", response_model=List[UserResponse])
def get_all_users(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    """
    Fetch all users - Requires admin authentication.
    """
    return db.query(User).all()

@router.get("/{user_id}", response_model=UserResponse)
def get_user(user_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetch user details - Requires authentication.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if current_user.role != "admin" and current_user.id != user_id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    return user

@router.post("/", response_model=UserResponse)
def create_user(user_data: UserCreate, db: Session = Depends(get_db)):
    """
    Create a new user.
    """
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="User with this email already exists")

    new_user = User(
        username=user_data.username,
        email=user_data.email,
        role=user_data.role
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.put("/{user_id}", response_model=UserResponse)
def update_user(user_id: int, user_data: UserUpdate, db: Session = Depends(get_db)):
    """
    Update user details (username, email, role).
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_fields = user_data.dict(exclude_unset=True)
    for key, value in update_fields.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return user

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db)):
    """
    Delete a user by ID.
    """
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}