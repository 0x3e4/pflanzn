import logging
from typing import Optional

import openai

from app.core.config import settings
from app.services.prompt_config import PromptConfig
from app.utils.llm_text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

openai.api_key = settings.OPENAI_API_KEY

class OpenAIClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using OpenAI's GPT models.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        try:
            logger.info(f"Requesting OpenAI to generate description for: {species_name}")

            response = openai.ChatCompletion.create(
                model=settings.OPENAI_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=PromptConfig.MAX_TOKENS_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE
            )

            generated_text = response['choices'][0]['message']['content']
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received response from OpenAI")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling OpenAI: {e}")
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
            logger.info(f"Requesting OpenAI to generate location description for: {location_name}")

            response = openai.ChatCompletion.create(
                model=settings.OPENAI_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE,
            )

            generated_text = response["choices"][0]["message"]["content"]
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received location description response from OpenAI")
            return cleaned_description
        except Exception as e:
            logger.exception(f"Error while calling OpenAI for location description: {e}")
            raise

    def care_helper(self, db, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using OpenAI's GPT models with vision capabilities.
        Optionally includes user's observation for more targeted advice.
        """
        import base64

        from app.models import Plant
        from app.utils.uploads import resolve_upload_path

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

        image_path, media_type = resolve_upload_path(latest_images[0].image_path)

        with open(image_path, "rb") as f:
            base64_image = base64.b64encode(f.read()).decode("utf-8")

        prompt = PromptConfig.get_care_helper_prompt(species, watering_dates, user_message)

        try:
            logger.info(f"Requesting OpenAI vision-based care guidance for plant ID {plant_id}")

            response = openai.ChatCompletion.create(
                model="gpt-4o",  # Use vision-capable model
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:{media_type};base64,{base64_image}"
                                }
                            }
                        ]
                    }
                ],
                max_tokens=PromptConfig.MAX_TOKENS_CARE_ADVICE,
                temperature=PromptConfig.TEMPERATURE_PRECISE
            )

            generated_text = response['choices'][0]['message']['content']
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
