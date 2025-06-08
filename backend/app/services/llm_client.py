from app.services.huggingface import HuggingFaceClient
from app.services.mistralai import MistralAIClient
from app.services.openai import OpenAIClient
from app.services.anthropic import ClaudeClient
from app.services.ollama import OllamaClient
from app.core.config import settings
from sqlalchemy.orm import Session

class LLMClient:

    def __init__(self):
        provider = settings.VITE_LLM_PROVIDER.lower()
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

    def care_helper(self, db: Session, plant_id: int) -> str:
        return self.client.care_helper(db, plant_id)