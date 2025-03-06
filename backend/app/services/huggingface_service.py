import logging
import re
from huggingface_hub import InferenceClient
from app.core.config import settings

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

client = InferenceClient(
    model=settings.HUGGINGFACE_MODEL_NAME,
    token=settings.HUGGINGFACE_API_KEY
)

def generate_species_description(common_name: str, species_name: str) -> str:
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

def clean_generated_text(text: str) -> str:
    """
    Cleans up the AI-generated description:
    - Removes leading "Title:" if present.
    - Removes markdown-like formatting (** and similar things).
    - Trims leading and trailing spaces.
    """

    text = text.replace("Title:", "").strip()
    text = text.replace("Habitat:", "").strip()
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    text = re.sub(r"#+", "", text)
    text = text.strip()

    return text