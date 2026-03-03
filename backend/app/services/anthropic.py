from datetime import datetime
import logging
from anthropic import Anthropic, HUMAN_PROMPT, AI_PROMPT
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text
from app.services.prompt_config import PromptConfig
from sqlalchemy.orm import Session
from app.models import Plant
import base64
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

anthropic_client = Anthropic(api_key=settings.CLAUDE_API_KEY)

class ClaudeClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using Claude 3's Messages API.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        try:
            logger.info(f"Requesting Claude to generate description for: {species_name}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=PromptConfig.MAX_TOKENS_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE,
                system=PromptConfig.get_system_message(),
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            generated_text = response.content[0].text
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received response from Claude (Messages API)")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Claude Messages API: {e}")
            raise

    def generate_location_description(
        self,
        location_name: str,
        item_name: str,
        spot_type: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        existing_description: Optional[str] = None,
    ) -> str:
        prompt = PromptConfig.get_location_description_prompt(
            location_name=location_name,
            item_name=item_name,
            spot_type=spot_type,
            latitude=latitude,
            longitude=longitude,
            existing_description=existing_description,
        )

        try:
            logger.info(f"Requesting Claude to generate location description for: {location_name}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE,
                system=PromptConfig.get_system_message(),
                messages=[{"role": "user", "content": prompt}],
            )

            generated_text = response.content[0].text
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received location description response from Claude")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Claude for location description: {e}")
            raise

    def care_helper(self, db: Session, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using Claude's vision capabilities.
        Optionally includes user's observation for more targeted advice.
        """
        import os
        from app.models import Plant

        # Recompute BASE_DIR and UPLOAD_FOLDER exactly as in plants.py
        BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

        plant = db.query(Plant).filter(Plant.id == plant_id).first()
        if not plant:
            raise ValueError("Plant not found")

        species = plant.species or "Unknown species"

        # Watering history
        last_waterings = sorted(plant.waterings, key=lambda w: w.watered_at, reverse=True)[:10]
        watering_dates = [w.watered_at.strftime('%Y-%m-%d') for w in last_waterings]

        # Use latest image
        latest_images = sorted(plant.images, key=lambda img: img.uploaded_at, reverse=True)[:5]
        if not latest_images:
            raise ValueError("No images found for this plant")

        relative_path = latest_images[0].image_path
        image_path = os.path.join(UPLOAD_FOLDER, relative_path)

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        with open(image_path, "rb") as f:
            base64_image = base64.b64encode(f.read()).decode("utf-8")

        prompt = PromptConfig.get_care_helper_prompt(species, watering_dates, user_message)

        try:
            logger.info(f"Requesting Claude vision-based care guidance for plant ID {plant_id}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=PromptConfig.MAX_TOKENS_CARE_ADVICE,
                temperature=PromptConfig.TEMPERATURE_PRECISE,
                system=PromptConfig.get_system_message(),
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64_image,
                                },
                            },
                        ],
                    }
                ],
            )

            generated_text = response.content[0].text
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
