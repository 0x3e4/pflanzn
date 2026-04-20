import os

from pydantic_settings import BaseSettings


def _truthy(value: str | None, default: bool = False) -> bool:
    if value is None:
        return default
    return value.strip().lower() in ("1", "true", "yes", "on")


def _env(*names: str, default: str = "") -> str:
    """First non-empty match among candidate env var names."""
    for name in names:
        value = os.getenv(name)
        if value is not None and value != "":
            return value
    return default


def _detect_llm_provider() -> str:
    """Pick the LLM provider based on which credentials are configured.

    Priority: openai > claude > mistralai > huggingface > ollama.
    Explicit LLM_PROVIDER env still wins when set (undocumented override).
    """
    explicit = _env("LLM_PROVIDER", "VITE_LLM_PROVIDER")
    if explicit:
        return explicit.lower()
    if os.getenv("OPENAI_API_KEY"):
        return "openai"
    if os.getenv("CLAUDE_API_KEY"):
        return "claude"
    if os.getenv("MISTRALAI_API_KEY"):
        return "mistralai"
    if os.getenv("HUGGINGFACE_API_KEY"):
        return "huggingface"
    if os.getenv("OLLAMA_URL"):
        return "ollama"
    return ""


class Settings(BaseSettings):
    # App display / feature config (exposed at /api/config)
    TZ: str = os.getenv("TZ", "UTC")
    LOCALE: str = _env("LOCALE", "VITE_LOCALE", default="en-US")
    AUTH_MODE: str = _env("AUTH_MODE", "VITE_AUTH_MODE", default="no")
    SHOW_PROTECTED_VIEW: bool = _truthy(_env("SHOW_PROTECTED_VIEW", "VITE_SHOW_PROTECTED_VIEW"), default=True)
    ENABLE_LOCATIONS: bool = _truthy(
        _env("ENABLE_LOCATIONS", "VITE_ENABLE_LOCATIONS", "VITE_ENABLE_HERBALIST_LOCATIONS"),
        default=False,
    )
    LLM_PROVIDER: str = _detect_llm_provider()
    DOMAIN: str = _env("DOMAIN", "VITE_DOMAIN")
    OIDC_NAME: str = _env("OIDC_NAME", "VITE_OIDC_NAME")

    # Backend-only
    DB_HOST: str = os.getenv("DB_HOST", "localhost")
    DB_PORT: int = int(os.getenv("DB_PORT", 3306))
    DB_USER: str = os.getenv("DB_USER", "user")
    DB_PASSWORD: str = os.getenv("DB_PASSWORD", "password")
    DB_NAME: str = os.getenv("DB_NAME", "plants_db")
    SECRET_KEY: str = os.getenv("SECRET_KEY")
    ADMIN_USER: str = os.getenv("ADMIN_USER")
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD")
    OIDC_PROVIDER_URL: str = os.getenv("OIDC_PROVIDER_URL")
    OIDC_CLIENT_ID: str = os.getenv("OIDC_CLIENT_ID")
    OIDC_CLIENT_SECRET: str = os.getenv("OIDC_CLIENT_SECRET")
    REDIS_URL: str = os.getenv("REDIS_URL", "localhost")
    PLANTNET_API_KEY: str = os.getenv("PLANTNET_API_KEY")
    PLANTNET_LANGUAGE: str = os.getenv("PLANTNET_LANGUAGE", "en")
    LLM_LANGUAGE: str = os.getenv("LLM_LANGUAGE", "german")
    HUGGINGFACE_API_KEY: str = os.getenv("HUGGINGFACE_API_KEY")
    HUGGINGFACE_MODEL_NAME: str = os.getenv("HUGGINGFACE_MODEL_NAME")
    MISTRALAI_API_KEY: str = os.getenv("MISTRALAI_API_KEY")
    MISTRALAI_API_URL: str = os.getenv("MISTRALAI_API_URL")
    MISTRALAI_MODEL_NAME: str = os.getenv("MISTRALAI_MODEL_NAME")
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY")
    OPENAI_MODEL_NAME: str = os.getenv("OPENAI_MODEL_NAME", "gpt-4-turbo")
    CLAUDE_API_KEY: str = os.getenv("CLAUDE_API_KEY")
    CLAUDE_MODEL_NAME: str = os.getenv("CLAUDE_MODEL_NAME", "claude-opus-4-20250514")
    OLLAMA_URL: str = os.getenv("OLLAMA_URL")
    OLLAMA_MODEL_NAME: str = os.getenv("OLLAMA_MODEL_NAME")
    OPENWEATHERMAP_API_KEY: str = os.getenv("OPENWEATHERMAP_API_KEY", "")
    WEATHER_CHECK_INTERVAL_HOURS: int = int(os.getenv("WEATHER_CHECK_INTERVAL_HOURS", "1"))
    WEATHER_RAINFALL_THRESHOLD_MM: float = float(os.getenv("WEATHER_RAINFALL_THRESHOLD_MM", "1.0"))
    WEATHER_ENABLED: bool = _truthy(os.getenv("WEATHER_ENABLED"), default=True)
    BASE_DIR: str = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    UPLOAD_FOLDER: str = os.path.join(BASE_DIR, "uploads")

    class Config:
        env_file = ".env"

settings = Settings()
