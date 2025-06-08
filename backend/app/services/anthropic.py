from datetime import datetime
import logging
from anthropic import Anthropic, HUMAN_PROMPT, AI_PROMPT
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text
from sqlalchemy.orm import Session
from app.models import Plant
import base64

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

anthropic_client = Anthropic(api_key=settings.CLAUDE_API_KEY)

class ClaudeClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using Claude 3's Messages API.
        """
        prompt = (
            f"Write a detailed botanical description for the plant species '{species_name}', "
            f"also known as '{common_name}'. Cover these aspects: habitat, appearance, care tips, and any interesting facts. "
            f"Write the description in '{settings.LLM_LANGUAGE}' naturally, like a professional botanist would write for a plant catalog. "
            f"Do NOT include a title or markdown formatting like '**' and keep it within 2000 characters."
        )

        try:
            logger.info(f"Requesting Claude to generate description for: {species_name}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=1000,
                temperature=0.7,
                system="You are a helpful and knowledgeable botanical assistant.",
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            generated_text = response.content[0].text
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received response from Claude (Messages API)")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Claude Messages API: {e}")
            raise

    def care_helper(self, db: Session, plant_id: int) -> str:
        import os
        from app.models import Plant

        # Recompute BASE_DIR and UPLOAD_FOLDER exactly as in plants.py
        BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
        UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

        plant = db.query(Plant).filter(Plant.id == plant_id).first()
        if not plant:
            raise ValueError("Plant not found")

        species = plant.species or "Unknown species"
        name = plant.name or "Unnamed plant"

        # Watering history
        last_waterings = sorted(plant.waterings, key=lambda w: w.watered_at, reverse=True)
        watering_dates = [w.watered_at.strftime('%Y-%m-%d') for w in last_waterings]

        # Use latest image
        latest_images = sorted(plant.images, key=lambda img: img.uploaded_at, reverse=True)[:5]
        if not latest_images:
            raise ValueError("No images found for this plant")

        relative_path = latest_images[0].image_path  # e.g. "plants/abc.jpg"
        image_path = os.path.join(UPLOAD_FOLDER, relative_path)

        if not os.path.exists(image_path):
            raise FileNotFoundError(f"Image file not found: {image_path}")

        with open(image_path, "rb") as f:
            base64_image = base64.b64encode(f.read()).decode("utf-8")

        prompt = (
            f"You're helping care for a plant of the species '{species}'. "
            f"It has been watered on the following dates: {', '.join(watering_dates)}.\n"
            f"The following image shows its current state. Based on this and the watering history, "
            f"suggest appropriate care recommendations, including:\n"
            f"- Whether the watering frequency seems adequate\n"
            f"- Any visual cues that could indicate health issues\n"
            f"- Seasonal or environmental care recommendations (if applicable)\n"
            f"Respond in '{settings.LLM_LANGUAGE}' like a professional botanist. Do not include markdown or titles. Max 1000 characters."
        )

        try:
            logger.info(f"Requesting Claude vision-based care guidance for plant ID {plant_id}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=1000,
                temperature=0.7,
                system="You are a helpful and knowledgeable botanical assistant.",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image",
                                "source": {
                                    "type": "base64",
                                    "media_type": "image/jpeg",
                                    "data": base64_image,
                                },
                            },
                        ],
                    }
                ],
            )

            generated_text = response.content[0].text
            cleaned = clean_generated_text(generated_text)
            return cleaned

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise