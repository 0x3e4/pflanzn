"""Tools the MCP endpoint offers to AI clients.

Each tool is a plain function over the ORM session. Read tools need the
`pflanzn:read` scope, write tools `pflanzn:write`; write tools never delete
anything. Times are returned in the instance timezone (TZ) as ISO 8601.
"""
import base64
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone
from typing import Any, Callable, Optional
from zoneinfo import ZoneInfo

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.core.config import settings
from app.models import (
    Location,
    Plant,
    PlantCareAdvice,
    PlantFertilizing,
    PlantImage,
    PlantNote,
    PlantWatering,
    Tag,
    User,
    WeatherLog,
    plant_tag_association,
)
from app.services import notifications as notification_service
from app.services import reminders as reminder_service
from app.services.mcp_oauth import SCOPE_READ, SCOPE_WRITE
from app.utils.time import utcnow

LOCAL_TZ = ZoneInfo(settings.TZ)
MAX_TEXT = 20000


class ToolError(Exception):
    """Reported back to the model as a tool result with isError=true."""


@dataclass
class ToolContext:
    db: Session
    user: Optional[User]
    scopes: set[str]


@dataclass
class Tool:
    name: str
    title: str
    description: str
    handler: Callable[[ToolContext, dict], Any]
    properties: dict = field(default_factory=dict)
    required: list[str] = field(default_factory=list)
    write: bool = False
    idempotent: bool = False
    available: Callable[[], bool] = lambda: True

    @property
    def scope(self) -> str:
        return SCOPE_WRITE if self.write else SCOPE_READ

    def definition(self) -> dict:
        return {
            "name": self.name,
            "title": self.title,
            "description": self.description,
            "inputSchema": {
                "type": "object",
                "properties": self.properties,
                "required": self.required,
                "additionalProperties": False,
            },
            "annotations": {
                "title": self.title,
                "readOnlyHint": not self.write,
                "destructiveHint": False,
                "idempotentHint": self.idempotent or not self.write,
                "openWorldHint": False,
            },
        }


# ==============================================================================
# Helpers
# ==============================================================================

def _iso(dt: Optional[datetime]) -> Optional[str]:
    """DB datetimes are naive UTC."""
    if not dt:
        return None
    return dt.replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ).isoformat(timespec="minutes")


def _days_since(dt: Optional[datetime]) -> Optional[int]:
    return (utcnow() - dt).days if dt else None


def _watering_due(interval_days: Optional[int], last_watered: Optional[datetime],
                  today: Optional[date] = None) -> tuple[Optional[int], bool]:
    """(days until the next watering is due, needs water now) in local calendar days.

    Plants without an interval are never due. A plant with an interval that was
    never watered is due today.
    """
    if not interval_days:
        return None, False
    if not last_watered:
        return 0, True
    today = today or datetime.now(LOCAL_TZ).date()
    watered_on = last_watered.replace(tzinfo=timezone.utc).astimezone(LOCAL_TZ).date()
    days_until = interval_days - (today - watered_on).days
    return days_until, days_until <= 0


def _plant_url(plant_id: int) -> Optional[str]:
    base = settings.public_base_url
    return f"{base}/plant/{plant_id}" if base else None


def _arg_int(args: dict, name: str, default: Optional[int] = None, *, minimum: int = 1,
             maximum: Optional[int] = None) -> int:
    value = args.get(name, default)
    if isinstance(value, bool) or not isinstance(value, int):
        if value is None:
            raise ToolError(f"'{name}' is required")
        raise ToolError(f"'{name}' must be an integer")
    if value < minimum or (maximum is not None and value > maximum):
        bounds = f"between {minimum} and {maximum}" if maximum is not None else f"at least {minimum}"
        raise ToolError(f"'{name}' must be {bounds}")
    return value


def _arg_str(args: dict, name: str, *, required: bool = False, max_length: int = 255) -> Optional[str]:
    value = args.get(name)
    if value is None:
        if required:
            raise ToolError(f"'{name}' is required")
        return None
    if not isinstance(value, str):
        raise ToolError(f"'{name}' must be a string")
    value = value.strip()
    if required and not value:
        raise ToolError(f"'{name}' must not be empty")
    if len(value) > max_length:
        raise ToolError(f"'{name}' must be at most {max_length} characters")
    return value


def _arg_bool(args: dict, name: str, default: Optional[bool] = None) -> Optional[bool]:
    value = args.get(name, default)
    if value is not None and not isinstance(value, bool):
        raise ToolError(f"'{name}' must be true or false")
    return value


def _arg_interval(args: dict) -> Optional[int]:
    """Optional watering interval in days; null/absent means no schedule."""
    if args.get("watering_interval_days") is None:
        return None
    return _arg_int(args, "watering_interval_days", maximum=365)


