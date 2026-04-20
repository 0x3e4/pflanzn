from typing import Optional

from sqlalchemy.orm import Session

from app.core.config import settings
from app.services.anthropic import ClaudeClient
from app.services.huggingface import HuggingFaceClient
from app.services.mistralai import MistralAIClient
from app.services.ollama import OllamaClient
from app.services.openai import OpenAIClient


class LLMClient:

    def __init__(self):
        provider = (settings.LLM_PROVIDER or "").lower()
        if provider == "huggingface":
            self.client = HuggingFaceClient()
        elif provider == "mistralai":
            self.client = MistralAIClient()
        elif provider == "openai":
            self.client = OpenAIClient()
        elif provider == "claude":
            self.client = ClaudeClient()
        elif provider == "ollama":
            self.client = OllamaClient()
        else:
            raise ValueError(f"Unsupported LLM provider: {provider}")

    def generate_species_description(self, common_name: str, species_name: str) -> str:
        return self.client.generate_species_description(common_name, species_name)

    def generate_location_description(
        self,
        location_name: str,
        item_name: str,
        spot_type: str,
        latitude: Optional[float] = None,
        longitude: Optional[float] = None,
        existing_description: Optional[str] = None,
    ) -> str:
        return self.client.generate_location_description(
            location_name=location_name,
            item_name=item_name,
            spot_type=spot_type,
            latitude=latitude,
            longitude=longitude,
            existing_description=existing_description,
        )

    def care_helper(self, db: Session, plant_id: int, user_message: str = None) -> str:
        return self.client.care_helper(db, plant_id, user_message)
