from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, EmailStr, Field


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
    is_outdoor: Optional[bool] = False
    reaches_rain: Optional[bool] = False
    weather_config_id: Optional[int] = None

class PlantUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[List[str]] = []
    is_outdoor: Optional[bool] = None
    reaches_rain: Optional[bool] = None
    weather_config_id: Optional[int] = None

class PlantImageResponse(BaseModel):
    id: int
    image_path: str
    uploaded_at: datetime

    class Config:
        from_attributes = True

class PlantImageCreate(BaseModel):
    uploaded_at: Optional[datetime] = None

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

class PlantFertilizingCreate(BaseModel):
    fertilized_at: Optional[datetime] = None

class PlantFertilizingResponse(BaseModel):
    id: int
    fertilized_at: datetime

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

class PlantCareAdviceCreate(BaseModel):
    pass

class PlantCareAdviceResponse(BaseModel):
    id: int
    advice_text: str
    generated_at: datetime

    class Config:
        from_attributes = True

class PlantNoteCreate(BaseModel):
    note_text: str

class PlantNoteResponse(BaseModel):
    id: int
    note_text: str
    created_at: datetime

    class Config:
        from_attributes = True

class ActivityResponse(BaseModel):
    id: str
    plant_id: int
    plant_name: str
    activity_type: str
    activity_data: dict
    timestamp: str

    class Config:
        from_attributes = True

class PlantResponse(BaseModel):
    id: int
    name: str
    species: Optional[str]
    description: Optional[str] = None
    images: List[PlantImageResponse] = []
    waterings: List[PlantWateringResponse] = []
    fertilizings: List["PlantFertilizingResponse"] = []
    care_advice: List[PlantCareAdviceResponse] = []
    notes: List[PlantNoteResponse] = []
    last_watered: Optional[datetime] = None
    last_fertilized: Optional[datetime] = None
    tags: Optional[List[TagResponse]] = []
    is_archived: Optional[bool] = None
    archive_reason: Optional[str] = None
    is_outdoor: Optional[bool] = False
    reaches_rain: Optional[bool] = False
    weather_config_id: Optional[int] = None

    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class LocationImageResponse(BaseModel):
    id: int
    image_path: str
    uploaded_at: datetime
    exif_latitude: Optional[float] = None
    exif_longitude: Optional[float] = None

    class Config:
        from_attributes = True

class LocationBase(BaseModel):
    name: str
    item_name: Optional[str] = None
    description: Optional[str] = None
    spot_type: Literal["field", "public_spot", "forest", "meadow", "other"] = "other"
    visibility: Literal["private", "shared", "public"] = "private"
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LocationCreate(LocationBase):
    pass

class LocationUpdate(BaseModel):
    name: Optional[str] = None
    item_name: Optional[str] = None
    description: Optional[str] = None
    spot_type: Optional[Literal["field", "public_spot", "forest", "meadow", "other"]] = None
    visibility: Optional[Literal["private", "shared", "public"]] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class LocationResponse(LocationBase):
    id: int
    coordinate_source: Optional[Literal["manual", "photo_exif"]] = None
    created_at: datetime
    updated_at: datetime
    images: List[LocationImageResponse] = []

    class Config:
        from_attributes = True

class ShareLinkCreate(BaseModel):
    alias: str = Field(..., min_length=1, max_length=255)
    expires_in_hours: Optional[int] = None  # None = never expires

class ShareLinkResponse(BaseModel):
    id: int
    token: str
    alias: str
    expires_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WeatherConfigCreate(BaseModel):
    city_name: Optional[str] = None
    latitude: float
    longitude: float
    enabled: Optional[bool] = True
    is_default: Optional[bool] = False

class WeatherConfigUpdate(BaseModel):
    city_name: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    enabled: Optional[bool] = None
    is_default: Optional[bool] = None

class WeatherConfigResponse(BaseModel):
    id: int
    city_name: Optional[str] = None
    latitude: float
    longitude: float
    enabled: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class WeatherLogResponse(BaseModel):
    id: int
    checked_at: datetime
    city_name: Optional[str] = None
    weather_condition: Optional[str] = None
    rainfall_mm: float
    temperature: Optional[float] = None
    auto_watered_count: int

    class Config:
        from_attributes = True


class AutoWateringResponse(BaseModel):
    id: int
    plant_id: int
    plant_name: str
    watered_at: datetime
    city_name: Optional[str] = None
    rainfall_mm: Optional[float] = None


class AutoWateringPaginatedResponse(BaseModel):
    items: List[AutoWateringResponse]
    total: int
    limit: int
    offset: int


class WateringListItemResponse(BaseModel):
    id: int
    plant_id: int
    plant_name: str
    watered_at: datetime
    rainfall_mm: Optional[float] = None
    user_id: Optional[int] = None
    weather_config_name: Optional[str] = None
    tags: List[str] = []


class WateringListPaginatedResponse(BaseModel):
    items: List[WateringListItemResponse]
    total: int
    limit: int
    offset: int


class WateringBulkDeleteRequest(BaseModel):
    ids: List[int] = Field(..., min_length=1, max_length=500)


class WateringBulkDeleteResponse(BaseModel):
    deleted: int


class UserPreferencesResponse(BaseModel):
    preferences: dict


class UserPreferencesUpdate(BaseModel):
    preferences: dict


class WeatherLogPaginatedResponse(BaseModel):
    items: List[WeatherLogResponse]
    total: int
    limit: int
    offset: int


class AppConfigResponse(BaseModel):
    tz: str
    locale: str
    auth_mode: str
    show_protected_view: bool
    enable_locations: bool
    llm_provider: str
    domain: str
    oidc_name: str
    admin_user: Optional[str] = None

PlantResponse.model_rebuild()
