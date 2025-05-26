from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Body
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from app.database import get_db
from app.models import Plant, PlantImage, PlantWatering, Tag
import shutil
import os
import io
import requests
import uuid
import logging

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
        } if last_watered else None,
    }