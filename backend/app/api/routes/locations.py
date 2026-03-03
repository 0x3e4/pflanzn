import io
import logging
import os
import uuid
from typing import List

import pillow_heif
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy.orm import Session

from app.core.config import settings
from app.database import get_db
from app.models import Location, LocationImage
from app.services.llm_client import LLMClient
from app.services.plantnet import identify_species_via_plantnet
from app.schemas import (
    LocationCreate,
    LocationImageResponse,
    LocationResponse,
    LocationUpdate,
)
from app.utils.exif import extract_gps_coordinates

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

router = APIRouter()
LOCATION_FOLDER = os.path.join(settings.UPLOAD_FOLDER, "locations")
IDENTIFICATION_FOLDER = os.path.join(settings.UPLOAD_FOLDER, "identifications")
os.makedirs(LOCATION_FOLDER, exist_ok=True)
os.makedirs(IDENTIFICATION_FOLDER, exist_ok=True)

pillow_heif.register_heif_opener()


def ensure_feature_enabled():
    if not settings.VITE_ENABLE_LOCATIONS:
        raise HTTPException(status_code=404, detail="Locations feature is disabled")


@router.post("/", response_model=LocationResponse)
def create_location(
    location_data: LocationCreate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    coordinate_source = "manual" if location_data.latitude is not None and location_data.longitude is not None else None
    location = Location(
        name=location_data.name,
        item_name=location_data.item_name,
        description=location_data.description,
        spot_type=location_data.spot_type,
        visibility=location_data.visibility,
        latitude=location_data.latitude,
        longitude=location_data.longitude,
        coordinate_source=coordinate_source,
    )
    db.add(location)
    db.commit()
    db.refresh(location)
    return location


@router.get("/", response_model=List[LocationResponse])
def list_locations(
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    return db.query(Location).order_by(Location.updated_at.desc()).all()


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.put("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    location_data: LocationUpdate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    updates = location_data.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(location, key, value)

    if location.latitude is None or location.longitude is None:
        location.coordinate_source = None
    elif location.coordinate_source != "photo_exif":
        location.coordinate_source = "manual"

    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}")
def delete_location(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    for image in location.images:
        absolute_image_path = os.path.join(settings.UPLOAD_FOLDER, image.image_path)
        if os.path.exists(absolute_image_path):
            os.remove(absolute_image_path)

    db.delete(location)
    db.commit()
    return {"message": "Location deleted successfully"}


@router.post("/{location_id}/upload_image")
def upload_location_image(
    location_id: int,
    file: UploadFile = File(...),
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    new_filename = f"{uuid.uuid4()}.jpg"
    relative_path = f"locations/{new_filename}"
    final_file_path = os.path.join(LOCATION_FOLDER, new_filename)

    try:
        contents = file.file.read()
        file.file.close()
        exif_latitude, exif_longitude = extract_gps_coordinates(contents)

        image_stream = io.BytesIO(contents)
        image_stream.seek(0)
        with Image.open(image_stream) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")

            max_width = 1200
            if img.width > max_width:
                ratio = max_width / float(img.width)
                new_height = int(float(img.height) * ratio)
                img = img.resize((max_width, new_height), Image.LANCZOS)

            img.save(final_file_path, format="JPEG", optimize=True, quality=82)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error processing image: {exc}")

    location_image = LocationImage(
        location_id=location.id,
        image_path=relative_path,
        exif_latitude=exif_latitude,
        exif_longitude=exif_longitude,
    )
    db.add(location_image)

    if exif_latitude is not None and exif_longitude is not None and (location.latitude is None or location.longitude is None):
        location.latitude = exif_latitude
        location.longitude = exif_longitude
        location.coordinate_source = "photo_exif"

    db.commit()
    db.refresh(location_image)

    return {
        "message": "Image uploaded successfully",
        "image_path": relative_path,
        "exif_latitude": exif_latitude,
        "exif_longitude": exif_longitude,
    }


@router.get("/{location_id}/images", response_model=List[LocationImageResponse])
def list_location_images(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location.images


@router.delete("/{location_id}/images/{image_id}")
def delete_location_image(
    location_id: int,
    image_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    image = (
        db.query(LocationImage)
        .filter(LocationImage.id == image_id, LocationImage.location_id == location_id)
        .first()
    )
    if not image:
        raise HTTPException(status_code=404, detail="Image not found for this location")

    absolute_image_path = os.path.join(settings.UPLOAD_FOLDER, image.image_path)
    if os.path.exists(absolute_image_path):
        os.remove(absolute_image_path)

    db.delete(image)
    db.commit()

    return {"message": "Image deleted successfully"}


@router.post("/{location_id}/generate_description")
def generate_location_description(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
):
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    try:
        llm = LLMClient()
        description = llm.generate_location_description(
            location_name=location.name,
            item_name=location.item_name or "",
            spot_type=location.spot_type,
            latitude=location.latitude,
            longitude=location.longitude,
            existing_description=location.description,
        )
        location.description = description
        db.commit()
        db.refresh(location)
        return {
            "message": "Location description generated and saved successfully.",
            "description": description,
        }
    except Exception as exc:
        logger.error(f"Failed to generate location description: {exc}")
        raise HTTPException(status_code=500, detail=f"Failed to generate location description: {exc}")


@router.post("/identify")
async def identify_location_item(
    file: UploadFile = File(...),
    _: None = Depends(ensure_feature_enabled),
):
    identification_file_path = ""

    try:
        contents = await file.read()
        if not contents:
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        image_stream = io.BytesIO(contents)
        image_stream.seek(0)

        with Image.open(image_stream) as img:
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")

            identify_filename = f"{uuid.uuid4()}.jpg"
            identification_file_path = os.path.join(IDENTIFICATION_FOLDER, identify_filename)
            img.save(identification_file_path, format="JPEG", optimize=True, quality=82)
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Error processing image: {exc}")

    try:
        result = identify_species_via_plantnet(
            image_path=identification_file_path,
            mime_type="image/jpeg",
            filename=file.filename or "location_upload.jpg",
        )
    except Exception as exc:
        logger.error(f"Error identifying location item via Pl@ntNet: {exc}")
        raise HTTPException(status_code=500, detail="Failed to communicate with Pl@ntNet API.")
    finally:
        if identification_file_path and os.path.exists(identification_file_path):
            os.remove(identification_file_path)

    if "results" in result and len(result["results"]) > 0:
        sorted_results = sorted(result["results"], key=lambda x: x["score"], reverse=True)
        species_data = []

        for res in sorted_results:
            scientific_name = res["species"].get("scientificNameWithoutAuthor", "Unknown")
            common_names = res["species"].get("commonNames", [])
            common_name = common_names[0] if common_names else "Unknown"
            images = [img["url"]["m"] for img in res.get("images", []) if "url" in img and "m" in img["url"]]

            species_data.append(
                {
                    "scientific_name": scientific_name,
                    "common_name": common_name,
                    "score": f"{res['score'] * 100:.2f}",
                    "images": images,
                }
            )

        return {"identified_species": species_data}

    return {"identified_species": [], "message": "No species found"}
