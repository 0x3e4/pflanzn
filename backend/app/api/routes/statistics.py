import logging
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import Date, and_, cast
from sqlalchemy.orm import Session
from sqlalchemy.sql import func

from app.database import get_db
from app.models import Plant, PlantImage, PlantWatering

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

    return {
        "totalPlants": total_plants,
        "archivedPlants": archived_plants,
        "topSpecies": [{"name": s[0], "count": s[1]} for s in top_species],
        "totalWaterings": total_waterings,
        "totalImages": total_images,
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
