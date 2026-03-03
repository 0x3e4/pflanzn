from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, Form
from sqlalchemy.orm import Session
from app.core.config import settings
from app.core.security import get_current_user
from app.database import get_db
from app.models import Plant, PlantImage, PlantWatering, PlantCareAdvice, PlantNote, Tag, PlantIdentification, User
from app.schemas import (
    PlantCreate, PlantResponse, PlantUpdate, PlantImageResponse, 
    PlantWateringCreate, PlantWateringResponse, PlantCareAdviceResponse,
    PlantNoteCreate, PlantNoteResponse, TagResponse, ArchiveRequest, 
    PlantIdentificationResponse, ActivityResponse
)
from typing import List, Optional
import os
import io
import uuid
import logging
import json
from PIL import Image, ImageOps
import pillow_heif
import mimetypes
from app.services.plantnet import identify_species_via_plantnet
from app.services.llm_client import LLMClient
import traceback
from datetime import datetime, timezone
from zoneinfo import ZoneInfo 
from dotenv import load_dotenv

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PLANT_FOLDER = os.path.join(settings.UPLOAD_FOLDER, "plants")
IDENTIFICATION_FOLDER = os.path.join(settings.UPLOAD_FOLDER, "identifications")

os.makedirs(PLANT_FOLDER, exist_ok=True)
os.makedirs(IDENTIFICATION_FOLDER, exist_ok=True)

pillow_heif.register_heif_opener()

load_dotenv()
LOCAL_TZ = os.getenv("VITE_TZ", "UTC") 
tz = ZoneInfo(LOCAL_TZ)

router = APIRouter()

@router.post("/", response_model=PlantResponse)
def create_plant(plant_data: PlantCreate, db: Session = Depends(get_db)):
    new_plant = Plant(
        name=plant_data.name,
        species=plant_data.species if plant_data.species else None
    )
    db.add(new_plant)
    db.commit()
    db.refresh(new_plant)
    return new_plant

@router.get("/", response_model=List[PlantResponse])
def get_all_plants(db: Session = Depends(get_db)):
    plants = db.query(Plant).all()

    for plant in plants:
        if plant.waterings:
            plant.last_watered = max(watering.watered_at for watering in plant.waterings)
            plant.last_watered = plant.last_watered.replace(tzinfo=timezone.utc).astimezone(tz)
        else:
            plant.last_watered = None

    return plants

@router.get("/identifications", response_model=List[PlantIdentificationResponse])
def get_identifications(
    db: Session = Depends(get_db),
    user_id: Optional[int] = Query(None),
    session_id: Optional[str] = Query(None),
    is_primary: Optional[bool] = Query(None),
):
    query = db.query(PlantIdentification)

    if user_id is not None:
        query = query.filter(PlantIdentification.user_id == user_id)
    if session_id is not None:
        query = query.filter(PlantIdentification.session_id == session_id)
    if is_primary is not None:
        query = query.filter(PlantIdentification.is_primary == is_primary)

    results = query.order_by(PlantIdentification.identified_at.desc()).all()

    # Convert JSON string to list for `result_images`
    for r in results:
        if r.result_images:
            try:
                r.result_images = json.loads(r.result_images)
            except:
                r.result_images = []

    return results

