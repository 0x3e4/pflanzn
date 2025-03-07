import logging
import requests
import json
import os
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

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
    try:
        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found at {image_path}")

        with open(image_path, "rb") as image_file:
            files = {
                "images": (filename, image_file, mime_type)
            }
            params = {
                "include-related-images": "false",
                "no-reject": "false",
                "nb-results": "10",
                "lang": settings.PLANTNET_LANGUAGE,
                "api-key": settings.PLANTNET_API_KEY,
            }
            data = {
                "organs": "auto"
            }

            response = requests.post(
                "https://my-api.plantnet.org/v2/identify/all",
                params=params,
                files=files,
                data=data,
                headers={"accept": "application/json"},
            )

        logger.info(f"Pl@ntNet API responded with status {response.status_code}")
        response.raise_for_status()
        return response.json()

    except Exception as e:
        logger.exception("Error calling Pl@ntNet API")
        raise e