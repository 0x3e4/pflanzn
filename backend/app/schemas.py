from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    role: Optional[str] = "user"

class UserBase(BaseModel):
    username: str
    email: str
    role: str

class UserUpdate(BaseModel):
    username: Optional[str] = None
    email: Optional[str] = None
    role: Optional[str] = None

class UserPasswordUpdate(BaseModel):
    old_password: str = Field(..., min_length=6, description="Current password of the user")
    new_password: str = Field(..., min_length=8, description="New password with at least 8 characters")

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str

    class Config:
        from_attributes = True

class LoginRequest(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class LocationCreate(BaseModel):
    name: str

class LocationResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class PlantCreate(BaseModel):
    name: str
    species: Optional[str] = None
    location_id: Optional[int] = None
    description: Optional[str] = None

class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    location_id: Optional[int] = None
    description: Optional[str] = None

class PlantImageResponse(BaseModel):
    id: int
    image_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class PlantResponse(BaseModel):
    id: int
    name: str
    species: Optional[str]
    description: Optional[str] = None
    location_id: Optional[int]
    images: List[PlantImageResponse] = []
    waterings: List["PlantWateringResponse"] = []
    last_watered: Optional[datetime] = None

    class Config:
        from_attributes = True

class IdentifyRequest(BaseModel):
    image_path: str

class PlantWateringCreate(BaseModel):
    watered_at: Optional[datetime] = None

class PlantWateringResponse(BaseModel):
    id: int
    watered_at: datetime

    class Config:
        from_attributes = True