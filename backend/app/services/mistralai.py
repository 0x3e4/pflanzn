import logging
import re
import httpx
import json
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text

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
        prompt = (
            f"Write a detailed botanical description for the plant species '{species_name}', "
            f"also known as '{common_name}'. Cover these aspects: habitat, appearance, care tips, and any interesting facts. "
            f"Write the description in '{settings.LLM_LANGUAGE}' naturally, like a professional botanist would write for a plant catalog. "
            f"Do NOT include a title or markdown formatting like '**' and keep it within 2000 characters."
        )

        payload = {
            "model": settings.MISTRALAI_MODEL_NAME,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 1000,
            "temperature": 0.7,
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