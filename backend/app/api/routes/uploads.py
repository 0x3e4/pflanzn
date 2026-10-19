import logging
import os

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import AUDIENCE_MEMBER, LOCATION_VISIBILITY_BY_AUDIENCE, require_read_access
from app.database import get_db
from app.models import Location, LocationImage

router = APIRouter()
logger = logging.getLogger(__name__)

VALID_SIZES = {"thumb", "medium", "original"}


def _location_image_visible(db: Session, relative_path: str, audience: str) -> bool:
    return (
        db.query(LocationImage.id)
        .join(Location, LocationImage.location_id == Location.id)
        .filter(
            LocationImage.image_path == relative_path,
            Location.visibility.in_(LOCATION_VISIBILITY_BY_AUDIENCE[audience]),
        )
        .first()
        is not None
    )


@router.get("/{file_path:path}")
def serve_upload(
    file_path: str,
    size: str = Query(default="original"),
    db: Session = Depends(get_db),
    audience: str = Depends(require_read_access),
):
    """
    Serve uploaded files with optional size variants.

    New images are stored as WebP variants: {base}_thumb.webp, {base}_medium.webp, {base}_original.webp
    Legacy images are stored as single files: {base}.jpg
    """
    if size not in VALID_SIZES:
        size = "original"

    full_path = os.path.join(settings.UPLOAD_FOLDER, file_path)

    # Prevent directory traversal. A plain startswith() would also accept a sibling
    # such as "uploads_backup"; commonpath compares whole path components.
    real_base = os.path.realpath(settings.UPLOAD_FOLDER)
    real_path = os.path.realpath(full_path)
    try:
        contained = os.path.commonpath([real_base, real_path]) == real_base
    except ValueError:  # different drives on Windows
        contained = False
    if not contained:
        raise HTTPException(status_code=403, detail="Access denied")

    # Location photos follow their location's visibility. Decide on the resolved path,
    # so "plants/../locations/x.jpg" or "./locations//x.jpg" can't skip the check.
    if audience != AUDIENCE_MEMBER:
        relative_path = os.path.relpath(real_path, real_base).replace(os.sep, "/")
        if relative_path.split("/")[0].lower() == "locations" and not _location_image_visible(
            db, relative_path, audience
        ):
            raise HTTPException(status_code=404, detail="File not found")

    # Try new WebP variant format: {base}_{size}.webp
    sized_path = f"{full_path}_{size}.webp"
    if os.path.exists(sized_path):
        return FileResponse(sized_path, media_type="image/webp")

    # Fallback to original variant if requested size doesn't exist
    if size != "original":
        original_path = f"{full_path}_original.webp"
        if os.path.exists(original_path):
            return FileResponse(original_path, media_type="image/webp")

    # Legacy format: file exists as-is (old .jpg files)
    if os.path.exists(full_path):
        return FileResponse(full_path)

    raise HTTPException(status_code=404, detail="File not found")
