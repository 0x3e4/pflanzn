"""Reminders: notes with a remind_at. Shared by the home page (/api/reminders) and MCP."""
from datetime import datetime, time, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session, joinedload

from app.core.config import settings
from app.models import Plant, PlantNote
from app.utils.time import utcnow

LOCAL_TZ = ZoneInfo(settings.TZ or "UTC")
MAX_REMINDERS = 200


def start_of_local_day(days_back: int = 0, now: Optional[datetime] = None) -> datetime:
    """Midnight in TZ, `days_back` days ago, as naive UTC (how the columns store time)."""
    local_now = (now or datetime.now(timezone.utc)).astimezone(LOCAL_TZ)
    midnight = datetime.combine(local_now.date() - timedelta(days=days_back), time(), tzinfo=LOCAL_TZ)
    return midnight.astimezone(timezone.utc).replace(tzinfo=None)


def upcoming(
    db: Session,
    days_ahead: int = 14,
    days_back: int = 0,
    plant_id: Optional[int] = None,
    now: Optional[datetime] = None,
) -> list[PlantNote]:
    """Reminders of active plants from the start of today (minus days_back) until
    days_ahead from now, soonest first. Sent ones are included: today's sent reminder
    still belongs on today's list."""
    current = now.astimezone(timezone.utc).replace(tzinfo=None) if now else utcnow()
    q = (
        db.query(PlantNote)
        .options(joinedload(PlantNote.plant))
        .join(Plant, Plant.id == PlantNote.plant_id)
        .filter(
            PlantNote.remind_at.isnot(None),
            PlantNote.remind_at >= start_of_local_day(days_back, now),
            PlantNote.remind_at <= current + timedelta(days=days_ahead),
            (Plant.is_archived == False) | (Plant.is_archived.is_(None)),  # noqa: E712
        )
    )
    if plant_id is not None:
        q = q.filter(PlantNote.plant_id == plant_id)
    return q.order_by(PlantNote.remind_at).limit(MAX_REMINDERS).all()


def utc_iso(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc).isoformat().replace("+00:00", "Z")
