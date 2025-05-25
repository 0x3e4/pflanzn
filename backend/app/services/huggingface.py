import logging
import re
from huggingface_hub import InferenceClient
from app.core.config import settings
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
        prompt = (
            f"Write a detailed botanical description for the plant species '{species_name}', "
            f"also known as '{common_name}'. Cover these aspects: habitat, appearance, care tips, and any interesting facts. "
            f"Write the description in '{settings.LLM_LANGUAGE}' naturally, like a professional botanist would write for a plant catalog. "
            f"Do NOT include a title or markdown formatting like '**' and keep it within 2000 characters."
        )

        try:
            logger.info(f"Requesting Hugging Face to generate description for: {species_name}")

            # Use `InferenceClient` to generate text directly
            response = client.text_generation(prompt, max_new_tokens=100)

            cleaned_description = clean_generated_text(response)

            logger.info(f"Received response from Hugging Face")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Hugging Face: {e}")
            raise