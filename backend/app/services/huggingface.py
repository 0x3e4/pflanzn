import logging
from typing import Optional

from huggingface_hub import InferenceClient

from app.core.config import settings
from app.services.care_context import build_care_context
from app.services.prompt_config import PromptConfig
from app.utils.llm_text_cleaner import clean_generated_text

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

            logger.info("Received response from Hugging Face")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Hugging Face: {e}")
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
        system_msg = PromptConfig.get_system_message()
        prompt = PromptConfig.get_location_description_prompt(
            location_name=location_name,
            item_name=item_name,
            spot_type=spot_type,
            latitude=latitude,
            longitude=longitude,
            existing_description=existing_description,
        )
        full_prompt = f"{system_msg}\n\n{prompt}"

        try:
            logger.info(f"Requesting Hugging Face to generate location description for: {location_name}")

            response = client.text_generation(
                full_prompt,
                max_new_tokens=PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE,
            )

            cleaned_description = clean_generated_text(response)

            logger.info("Received location description response from Hugging Face")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Hugging Face for location description: {e}")
            raise

    def care_helper(self, db, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant using Hugging Face.
        Note: Vision support depends on the specific model being used.
        """
        system_msg = PromptConfig.get_system_message()
        prompt = build_care_context(db, plant_id, user_message, max_images=0).prompt
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
