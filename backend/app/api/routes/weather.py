import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models import User, WeatherConfig, WeatherLog
from app.schemas import (
    WeatherConfigCreate,
    WeatherConfigResponse,
    WeatherConfigUpdate,
    WeatherLogResponse,
)
from app.services.weather_service import check_and_auto_water, get_current_weather

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/configs", response_model=List[WeatherConfigResponse])
def get_weather_configs(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get all weather configurations."""
    return db.query(WeatherConfig).order_by(WeatherConfig.id).all()


@router.get("/config", response_model=WeatherConfigResponse)
def get_weather_config(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get the first weather configuration (default)."""
    config = db.query(WeatherConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="No weather configuration found.")
    return config


@router.post("/config", response_model=WeatherConfigResponse)
def create_weather_config(
    data: WeatherConfigCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Create a new weather configuration."""
    config = WeatherConfig(
        user_id=current_user.id if current_user else None,
        city_name=data.city_name,
        latitude=data.latitude,
        longitude=data.longitude,
        enabled=data.enabled if data.enabled is not None else True,
    )
    db.add(config)
    db.commit()
    db.refresh(config)
    return config


@router.put("/config/{config_id}", response_model=WeatherConfigResponse)
def update_weather_config(
    config_id: int,
    data: WeatherConfigUpdate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Update a weather configuration by ID."""
    config = db.query(WeatherConfig).filter(WeatherConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Weather configuration not found.")

    if data.city_name is not None:
        config.city_name = data.city_name
    if data.latitude is not None:
        config.latitude = data.latitude
    if data.longitude is not None:
        config.longitude = data.longitude
    if data.enabled is not None:
        config.enabled = data.enabled

    db.commit()
    db.refresh(config)
    return config


@router.delete("/config/{config_id}", status_code=204)
def delete_weather_config(
    config_id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Delete a weather configuration by ID."""
    config = db.query(WeatherConfig).filter(WeatherConfig.id == config_id).first()
    if not config:
        raise HTTPException(status_code=404, detail="Weather configuration not found.")

    db.delete(config)
    db.commit()


@router.get("/current")
def get_current_weather_endpoint(
    config_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get current weather for a configured location."""

    if config_id:
        config = db.query(WeatherConfig).filter(WeatherConfig.id == config_id).first()
    else:
        config = db.query(WeatherConfig).first()

    if not config:
        raise HTTPException(status_code=404, detail="No weather configuration found.")

    try:
        data = get_current_weather(config.latitude, config.longitude)
        weather_main = data.get("weather", [{}])[0].get("main", "Unknown")
        weather_desc = data.get("weather", [{}])[0].get("description", "")
        temp = data.get("main", {}).get("temp")
        humidity = data.get("main", {}).get("humidity")
        rain = data.get("rain", {})
        rainfall = rain.get("1h", rain.get("3h", 0.0))

        return {
            "condition": weather_main,
            "description": weather_desc,
            "temperature": temp,
            "humidity": humidity,
            "rainfall_mm": rainfall,
            "city_name": config.city_name,
        }
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch weather: {str(e)}")


@router.get("/logs", response_model=List[WeatherLogResponse])
def get_weather_logs(
    limit: int = 20,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Get recent weather check logs."""
    logs = (
        db.query(WeatherLog)
        .order_by(WeatherLog.checked_at.desc())
        .limit(limit)
        .all()
    )
    return logs


@router.post("/check")
def trigger_weather_check(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """Manually trigger a weather check and auto-watering."""
    watered_count = check_and_auto_water(db)
    return {"message": f"Weather check complete. {watered_count} plants auto-watered."}
