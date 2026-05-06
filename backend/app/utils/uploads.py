import os
from typing import Tuple

from app.core.config import settings


def resolve_upload_path(relative_path: str, prefer_size: str = "medium") -> Tuple[str, str]:
    """Resolve a stored image path (e.g. ``plants/{uuid}``) to a real file on disk.

    Mirrors the ``/api/uploads`` route's variant resolution: tries the requested
    size first, falls back to ``_original.webp``, then to the legacy bare path
    (for older ``.jpg`` records). Returns (absolute_path, media_type).
    """
    full_path = os.path.join(settings.UPLOAD_FOLDER, relative_path)

    sized_path = f"{full_path}_{prefer_size}.webp"
    if os.path.exists(sized_path):
        return sized_path, "image/webp"

    if prefer_size != "original":
        original_path = f"{full_path}_original.webp"
        if os.path.exists(original_path):
            return original_path, "image/webp"

    if os.path.exists(full_path):
        media_type = "image/jpeg" if full_path.lower().endswith((".jpg", ".jpeg")) else "application/octet-stream"
        return full_path, media_type

    raise FileNotFoundError(f"Image file not found for: {relative_path}")
