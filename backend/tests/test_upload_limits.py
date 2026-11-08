"""Photo uploads refuse images with too many pixels before decoding them.

Regression: plant photos, location photos and both identification uploads opened the bytes
with Pillow directly, whose own limit only bites near 179 MP. A highly compressed image of
about 13k x 13k px fits a 30 MB body and decodes to well over a gigabyte per request.
"""
import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.core.config import settings
from app.utils.uploads import MAX_PHOTO_PIXELS


def _png(size=(40, 20)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, "white").save(buffer, format="PNG")
    return buffer.getvalue()


@pytest.fixture
def folders(tmp_path):
    """Every upload folder points at an empty temp dir, so nothing written can hide."""
    with patch("app.api.routes.plants.PLANT_FOLDER", str(tmp_path)), \
         patch("app.api.routes.plants.IDENTIFICATION_FOLDER", str(tmp_path)), \
         patch("app.api.routes.locations.LOCATION_FOLDER", str(tmp_path)), \
         patch("app.api.routes.locations.IDENTIFICATION_FOLDER", str(tmp_path)):
        yield tmp_path


@pytest.mark.parametrize("url, module", [
    ("/api/plants/1/upload_image", "plants"),
    ("/api/plants/identify", "plants"),
    ("/api/locations/1/upload_image", "locations"),
    ("/api/locations/identify", "locations"),
])
def test_too_many_pixels_is_refused_and_nothing_is_written(client, mock_db, folders, url, module):
    mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(id=1)
    with patch.object(settings, "PLANTNET_API_KEY", "k"), \
         patch(f"app.api.routes.{module}.MAX_PHOTO_PIXELS", 100), \
         patch(f"app.api.routes.{module}.identify_species_via_plantnet", side_effect=AssertionError("not reached")):
        response = client.post(url, files={"file": ("big.png", _png(), "image/png")})

    assert response.status_code == 400
    assert "too large" in response.json()["detail"]
    assert list(folders.iterdir()) == []


def test_pillow_refuses_bombs_everywhere_else_too():
    # Any other Image.open on uploaded bytes gets the same ceiling (Pillow raises above twice it).
    assert Image.MAX_IMAGE_PIXELS == MAX_PHOTO_PIXELS
