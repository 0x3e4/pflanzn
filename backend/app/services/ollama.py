import logging
import re
import ollama
import os
from app.core.config import settings
from app.utils.text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

os.environ['VITE_OLLAMA_URL'] = settings.VITE_OLLAMA_URL

class OllamaClient:
    def generate_species_description(common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using a local/remote LLM running in Ollama.
        """
        prompt = (
            f"Write a detailed botanical description for the plant species '{species_name}', "
            f"also known as '{common_name}'. Cover these aspects: habitat, appearance, care tips, and any interesting facts. "
            f"Write the description in '{settings.LLM_LANGUAGE}' naturally, like a professional botanist would write for a plant catalog. "
            f"Do NOT include a title or markdown formatting like '**' and keep it within 2000 characters."
        )

        try:
            logger.info(f"Requesting Ollama (remote LLM at {settings.VITE_OLLAMA_URL}) to generate description for: {species_name}")

            response = ollama.chat(
                model=settings.OLLAMA_MODEL_NAME,
                messages=[{"role": "user", "content": prompt}],
                options={"temperature": 0.7}
            )

            generated_text = response['message']['content']

            cleaned_description = clean_generated_text(generated_text)

            logger.info(f"Received response from Ollama")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Ollama: {e}")
            raise