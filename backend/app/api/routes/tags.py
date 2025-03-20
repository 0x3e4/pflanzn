from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Tag, Plant, plant_tag_association
from app.schemas import TagCreate, TagResponse, TagListResponse, PlantResponse
from typing import List

router = APIRouter()

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
