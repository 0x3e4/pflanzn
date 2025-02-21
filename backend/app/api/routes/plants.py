from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Plant, PlantImage
from app.schemas import PlantCreate, PlantResponse, PlantUpdate, PlantImageResponse, IdentifyRequest
from typing import List
import shutil
import os
import requests
import uuid
import logging
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")
PLANT_FOLDER = os.path.join(UPLOAD_FOLDER, "plants")

os.makedirs(PLANT_FOLDER, exist_ok=True)

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
    return plants

@router.get("/{plant_id}", response_model=PlantResponse)
def get_plant(plant_id: int, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    return plant

@router.put("/{plant_id}", response_model=PlantResponse)
def update_plant(plant_id: int, plant_data: PlantUpdate, db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    
    for key, value in plant_data.dict(exclude_unset=True).items():
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
def upload_plant_image(plant_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")

    # Generate a UUID filename
    file_extension = file.filename.split(".")[-1]
    filename = f"{uuid.uuid4()}.{file_extension}"
    file_path = os.path.join(PLANT_FOLDER, filename)

    logger.info(f"Uploading image for plant ID {plant_id}...")

    # Save file
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Save the relative path to DB
    relative_path = f"plants/{filename}"  # Store as 'plants/UUID.png'
    plant_image = PlantImage(plant_id=plant_id, image_path=relative_path)
    db.add(plant_image)
    db.commit()
    db.refresh(plant_image)

    logger.info(f"File successfully saved to {file_path}")
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
        with open(image_path, "rb") as image_file:
            files = {
                "images": (filename, image_file, mime_type)
            }
            params = {
                "include-related-images": "false",
                "no-reject": "false",
                "nb-results": "10",
                "lang": "en",
                "api-key": settings.PLANTNET_API_KEY,
            }
            data = {"organs": "auto"}

            response = requests.post(
                "https://my-api.plantnet.org/v2/identify/all",
                params=params,
                files=files,
                data=data,
                headers={"accept": "application/json"},
            )

        logger.info(f"Pl@ntNet API: {response}")

        result = response.json()

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