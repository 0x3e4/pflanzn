from pydantic import BaseModel, EmailStr, Field, ConfigDict
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
    old_password: str = Field(..., description="Current password of the user")
    new_password: str = Field(..., description="New password of the user")

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

class TagCreate(BaseModel):
    name: str

class TagResponse(BaseModel):
    id: int
    name: str

    class Config:
        from_attributes = True

class TagListResponse(BaseModel):
    tags: List[TagResponse]

class PlantCreate(BaseModel):
    name: str
    species: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = []

class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = []

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
    images: List[PlantImageResponse] = []
    waterings: List["PlantWateringResponse"] = []
    last_watered: Optional[datetime] = None
    tags: Optional[List[TagResponse]] = []
    is_archived: Optional[bool] = None
    archive_reason: Optional[str] = None

    class Config:
        from_attributes = True

class ArchiveRequest(BaseModel):
    archive: bool
    reason: str

class IdentifyRequest(BaseModel):
    image_path: str

class PlantWateringCreate(BaseModel):
    watered_at: Optional[datetime] = None

class PlantWateringResponse(BaseModel):
    id: int
    watered_at: datetime

    class Config:
        from_attributes = True

class PlantIdentificationCreate(BaseModel):
    scientific_name: str
    common_name: Optional[str] = None
    confidence_score: Optional[str] = None
    image_path: Optional[str] = None
    result_images: Optional[List[str]] = []

class PlantIdentificationResponse(PlantIdentificationCreate):
    id: int
    session_id: str
    user_id: Optional[int]
    image_path: str
    scientific_name: str
    common_name: Optional[str]
    confidence_score: Optional[str]
    result_images: Optional[List[str]]
    identified_at: datetime
    is_primary: bool

    class Config:
        from_attributes = True

PlantResponse.model_rebuild()