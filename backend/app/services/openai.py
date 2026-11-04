import logging
from typing import Optional

from openai import OpenAI

from app.core.config import settings
from app.services.care_context import build_care_context
from app.services.prompt_config import PromptConfig
from app.utils.llm_text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)



def _client() -> OpenAI:
    # Built per call: the constructor raises without an API key, and this module is
    # imported whichever provider is configured.
    return OpenAI(api_key=settings.OPENAI_API_KEY)

class OpenAIClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using OpenAI's GPT models.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        try:
            logger.info(f"Requesting OpenAI to generate description for: {species_name}")

            response = _client().chat.completions.create(
                model=settings.OPENAI_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt}
                ],
                max_tokens=PromptConfig.MAX_TOKENS_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE
            )

            generated_text = response.choices[0].message.content
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

            response = _client().chat.completions.create(
                model=settings.OPENAI_MODEL_NAME,
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": prompt},
                ],
                max_tokens=PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                temperature=PromptConfig.TEMPERATURE_CREATIVE,
            )

            generated_text = response.choices[0].message.content
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
        context = build_care_context(db, plant_id, user_message)
        content = [{"type": "text", "text": context.prompt}]
        content += [
            {"type": "image_url", "image_url": {"url": f"data:{image.media_type};base64,{image.data}"}}
            for image in context.images
        ]

        try:
            logger.info(f"Requesting OpenAI vision-based care guidance for plant ID {plant_id}")

            response = _client().chat.completions.create(
                model="gpt-4o",  # Use vision-capable model
                messages=[
                    {"role": "system", "content": PromptConfig.get_system_message()},
                    {"role": "user", "content": content},
                ],
                max_tokens=PromptConfig.MAX_TOKENS_CARE_ADVICE,
                temperature=PromptConfig.TEMPERATURE_PRECISE
            )

            generated_text = response.choices[0].message.content
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
