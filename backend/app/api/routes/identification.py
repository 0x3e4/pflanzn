"""How many Pl@ntNet identifications are left today (members and admins see it; the
plant pages warn when it runs low, Manage → Integrations shows it to admins)."""
from fastapi import APIRouter

from app.core.config import settings
from app.services.plantnet import quota_status

router = APIRouter()


@router.get("/quota")
def identification_quota():
    return {"enabled": settings.identification_available, **quota_status()}
