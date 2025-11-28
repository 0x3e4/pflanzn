import logging
import re
import httpx
import json
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text
from app.services.prompt_config import PromptConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

MISTRAL_API_URL = settings.MISTRALAI_API_URL

HEADERS = {
    "Authorization": f"Bearer {settings.MISTRALAI_API_KEY}",
    "Content-Type": "application/json"
}

class MistralAIClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using Mistral AI via their API.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        payload = {
            "model": settings.MISTRALAI_MODEL_NAME,
            "messages": [
                {"role": "system", "content": PromptConfig.get_system_message()},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": PromptConfig.MAX_TOKENS_DESCRIPTION,
            "temperature": PromptConfig.TEMPERATURE_CREATIVE,
        }

        try:
            logger.info(f"Requesting Mistral AI to generate description for: {species_name}")

            response = httpx.post(MISTRAL_API_URL, headers=HEADERS, data=json.dumps(payload))

            if response.status_code != 200:
                logger.error(f"Failed to call Mistral AI: {response.status_code} - {response.text}")
                raise Exception(f"Mistral API request failed with status {response.status_code}")

            data = response.json()
            generated_text = data['choices'][0]['message']['content']
            cleaned_description = clean_generated_text(generated_text)

            logger.info(f"Received response from Mistral AI")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Mistral AI: {e}")
            raise

    def care_helper(self, db, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using Mistral AI.
        Note: Mistral AI may not support vision, so this provides text-based advice.
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

        payload = {
            "model": settings.MISTRALAI_MODEL_NAME,
            "messages": [
                {"role": "system", "content": PromptConfig.get_system_message()},
                {"role": "user", "content": prompt}
            ],
            "max_tokens": PromptConfig.MAX_TOKENS_CARE_ADVICE,
            "temperature": PromptConfig.TEMPERATURE_PRECISE,
        }

        try:
            logger.info(f"Requesting Mistral AI care guidance for plant ID {plant_id}")

            response = httpx.post(MISTRAL_API_URL, headers=HEADERS, data=json.dumps(payload))

            if response.status_code != 200:
                logger.error(f"Failed to call Mistral AI: {response.status_code} - {response.text}")
                raise Exception(f"Mistral API request failed with status {response.status_code}")

            data = response.json()
            generated_text = data['choices'][0]['message']['content']
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise