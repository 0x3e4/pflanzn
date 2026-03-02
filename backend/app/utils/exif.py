from __future__ import annotations

import io
from typing import Optional, Tuple, Union

from PIL import ExifTags, Image


def _ratio_to_float(value: Union[Tuple[int, int], int, float]) -> float:
    if isinstance(value, tuple) and len(value) == 2:
        numerator, denominator = value
        if denominator == 0:
            return 0.0
        return float(numerator) / float(denominator)
    return float(value)


def _to_decimal(dms_values, direction: str) -> Optional[float]:
    if not dms_values or len(dms_values) != 3:
        return None

    degrees = _ratio_to_float(dms_values[0])
    minutes = _ratio_to_float(dms_values[1])
    seconds = _ratio_to_float(dms_values[2])
    decimal = degrees + (minutes / 60.0) + (seconds / 3600.0)
    direction_value = direction.decode() if isinstance(direction, bytes) else str(direction)

    if direction_value in {"S", "W"}:
        decimal = -decimal
    return decimal


def extract_gps_coordinates(image_bytes: bytes) -> Tuple[Optional[float], Optional[float]]:
    gps_tag = next((tag for tag, name in ExifTags.TAGS.items() if name == "GPSInfo"), None)
    if gps_tag is None:
        return None, None

    try:
        with Image.open(io.BytesIO(image_bytes)) as img:
            exif_data = img.getexif()
            if not exif_data:
                return None, None

            raw_gps = exif_data.get(gps_tag)
            if not raw_gps:
                return None, None

            gps_data = {ExifTags.GPSTAGS.get(key, key): value for key, value in raw_gps.items()}
            latitude = _to_decimal(gps_data.get("GPSLatitude"), gps_data.get("GPSLatitudeRef", "N"))
            longitude = _to_decimal(gps_data.get("GPSLongitude"), gps_data.get("GPSLongitudeRef", "E"))
            return latitude, longitude
    except Exception:
        return None, None
