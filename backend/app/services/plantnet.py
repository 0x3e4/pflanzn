import logging
import os

import requests

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"


class PlantNetError(Exception):
    """Pl@ntNet call failed. The message never contains the request URL: the API key
    travels in the query string, and requests puts the full URL into its errors."""

def identify_species_via_plantnet(
    image_path: str,
    mime_type: str,
    filename: str
) -> dict[str, any]:
    """
    Call the Pl@ntNet API to identify a plant from an image.
    
    :param image_path: Absolute path to the local image file
    :param mime_type: MIME type, e.g., 'image/png' or 'image/jpeg'
    :param filename: Just the filename (for the multipart form)
    :return: Parsed JSON response from the API
    """
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found at {image_path}")

    try:
        with open(image_path, "rb") as image_file:
            files = {
                "images": (filename, image_file, mime_type)
            }
            params = {
                "include-related-images": "true",
                "no-reject": "false",
                "nb-results": "5",
                "lang": settings.PLANTNET_LANGUAGE,
                "api-key": settings.PLANTNET_API_KEY,
            }
            data = {
                "organs": "auto"
            }

            response = requests.post(
                PLANTNET_URL,
                params=params,
                files=files,
                data=data,
                headers={"accept": "application/json"},
                timeout=30,
            )
    except requests.RequestException as e:
        # `from None`: the original exception (and its traceback) embeds the keyed URL.
        logger.error(f"Pl@ntNet request failed: {type(e).__name__}")
        raise PlantNetError(f"Pl@ntNet request failed ({type(e).__name__})") from None

    logger.info(f"Pl@ntNet API responded with status {response.status_code}")
    if response.status_code == 404:  # Pl@ntNet's answer for "no species found"
        return {"results": []}
    if not response.ok:
        raise PlantNetError(f"Pl@ntNet returned HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError:
        raise PlantNetError("Pl@ntNet returned an invalid response") from None