def _arg_ids(args: dict, name: str) -> list[int]:
    value = args.get(name)
    if not isinstance(value, list) or not value or len(value) > 200:
        raise ToolError(f"'{name}' must be a list of 1-200 plant ids")
    if not all(isinstance(v, int) and not isinstance(v, bool) for v in value):
        raise ToolError(f"'{name}' must only contain integers")
    return list(dict.fromkeys(value))


def _arg_tags(args: dict, name: str) -> Optional[list[str]]:
    value = args.get(name)
    if value is None:
        return None
    if not isinstance(value, list) or not all(isinstance(v, str) for v in value) or len(value) > 50:
        raise ToolError(f"'{name}' must be a list of up to 50 tag names")
    names = [v.strip()[:255] for v in value if v.strip()]
    return list(dict.fromkeys(names))


def _arg_when(args: dict, name: str) -> datetime:
    """Optional ISO 8601 timestamp -> naive UTC. Times without an offset are read in TZ."""
    raw = args.get(name)
    if raw is None:
        return utcnow()
    if not isinstance(raw, str):
        raise ToolError(f"'{name}' must be an ISO 8601 date or datetime")
    try:
        parsed = datetime.fromisoformat(raw.strip().replace("Z", "+00:00"))
    except ValueError:
        raise ToolError(f"'{name}' must be an ISO 8601 date or datetime, e.g. 2026-05-01T08:30")
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=LOCAL_TZ)
    as_utc = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    if as_utc > utcnow() + timedelta(minutes=5):
        raise ToolError(f"'{name}' cannot be in the future")
    return as_utc


# A reminder given as a date only is sent at this local time.
REMINDER_DEFAULT_HOUR = 9


def _arg_remind_at(args: dict) -> Optional[datetime]:
    """Optional reminder time (ISO 8601) -> naive UTC; a date alone means 09:00 in TZ."""
    raw = args.get("remind_at")
    if raw is None or raw == "":
        return None
    if not isinstance(raw, str):
        raise ToolError("'remind_at' must be an ISO 8601 date or datetime")
    text = raw.strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise ToolError("'remind_at' must be an ISO 8601 date or datetime, e.g. 2026-05-01 or 2026-05-01T18:00")
    if len(text) == 10:
        parsed = parsed.replace(hour=REMINDER_DEFAULT_HOUR)
    if parsed.tzinfo is None:
        parsed = parsed.replace(tzinfo=LOCAL_TZ)
    as_utc = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    if as_utc < utcnow() - timedelta(minutes=5):
        raise ToolError("'remind_at' must not be in the past")
    return as_utc


def _get_plant(db: Session, plant_id: int) -> Plant:
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise ToolError(f"Plant {plant_id} not found. Use list_plants to look up ids.")
    return plant


def _get_plants(db: Session, plant_ids: list[int]) -> list[Plant]:
    plants = db.query(Plant).filter(Plant.id.in_(plant_ids)).all()
    missing = sorted(set(plant_ids) - {p.id for p in plants})
    if missing:
        raise ToolError(f"Unknown plant ids: {missing}. Nothing was changed.")
    return plants


def _resolve_tags(db: Session, names: list[str]) -> list[Tag]:
    tags = []
    for name in names:
        tag = db.query(Tag).filter(Tag.name == name).first()
        if not tag:
            tag = Tag(name=name)
            db.add(tag)
            db.flush()
        tags.append(tag)
    return tags


def _user_id(ctx: ToolContext) -> Optional[int]:
    return ctx.user.id if ctx.user else None


def _last_dates(db: Session, column, plant_column) -> dict[int, datetime]:
    return dict(db.query(plant_column, func.max(column)).group_by(plant_column).all())


def _floor_plan_names(db: Session) -> dict[int, str]:
    """Plan names for `floor_plan` fields; empty while the feature is switched off."""
    from app.models import FloorPlan
    from app.services import app_settings

    if not app_settings.floor_plans_enabled(db):
        return {}
    return dict(db.query(FloorPlan.id, FloorPlan.name).all())


def _plant_summary(plant: Plant, last_watered: dict, last_fertilized: dict,
                   plan_names: Optional[dict] = None) -> dict:
    watered = last_watered.get(plant.id)
    days_until_due, needs_water = _watering_due(plant.watering_interval_days, watered)
    return {
        "id": plant.id,
        "name": plant.name,
        "species": plant.species,
        "tags": sorted(t.name for t in plant.tags),
        "archived": bool(plant.is_archived),
        "outdoor": bool(plant.is_outdoor),
        "reaches_rain": bool(plant.reaches_rain),
        "last_watered": _iso(watered),
        "days_since_watered": _days_since(watered),
        "watering_interval_days": plant.watering_interval_days,
        "days_until_watering_due": days_until_due,
        "needs_water": needs_water,
        "last_fertilized": _iso(last_fertilized.get(plant.id)),
        **({"floor_plan": plan_names.get(plant.floor_plan_id)} if plan_names else {}),
    }


# ==============================================================================
# Read tools
# ==============================================================================

