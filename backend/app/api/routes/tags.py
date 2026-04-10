
from datetime import datetime
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Plant, PlantWatering, Tag, plant_tag_association
from app.schemas import PlantWateringCreate, TagCreate, TagListResponse, TagResponse


class TagPlantsUpdate(BaseModel):
    plant_ids: List[int]

router = APIRouter()


@router.get("/detailed")
def get_tags_detailed(db: Session = Depends(get_db)):
    """Get all tags with plant usage counts."""
    tags = db.query(Tag).all()

    result = []
    for tag in tags:
        plants = (
            db.query(Plant.id, Plant.name)
            .join(plant_tag_association, Plant.id == plant_tag_association.c.plant_id)
            .filter(plant_tag_association.c.tag_id == tag.id)
            .all()
        )
        result.append({
            "id": tag.id,
            "name": tag.name,
            "plant_count": len(plants),
            "plant_ids": [p.id for p in plants],
            "plant_names": [p.name for p in plants],
        })

    return result


# Create a new tag
@router.post("/", response_model=TagResponse)
def create_tag(tag_data: TagCreate, db: Session = Depends(get_db)):
    existing_tag = db.query(Tag).filter(Tag.name == tag_data.name).first()
    if existing_tag:
        raise HTTPException(status_code=400, detail="Tag already exists")

    new_tag = Tag(name=tag_data.name)
    db.add(new_tag)
    db.commit()
    db.refresh(new_tag)

    return new_tag

# Get all tags
@router.get("/", response_model=TagListResponse)
def get_all_tags(db: Session = Depends(get_db)):
    tags = db.query(Tag).all()
    return {"tags": tags}

# Get a tag by ID
@router.get("/{tag_id}", response_model=TagResponse)
def get_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")
    return tag

# Update a tag name
@router.put("/{tag_id}", response_model=TagResponse)
def update_tag(tag_id: int, tag_data: TagCreate, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    tag.name = tag_data.name
    db.commit()
    db.refresh(tag)

    return tag

# Delete a tag
@router.delete("/{tag_id}", response_model=dict)
def delete_tag(tag_id: int, db: Session = Depends(get_db)):
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Check if the tag is assigned to any plant
    if db.query(plant_tag_association).filter(plant_tag_association.c.tag_id == tag_id).first():
        raise HTTPException(status_code=400, detail="Tag is assigned to a plant and cannot be deleted.")

    db.delete(tag)
    db.commit()

    return {"message": "Tag deleted successfully"}

# Set plants for a tag (bulk assign/unassign)
@router.put("/{tag_id}/plants")
def set_tag_plants(tag_id: int, data: TagPlantsUpdate, db: Session = Depends(get_db)):
    """Replace the plant list for a tag. Plants in the list get the tag, others lose it."""
    tag = db.query(Tag).filter(Tag.id == tag_id).first()
    if not tag:
        raise HTTPException(status_code=404, detail="Tag not found")

    # Get current plant IDs for this tag
    current_ids = set(
        r[0] for r in db.query(plant_tag_association.c.plant_id)
        .filter(plant_tag_association.c.tag_id == tag_id)
        .all()
    )
    new_ids = set(data.plant_ids)

    # Remove tag from plants no longer in the list
    to_remove = current_ids - new_ids
    if to_remove:
        db.execute(
            plant_tag_association.delete().where(
                plant_tag_association.c.tag_id == tag_id,
                plant_tag_association.c.plant_id.in_(to_remove),
            )
        )

    # Add tag to new plants
    to_add = new_ids - current_ids
    if to_add:
        # Verify plants exist
        existing = set(
            r[0] for r in db.query(Plant.id).filter(Plant.id.in_(to_add)).all()
        )
        for pid in existing:
            db.execute(
                plant_tag_association.insert().values(tag_id=tag_id, plant_id=pid)
            )

    db.commit()

    # Return updated tag info
    plants = (
        db.query(Plant.id, Plant.name)
        .join(plant_tag_association, Plant.id == plant_tag_association.c.plant_id)
        .filter(plant_tag_association.c.tag_id == tag_id)
        .all()
    )
    return {
        "id": tag.id,
        "name": tag.name,
        "plant_count": len(plants),
        "plant_ids": [p.id for p in plants],
        "plant_names": [p.name for p in plants],
    }


# Water plants by tag
@router.post("/{tag_id}/water")
def water_plants_by_tag(
    tag_id: int,
    watering_data: PlantWateringCreate,
    db: Session = Depends(get_db)
):
    plants = db.query(Plant).join(Plant.tags).filter(Tag.id == tag_id, Plant.is_archived == False).all()

    if not plants:
        raise HTTPException(status_code=404, detail="No plants found with this tag")

    now = watering_data.watered_at or datetime.utcnow()

    for plant in plants:
        watering = PlantWatering(
            plant_id=plant.id,
            watered_at=now
        )
        db.add(watering)

    db.commit()

    return {"message": f"{len(plants)} plants watered successfully."}
