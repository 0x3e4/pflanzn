"""Floor plans: images of a home that plants are placed on.

Members only. A floor plan (and its address) shows the inside of someone's home, so
unlike the plant collection it is never visible to share-link viewers or anonymous
readers — every route here goes through `require_floor_plans`, and /api/uploads
applies the same rule to the plan images.
"""
import logging
import os
import re
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import AUDIENCE_MEMBER, require_read_access, require_write_access
from app.database import get_db
from app.models import FloorPlan, Plant
from app.schemas import FloorPlanPlacement, FloorPlanPlacementUpdate, FloorPlanResponse, FloorPlanUpdate
from app.services import app_settings
from app.utils.uploads import (
    UploadRejected,
    delete_image_variants,
    generate_image_variants,
    open_upload_image,
    read_upload_limited,
)

logger = logging.getLogger(__name__)

FLOOR_PLAN_FOLDER = os.path.join(settings.UPLOAD_FOLDER, "floorplans")
os.makedirs(FLOOR_PLAN_FOLDER, exist_ok=True)

# Plans get bigger variants than plant photos: room labels must stay legible when zoomed.
FLOOR_PLAN_VARIANTS = {"original": 2560, "medium": 1280, "thumb": 320}
MAX_UPLOAD_BYTES = 20 * 1024 * 1024
MAX_PIXELS = 40_000_000
MAX_FLOOR_PLANS = 50
_CONTROL_CHARS = re.compile(r"[\x00-\x1f\x7f]")


def require_floor_plans(audience: str = Depends(require_read_access), db: Session = Depends(get_db)) -> None:
    """Members only, and only while an admin has the feature switched on."""
    if audience != AUDIENCE_MEMBER or not app_settings.floor_plans_enabled(db):
        raise HTTPException(status_code=404, detail="Not found")


router = APIRouter(dependencies=[Depends(require_floor_plans)])


def _clean(value: Optional[str], max_length: int) -> Optional[str]:
    if value is None:
        return None
    value = _CONTROL_CHARS.sub("", value).strip()
    return value[:max_length] or None


def _get_plan(db: Session, plan_id: int) -> FloorPlan:
    plan = db.query(FloorPlan).filter(FloorPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Floor plan not found")
    return plan


def _store_image(upload: UploadFile) -> tuple[str, int, int]:
    """Validates and re-encodes an uploaded plan; returns (relative_path, width, height)."""
    try:
        img = open_upload_image(read_upload_limited(upload, MAX_UPLOAD_BYTES), MAX_PIXELS)
    except UploadRejected as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)
    base_name = str(uuid.uuid4())
    sizes = generate_image_variants(img, os.path.join(FLOOR_PLAN_FOLDER, base_name), FLOOR_PLAN_VARIANTS)
    width, height = sizes["original"]
    return f"floorplans/{base_name}", width, height


def _response(plan: FloorPlan, placements: List[FloorPlanPlacement]) -> FloorPlanResponse:
    return FloorPlanResponse(
        id=plan.id,
        name=plan.name,
        address=plan.address,
        image_path=plan.image_path,
        width=plan.width,
        height=plan.height,
        sort_order=plan.sort_order,
        placements=placements,
    )


def _placements(db: Session, plan_ids: List[int]) -> dict[int, List[FloorPlanPlacement]]:
    by_plan: dict[int, List[FloorPlanPlacement]] = {pid: [] for pid in plan_ids}
    if not plan_ids:
        return by_plan
    rows = (
        db.query(Plant.id, Plant.floor_plan_id, Plant.plan_x, Plant.plan_y)
        .filter(Plant.floor_plan_id.in_(plan_ids), Plant.plan_x.isnot(None), Plant.plan_y.isnot(None))
        .filter((Plant.is_archived == False) | (Plant.is_archived.is_(None)))  # noqa: E712
        .all()
    )
    for plant_id, plan_id, x, y in rows:
        by_plan[plan_id].append(FloorPlanPlacement(plant_id=plant_id, x=x, y=y))
    return by_plan


