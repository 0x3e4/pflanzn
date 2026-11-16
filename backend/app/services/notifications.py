"""Notifications through an Apprise API server (https://github.com/caronc/apprise-api).

Pflanzn never talks to Telegram, ntfy, Matrix, mail etc. itself: it posts a title and a
body to Apprise, which knows where to send them. Two ways to tell Apprise where:

- APPRISE_KEY: a configuration saved in Apprise under that key (its web UI or API);
  Pflanzn posts to /notify/{key}, optionally limited to APPRISE_TAG.
- APPRISE_URLS: the notification URLs themselves (comma or space separated); Pflanzn
  posts them along with every message to the stateless /notify/ endpoint.

What gets sent (each switchable in Manage → Notifications):

- reminders: a note with a "remind me" time, once it is due;
- the watering digest: once a day at a set time, the plants whose watering schedule
  says they are due (or overdue).
"""
import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Optional
from zoneinfo import ZoneInfo

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Plant, PlantNote, PlantWatering
from app.services import app_settings
from app.utils.time import utcnow

logger = logging.getLogger(__name__)

LOCAL_TZ = ZoneInfo(settings.TZ or "UTC")
TIMEOUT_SECONDS = 15
# A reminder older than this when the loop first sees it (notifications were off, the
# backend was down) is not sent any more: a week-old "repot the fern" is noise.
REMINDER_GRACE = timedelta(days=2)
_TIME = re.compile(r"^([01]\d|2[0-3]):[0-5]\d$")


class NotificationError(Exception):
    """Apprise could not be reached or refused the message. The text never contains
    the notification URLs: they carry tokens."""


def configured() -> bool:
    return bool(settings.APPRISE_URL and (settings.APPRISE_KEY or settings.APPRISE_URLS))


def target_summary() -> dict:
    """What the admin page shows: where messages go, without any token."""
    return {
        "configured": configured(),
        "server": settings.APPRISE_URL or None,
        "mode": "key" if settings.APPRISE_KEY else ("urls" if settings.APPRISE_URLS else None),
        "key": settings.APPRISE_KEY or None,
        "tag": settings.APPRISE_TAG or None,
        # The URLs themselves stay secret; their schemes say enough ("tgram, ntfy").
        "services": sorted({u.split("://", 1)[0] for u in _urls() if "://" in u}),
    }


def _urls() -> list[str]:
    return [u for u in re.split(r"[\s,]+", settings.APPRISE_URLS or "") if u]


def send(title: str, body: str, notify_type: str = "info") -> None:
    """Posts one message to Apprise. Raises NotificationError when it didn't go out."""
    if not configured():
        raise NotificationError("Notifications are not set up (APPRISE_URL and APPRISE_KEY or APPRISE_URLS)")
    base = settings.APPRISE_URL.rstrip("/")
    payload: dict = {"title": title, "body": body, "type": notify_type, "format": "text"}
    if settings.APPRISE_KEY:
        url = f"{base}/notify/{requests.utils.quote(settings.APPRISE_KEY, safe='')}"
        if settings.APPRISE_TAG:
            payload["tag"] = settings.APPRISE_TAG
    else:
        url = f"{base}/notify/"
        payload["urls"] = ",".join(_urls())
    try:
        response = requests.post(url, json=payload, timeout=TIMEOUT_SECONDS)
    except requests.RequestException as e:
        raise NotificationError(f"Apprise could not be reached ({type(e).__name__})") from None
    if not response.ok:
        raise NotificationError(f"Apprise answered HTTP {response.status_code}")


def _active():
    """Not archived (the column is nullable on old rows)."""
    return (Plant.is_archived == False) | (Plant.is_archived.is_(None))  # noqa: E712


def _plant_link(plant_id: int) -> str:
    base = settings.public_base_url
    return f"{base}/plant/{plant_id}" if base else ""


