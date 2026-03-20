import logging
import os
from typing import Optional

import ollama

from app.core.config import settings
from app.services.prompt_config import PromptConfig
from app.utils.llm_text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

os.environ['OLLAMA_URL'] = settings.OLLAMA_URL

class OllamaClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using a local/remote LLM running in Ollama.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        try:
            logger.info(f"Requesting Ollama (remote LLM at {settings.OLLAMA_URL}) to generate description for: {species_name}")

            response = ollama.chat(
                model=settings.OLLAMA_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt}
                ],
                options={
                    "temperature": PromptConfig.TEMPERATURE_CREATIVE,
                    "num_predict": PromptConfig.MAX_TOKENS_DESCRIPTION
                }
            )

            generated_text = response['message']['content']
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received response from Ollama")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Ollama: {e}")
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
            logger.info(f"Requesting Ollama to generate location description for: {location_name}")

            response = ollama.chat(
                model=settings.OLLAMA_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt},
                ],
                options={
                    "temperature": PromptConfig.TEMPERATURE_CREATIVE,
                    "num_predict": PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                },
            )

            generated_text = response["message"]["content"]
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received location description response from Ollama")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Ollama for location description: {e}")
            raise

    def care_helper(self, db, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using Ollama.
        Note: Vision support depends on the specific Ollama model being used.
        """
        import os

        from app.models import Plant

        BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

        plant = db.query(Plant).filter(Plant.id == plant_id).first()
        if not plant:
            raise ValueError("Plant not found")

        species = plant.species or "Unknown species"

        # Watering history
        last_waterings = sorted(plant.waterings, key=lambda w: w.watered_at, reverse=True)[:10]
        watering_dates = [w.watered_at.strftime('%Y-%m-%d') for w in last_waterings]

        prompt = PromptConfig.get_care_helper_prompt(species, watering_dates, user_message)

        try:
            logger.info(f"Requesting Ollama care guidance for plant ID {plant_id}")

            response = ollama.chat(
                model=settings.OLLAMA_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt}
                ],
                options={
                    "temperature": PromptConfig.TEMPERATURE_PRECISE,
                    "num_predict": PromptConfig.MAX_TOKENS_CARE_ADVICE
                }
            )

            generated_text = response['message']['content']
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
