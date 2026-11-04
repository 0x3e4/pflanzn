import logging
import re
from typing import Optional

from openai import BadRequestError, OpenAI

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


CARE_MODEL = "gpt-4o"  # Use vision-capable model
# Web search answers cite sources as markdown links: "([site](url))" or "[text](url)".
_CITATION = re.compile(r"\s?\(\[[^\]]*\]\([^)]*\)\)")
_LINK = re.compile(r"\[([^\]]*)\]\(https?://[^)]*\)")


def _care_request(context, web_search: bool) -> str:
    content = [{"type": "input_text", "text": context.prompt}]
    content += [
        {"type": "input_image", "image_url": f"data:{image.media_type};base64,{image.data}", "detail": "auto"}
        for image in context.images
    ]
    request = {
        "model": CARE_MODEL,
        "instructions": PromptConfig.get_system_message(),
        "input": [{"role": "user", "content": content}],
        "max_output_tokens": PromptConfig.MAX_TOKENS_CARE_ADVICE,
        "temperature": PromptConfig.TEMPERATURE_PRECISE,
    }
    if web_search:
        request["tools"] = [{"type": "web_search"}]
        request["max_tool_calls"] = 3
    text = _client().responses.create(**request).output_text
    return _LINK.sub(r"\1", _CITATION.sub("", text))

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
        Generate care advice for a plant using OpenAI's GPT models with vision capabilities,
        via the Responses API. With CARE_WEB_SEARCH, the model may also search the web.
        Optionally includes user's observation for more targeted advice.
        """
        context = build_care_context(db, plant_id, user_message)
        web_search = settings.CARE_WEB_SEARCH

        try:
            logger.info(f"Requesting OpenAI vision-based care guidance for plant ID {plant_id} "
                        f"({len(context.images)} photos, web search {'on' if web_search else 'off'})")
            try:
                generated_text = _care_request(context, web_search)
            except BadRequestError as e:
                if not web_search:
                    raise
                # Web search not offered for this model or account.
                logger.warning(f"OpenAI rejected web search, retrying without it: {e}")
                generated_text = _care_request(context, False)

            if not generated_text:
                raise RuntimeError("OpenAI returned no care advice")
            return clean_generated_text(generated_text)

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
