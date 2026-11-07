import io
import logging
import os
import uuid
from datetime import datetime, timezone
from typing import List, Optional

import pillow_heif
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, ImageOps
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.features import require_identification, require_llm
from app.core.security import (
    AUDIENCE_MEMBER,
    LOCATION_VISIBILITY_BY_AUDIENCE,
    require_read_access,
    require_write_access,
)
from app.database import get_db
from app.models import Location, LocationImage, LocationNote, LocationSeasonEvent, LocationTag, User
from app.schemas import (
    LocationCreate,
    LocationImageResponse,
    LocationLocalImport,
    LocationNoteCreate,
    LocationResponse,
    LocationSeasonEventCreate,
    LocationTagsUpdate,
    LocationUpdate,
)
from app.services.llm_client import LLMClient
from app.services.plantnet import identify_species_via_plantnet
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
    if not settings.ENABLE_LOCATIONS:
        raise HTTPException(status_code=404, detail="Locations feature is disabled")


def _visible_locations(db: Session, audience: str):
    """Locations the reader may see: members see all; share-link viewers see shared
    and public; anonymous readers (SHOW_PROTECTED_VIEW=false) see public only."""
    query = db.query(Location)
    if audience != AUDIENCE_MEMBER:
        query = query.filter(Location.visibility.in_(LOCATION_VISIBILITY_BY_AUDIENCE[audience]))
    return query


def _get_visible_location(db: Session, location_id: int, audience: str) -> Location:
    # 404 rather than 403 for hidden locations, so their existence isn't revealed.
    location = _visible_locations(db, audience).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


@router.post("/", response_model=LocationResponse)
def create_location(
    location_data: LocationCreate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
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
    audience: str = Depends(require_read_access),
):
    return _visible_locations(db, audience).order_by(Location.updated_at.desc()).all()


def _tag_name(value: str) -> str:
    return value.strip().lstrip("#").strip()[:64]


def _naive_utc(value: Optional[datetime]) -> datetime:
    if value is None:
        return datetime.now(timezone.utc).replace(tzinfo=None, microsecond=0)
    if value.tzinfo is not None:
        value = value.astimezone(timezone.utc).replace(tzinfo=None)
    return value.replace(microsecond=0)


def _get_location_for_write(db: Session, location_id: int) -> Location:
    location = db.query(Location).filter(Location.id == location_id).first()
    if not location:
        raise HTTPException(status_code=404, detail="Location not found")
    return location


def _add_tags(location: Location, names: List[str]) -> None:
    """Add tags the location doesn't have yet (case-insensitive, like the unique index)."""
    have = {tag.name.lower() for tag in location.tags}
    for raw in names:
        name = _tag_name(raw)
        if name and name.lower() not in have:
            location.tags.append(LocationTag(name=name))
            have.add(name.lower())


@router.get("/tags", response_model=List[str])
def list_location_tags(
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    audience: str = Depends(require_read_access),
):
    """Every tag used on a location the reader can see, for suggestions."""
    visible = _visible_locations(db, audience).with_entities(Location.id)
    rows = (
        db.query(LocationTag.name)
        .filter(LocationTag.location_id.in_(visible))
        .group_by(LocationTag.name)
        .order_by(LocationTag.name)
        .all()
    )
    return [row[0] for row in rows]


