from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    TZ: str = os.getenv("TZ", "UTC")
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", 3306))
    DB_USER: str = os.getenv("DB_USER", "user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    DB_NAME: str = os.getenv("DB_NAME", "plants_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    AUTH_MODE: str = os.getenv("AUTH_MODE", "local")
    REDIS_URL: str = os.getenv("REDIS_URL", "localhost")
    PLANTNET_API_KEY: str = os.getenv("PLANTNET_API_KEY")
    PLANTNET_LANGUAGE: str = os.getenv("PLANTNET_LANGUAGE", "en")
    LLM_PROVIDER: str = os.getenv("VITE_LLM_PROVIDER")
    LLM_LANGUAGE: str = os.getenv("VITE_LLM_LANGUAGE", "german")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY")
    HUGGINGFACE_MODEL_NAME: str = os.getenv("HUGGINGFACE_MODEL_NAME")
    MISTRALAI_API_KEY: str = os.getenv("MISTRALAI_API_KEY")
    MISTRALAI_API_URL: str = os.getenv("MISTRALAI_API_URL")
    MISTRALAI_MODEL_NAME: str = os.getenv("MISTRALAI_MODEL_NAME")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_API_KEY", "gpt-4-turbo")
    OLLAMA_URL: str = os.getenv("OLLAMA_URL")
    OLLAMA_MODEL_NAME: str = os.getenv("OLLAMA_MODEL_NAME")
    
    class Config:
        env_file = ".env"

settings = Settings()