def list_plants(ctx: ToolContext, args: dict) -> dict:
    query_text = _arg_str(args, "query")
    tag = _arg_str(args, "tag")
    include_archived = _arg_bool(args, "include_archived", False)
    outdoor = _arg_bool(args, "outdoor")
    needs_water = _arg_bool(args, "needs_water")

    q = ctx.db.query(Plant).options(selectinload(Plant.tags))
    if not include_archived:
        q = q.filter(or_(Plant.is_archived == False, Plant.is_archived.is_(None)))
    if query_text:
        pattern = f"%{query_text}%"
        q = q.filter(or_(Plant.name.ilike(pattern), Plant.species.ilike(pattern)))
    if tag:
        q = q.join(Plant.tags).filter(Tag.name == tag)
    if outdoor is not None:
        q = q.filter(Plant.is_outdoor == outdoor)

    plants = q.order_by(Plant.name).all()
    last_watered = _last_dates(ctx.db, PlantWatering.watered_at, PlantWatering.plant_id)
    last_fertilized = _last_dates(ctx.db, PlantFertilizing.fertilized_at, PlantFertilizing.plant_id)
    plan_names = _floor_plan_names(ctx.db)
    summaries = [_plant_summary(p, last_watered, last_fertilized, plan_names) for p in plants]
    if needs_water is not None:
        summaries = [p for p in summaries if p["needs_water"] == needs_water]
    return {
        "count": len(summaries),
        "timezone": settings.TZ,
        "plants": summaries,
    }


