"""Notification status and a test message (admin-only; open in AUTH_MODE=no).

Where messages go is set in the environment (APPRISE_*); what is sent is set in
Manage → Notifications (app settings notify_*)."""
import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.core.security import require_admin_write
from app.database import get_db
from app.services import app_settings
from app.services import notifications as notification_service

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/status")
def notification_status(db: Session = Depends(get_db), _=Depends(require_admin_write)):
    due = notification_service.plants_due_for_water(db) if notification_service.configured() else []
    return {
        **notification_service.target_summary(),
        "settings": {
            key: app_settings.get_setting(db, key)
            for key in ("notify_reminders", "notify_watering", "notify_watering_time")
        },
        "plants_due_now": len(due),
    }


@router.post("/test")
def send_test_notification(db: Session = Depends(get_db), _=Depends(require_admin_write)):
    """Sends a test message, or the watering digest as it would look right now."""
    if not notification_service.configured():
        raise HTTPException(status_code=400, detail="Notifications are not set up on this server")
    due = notification_service.plants_due_for_water(db)
    if due:
        title, body = notification_service.watering_digest_text(due)
        title = f"Test: {title}"
    else:
        title, body = "Pflanzn test", "Notifications work. No plant needs water right now."
    try:
        notification_service.send(title, body)
    except notification_service.NotificationError as e:
        logger.warning(f"Test notification failed: {e}")
        raise HTTPException(status_code=502, detail=str(e))
    return {"message": "Test notification sent"}
