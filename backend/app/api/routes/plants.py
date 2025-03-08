from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session, joinedload
from sqlalchemy.sql import func
from app.database import get_db
from app.models import Plant, PlantImage, PlantWatering
from app.schemas import PlantCreate, PlantResponse, PlantUpdate, PlantImageResponse, IdentifyRequest, PlantWateringCreate, PlantWateringResponse
from typing import List
import shutil
import os
import io
import requests
import uuid
import logging
from PIL import Image, ImageOps
import pillow_heif
from app.services.plantnet import identify_species_via_plantnet
from app.services.llm_client import LLMClient

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
PLANT_FOLDER = os.path.join(UPLOAD_FOLDER, "plants")

os.makedirs(PLANT_FOLDER, exist_ok=True)

pillow_heif.register_heif_opener()

router = APIRouter()

@router.post("/", response_model=PlantResponse)
def create_plant(plant_data: PlantCreate, db: Session = Depends(get_db)):
    new_plant = Plant(
        name=plant_data.name,
        species=plant_data.species if plant_data.species else None,
        location_id=plant_data.location_id if plant_data.location_id else None
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
        else:
            plant.last_watered = None

    return plants

@router.get("/statistics")
def get_statistics(db: Session = Depends(get_db)):
    """
    Fetch general statistics about plants and waterings.
    """
    total_plants = db.query(Plant).count()

    # Get top 5 species
    top_species = (
        db.query(Plant.species, func.count(Plant.species).label("count"))
        .group_by(Plant.species)
        .order_by(func.count(Plant.species).desc())
        .limit(5)
        .all()
    )

    total_waterings = db.query(PlantWatering).count()

    # Get the last watered plant
    last_watered = (
        db.query(Plant)
        .join(PlantWatering, Plant.id == PlantWatering.plant_id)
        .order_by(PlantWatering.watered_at.desc())
        .first()
    )

    return {
        "totalPlants": total_plants,
        "topSpecies": [{"name": s[0], "count": s[1]} for s in top_species],
        "totalWaterings": total_waterings,
        "lastWateredPlant": {"id": last_watered.id, "name": last_watered.name} if last_watered else None,
    }

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

    plant.last_watered = latest_watering.watered_at if latest_watering else None

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
        if os.path.exists(image.image_path):
            os.remove(image.image_path)

    db.delete(plant)
    db.commit()
    return {"message": "Plant and associated images deleted successfully"}

@router.post("/{plant_id}/upload_image")
def upload_plant_image(
    plant_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
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

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error processing image: {str(e)}")

    relative_path = f"plants/{new_filename}"
    plant_image = PlantImage(plant_id=plant_id, image_path=relative_path)
    db.add(plant_image)
    db.commit()
    db.refresh(plant_image)

    logger.info(f"File successfully saved to {final_file_path}")
    logger.info(f"Image record added to database: {relative_path}")

    return {"message": "Image uploaded successfully", "image_path": relative_path}

@router.get("/{plant_id}/images", response_model=List[PlantImageResponse])
def get_plant_images(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant.images

@router.post("/{plant_id}/identify")
def identify_species(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()

    if not plant or not plant.images:
        raise HTTPException(status_code=404, detail="Plant or images not found")

    # Get latest image (sorted by uploaded_at)
    latest_image = sorted(plant.images, key=lambda img: img.uploaded_at, reverse=True)[0]
    image_path = os.path.join(UPLOAD_FOLDER, latest_image.image_path)

    if not os.path.exists(image_path):
        raise HTTPException(status_code=404, detail="Image file not found")

    filename = os.path.basename(image_path)
    extension = os.path.splitext(filename)[1].lower()

    logger.info(f"Extension of image {extension}...")

    if extension == '.png':
        mime_type = 'image/png'
    elif extension in ['.jpg', '.jpeg']:
        mime_type = 'image/jpeg'

    logger.info(f"MIME type of image {mime_type}...")

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
                # Check if common_names list is not empty; if empty, default to "Unknown"
                common_name = common_names[0] if common_names else "Unknown"
                species_data.append({
                    "scientific_name": scientific_name,
                    "common_name": common_name,
                    "score": f"{res['score'] * 100:.2f}"
                })
            
            return {"identified_species": species_data}

    except Exception as e:
        return {"message": f"Error: {str(e)}"}

    return {"message": "No species found"}

@router.delete("/{plant_id}/images/{image_id}")
def delete_plant_image(plant_id: int, image_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    image = db.query(PlantImage).filter(PlantImage.id == image_id, PlantImage.plant_id == plant_id).first()
    if not image:
        raise HTTPException(status_code=404, detail="Image not found for this plant")

    # Remove image file from disk
    absolute_image_path = os.path.join(BASE_DIR, "uploads", image.image_path)
    if os.path.exists(absolute_image_path):
        os.remove(absolute_image_path)

    db.delete(image)
    db.commit()

    return {"message": "Image deleted successfully"}

@router.post("/{plant_id}/generate_description")
async def generate_species_description_for_plant(plant_id: int, db: Session = Depends(get_db)):
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
        raise HTTPException(status_code=500, detail=f"Failed to generate description: {str(e)}")

@router.post("/{plant_id}/watering", response_model=PlantWateringResponse)
def water_plant(
    plant_id: int,
    watering_data: PlantWateringCreate,
    db: Session = Depends(get_db)
):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    watering = PlantWatering(
        plant_id=plant_id,
        watered_at=watering_data.watered_at or datetime.utcnow()
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