@router.delete("/tags/{tag_name}")
def delete_location_tag_everywhere(
    tag_name: str,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    name = _tag_name(tag_name)
    deleted = (
        db.query(LocationTag)
        .filter(func.lower(LocationTag.name) == name.lower())
        .delete(synchronize_session=False)
    )
    db.commit()
    return {"deleted": deleted}


@router.get("/{location_id}", response_model=LocationResponse)
def get_location(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    audience: str = Depends(require_read_access),
):
    return _get_visible_location(db, location_id, audience)


@router.put("/{location_id}", response_model=LocationResponse)
def update_location(
    location_id: int,
    location_data: LocationUpdate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
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
    current_user: Optional[User] = Depends(require_write_access),
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
    current_user: Optional[User] = Depends(require_write_access),
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
    audience: str = Depends(require_read_access),
):
    return _get_visible_location(db, location_id, audience).images


@router.delete("/{location_id}/images/{image_id}")
def delete_location_image(
    location_id: int,
    image_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
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


@router.post("/{location_id}/generate_description", dependencies=[Depends(require_llm)])
def generate_location_description(
    location_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
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


@router.post("/identify", dependencies=[Depends(require_identification)])
async def identify_location_item(
    file: UploadFile = File(...),
    _: None = Depends(ensure_feature_enabled),
    current_user: Optional[User] = Depends(require_write_access),
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

@router.put("/{location_id}/tags", response_model=LocationResponse)
def set_location_tags(
    location_id: int,
    data: LocationTagsUpdate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    """Replace the location's own tags (the ones derived from its type and visibility aren't stored)."""
    location = _get_location_for_write(db, location_id)
    wanted = {_tag_name(name).lower() for name in data.tags} - {""}
    location.tags = [tag for tag in location.tags if tag.name.lower() in wanted]
    _add_tags(location, data.tags)
    db.commit()
    db.refresh(location)
    return location


@router.post("/{location_id}/notes", response_model=LocationResponse)
def add_location_note(
    location_id: int,
    data: LocationNoteCreate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    location = _get_location_for_write(db, location_id)
    location.notes.append(
        LocationNote(
            note_text=data.note_text.strip(),
            created_at=_naive_utc(None),
            user_id=current_user.id if current_user else None,
        )
    )
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}/notes/{note_id}", response_model=LocationResponse)
def delete_location_note(
    location_id: int,
    note_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    location = _get_location_for_write(db, location_id)
    note = next((n for n in location.notes if n.id == note_id), None)
    if not note:
        raise HTTPException(status_code=404, detail="Note not found for this location")
    location.notes.remove(note)
    db.commit()
    db.refresh(location)
    return location


@router.post("/{location_id}/season_events", response_model=LocationResponse)
def add_location_season_event(
    location_id: int,
    data: LocationSeasonEventCreate,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    location = _get_location_for_write(db, location_id)
    location.season_events.append(
        LocationSeasonEvent(
            title=data.title.strip(),
            occurred_at=_naive_utc(data.occurred_at),
            created_at=_naive_utc(None),
            user_id=current_user.id if current_user else None,
        )
    )
    db.commit()
    db.refresh(location)
    return location


@router.delete("/{location_id}/season_events/{event_id}", response_model=LocationResponse)
def delete_location_season_event(
    location_id: int,
    event_id: int,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    location = _get_location_for_write(db, location_id)
    event = next((e for e in location.season_events if e.id == event_id), None)
    if not event:
        raise HTTPException(status_code=404, detail="Season event not found for this location")
    location.season_events.remove(event)
    db.commit()
    db.refresh(location)
    return location


@router.post("/{location_id}/import_local", response_model=LocationResponse)
def import_local_location_data(
    location_id: int,
    data: LocationLocalImport,
    _: None = Depends(ensure_feature_enabled),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(require_write_access),
):
    """Take over tags, notes and harvest times an older version kept in one browser.
    Safe to repeat: entries the location already has are skipped."""
    location = _get_location_for_write(db, location_id)
    user_id = current_user.id if current_user else None

    _add_tags(location, data.tags)

    have_notes = {(n.note_text, n.created_at) for n in location.notes}
    for note in data.notes:
        key = (note.text.strip(), _naive_utc(note.created_at))
        if key[0] and key not in have_notes:
            location.notes.append(LocationNote(note_text=key[0], created_at=key[1], user_id=user_id))
            have_notes.add(key)

    have_events = {(e.title, e.occurred_at) for e in location.season_events}
    for event in data.season_events:
        key = (event.title.strip(), _naive_utc(event.occurred_at))
        if key[0] and key not in have_events:
            location.season_events.append(
                LocationSeasonEvent(
                    title=key[0],
                    occurred_at=key[1],
                    created_at=_naive_utc(event.created_at),
                    user_id=user_id,
                )
            )
            have_events.add(key)

    db.commit()
    db.refresh(location)
    return location
