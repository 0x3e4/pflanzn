import json
import logging
import os
from datetime import datetime, timezone
from typing import Optional

import requests

from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

PLANTNET_URL = "https://my-api.plantnet.org/v2/identify/all"


QUOTA_KEY = "pflanzn:plantnet:quota"


class PlantNetError(Exception):
    """Pl@ntNet call failed. The message never contains the request URL: the API key
    travels in the query string, and requests puts the full URL into its errors."""


class PlantNetQuotaError(PlantNetError):
    """The daily identification limit of the API key is used up."""


def _record_quota(remaining: Optional[int]) -> None:
    """Remembers what Pl@ntNet said is left today (every answer carries it)."""
    from app.core.security import redis_client

    try:
        redis_client.set(
            QUOTA_KEY,
            json.dumps({"remaining": remaining, "updated_at": datetime.now(timezone.utc).isoformat()}),
            ex=3 * 24 * 3600,
        )
    except Exception as e:  # Redis down: the status page just doesn't know
        logger.warning(f"Could not store the Pl@ntNet quota ({type(e).__name__})")


def quota_status() -> dict:
    """{remaining, limit, updated_at}; remaining is None until the first identification,
    and once the last reading is from an earlier day (UTC), since the limit resets daily."""
    from app.core.config import settings as current
    from app.core.security import redis_client

    status = {"remaining": None, "limit": current.PLANTNET_DAILY_LIMIT, "updated_at": None}
    try:
        raw = redis_client.get(QUOTA_KEY)
    except Exception:
        return status
    if not raw:
        return status
    try:
        stored = json.loads(raw)
        updated = datetime.fromisoformat(stored["updated_at"])
    except (ValueError, KeyError, TypeError):
        return status
    status["updated_at"] = stored["updated_at"]
    if updated.date() == datetime.now(timezone.utc).date():
        status["remaining"] = stored.get("remaining")
    return status

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
    try:
        body = response.json()
    except ValueError:
        body = None
    if isinstance(body, dict) and isinstance(body.get("remainingIdentificationRequests"), int):
        _record_quota(body["remainingIdentificationRequests"])
    if response.status_code == 429:
        _record_quota(0)
        raise PlantNetQuotaError("The daily Pl@ntNet limit is used up. It resets tomorrow.")
    if response.status_code == 404:  # Pl@ntNet's answer for "no species found"
        return {"results": []}
    if not response.ok:
        raise PlantNetError(f"Pl@ntNet returned HTTP {response.status_code}")
    if body is None:
        raise PlantNetError("Pl@ntNet returned an invalid response")
    return body
