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


# Image variant sizes for responsive serving (max width in px).
IMAGE_VARIANTS = {
    "original": 2000,
    "medium": 800,
    "thumb": 300,
}


class UploadRejected(Exception):
    """An upload that must not be stored. `status_code` is 400 or 413."""

    def __init__(self, status_code: int, detail: str):
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def read_upload_limited(upload, max_bytes: int) -> bytes:
    """Reads an UploadFile, refusing to buffer more than `max_bytes`."""
    contents = upload.file.read(max_bytes + 1)
    if len(contents) > max_bytes:
        raise UploadRejected(413, f"File is larger than {max_bytes // (1024 * 1024)} MB")
    if not contents:
        raise UploadRejected(400, "Uploaded file is empty")
    return contents


def open_upload_image(contents: bytes, max_pixels: int):
    """Decodes untrusted bytes as an image (EXIF-rotated, RGB). Anything PIL can't read,
    or that is larger than `max_pixels`, is rejected before full decoding."""
    import io

    from PIL import Image, ImageOps

    try:
        img = Image.open(io.BytesIO(contents))
        if img.width * img.height > max_pixels:
            raise UploadRejected(400, "Image dimensions are too large")
        img = ImageOps.exif_transpose(img)
        return img.convert("RGB")
    except UploadRejected:
        raise
    except Exception:
        raise UploadRejected(400, "File is not a supported image")


def generate_image_variants(img, base_path: str, variants: dict = IMAGE_VARIANTS) -> dict:
    """Writes `{base_path}_{size}.webp` per variant; returns {size: (width, height)}."""
    from PIL import Image

    sizes = {}
    for suffix, max_width in variants.items():
        variant = img.copy()
        if variant.width > max_width:
            ratio = max_width / float(variant.width)
            variant = variant.resize((max_width, int(float(variant.height) * ratio)), Image.LANCZOS)
        variant.save(f"{base_path}_{suffix}.webp", format="WEBP", quality=80, method=4)
        sizes[suffix] = variant.size
    return sizes


def delete_image_variants(relative_path: str, variants: dict = IMAGE_VARIANTS) -> None:
    """Removes the WebP variants of a stored image, confined to UPLOAD_FOLDER."""
    base_dir = os.path.realpath(settings.UPLOAD_FOLDER)
    base_path = os.path.realpath(os.path.join(base_dir, relative_path))
    if os.path.commonpath([base_dir, base_path]) != base_dir:
        return
    for suffix in variants:
        variant_path = f"{base_path}_{suffix}.webp"
        if os.path.exists(variant_path):
            os.remove(variant_path)