@router.get("", response_model=List[FloorPlanResponse])
def list_floor_plans(db: Session = Depends(get_db)):
    plans = db.query(FloorPlan).order_by(FloorPlan.sort_order, FloorPlan.id).all()
    placements = _placements(db, [p.id for p in plans])
    return [_response(plan, placements[plan.id]) for plan in plans]


@router.post("", response_model=FloorPlanResponse)
def create_floor_plan(
    name: str = Form(..., max_length=100),
    address: Optional[str] = Form(None, max_length=255),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    _=Depends(require_write_access),
):
    clean_name = _clean(name, 100)
    if not clean_name:
        raise HTTPException(status_code=400, detail="Name is required")
    if db.query(FloorPlan).count() >= MAX_FLOOR_PLANS:
        raise HTTPException(status_code=400, detail=f"At most {MAX_FLOOR_PLANS} floor plans")

    image_path, width, height = _store_image(file)
    last = db.query(FloorPlan).order_by(FloorPlan.sort_order.desc()).first()
    plan = FloorPlan(
        name=clean_name,
        address=_clean(address, 255),
        image_path=image_path,
        width=width,
        height=height,
        sort_order=(last.sort_order + 1) if last else 0,
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return _response(plan, [])


@router.put("/{plan_id}", response_model=FloorPlanResponse)
def update_floor_plan(
    plan_id: int, payload: FloorPlanUpdate, db: Session = Depends(get_db), _=Depends(require_write_access)
):
    plan = _get_plan(db, plan_id)
    fields = payload.model_dump(exclude_unset=True)
    if "name" in fields:
        name = _clean(fields["name"], 100)
        if not name:
            raise HTTPException(status_code=400, detail="Name is required")
        plan.name = name
    if "address" in fields:
        plan.address = _clean(fields["address"], 255)
    if fields.get("sort_order") is not None:
        plan.sort_order = fields["sort_order"]
    db.commit()
    db.refresh(plan)
    return _response(plan, _placements(db, [plan.id])[plan.id])


@router.put("/{plan_id}/image", response_model=FloorPlanResponse)
def replace_floor_plan_image(
    plan_id: int, file: UploadFile = File(...), db: Session = Depends(get_db), _=Depends(require_write_access)
):
    """New image, same placements (they are stored relative to the image size)."""
    plan = _get_plan(db, plan_id)
    old_path = plan.image_path
    plan.image_path, plan.width, plan.height = _store_image(file)
    db.commit()
    delete_image_variants(old_path, FLOOR_PLAN_VARIANTS)
    db.refresh(plan)
    return _response(plan, _placements(db, [plan.id])[plan.id])


@router.delete("/{plan_id}")
def delete_floor_plan(plan_id: int, db: Session = Depends(get_db), _=Depends(require_write_access)):
    plan = _get_plan(db, plan_id)
    db.query(Plant).filter(Plant.floor_plan_id == plan.id).update(
        {Plant.floor_plan_id: None, Plant.plan_x: None, Plant.plan_y: None}, synchronize_session=False
    )
    image_path = plan.image_path
    db.delete(plan)
    db.commit()
    delete_image_variants(image_path, FLOOR_PLAN_VARIANTS)
    return {"message": "Floor plan deleted"}


@router.put("/{plan_id}/placements/{plant_id}", response_model=FloorPlanPlacement)
def place_plant(
    plan_id: int,
    plant_id: int,
    payload: FloorPlanPlacementUpdate,
    db: Session = Depends(get_db),
    _=Depends(require_write_access),
):
    plan = _get_plan(db, plan_id)
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    if plant.is_archived:
        raise HTTPException(status_code=400, detail="Archived plants can't be placed")
    plant.floor_plan_id, plant.plan_x, plant.plan_y = plan.id, payload.x, payload.y
    db.commit()
    return FloorPlanPlacement(plant_id=plant.id, x=payload.x, y=payload.y)


@router.delete("/placements/{plant_id}")
def unplace_plant(plant_id: int, db: Session = Depends(get_db), _=Depends(require_write_access)):
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise HTTPException(status_code=404, detail="Plant not found")
    plant.floor_plan_id = plant.plan_x = plant.plan_y = None
    db.commit()
    return {"message": "Plant removed from its floor plan"}