def get_plant(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    limit = _arg_int(args, "history_limit", 10, maximum=50)
    db = ctx.db

    waterings = (db.query(PlantWatering).filter(PlantWatering.plant_id == plant.id)
                 .order_by(PlantWatering.watered_at.desc()).limit(limit).all())
    fertilizings = (db.query(PlantFertilizing).filter(PlantFertilizing.plant_id == plant.id)
                    .order_by(PlantFertilizing.fertilized_at.desc()).limit(limit).all())
    notes = (db.query(PlantNote).filter(PlantNote.plant_id == plant.id)
             .order_by(PlantNote.created_at.desc()).limit(limit).all())
    advice = (db.query(PlantCareAdvice).filter(PlantCareAdvice.plant_id == plant.id)
              .order_by(PlantCareAdvice.generated_at.desc()).limit(3).all())
    images = (db.query(PlantImage).filter(PlantImage.plant_id == plant.id)
              .order_by(PlantImage.uploaded_at.desc()).all())

    return {
        "id": plant.id,
        "name": plant.name,
        "species": plant.species,
        "description": plant.description,
        "tags": sorted(t.name for t in plant.tags),
        "archived": bool(plant.is_archived),
        "archive_reason": plant.archive_reason,
        "outdoor": bool(plant.is_outdoor),
        "reaches_rain": bool(plant.reaches_rain),
        "floor_plan": _floor_plan_names(db).get(plant.floor_plan_id),
        "watering_interval_days": plant.watering_interval_days,
        "weather_zone": plant.weather_config.city_name if plant.weather_config else None,
        "url": _plant_url(plant.id),
        "timezone": settings.TZ,
        "recent_waterings": [
            {
                "at": _iso(w.watered_at),
                "source": "auto (rain)" if w.user_id is None and w.rainfall_mm is not None else "manual",
                "rainfall_mm": w.rainfall_mm,
            }
            for w in waterings
        ],
        "recent_fertilizings": [_iso(f.fertilized_at) for f in fertilizings],
        "recent_notes": [
            {"id": n.id, "at": _iso(n.created_at), "text": n.note_text, "remind_at": _iso(n.remind_at)}
            for n in notes
        ],
        "upcoming_reminders": [_reminder(n) for n in reminder_service.upcoming(db, 365, plant_id=plant.id)],
        "latest_care_advice": [{"at": _iso(a.generated_at), "text": a.advice_text[:4000]} for a in advice],
        "image_count": len(images),
        "recent_images": [{"image_id": i.id, "uploaded_at": _iso(i.uploaded_at)} for i in images[:10]],
    }


def _image_file(image_path: str, size: str) -> Optional[tuple[str, str]]:
    """(absolute path, mime type) for a stored image, confined to UPLOAD_FOLDER."""
    base_dir = os.path.realpath(settings.UPLOAD_FOLDER)
    base_path = os.path.realpath(os.path.join(base_dir, image_path))
    if os.path.commonpath([base_dir, base_path]) != base_dir:
        return None
    for candidate in (f"{base_path}_{size}.webp", f"{base_path}_original.webp"):
        if os.path.isfile(candidate):
            return candidate, "image/webp"
    if os.path.isfile(base_path):  # legacy single-file upload
        ext = os.path.splitext(base_path)[1].lower()
        mime = {".png": "image/png", ".webp": "image/webp", ".gif": "image/gif"}.get(ext, "image/jpeg")
        return base_path, mime
    return None


def get_plant_photo(ctx: ToolContext, args: dict) -> list[dict]:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    size = args.get("size", "medium")
    if size not in ("thumb", "medium"):
        raise ToolError("'size' must be 'thumb' or 'medium'")

    q = ctx.db.query(PlantImage).filter(PlantImage.plant_id == plant.id)
    if args.get("image_id") is not None:
        q = q.filter(PlantImage.id == _arg_int(args, "image_id"))
    image = q.order_by(PlantImage.uploaded_at.desc()).first()
    if not image:
        raise ToolError(f"{plant.name} has no photo{' with that image_id' if args.get('image_id') else ''}.")

    found = _image_file(image.image_path, size)
    if not found:
        raise ToolError("The image file is missing on the server.")
    path, mime = found
    with open(path, "rb") as fh:
        data = base64.b64encode(fh.read()).decode()
    return [
        {"type": "text", "text": f"Photo of {plant.name} (plant {plant.id}), uploaded {_iso(image.uploaded_at)}."},
        {"type": "image", "data": data, "mimeType": mime},
    ]


def list_tags(ctx: ToolContext, args: dict) -> dict:
    counts = dict(
        ctx.db.query(plant_tag_association.c.tag_id, func.count(plant_tag_association.c.plant_id))
        .join(Plant, Plant.id == plant_tag_association.c.plant_id)
        .filter(or_(Plant.is_archived == False, Plant.is_archived.is_(None)))
        .group_by(plant_tag_association.c.tag_id)
        .all()
    )
    tags = ctx.db.query(Tag).order_by(Tag.name).all()
    return {"tags": [{"id": t.id, "name": t.name, "active_plants": counts.get(t.id, 0)} for t in tags]}


def get_overview(ctx: ToolContext, args: dict) -> dict:
    from app.api.routes.statistics import get_statistics

    stats = get_statistics(ctx.db)
    plants = (ctx.db.query(Plant).options(selectinload(Plant.tags))
              .filter(or_(Plant.is_archived == False, Plant.is_archived.is_(None))).all())
    last_watered = _last_dates(ctx.db, PlantWatering.watered_at, PlantWatering.plant_id)
    last_fertilized = _last_dates(ctx.db, PlantFertilizing.fertilized_at, PlantFertilizing.plant_id)
    longest_dry = sorted(
        plants,
        key=lambda p: last_watered.get(p.id) or datetime.min,
    )[:10]

    due_now = [
        summary for summary in (_plant_summary(p, last_watered, last_fertilized) for p in plants)
        if summary["needs_water"]
    ]
    overview = {
        "active_plants": stats["totalPlants"],
        "needs_water_now": [{"id": p["id"], "name": p["name"]} for p in due_now],
        "reminders_next_7_days": [_reminder(n) for n in reminder_service.upcoming(ctx.db, 7)],
        "notifications_configured": notification_service.configured(),
        "archived_plants": stats["archivedPlants"],
        "total_waterings": stats["totalWaterings"],
        "total_images": stats["totalImages"],
        "top_species": stats["topSpecies"],
        "longest_since_watered": [_plant_summary(p, last_watered, last_fertilized) for p in longest_dry],
        "timezone": settings.TZ,
    }
    if settings.WEATHER_ENABLED:
        log = ctx.db.query(WeatherLog).order_by(WeatherLog.checked_at.desc()).first()
        if log:
            overview["last_weather_check"] = {
                "at": _iso(log.checked_at),
                "location": log.city_name,
                "condition": log.weather_condition,
                "rainfall_mm": log.rainfall_mm,
                "temperature_c": log.temperature,
                "plants_auto_watered": log.auto_watered_count,
            }
    return overview


def get_recent_activity(ctx: ToolContext, args: dict) -> dict:
    days = _arg_int(args, "days", 7, maximum=365)
    plant_id = args.get("plant_id")
    if plant_id is not None:
        plant_id = _get_plant(ctx.db, _arg_int(args, "plant_id")).id
    since = utcnow() - timedelta(days=days)
    names = dict(ctx.db.query(Plant.id, Plant.name).all())

    events = []
    sources = [
        (PlantWatering, PlantWatering.watered_at, "watering",
         lambda r: "auto (rain)" if r.user_id is None and r.rainfall_mm is not None else None),
        (PlantFertilizing, PlantFertilizing.fertilized_at, "fertilizing", lambda r: None),
        (PlantNote, PlantNote.created_at, "note", lambda r: r.note_text[:500]),
        (PlantCareAdvice, PlantCareAdvice.generated_at, "care_advice", lambda r: r.advice_text[:200]),
        (PlantImage, PlantImage.uploaded_at, "photo", lambda r: None),
    ]
    for model, column, kind, detail in sources:
        q = ctx.db.query(model).filter(column >= since)
        if plant_id is not None:
            q = q.filter(model.plant_id == plant_id)
        for row in q.order_by(column.desc()).limit(500).all():
            when = getattr(row, column.key)
            event = {"at_utc": when, "type": kind, "plant_id": row.plant_id, "plant": names.get(row.plant_id)}
            extra = detail(row)
            if extra:
                event["detail"] = extra
            events.append(event)

    events.sort(key=lambda e: e["at_utc"], reverse=True)
    events = events[:300]
    for event in events:
        event["at"] = _iso(event.pop("at_utc"))
    return {"days": days, "timezone": settings.TZ, "count": len(events), "events": events}


def list_locations(ctx: ToolContext, args: dict) -> dict:
    locations = ctx.db.query(Location).order_by(Location.name).all()
    return {
        "locations": [
            {
                "id": loc.id,
                "name": loc.name,
                "item": loc.item_name,
                "spot_type": loc.spot_type,
                "visibility": loc.visibility,
                "latitude": loc.latitude,
                "longitude": loc.longitude,
                "description": (loc.description or "")[:2000] or None,
            }
            for loc in locations
        ]
    }


def _reminder(note: PlantNote) -> dict:
    return {
        "note_id": note.id,
        "plant_id": note.plant_id,
        "plant": note.plant.name if note.plant else None,
        "text": note.note_text,
        "remind_at": _iso(note.remind_at),
        "sent": note.reminded_at is not None,
    }


def list_reminders(ctx: ToolContext, args: dict) -> dict:
    days_ahead = _arg_int(args, "days_ahead", 14, maximum=365)
    days_back = _arg_int(args, "days_back", 0, minimum=0, maximum=365)
    plant_id = None
    if args.get("plant_id") is not None:
        plant_id = _get_plant(ctx.db, _arg_int(args, "plant_id")).id
    notes = reminder_service.upcoming(ctx.db, days_ahead, days_back, plant_id=plant_id)
    return {
        "timezone": settings.TZ,
        "from": _iso(reminder_service.start_of_local_day(days_back)),
        "days_ahead": days_ahead,
        "notifications_configured": notification_service.configured(),
        "count": len(notes),
        "reminders": [_reminder(n) for n in notes],
    }


def get_watering_plan(ctx: ToolContext, args: dict) -> dict:
    """When each scheduled plant is due in the next N days (overdue ones first)."""
    days = _arg_int(args, "days", 7, maximum=60)
    include_rain = _arg_bool(args, "include_rain_watered", True)
    today = datetime.now(LOCAL_TZ).date()
    last_watered = _last_dates(ctx.db, PlantWatering.watered_at, PlantWatering.plant_id)
    plants = (ctx.db.query(Plant)
              .filter(or_(Plant.is_archived == False, Plant.is_archived.is_(None)),  # noqa: E712
                      Plant.watering_interval_days.isnot(None))
              .order_by(Plant.name).all())
    plan = []
    for plant in plants:
        if not include_rain and plant.is_outdoor and plant.reaches_rain:
            continue
        days_until, _ = _watering_due(plant.watering_interval_days, last_watered.get(plant.id), today)
        if days_until is None or days_until > days:
            continue
        plan.append({
            "plant_id": plant.id,
            "plant": plant.name,
            "due_on": (today + timedelta(days=days_until)).isoformat(),
            "days_until_due": days_until,
            "overdue": days_until < 0,
            "watering_interval_days": plant.watering_interval_days,
            "last_watered": _iso(last_watered.get(plant.id)),
            "rain_counts": bool(plant.is_outdoor and plant.reaches_rain),
        })
    plan.sort(key=lambda item: (item["days_until_due"], item["plant"].lower()))
    unscheduled = (ctx.db.query(func.count(Plant.id))
                   .filter(or_(Plant.is_archived == False, Plant.is_archived.is_(None)),  # noqa: E712
                           Plant.watering_interval_days.is_(None)).scalar())
    return {
        "today": today.isoformat(),
        "days": days,
        "timezone": settings.TZ,
        "plan": plan,
        "plants_without_schedule": unscheduled,
    }


def get_species_info(ctx: ToolContext, args: dict) -> dict:
    """What Pl@ntNet and GBIF know about a plant's species."""
    from app.services import plant_reference

    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    if not plant.species or plant.species.strip().lower() == "unknown":
        raise ToolError(f"{plant.name} has no species yet. Set one with update_plant first.")
    reference = plant_reference.lookup(ctx.db, plant.species)
    if not reference:
        return {"plant_id": plant.id, "species": plant.species, "found": False}
    return {
        "plant_id": plant.id,
        "species": plant.species,
        "found": True,
        "scientific_name": reference.name,
        "family": reference.family,
        "genus": reference.genus,
        "common_names": reference.common_names,
        "plantnet_url": reference.url,
        "wikipedia_url": reference.wikipedia_url,
        "facts": reference.facts,
    }


# ==============================================================================
# Write tools
# ==============================================================================

def water_plants(ctx: ToolContext, args: dict) -> dict:
    plants = _get_plants(ctx.db, _arg_ids(args, "plant_ids"))
    when = _arg_when(args, "watered_at")
    for plant in plants:
        ctx.db.add(PlantWatering(plant_id=plant.id, watered_at=when, user_id=_user_id(ctx)))
    ctx.db.commit()
    return {"watered": [{"id": p.id, "name": p.name} for p in plants], "at": _iso(when)}


def fertilize_plants(ctx: ToolContext, args: dict) -> dict:
    plants = _get_plants(ctx.db, _arg_ids(args, "plant_ids"))
    when = _arg_when(args, "fertilized_at")
    for plant in plants:
        ctx.db.add(PlantFertilizing(plant_id=plant.id, fertilized_at=when, user_id=_user_id(ctx)))
    ctx.db.commit()
    return {"fertilized": [{"id": p.id, "name": p.name} for p in plants], "at": _iso(when)}


def add_plant_note(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    note = PlantNote(
        plant_id=plant.id,
        note_text=_arg_str(args, "text", required=True, max_length=MAX_TEXT),
        created_at=utcnow(),
        remind_at=_arg_remind_at(args),
        user_id=_user_id(ctx),
    )
    ctx.db.add(note)
    ctx.db.commit()
    result = {"note_id": note.id, "plant_id": plant.id, "plant": plant.name}
    if note.remind_at:
        result["remind_at"] = _iso(note.remind_at)
    return result


def update_note(ctx: ToolContext, args: dict) -> dict:
    """Change a note's text and/or its reminder; remind_at null turns a reminder back into a note."""
    note_id = _arg_int(args, "note_id")
    note = ctx.db.query(PlantNote).filter(PlantNote.id == note_id).first()
    if not note:
        raise ToolError(f"Note {note_id} not found. list_reminders and get_plant show note ids.")
    changed = []
    if "text" in args:
        note.note_text = _arg_str(args, "text", required=True, max_length=MAX_TEXT)
        changed.append("text")
    if "remind_at" in args:
        remind_at = _arg_remind_at(args)
        if remind_at != note.remind_at:
            note.remind_at = remind_at
            note.reminded_at = None  # a moved reminder is sent again at its new time
        changed.append("remind_at")
    if not changed:
        raise ToolError("Pass text and/or remind_at.")
    ctx.db.commit()
    return {
        "note_id": note.id,
        "plant_id": note.plant_id,
        "updated": changed,
        "remind_at": _iso(note.remind_at),
    }


def add_care_advice(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    advice = PlantCareAdvice(
        plant_id=plant.id,
        advice_text=_arg_str(args, "advice", required=True, max_length=MAX_TEXT),
        generated_at=utcnow(),
        user_id=_user_id(ctx),
    )
    ctx.db.add(advice)
    ctx.db.commit()
    return {"care_advice_id": advice.id, "plant_id": plant.id, "plant": plant.name}


def create_plant(ctx: ToolContext, args: dict) -> dict:
    plant = Plant(
        name=_arg_str(args, "name", required=True),
        species=_arg_str(args, "species") or None,
        description=_arg_str(args, "description", max_length=MAX_TEXT) or None,
        is_outdoor=bool(_arg_bool(args, "outdoor", False)),
        reaches_rain=bool(_arg_bool(args, "reaches_rain", False)),
        watering_interval_days=_arg_interval(args),
    )
    tag_names = _arg_tags(args, "tags")
    if tag_names:
        plant.tags = _resolve_tags(ctx.db, tag_names)
    ctx.db.add(plant)
    ctx.db.commit()
    return {"id": plant.id, "name": plant.name, "url": _plant_url(plant.id)}


def update_plant(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    changed = []
    for key, column, max_length in (("name", "name", 255), ("species", "species", 255),
                                    ("description", "description", MAX_TEXT)):
        if key in args:
            value = _arg_str(args, key, required=(key == "name"), max_length=max_length)
            setattr(plant, column, value if key == "name" else (value or None))
            changed.append(key)
    for key, column in (("outdoor", "is_outdoor"), ("reaches_rain", "reaches_rain")):
        if key in args:
            setattr(plant, column, _arg_bool(args, key))
            changed.append(key)
    if "watering_interval_days" in args:
        plant.watering_interval_days = _arg_interval(args)
        changed.append("watering_interval_days")
    if not changed:
        raise ToolError("Pass at least one field to change.")
    ctx.db.commit()
    return {"id": plant.id, "name": plant.name, "updated": changed}


def set_plant_tags(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    names = _arg_tags(args, "tags")
    if names is None:
        raise ToolError("'tags' is required (use [] to remove all tags)")
    plant.tags = _resolve_tags(ctx.db, names)
    ctx.db.commit()
    return {"id": plant.id, "name": plant.name, "tags": sorted(t.name for t in plant.tags)}


def set_plant_archived(ctx: ToolContext, args: dict) -> dict:
    plant = _get_plant(ctx.db, _arg_int(args, "plant_id"))
    archived = _arg_bool(args, "archived")
    if archived is None:
        raise ToolError("'archived' is required")
    plant.is_archived = archived
    plant.archive_reason = _arg_str(args, "reason", max_length=MAX_TEXT) if archived else None
    ctx.db.commit()
    return {"id": plant.id, "name": plant.name, "archived": archived}


# ==============================================================================
# Registry
# ==============================================================================

_PLANT_ID = {"type": "integer", "description": "Plant id (from list_plants)"}
_WHEN = ("Optional ISO 8601 date/time. Without an offset it is read in the collection's timezone. "
         "Defaults to now.")

TOOLS: list[Tool] = [
    Tool(
        "list_plants", "List plants",
        "List the plants in the collection with tags, outdoor flags, watering schedule (needs_water) and "
        "when each was last watered and fertilized. Archived plants are hidden unless include_archived is true.",
        list_plants,
        properties={
            "query": {"type": "string", "description": "Filter by name or species (substring)"},
            "tag": {"type": "string", "description": "Only plants with this tag"},
            "outdoor": {"type": "boolean", "description": "Only outdoor (true) or indoor (false) plants"},
            "needs_water": {"type": "boolean",
                            "description": "Only plants whose watering schedule says they are due (true) or not "
                                           "due (false). Plants without a schedule are never due."},
            "include_archived": {"type": "boolean", "default": False},
        },
    ),
    Tool(
        "get_plant", "Get plant details",
        "Full details for one plant: description, tags, recent waterings/fertilizings/notes, upcoming "
        "reminders, latest care advice and photo ids.",
        get_plant,
        properties={
            "plant_id": _PLANT_ID,
            "history_limit": {"type": "integer", "minimum": 1, "maximum": 50, "default": 10},
        },
        required=["plant_id"],
    ),
    Tool(
        "get_plant_photo", "Get plant photo",
        "Return a photo of a plant so you can look at it (latest by default, or a specific image_id from "
        "get_plant).",
        get_plant_photo,
        properties={
            "plant_id": _PLANT_ID,
            "image_id": {"type": "integer", "description": "Specific image; defaults to the latest"},
            "size": {"type": "string", "enum": ["thumb", "medium"], "default": "medium"},
        },
        required=["plant_id"],
    ),
    Tool("list_tags", "List tags", "List all tags with the number of active plants using each.", list_tags),
    Tool(
        "get_overview", "Collection overview",
        "Collection statistics, the plants that need water now, reminders of the next 7 days, the plants "
        "that have gone longest without water, and the latest weather check used for automatic rain "
        "watering.",
        get_overview,
    ),
    Tool(
        "get_recent_activity", "Recent activity",
        "Chronological care log (waterings, fertilizings, notes, care advice, photos) for the last N days, "
        "optionally for one plant.",
        get_recent_activity,
        properties={
            "days": {"type": "integer", "minimum": 1, "maximum": 365, "default": 7},
            "plant_id": _PLANT_ID,
        },
    ),
    Tool(
        "list_reminders", "List reminders",
        "Reminders (notes with a remind_at) from the start of today until days_ahead, soonest first, "
        "optionally for one plant; days_back also shows earlier ones. 'sent' says whether the "
        "notification went out.",
        list_reminders,
        properties={
            "days_ahead": {"type": "integer", "minimum": 1, "maximum": 365, "default": 14},
            "days_back": {"type": "integer", "minimum": 0, "maximum": 365, "default": 0},
            "plant_id": _PLANT_ID,
        },
    ),
    Tool(
        "get_watering_plan", "Watering plan",
        "Which plants with a watering schedule are due in the next N days, overdue ones first, with the "
        "date each is due. Plants without a schedule are only counted.",
        get_watering_plan,
        properties={
            "days": {"type": "integer", "minimum": 1, "maximum": 60, "default": 7},
            "include_rain_watered": {"type": "boolean", "default": True,
                                     "description": "false leaves out outdoor plants that rain waters"},
        },
    ),
    Tool(
        "get_species_info", "Species info",
        "What Pl@ntNet and GBIF know about a plant's species: scientific name, family, genus, common "
        "names, traits and pests (facts), and links to Pl@ntNet and Wikipedia.",
        get_species_info,
        properties={"plant_id": _PLANT_ID},
        required=["plant_id"],
    ),
    Tool(
        "list_locations", "List garden locations",
        "List garden locations/spots (beds, pots, herb patches) with coordinates and descriptions.",
        list_locations,
        available=lambda: settings.ENABLE_LOCATIONS,
    ),
    Tool(
        "water_plants", "Log watering",
        "Record that one or more plants were watered. All ids must exist or nothing is recorded.",
        water_plants,
        properties={
            "plant_ids": {"type": "array", "items": {"type": "integer"}, "minItems": 1, "maxItems": 200},
            "watered_at": {"type": "string", "description": _WHEN},
        },
        required=["plant_ids"],
        write=True,
    ),
    Tool(
        "fertilize_plants", "Log fertilizing",
        "Record that one or more plants were fertilized. All ids must exist or nothing is recorded.",
        fertilize_plants,
        properties={
            "plant_ids": {"type": "array", "items": {"type": "integer"}, "minItems": 1, "maxItems": 200},
            "fertilized_at": {"type": "string", "description": _WHEN},
        },
        required=["plant_ids"],
        write=True,
    ),
    Tool(
        "add_plant_note", "Add note",
        "Add a note to a plant's timeline (observations, repotting, pests, …). With remind_at the note "
        "is also a reminder: it shows on that day in the plant's calendar and, if the server has "
        "notifications set up, is sent then.",
        add_plant_note,
        properties={
            "plant_id": _PLANT_ID,
            "text": {"type": "string", "maxLength": MAX_TEXT},
            "remind_at": {"type": "string",
                          "description": "Optional ISO 8601 date or datetime in the future; without an "
                                         "offset it is local time, a date alone means 09:00"},
        },
        required=["plant_id", "text"],
        write=True,
    ),
    Tool(
        "update_note", "Update note or reminder",
        "Change a note's text, set or move its reminder, or remove the reminder (remind_at null). Notes are "
        "never deleted. A moved reminder is sent again at its new time.",
        update_note,
        properties={
            "note_id": {"type": "integer", "description": "From list_reminders or get_plant"},
            "text": {"type": "string", "maxLength": MAX_TEXT},
            "remind_at": {"type": ["string", "null"],
                          "description": "ISO 8601 date or datetime in the future; without an offset it is "
                                         "local time, a date alone means 09:00. null removes the reminder "
                                         "(the note stays)."},
        },
        required=["note_id"],
        write=True,
        idempotent=True,
    ),
    Tool(
        "add_care_advice", "Save care advice",
        "Save care advice you wrote for a plant so it appears in the plant's AI care advice history.",
        add_care_advice,
        properties={"plant_id": _PLANT_ID, "advice": {"type": "string", "maxLength": MAX_TEXT}},
        required=["plant_id", "advice"],
        write=True,
    ),
    Tool(
        "create_plant", "Create plant",
        "Add a new plant to the collection. Tags that don't exist yet are created. Photos can only be added "
        "in the Pflanzn app.",
        create_plant,
        properties={
            "name": {"type": "string", "maxLength": 255, "description": "Common or nickname"},
            "species": {"type": "string", "maxLength": 255, "description": "Scientific name"},
            "description": {"type": "string"},
            "outdoor": {"type": "boolean", "default": False},
            "reaches_rain": {"type": "boolean", "default": False,
                             "description": "Outdoor plants only: rain counts as watering"},
            "watering_interval_days": {"type": ["integer", "null"], "minimum": 1, "maximum": 365,
                                       "description": "Water every N days; null for no schedule"},
            "tags": {"type": "array", "items": {"type": "string"}},
        },
        required=["name"],
        write=True,
    ),
    Tool(
        "update_plant", "Update plant",
        "Change a plant's name, species, description, outdoor/rain flags or watering schedule. Only passed "
        "fields change.",
        update_plant,
        properties={
            "plant_id": _PLANT_ID,
            "name": {"type": "string", "maxLength": 255},
            "species": {"type": "string", "maxLength": 255},
            "description": {"type": "string"},
            "outdoor": {"type": "boolean"},
            "reaches_rain": {"type": "boolean"},
            "watering_interval_days": {"type": ["integer", "null"], "minimum": 1, "maximum": 365,
                                       "description": "Water every N days; null for no schedule"},
        },
        required=["plant_id"],
        write=True,
        idempotent=True,
    ),
    Tool(
        "set_plant_tags", "Set plant tags",
        "Replace a plant's tags with the given list. Missing tags are created; [] removes all.",
        set_plant_tags,
        properties={"plant_id": _PLANT_ID, "tags": {"type": "array", "items": {"type": "string"}}},
        required=["plant_id", "tags"],
        write=True,
        idempotent=True,
    ),
    Tool(
        "set_plant_archived", "Archive or restore plant",
        "Archive a plant (e.g. it died or was given away) or restore it. Archived plants keep their history.",
        set_plant_archived,
        properties={
            "plant_id": _PLANT_ID,
            "archived": {"type": "boolean"},
            "reason": {"type": "string", "description": "Why it is being archived"},
        },
        required=["plant_id", "archived"],
        write=True,
        idempotent=True,
    ),
]

_BY_NAME = {tool.name: tool for tool in TOOLS}


def visible_tools(scopes: set[str]) -> list[Tool]:
    return [t for t in TOOLS if t.scope in scopes and t.available()]


def find_tool(name: str, scopes: set[str]) -> Optional[Tool]:
    tool = _BY_NAME.get(name)
    if tool and tool in visible_tools(scopes):
        return tool
    return None
