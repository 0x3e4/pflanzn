from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

class UserCreate(BaseModel):
    username: str
    email: str
    password: str
    role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: str

    class Config:
        from_attributes = True

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