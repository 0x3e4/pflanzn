import logging
from collections import Counter
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Date, and_, cast
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.core.config import settings
from app.database import get_db
from app.models import Plant, PlantFertilizing, PlantIdentification, PlantImage, PlantNote, PlantWatering
from app.utils.time import utcnow

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

router = APIRouter()

@router.get("/")
def get_statistics(db: Session = Depends(get_db)):
    """
    Fetch general statistics about plants, waterings, images, and archived plants.
    """
    # Count only active (non-archived) plants
    total_plants = db.query(Plant).filter(Plant.is_archived == False).count()

    # Count archived plants
    archived_plants = db.query(Plant).filter(Plant.is_archived == True).count()

    # Get top 5 species among active plants
    top_species = (
        db.query(Plant.species, func.count(Plant.species).label("count"))
        .filter(Plant.is_archived == False)
        .group_by(Plant.species)
        .order_by(func.count(Plant.species).desc())
        .limit(5)
        .all()
    )

    # Count waterings only for active plants
    total_waterings = (
        db.query(PlantWatering)
        .join(Plant, PlantWatering.plant_id == Plant.id)
        .filter(Plant.is_archived == False)
        .count()
    )

    # Last watered plant among active plants
    last_watered = (
        db.query(Plant)
        .join(PlantWatering, Plant.id == PlantWatering.plant_id)
        .filter(Plant.is_archived == False)
        .order_by(PlantWatering.watered_at.desc())
        .first()
    )

    # Total images for active plants
    total_images = (
        db.query(PlantImage)
        .join(Plant, PlantImage.plant_id == Plant.id)
        .filter(Plant.is_archived == False)
        .count()
    )

    # Identified Plants count = every plant (active + archived) plus standalone
    # identifications that were never converted into a plant. Standalone rows are
    # detected by image_path prefix — plant-linked identifications reuse the
    # plant's image (plants/...), standalone ones live under identifications/.
    standalone_identifications = (
        db.query(PlantIdentification)
        .filter(
            PlantIdentification.is_primary == True,
            PlantIdentification.image_path.like("identifications/%"),
        )
        .count()
    )
    identifications_count = total_plants + archived_plants + standalone_identifications

    return {
        "totalPlants": total_plants,
        "archivedPlants": archived_plants,
        "topSpecies": [{"name": s[0], "count": s[1]} for s in top_species],
        "totalWaterings": total_waterings,
        "totalImages": total_images,
        "identificationsCount": identifications_count,
        "totalFertilizings": (
            db.query(PlantFertilizing)
            .join(Plant, PlantFertilizing.plant_id == Plant.id)
            .filter(Plant.is_archived == False)
            .count()
        ),
        "lastWateredPlant": {
            "id": last_watered.id,
            "name": last_watered.name
        } if last_watered else None
    }

@router.get("/daily-waterings")
def get_daily_waterings(days: int = 7, db: Session = Depends(get_db)):
    """
    Fetch daily watering statistics for the specified number of days.
    """
    if days <= 0 or days > 365:
        raise HTTPException(status_code=400, detail="Days must be between 1 and 365")

    daily_waterings = get_daily_waterings_data(db, days)

    return {
        "dailyWaterings": daily_waterings,
        "totalDays": days,
        "dateRange": {
            "start": (datetime.now() - timedelta(days=days-1)).strftime("%Y-%m-%d"),
            "end": datetime.now().strftime("%Y-%m-%d")
        }
    }

def get_daily_waterings_data(db: Session, days: int = 7):
    """
    Helper function to get daily watering counts for the specified number of days.
    Only includes waterings for active (non-archived) plants.
    """
    # Calculate the date range
    end_date = datetime.now().date()
    start_date = end_date - timedelta(days=days-1)

    # Query to get daily watering counts
    daily_counts = (
        db.query(
            cast(PlantWatering.watered_at, Date).label('date'),
            func.count(PlantWatering.id).label('waterings')
        )
        .join(Plant, PlantWatering.plant_id == Plant.id)
        .filter(
            and_(
                Plant.is_archived == False,
                cast(PlantWatering.watered_at, Date) >= start_date,
                cast(PlantWatering.watered_at, Date) <= end_date
            )
        )
        .group_by(cast(PlantWatering.watered_at, Date))
        .order_by(cast(PlantWatering.watered_at, Date))
        .all()
    )

    # Create a dictionary for quick lookup
    watering_dict = {str(row.date): row.waterings for row in daily_counts}

    # Generate complete date range with 0 for days without waterings
    daily_waterings = []
    current_date = start_date

    while current_date <= end_date:
        date_str = current_date.strftime("%Y-%m-%d")
        waterings_count = watering_dict.get(date_str, 0)

        daily_waterings.append({
            "date": date_str,
            "waterings": waterings_count
        })

        current_date += timedelta(days=1)

    return daily_waterings


# ── Activity over time ──────────────────────────────────────────────────────
# One request for the statistics page: a year of care by day, twelve weeks of
# waterings split into manual and rain, the last 30 days against the 30 before,
# and the plants that got the most care lately. Active plants only. Timestamps are
# stored as naive UTC and counted on the calendar day of the configured timezone.

