"""Reminders still to come across all plants, for the home page."""
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.services import reminders as reminder_service

router = APIRouter()


@router.get("")
def list_reminders(
    db: Session = Depends(get_db),
    days: int = Query(14, ge=1, le=90, description="How many days ahead"),
    plant_id: Optional[int] = Query(None),
):
    """Reminders of active plants from the start of today until `days` ahead, soonest first.
    `sent` says whether the notification already went out."""
    notes = reminder_service.upcoming(db, days_ahead=days, plant_id=plant_id)
    return {
        "days": days,
        "reminders": [
            {
                "id": note.id,
                "plant_id": note.plant_id,
                "plant": note.plant.name if note.plant else None,
                "text": note.note_text,
                "remind_at": reminder_service.utc_iso(note.remind_at),
                "sent": note.reminded_at is not None,
            }
            for note in notes
        ],
    }
