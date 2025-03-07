import logging
import re
import openai
from app.core.config import settings
from app.utils.text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

openai.api_key = settings.OPENAI_API_KEY

class OpenAIClient:
    def generate_species_description(common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using OpenAI's GPT models.
        """
        prompt = (
            f"Write a detailed botanical description for the plant species '{species_name}', "
            f"also known as '{common_name}'. Cover these aspects: habitat, appearance, care tips, and any interesting facts. "
            f"Write the description in '{settings.LLM_LANGUAGE}' naturally, like a professional botanist would write for a plant catalog. "
            f"Do NOT include a title or markdown formatting like '**' and keep it within 2000 characters."
        )

        try:
            logger.info(f"Requesting OpenAI to generate description for: {species_name}")

            response = openai.ChatCompletion.create(
                model=settings.OPENAI_MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                max_tokens=1000,
                temperature=0.7
            )

            generated_text = response['choices'][0]['message']['content']

            cleaned_description = clean_generated_text(generated_text)

            logger.info(f"Received response from OpenAI")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling OpenAI: {e}")
            raise