ACTIVITY_DAYS = 365
ACTIVITY_WEEKS = 12
RECENT_DAYS = 30
MOST_CARED_DAYS = 90
MOST_CARED_LIMIT = 5


def _local_tz() -> ZoneInfo:
    try:
        return ZoneInfo(settings.TZ or "UTC")
    except Exception:
        return ZoneInfo("UTC")


def _local_date(stored: datetime, tz: ZoneInfo) -> date:
    return stored.replace(tzinfo=timezone.utc).astimezone(tz).date()


def _since(db: Session, column, plant_column, start_utc: datetime, *extra):
    """(plant_id, timestamp, *extra) rows for active plants since start_utc."""
    return (
        db.query(plant_column, column, *extra)
        .join(Plant, plant_column == Plant.id)
        .filter(Plant.is_archived == False, column >= start_utc)
        .all()
    )


def build_activity(db: Session, now_utc: datetime | None = None) -> dict:
    tz = _local_tz()
    now_utc = now_utc or utcnow()
    today = _local_date(now_utc, tz)
    first_day = today - timedelta(days=ACTIVITY_DAYS - 1)
    # A day of slack on the UTC side, so the first local day is complete.
    start_utc = now_utc - timedelta(days=ACTIVITY_DAYS + 1)

    waterings = _since(db, PlantWatering.watered_at, PlantWatering.plant_id, start_utc, PlantWatering.rainfall_mm)
    fertilizings = _since(db, PlantFertilizing.fertilized_at, PlantFertilizing.plant_id, start_utc)
    photos = _since(db, PlantImage.uploaded_at, PlantImage.plant_id, start_utc)
    notes = _since(db, PlantNote.created_at, PlantNote.plant_id, start_utc)

    def by_day(rows):
        return Counter(_local_date(row[1], tz) for row in rows if row[1] is not None)

    watering_days, fertilizing_days, photo_days = by_day(waterings), by_day(fertilizings), by_day(photos)
    days = []
    for offset in range(ACTIVITY_DAYS):
        day = first_day + timedelta(days=offset)
        days.append({
            "date": day.isoformat(),
            "waterings": watering_days.get(day, 0),
            "fertilizings": fertilizing_days.get(day, 0),
            "photos": photo_days.get(day, 0),
        })

    # Weeks start on Monday; the last one is the current, unfinished week.
    this_monday = today - timedelta(days=today.weekday())
    week_starts = [this_monday - timedelta(weeks=n) for n in range(ACTIVITY_WEEKS - 1, -1, -1)]
    weeks = {start: {"start": start.isoformat(), "manual": 0, "rain": 0} for start in week_starts}
    for _plant_id, watered_at, rainfall_mm in waterings:
        if watered_at is None:
            continue
        day = _local_date(watered_at, tz)
        start = day - timedelta(days=day.weekday())
        if start in weeks:
            # The rain check is the only writer of rainfall_mm.
            weeks[start]["rain" if rainfall_mm is not None else "manual"] += 1

    def recent(counter: Counter) -> dict:
        last = sum(n for day, n in counter.items() if 0 <= (today - day).days < RECENT_DAYS)
        previous = sum(n for day, n in counter.items() if RECENT_DAYS <= (today - day).days < 2 * RECENT_DAYS)
        return {"last30": last, "previous30": previous}

    # Most cared for: what someone did by hand (rain waterings don't count).
    cared = Counter()
    detail: dict[int, Counter] = {}
    for kind, rows in (("waterings", [r for r in waterings if r[2] is None]), ("fertilizings", fertilizings),
                       ("photos", photos), ("notes", notes)):
        for row in rows:
            if row[1] is not None and (today - _local_date(row[1], tz)).days < MOST_CARED_DAYS:
                cared[row[0]] += 1
                detail.setdefault(row[0], Counter())[kind] += 1
    top_ids = [plant_id for plant_id, _ in cared.most_common(MOST_CARED_LIMIT)]
    names = dict(db.query(Plant.id, Plant.name).filter(Plant.id.in_(top_ids)).all()) if top_ids else {}
    most_cared = [
        {
            "id": plant_id,
            "name": names.get(plant_id, f"#{plant_id}"),
            "total": cared[plant_id],
            **{kind: detail[plant_id].get(kind, 0) for kind in ("waterings", "fertilizings", "photos", "notes")},
        }
        for plant_id in top_ids
    ]

    return {
        "timezone": str(tz),
        "today": today.isoformat(),
        "days": days,
        "weeks": [weeks[start] for start in week_starts],
        "recent": {
            "waterings": recent(watering_days),
            "fertilizings": recent(fertilizing_days),
            "photos": recent(photo_days),
        },
        "mostCared": most_cared,
        "mostCaredDays": MOST_CARED_DAYS,
    }


@router.get("/activity")
def get_activity(db: Session = Depends(get_db)):
    """Care activity over time for the statistics page (see build_activity)."""
    return build_activity(db)
