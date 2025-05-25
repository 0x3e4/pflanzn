import logging
from anthropic import Anthropic, HUMAN_PROMPT, AI_PROMPT
from app.core.config import settings
from app.utils.llm_text_cleaner import clean_generated_text

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