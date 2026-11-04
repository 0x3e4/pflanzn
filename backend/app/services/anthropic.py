import logging
import re
from typing import Optional

from anthropic import Anthropic, BadRequestError
from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.care_context import build_care_context
from app.services.prompt_config import PromptConfig
from app.utils.llm_text_cleaner import clean_generated_text

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

anthropic_client = Anthropic(api_key=settings.CLAUDE_API_KEY)


# Thinking and web tool use count toward max_tokens, so the care helper needs room.
MAX_TOKENS_CARE_ADVICE = 16000
# A server-side tool loop can pause the turn; it's resumed this many times at most.
MAX_CONTINUATIONS = 3
# Newer models take the dynamic-filtering web tools, older ones the basic variants.
_DYNAMIC_WEB_TOOLS = re.compile(r"^claude-(opus-(4-[6-9]|5)|sonnet-(4-6|5))")


def _response_text(response) -> str:
    """The answer: text after the last tool block. Newer models can put a thinking
    block first, and text before a web search is preamble ("Let me look that up")."""
    blocks = list(response.content)
    last_tool = max(
        (i for i, block in enumerate(blocks) if block.type not in ("text", "thinking", "redacted_thinking")),
        default=-1,
    )
    return "".join(block.text for block in blocks[last_tool + 1:] if block.type == "text")


def _web_tools(model: str) -> list[dict]:
    dynamic = _DYNAMIC_WEB_TOOLS.match(model or "")
    return [
        {"type": "web_search_20260209" if dynamic else "web_search_20250305", "name": "web_search", "max_uses": 3},
        {"type": "web_fetch_20260209" if dynamic else "web_fetch_20250910", "name": "web_fetch", "max_uses": 3,
         "max_content_tokens": 20000},
    ]


def _care_request(content: list[dict], tools: Optional[list[dict]]):
    messages = [{"role": "user", "content": content}]
    request = {
        "model": settings.CLAUDE_MODEL_NAME,
        "max_tokens": MAX_TOKENS_CARE_ADVICE,
        "system": PromptConfig.get_system_message(),
        "messages": messages,
    }
    if tools:
        request["tools"] = tools
    for _ in range(MAX_CONTINUATIONS):
        response = anthropic_client.messages.create(**request)
        if response.stop_reason != "pause_turn":
            break
        messages.append({"role": "assistant", "content": response.content})
    return response

class ClaudeClient:
    def generate_species_description(self, common_name: str, species_name: str) -> str:
        """
        Generate a description for a given plant species using Claude 3's Messages API.
        """
        prompt = PromptConfig.get_species_description_prompt(common_name, species_name)

        try:
            logger.info(f"Requesting Claude to generate description for: {species_name}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=PromptConfig.MAX_TOKENS_DESCRIPTION,
                system=PromptConfig.get_system_message(),
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            generated_text = _response_text(response)
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received response from Claude (Messages API)")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Claude Messages API: {e}")
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
            logger.info(f"Requesting Claude to generate location description for: {location_name}")

            response = anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL_NAME,
                max_tokens=PromptConfig.MAX_TOKENS_LOCATION_DESCRIPTION,
                system=PromptConfig.get_system_message(),
                messages=[{"role": "user", "content": prompt}],
            )

            generated_text = _response_text(response)
            cleaned_description = clean_generated_text(generated_text)

            logger.info("Received location description response from Claude")
            return cleaned_description

        except Exception as e:
            logger.exception(f"Error while calling Claude for location description: {e}")
            raise

    def care_helper(self, db: Session, plant_id: int, user_message: str = None) -> str:
        """
        Generate care advice for a plant from its latest photos, history and Pl@ntNet
        facts. With CARE_WEB_SEARCH, Claude may also search the web and read pages.
        Optionally includes user's observation for more targeted advice.
        """
        context = build_care_context(db, plant_id, user_message)
        content = [
            {"type": "image", "source": {"type": "base64", "media_type": image.media_type, "data": image.data}}
            for image in context.images
        ]
        content.append({"type": "text", "text": context.prompt})
        tools = _web_tools(settings.CLAUDE_MODEL_NAME) if settings.CARE_WEB_SEARCH else None

        try:
            logger.info(f"Requesting Claude care guidance for plant ID {plant_id} "
                        f"({len(context.images)} photos, web tools {'on' if tools else 'off'})")
            try:
                response = _care_request(content, tools)
            except BadRequestError as e:
                if not tools:
                    raise
                # Web tools disabled for the organization, or not offered for this model.
                logger.warning(f"Claude rejected the web tools, retrying without them: {e}")
                response = _care_request(content, None)

            generated_text = _response_text(response)
            if not generated_text:
                raise RuntimeError(f"Claude returned no care advice (stop reason: {response.stop_reason})")
            return clean_generated_text(generated_text)

        except Exception as e:
            logger.exception(f"Error while generating care helper response: {e}")
            raise