def send_due_reminders(db: Session, now: Optional[datetime] = None) -> int:
    """Sends every reminder that is due and not sent yet; returns how many went out."""
    now = now or utcnow()
    due = (
        db.query(PlantNote)
        .join(Plant, Plant.id == PlantNote.plant_id)
        .filter(
            PlantNote.remind_at.isnot(None),
            PlantNote.reminded_at.is_(None),
            PlantNote.remind_at <= now,
            PlantNote.remind_at >= now - REMINDER_GRACE,
            _active(),
        )
        .order_by(PlantNote.remind_at)
        .limit(50)
        .all()
    )
    sent = 0
    for note in due:
        # Claim it first, so a second worker (or the next tick while this one is slow)
        # doesn't send it again.
        claimed = (
            db.query(PlantNote)
            .filter(PlantNote.id == note.id, PlantNote.reminded_at.is_(None))
            .update({PlantNote.reminded_at: now}, synchronize_session=False)
        )
        db.commit()
        if not claimed:
            continue
        link = _plant_link(note.plant_id)
        body = note.note_text.strip() + (f"\n\n{link}" if link else "")
        try:
            send(f"Reminder: {note.plant.name}", body)
            sent += 1
        except NotificationError as e:
            logger.warning(f"Reminder {note.id} not sent: {e}")
            # Try again on the next tick.
            db.query(PlantNote).filter(PlantNote.id == note.id).update(
                {PlantNote.reminded_at: None}, synchronize_session=False
            )
            db.commit()
    return sent


def plants_due_for_water(db: Session) -> list[tuple[Plant, int]]:
    """(plant, days overdue) for every active plant whose schedule says water today or
    earlier, most overdue first. Same rule as the app and the MCP tools."""
    from sqlalchemy import func

    from app.services.mcp_tools import _watering_due

    last_watered = dict(
        db.query(PlantWatering.plant_id, func.max(PlantWatering.watered_at))
        .group_by(PlantWatering.plant_id)
        .all()
    )
    plants = (
        db.query(Plant)
        .filter(_active(), Plant.watering_interval_days.isnot(None))
        .all()
    )
    due = []
    for plant in plants:
        days_until, needs_water = _watering_due(plant.watering_interval_days, last_watered.get(plant.id))
        if needs_water:
            due.append((plant, -(days_until or 0)))
    due.sort(key=lambda item: (-item[1], item[0].name.lower()))
    return due


def watering_digest_text(due: list[tuple[Plant, int]]) -> tuple[str, str]:
    count = len(due)
    title = f"{count} plant{'s' if count != 1 else ''} need{'s' if count == 1 else ''} water"
    lines = []
    for plant, overdue in due:
        when = "today" if overdue <= 0 else f"{overdue} day{'s' if overdue != 1 else ''} overdue"
        lines.append(f"• {plant.name} ({when})")
    base = settings.public_base_url
    if base:
        lines.append(f"\n{base}/plants?needs_water=1")
    return title, "\n".join(lines)


def _digest_due_now(db: Session, now_local: datetime) -> bool:
    if not app_settings.get_setting(db, "notify_watering"):
        return False
    at = app_settings.get_setting(db, "notify_watering_time")
    if not _TIME.match(at or ""):
        at = "08:00"
    hour, minute = (int(x) for x in at.split(":"))
    return (now_local.hour, now_local.minute) >= (hour, minute)


def send_watering_digest(db: Session, now: Optional[datetime] = None) -> bool:
    """Once a day after the set time: the plants that need water. True when sent."""
    from app.core.security import redis_client

    now_local = (now or datetime.now(timezone.utc)).astimezone(LOCAL_TZ)
    if not _digest_due_now(db, now_local):
        return False
    # One digest per local day, also with several workers: whoever sets the key sends.
    key = f"pflanzn:notify:watering:{now_local.date().isoformat()}"
    try:
        if not redis_client.set(key, "1", nx=True, ex=3 * 24 * 3600):
            return False
    except Exception as e:  # Redis down: skip rather than send every minute
        logger.warning(f"Watering digest skipped, Redis unavailable ({type(e).__name__})")
        return False
    due = plants_due_for_water(db)
    if not due:
        return False
    title, body = watering_digest_text(due)
    try:
        send(title, body)
        return True
    except NotificationError as e:
        logger.warning(f"Watering digest not sent: {e}")
        try:
            redis_client.delete(key)  # try again on the next tick
        except Exception:
            pass
        return False


def run_once(db: Session) -> None:
    """One tick of the notification loop."""
    if not configured():
        return
    if app_settings.get_setting(db, "notify_reminders"):
        send_due_reminders(db)
    send_watering_digest(db)