@router.delete("/identifications/{identification_id}")
def delete_identification(
    identification_id: int,
    db: Session = Depends(get_db),
):
    target = db.query(PlantIdentification).filter(PlantIdentification.id == identification_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Identification not found")

    session_rows = db.query(PlantIdentification).filter(PlantIdentification.session_id == target.session_id).all()
    if not session_rows:
        raise HTTPException(status_code=404, detail="Identification session not found")

    image_paths = {entry.image_path for entry in session_rows if entry.image_path}
    deleted_count = len(session_rows)

    for entry in session_rows:
        db.delete(entry)

    db.commit()

    for image_path in image_paths:
        normalized_path = image_path.replace("\\", "/")
        if not normalized_path.startswith("identifications/"):
            continue

        has_references = db.query(PlantIdentification.id).filter(PlantIdentification.image_path == image_path).first()
        if has_references:
            continue

        absolute_image_path = os.path.join(settings.UPLOAD_FOLDER, image_path)
        if os.path.exists(absolute_image_path):
            try:
                os.remove(absolute_image_path)
            except OSError as exc:
                logger.warning(f"Failed to remove identification image '{absolute_image_path}': {exc}")

    return {"message": "Identification deleted successfully", "deleted_count": deleted_count}

@router.get("/{plant_id}", response_model=PlantResponse)
def get_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    latest_watering = (
        db.query(PlantWatering)
        .filter(PlantWatering.plant_id == plant_id)
        .order_by(PlantWatering.watered_at.desc())
        .first()
    )

    for image in plant.images:
        image.uploaded_at = image.uploaded_at.replace(tzinfo=timezone.utc).astimezone(tz)

    for watering in plant.waterings:
        watering.watered_at = watering.watered_at.replace(tzinfo=timezone.utc).astimezone(tz)

    for advice in plant.care_advice:
        advice.generated_at = advice.generated_at.replace(tzinfo=timezone.utc).astimezone(tz)

    for note in plant.notes:
        note.created_at = note.created_at.replace(tzinfo=timezone.utc).astimezone(tz)

    if latest_watering and latest_watering.watered_at:
        plant.last_watered = latest_watering.watered_at.replace(tzinfo=timezone.utc).astimezone(tz)
    else:
        plant.last_watered = None

    return plant

@router.put("/{plant_id}", response_model=PlantResponse)
def update_plant(plant_id: int, plant_data: PlantUpdate, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    for key, value in plant_data.dict(exclude_unset=True).items():
        logger.debug(f"Updating {key} to {value} for plant ID {plant_id}")
        setattr(plant, key, value)

    db.commit()
    db.refresh(plant)

    return plant

@router.delete("/{plant_id}")
def delete_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Remove associated images from storage
    for image in plant.images:
        # Remove image file from disk
        absolute_image_path = os.path.join(settings.UPLOAD_FOLDER, image.image_path)
        if os.path.exists(absolute_image_path):
            os.remove(absolute_image_path)

    db.delete(plant)
    db.commit()
    return {"message": "Plant and associated images deleted successfully"}

@router.post("/{plant_id}/upload_image")
def upload_plant_image(
    plant_id: int,
    file: UploadFile = File(...),
    uploaded_at: Optional[str] = Form(None), 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    logger.debug(f"Uploading image for plant ID {plant_id}...")

    new_filename = f"{uuid.uuid4()}.jpg"
    final_file_path = os.path.join(PLANT_FOLDER, new_filename)

    try:
        contents = file.file.read()
        logger.debug(f"Uploaded file size: {len(contents)} bytes")
        file.file.close()

        image_stream = io.BytesIO(contents)
        image_stream.seek(0)

        with Image.open(image_stream) as img:
            logger.debug(f"Opened image: format={img.format}, size={img.size}")
            img = ImageOps.exif_transpose(img)
            img = img.convert("RGB")

            max_width = 900
            if img.width > max_width:
                w_percent = max_width / float(img.width)
                new_height = int(float(img.height) * float(w_percent))
                img = img.resize((max_width, new_height), Image.LANCZOS)

            img.save(final_file_path, format="JPEG", optimize=True, quality=80)

        logger.debug(f"Optimized uploaded image saved for plant {plant_id}.")

        timestamp = None
        if uploaded_at:
            try:
                timestamp = datetime.fromisoformat(uploaded_at)
            except ValueError:
                logger.warning(f"Invalid timestamp format: {uploaded_at}, using current UTC time")
                timestamp = datetime.utcnow()
        else:
            timestamp = datetime.utcnow()

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

    relative_path = f"plants/{new_filename}"
    plant_image = PlantImage(
        plant_id=plant_id, 
        image_path=relative_path,
        uploaded_at=timestamp,
        user_id=(current_user.id if current_user else None),
    )
    db.add(plant_image)
    db.commit()
    db.refresh(plant_image)

    logger.info(f"File successfully saved to {final_file_path}")
    logger.info(f"Image record added to database: {relative_path}")

    return {"message": "Image uploaded successfully", "image_path": relative_path}

@router.get("/{plant_id}/images", response_model=List[PlantImageResponse])
def get_plant_images(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()

    for image in plant.images:
        image.uploaded_at = image.uploaded_at.replace(tzinfo=timezone.utc).astimezone(tz)

    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant.images

@router.post("/{plant_id}/identify")
def identify_species(
    plant_id: int, 
    db: Session = Depends(get_db)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()

    if not plant or not plant.images:
        raise HTTPException(status_code=404, detail="Plant or images not found")

    # Get latest image (sorted by uploaded_at)
    latest_image = sorted(plant.images, key=lambda img: img.uploaded_at, reverse=True)[0]
    image_path = os.path.join(settings.UPLOAD_FOLDER, latest_image.image_path)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    filename = os.path.basename(image_path)
    extension = os.path.splitext(filename)[1].lower()

    # Get MIME type dynamically
    mime_type, _ = mimetypes.guess_type(image_path)

    if not mime_type:
        raise HTTPException(status_code=400, detail="Unsupported image format. Only JPG and PNG allowed.")

    logger.info(f"Identifying plant from image: {filename}")
    logger.info(f"Detected MIME type: {mime_type}")

    # Send request to Pl@ntNet API
    try:
        result = identify_species_via_plantnet(
            image_path=image_path,
            mime_type=mime_type,
            filename=filename
        )

        # Sort results by score in descending order and format as needed
        if "results" in result and len(result["results"]) > 0:
            sorted_results = sorted(result["results"], key=lambda x: x["score"], reverse=True)
            
            # Format the results to return the species and score
            species_data = []
            for res in sorted_results:
                scientific_name = res["species"].get("scientificNameWithoutAuthor", "Unknown")
                common_names = res["species"].get("commonNames", [])
                common_name = common_names[0] if common_names else "Unknown"

                images = [img["url"]["m"] for img in res.get("images", []) if "url" in img and "m" in img["url"]]

                species_data.append({
                    "scientific_name": scientific_name,
                    "common_name": common_name,
                    "score": f"{res['score'] * 100:.2f}",
                    "images": images
                })

            relative_path = latest_image.image_path
            session_id = str(uuid.uuid4())

            for i, species in enumerate(species_data):
                identification = PlantIdentification(
                    session_id=session_id,
                    user_id=None,
                    image_path=relative_path,
                    scientific_name=species["scientific_name"],
                    common_name=species["common_name"],
                    confidence_score=species["score"],
                    result_images=json.dumps(species["images"]),
                    is_primary=(i == 0)
                )
                db.add(identification)

            db.commit()
            
            return {"identified_species": species_data}

    except Exception as e:
        logger.error(f"Error identifying plant: {str(e)}")
        return {
            "identified_species": [],
            "message": f"{str(e)}"
        }

    return {"message": "No species found"}

@router.post("/identify")
async def identify_species_from_image(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Identify a plant species from an uploaded image using the Pl@ntNet API
    without saving it to the database.
    """
    logger.debug("Received request to identify plant from uploaded image.")

    try:
        # Read file content
        contents = await file.read()
        if not contents:
            logger.warning("Uploaded file is empty.")
            raise HTTPException(status_code=400, detail="Uploaded file is empty.")

        logger.debug(f"Uploaded file: {file.filename}, Size: {len(contents)} bytes")

        # Convert file to image
        image_stream = io.BytesIO(contents)
        image_stream.seek(0)

        try:
            with Image.open(image_stream) as img:
                logger.debug(f"Opened image: format={img.format}, size={img.size}")

                # Ensure the image format is valid
                if img.format is None:
                    raise ValueError("Invalid image format. Please upload a valid image.")

                # Correct EXIF orientation and convert to RGB
                img = ImageOps.exif_transpose(img)
                img = img.convert("RGB")

                # Detect file extension and MIME type
                ext = file.filename.split(".")[-1].lower() if file.filename else None
                if ext not in ["jpg", "jpeg", "png"]:
                    raise HTTPException(status_code=400, detail="Unsupported image format. Only JPG and PNG allowed.")
                
                mime_type = mimetypes.types_map.get(f".{ext}", "image/jpeg")  # Default to JPEG

                id_uuid = str(uuid.uuid4())
                filename = f"{id_uuid}.{ext}"
                relative_path = os.path.join("identifications", filename)
                identification_file_path = os.path.join(settings.UPLOAD_FOLDER, relative_path)

                img.save(identification_file_path, format=img.format, optimize=True, quality=80)
                logger.debug(f"Image saved to: {identification_file_path}")

        except Exception as e:
            logger.error(f"Error processing image: {str(e)}")
            raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

        # Send request to Pl@ntNet API
        logger.debug("Sending image to Pl@ntNet for identification...")
        try:
            result = identify_species_via_plantnet(
                image_path=identification_file_path,
                mime_type=mime_type,
                filename=file.filename or "uploaded_image"
            )
            logger.debug("Received response from Pl@ntNet API.")
        except Exception as e:
            logger.error(f"Error contacting Pl@ntNet API: {str(e)}")
            raise HTTPException(status_code=500, detail="Failed to communicate with Pl@ntNet API.")

        # Process and sort results
        if "results" in result and len(result["results"]) > 0:
            sorted_results = sorted(result["results"], key=lambda x: x["score"], reverse=True)
            
            species_data = []
            for res in sorted_results:
                scientific_name = res["species"].get("scientificNameWithoutAuthor", "Unknown")
                common_names = res["species"].get("commonNames", [])
                common_name = common_names[0] if common_names else "Unknown"

                images = [img["url"]["m"] for img in res.get("images", []) if "url" in img and "m" in img["url"]]

                species_data.append({
                    "scientific_name": scientific_name,
                    "common_name": common_name,
                    "score": f"{res['score'] * 100:.2f}",
                    "images": images
                })

            logger.debug(f"Identified {len(species_data)} species from image.")

            session_id = str(id_uuid)

            for i, species in enumerate(species_data):
                identification = PlantIdentification(
                    session_id=session_id,
                    user_id=None,
                    image_path=relative_path,
                    scientific_name=species["scientific_name"],
                    common_name=species["common_name"],
                    confidence_score=species["score"],
                    result_images=json.dumps(species["images"]),
                    is_primary=(i == 0)
                )
                db.add(identification)

            db.commit()

            return {"identified_species": species_data}

        else:
            logger.warning("No species identified from the image.")
            return {"identified_species": [], "message": "No species found"}

    except Exception as e:
        logger.error(f"Error identifying plant: {str(e)}")
        return {
            "identified_species": [],
            "message": f"Error identifying species: {str(e)}"
        }

@router.delete("/{plant_id}/images/{image_id}")
def delete_plant_image(plant_id: int, image_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    image = db.query(PlantImage).filter(PlantImage.id == image_id, PlantImage.plant_id == plant_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found for this plant")

    # Remove image file from disk
    absolute_image_path = os.path.join(settings.UPLOAD_FOLDER, image.image_path)
    if os.path.exists(absolute_image_path):
        os.remove(absolute_image_path)

    db.delete(image)
    db.commit()

    return {"message": "Image deleted successfully"}

@router.post("/{plant_id}/generate_description")
async def generate_species_description_for_plant(
    plant_id: int, 
    db: Session = Depends(get_db),
):
    """
    Generate and save a species description using a llm provider for a given plant.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()

    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    if not plant.species:
        raise HTTPException(status_code=400, detail="Species is required to generate description")

    common_name = plant.name
    species = plant.species

    try:
        llm = LLMClient()
        description = llm.generate_species_description(common_name, species)
        plant.description = description
        db.commit()
        db.refresh(plant)

        return {
            "message": "Description generated and saved successfully.",
            "description": description
        }

    except Exception as e:
        logger.error(f"Failed to generate plant description: {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Failed to generate description: {str(e)}")

@router.post("/{plant_id}/watering", response_model=PlantWateringResponse)
def water_plant(
    plant_id: int,
    watering_data: PlantWateringCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    watering = PlantWatering(
        plant_id=plant_id,
        watered_at=watering_data.watered_at or datetime.utcnow(),
        user_id=(current_user.id if current_user else None),
    )
    db.add(watering)
    db.commit()
    db.refresh(watering)

    return watering

@router.delete("/{plant_id}/watering/{watering_id}", status_code=204)
def delete_watering(
    plant_id: int,
    watering_id: int,
    db: Session = Depends(get_db)
):

    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    watering = db.query(PlantWatering).filter(
        PlantWatering.id == watering_id,
        PlantWatering.plant_id == plant_id
    ).first()

    if not watering:
        raise HTTPException(status_code=404, detail="Watering entry not found")

    db.delete(watering)
    db.commit()

    return {"message": "Watering deleted successfully"}

# Assign tags to a plant
@router.post("/{plant_id}/assign", response_model=PlantResponse)
def assign_tags_to_plant(plant_id: int, tag_names: List[str], db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Fetch existing tags
    existing_tags = db.query(Tag).filter(Tag.name.in_(tag_names)).all()
    existing_tag_names = {tag.name for tag in existing_tags}

    # Add only new tags (avoid duplicates)
    new_tags = [Tag(name=name) for name in tag_names if name not in existing_tag_names]
    if new_tags:
        db.add_all(new_tags)
        db.commit()

    # Get updated list of tags
    all_tags = db.query(Tag).filter(Tag.name.in_(tag_names)).all()

    # Ensure no duplicate tag assignments
    for tag in all_tags:
        if tag not in plant.tags:
            plant.tags.append(tag)

    db.commit()
    db.refresh(plant)

    # Convert to Pydantic model before returning
    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        description=plant.description,
        images=[PlantImageResponse(id=img.id, image_path=img.image_path, uploaded_at=img.uploaded_at) for img in plant.images],
        waterings=[PlantWateringResponse(id=w.id, watered_at=w.watered_at) for w in plant.waterings],
        last_watered=max([w.watered_at for w in plant.waterings], default=None),
        tags=[TagResponse(id=t.id, name=t.name) for t in plant.tags],
        notes=[PlantNoteResponse(id=n.id, note_text=n.note_text, created_at=n.created_at) for n in plant.notes],
    )

# Remove a tag from a plant
@router.delete("/{plant_id}/remove/{tag_id}", response_model=PlantResponse)
def remove_tag_from_plant(plant_id: int, tag_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Remove tag association
    if tag in plant.tags:
        plant.tags.remove(tag)
        db.commit()
        db.refresh(plant)

    # Return updated plant object instead of empty response
    return PlantResponse(
        id=plant.id,
        name=plant.name,
        species=plant.species,
        description=plant.description,
        images=[PlantImageResponse(id=img.id, image_path=img.image_path, uploaded_at=img.uploaded_at) for img in plant.images],
        waterings=[PlantWateringResponse(id=w.id, watered_at=w.watered_at) for w in plant.waterings],
        last_watered=max([w.watered_at for w in plant.waterings], default=None),
        tags=[TagResponse(id=t.id, name=t.name) for t in plant.tags]
    )

# Archive or restore from archive
@router.post("/{plant_id}/archive")
def archive_plant(plant_id: int, data: ArchiveRequest, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    plant.is_archived = data.archive
    plant.archive_reason = data.reason
    db.commit()
    return {"message": f"Plant {'archived' if data.archive else 'restored'} successfully"}

@router.post("/{plant_id}/care_helper")
def get_care_helper(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    try:
        llm = LLMClient()
        advice = llm.care_helper(db, plant_id)
        return {"message": "Care advice generated successfully", "advice": advice}

    except Exception as e:
        logger.error(f"Failed to generate care advice: {e}")
        raise HTTPException(status_code=500, detail=f"Care helper failed: {str(e)}")
    
@router.get("/{plant_id}/activities")
def get_plant_activities(
    plant_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(20, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Get activities for a specific plant.
    Returns a unified list of activities (waterings, care advice, images, notes)
    """
    # Verify plant exists
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    activities = []
    
    # Get waterings for this plant
    waterings = (
        db.query(PlantWatering)
        .filter(PlantWatering.plant_id == plant_id)
        .order_by(PlantWatering.watered_at.desc())
        .all()
    )

    for watering in waterings:
        watering.watered_at = watering.watered_at.replace(tzinfo=timezone.utc).astimezone(tz)
        activities.append({
            "id": f"watering_{watering.id}",
            "plant_id": plant_id,
            "plant_name": plant.name,
            "activity_type": "watering",
            "activity_data": {
                "watering_id": watering.id,
                "user_name": watering.created_by.username if watering.created_by else None,
            },
            "timestamp": watering.watered_at.isoformat()
        })
    
    # Get images for this plant
    images = (
        db.query(PlantImage)
        .filter(PlantImage.plant_id == plant_id)
        .order_by(PlantImage.uploaded_at.desc())
        .all()
    )
    
    for image in images:
        image.uploaded_at = image.uploaded_at.replace(tzinfo=timezone.utc).astimezone(tz)
        activities.append({
            "id": f"image_{image.id}",
            "plant_id": plant_id,
            "plant_name": plant.name,
            "activity_type": "image_upload",
            "activity_data": {
                "image_id": image.id,
                "image_path": image.image_path,
                "user_name": image.uploaded_by.username if image.uploaded_by else None,
            },
            "timestamp": image.uploaded_at.isoformat()
        })
    
    # Get care advice for this plant (if table exists)
    try:
        care_advice = (
            db.query(PlantCareAdvice)
            .filter(PlantCareAdvice.plant_id == plant_id)
            .order_by(PlantCareAdvice.generated_at.desc())
            .all()
        )
        
        for advice in care_advice:
            advice.generated_at = advice.generated_at.replace(tzinfo=timezone.utc).astimezone(tz)
            activities.append({
                "id": f"care_{advice.id}",
                "plant_id": plant_id,
                "plant_name": plant.name,
                "activity_type": "care_advice",
                "activity_data": {
                    "advice_id": advice.id,
                    "advice": advice.advice_text,
                    "user_name": advice.created_by.username if advice.created_by else None,
                },
                "timestamp": advice.generated_at.isoformat()
            })
    except Exception as e:
        # Table might not exist yet, continue without care advice
        logger.warning(f"Could not fetch care advice: {e}")
    
    # Get notes for this plant (if table exists)
    try:
        notes = (
            db.query(PlantNote)
            .filter(PlantNote.plant_id == plant_id)
            .order_by(PlantNote.created_at.desc())
            .all()
        )
        
        for note in notes:
            activities.append({
                "id": f"note_{note.id}",
                "plant_id": plant_id,
                "plant_name": plant.name,
                "activity_type": "note",
                "activity_data": {
                    "note_id": note.id,
                    "note": note.note_text,
                    "user_name": note.created_by.username if note.created_by else None,
                },
                "timestamp": note.created_at.isoformat()
            })
    except Exception as e:
        # Table might not exist yet, continue without notes
        logger.warning(f"Could not fetch notes: {e}")
    
    # Sort all activities by timestamp (newest first)
    activities.sort(key=lambda x: x["timestamp"], reverse=True)
    
    # Apply pagination
    return activities[offset:offset + limit]

@router.post("/{plant_id}/care_advice", response_model=PlantCareAdviceResponse)
def get_care_helper(
    plant_id: int,
    user_message: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Generate and store care advice for a plant using LLM.
    Optional user_message allows adding context like "my plant is losing leaves".
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    try:
        llm = LLMClient()
        logger.info(f"Generating care advice for plant {plant_id}")
        if user_message:
            logger.info(f"User message: {user_message}")
        advice_text = llm.care_helper(db, plant_id, user_message)
        logger.info(f"Generated advice text: {advice_text[:100]}...")
        
        # Store the care advice in the database
        care_advice = PlantCareAdvice(
            plant_id=plant_id,
            advice_text=advice_text,
            generated_at=datetime.utcnow(),
            user_id=(current_user.id if current_user else None),
        )
        
        db.add(care_advice)
        db.commit()
        db.refresh(care_advice)
        
        logger.info(f"Care advice saved with ID: {care_advice.id}")
        
        return care_advice

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate care advice: {e}")
        logger.error(f"Error type: {type(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Care helper failed: {str(e)}")

@router.get("/{plant_id}/care_advice", response_model=List[PlantCareAdviceResponse])
def get_plant_care_advice(
    plant_id: int, 
    db: Session = Depends(get_db),
    limit: int = Query(10, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Get all care advice entries for a specific plant.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    care_advice = (
        db.query(PlantCareAdvice)
        .filter(PlantCareAdvice.plant_id == plant_id)
        .order_by(PlantCareAdvice.generated_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return care_advice

@router.delete("/{plant_id}/care_advice/{advice_id}")
def delete_care_advice(
    plant_id: int,
    advice_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a specific care advice entry.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    care_advice = db.query(PlantCareAdvice).filter(
        PlantCareAdvice.id == advice_id,
        PlantCareAdvice.plant_id == plant_id
    ).first()
    
    if not care_advice:
        raise HTTPException(status_code=404, detail="Care advice not found")
    
    db.delete(care_advice)
    db.commit()
    
    return {"message": "Care advice deleted successfully"}

@router.post("/{plant_id}/notes", response_model=PlantNoteResponse)
def create_plant_note(
    plant_id: int,
    note_data: PlantNoteCreate,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
):
    """
    Create a new note for a plant.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    note = PlantNote(
        plant_id=plant_id,
        note_text=note_data.note_text,
        created_at=datetime.utcnow(),
        user_id=(current_user.id if current_user else None),
    )
    
    db.add(note)
    db.commit()
    db.refresh(note)
    
    return note

@router.get("/{plant_id}/notes", response_model=List[PlantNoteResponse])
def get_plant_notes(
    plant_id: int,
    db: Session = Depends(get_db),
    limit: int = Query(10, le=50),
    offset: int = Query(0, ge=0)
):
    """
    Get all notes for a specific plant.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    notes = (
        db.query(PlantNote)
        .filter(PlantNote.plant_id == plant_id)
        .order_by(PlantNote.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    
    return notes

@router.put("/{plant_id}/notes/{note_id}", response_model=PlantNoteResponse)
def update_plant_note(
    plant_id: int,
    note_id: int,
    note_data: PlantNoteCreate,
    db: Session = Depends(get_db)
):
    """
    Update a specific plant note.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    note = db.query(PlantNote).filter(
        PlantNote.id == note_id,
        PlantNote.plant_id == plant_id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    note.note_text = note_data.note_text
    db.commit()
    db.refresh(note)
    
    return note

@router.delete("/{plant_id}/notes/{note_id}")
def delete_plant_note(
    plant_id: int,
    note_id: int,
    db: Session = Depends(get_db)
):
    """
    Delete a specific plant note.
    """
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    note = db.query(PlantNote).filter(
        PlantNote.id == note_id,
        PlantNote.plant_id == plant_id
    ).first()
    
    if not note:
        raise HTTPException(status_code=404, detail="Note not found")
    
    db.delete(note)
    db.commit()
    
    return {"message": "Note deleted successfully"}
