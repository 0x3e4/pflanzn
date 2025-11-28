import logging
import re
from huggingface_hub import InferenceClient
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text
from app.services.prompt_config import PromptConfig

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

client = InferenceClient(
    model=settings.HUGGINGFACE_MODEL_NAME,
    token=settings.HUGGINGFACE_API_KEY
)

class HuggingFaceClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using Hugging Face inference API via InferenceClient.
        """
        system_msg = PromptConfig.get_system_message()
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)
        full_prompt = f"{system_msg}\n\n{prompt}"

        try:
            logger.info(f"Requesting Hugging Face to generate description for: {species_name}")

            # Use `InferenceClient` to generate text directly
            response = client.text_generation(
                full_prompt,
                max_new_tokens=PromptConfig.MAX_TOKENS_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE
            )

            cleaned_description = clean_generated_text(response)

            logger.info(f"Received response from Hugging Face")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Hugging Face: {e}")
            raise

    def care_helper(self, db, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using Hugging Face.
        Note: Vision support depends on the specific model being used.
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

        system_msg = PromptConfig.get_system_message()
        prompt = PromptConfig.get_care_helper_prompt(species, watering_dates, user_message)
        full_prompt = f"{system_msg}\n\n{prompt}"

        try:
            logger.info(f"Requesting Hugging Face care guidance for plant ID {plant_id}")

            response = client.text_generation(
                full_prompt,
                max_new_tokens=PromptConfig.MAX_TOKENS_CARE_ADVICE,
                temperature=PromptConfig.TEMPERATURE_PRECISE
            )

            cleaned = clean_generated_text(response)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise