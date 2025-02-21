from pydantic_settings import BaseSettings
import os

class Settings(BaseSettings):
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", 3306))
    DB_USER: str = os.getenv("DB_USER", "user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    DB_NAME: str = os.getenv("DB_NAME", "plants_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your_secret_key")
    AUTH_MODE: str = os.getenv("AUTH_MODE", "local")
    REDIS_URL: str = os.getenv("REDIS_URL", "local")
    PLANTNET_API_KEY: str = os.getenv("PLANTNET_API_KEY", "local")
    
    class Config:
        env_file = ".env"

settings = Settings()