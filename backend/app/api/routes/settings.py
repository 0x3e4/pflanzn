"""Instance-wide settings managed from Manage (admin-only; open in AUTH_MODE=no)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_admin_write
from app.database import get_db
from app.schemas import AppSettingsResponse, AppSettingsUpdate
from app.services import app_settings

router = APIRouter()


@router.get("", response_model=AppSettingsResponse)
def get_settings(db: Session = Depends(get_db), _=Depends(require_admin_write)):
    return app_settings.get_all(db)


@router.put("", response_model=AppSettingsResponse)
def update_settings(payload: AppSettingsUpdate, db: Session = Depends(get_db), _=Depends(require_admin_write)):
    values = payload.model_dump(exclude_unset=True, exclude_none=True)
    try:
        return app_settings.update(db, values)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
