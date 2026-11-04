"""What the care helper tells the model about a plant, shared by every provider:
the prompt (plant data, history, notes, Pl@ntNet facts) and the latest photos."""
import base64
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional
from zoneinfo import ZoneInfo

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Plant
from app.services import plant_reference
from app.services.prompt_config import PromptConfig
from app.utils.uploads import resolve_upload_path

logger = logging.getLogger(__name__)

MAX_IMAGES = 3


@dataclass
class CareImage:
    data: str  # base64
    media_type: str
    taken: str  # YYYY-MM-DD


@dataclass
class CareContext:
    prompt: str
    images: list[CareImage] = field(default_factory=list)
    reference: Optional[plant_reference.PlantReference] = None


def _today() -> str:
    try:
        return datetime.now(ZoneInfo(settings.TZ)).strftime("%Y-%m-%d")
    except Exception:
        return datetime.now().strftime("%Y-%m-%d")


def _load_images(plant: Plant, max_images: int) -> list[CareImage]:
    images = []
    for image in sorted(plant.images, key=lambda img: img.uploaded_at, reverse=True):
        if len(images) >= max_images:
            break
        try:
            path, media_type = resolve_upload_path(image.image_path)
            with open(path, "rb") as f:
                data = base64.b64encode(f.read()).decode("utf-8")
        except OSError:
            logger.warning(f"Care helper: skipping unreadable image {image.image_path}")
            continue
        images.append(CareImage(data, media_type, image.uploaded_at.strftime("%Y-%m-%d")))
    return images


def build_care_context(db: Session, plant_id: int, user_message: Optional[str] = None,
                       max_images: int = MAX_IMAGES) -> CareContext:
    """max_images=0 for providers that only take text."""
    plant = db.query(Plant).filter(Plant.id == plant_id).first()
    if not plant:
        raise ValueError("Plant not found")

    images = _load_images(plant, max_images) if max_images else []
    reference = plant_reference.lookup(db, plant.species)
    waterings = sorted(plant.waterings, key=lambda w: w.watered_at, reverse=True)[:10]
    fertilizings = sorted(plant.fertilizings, key=lambda f: f.fertilized_at, reverse=True)[:5]
    notes = sorted(plant.notes, key=lambda n: n.created_at, reverse=True)[:5]
    previous = max(plant.care_advice, key=lambda a: a.generated_at, default=None)

    prompt = PromptConfig.get_care_helper_prompt(
        today=_today(),
        name=plant.name,
        species=plant.species,
        is_outdoor=bool(plant.is_outdoor),
        reaches_rain=bool(plant.reaches_rain),
        watering_interval_days=plant.watering_interval_days,
        waterings=[
            w.watered_at.strftime("%Y-%m-%d") + (" (rain)" if w.rainfall_mm else "") for w in waterings
        ],
        fertilizings=[f.fertilized_at.strftime("%Y-%m-%d") for f in fertilizings],
        notes=[(n.created_at.strftime("%Y-%m-%d"), n.note_text) for n in notes],
        previous_advice=(previous.generated_at.strftime("%Y-%m-%d"), previous.advice_text) if previous else None,
        photo_dates=[image.taken for image in images],
        vision=bool(max_images),
        reference=reference,
        user_message=user_message,
    )
    return CareContext(prompt, images, reference)
