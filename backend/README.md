# Pflanzn Backend

FastAPI REST API for the Pflanzn plant management system. Handles authentication, plant/location CRUD, species identification, AI-powered care advice, weather-based auto-watering, and file uploads.

## Tech Stack

- **Framework:** FastAPI with Uvicorn
- **ORM:** SQLAlchemy
- **Database:** MariaDB
- **Cache:** Redis (sessions, token storage)
- **Auth:** JWT (HS256) + Argon2 hashing + OIDC support (authlib)
- **Validation:** Pydantic + pydantic-settings
- **Testing:** pytest
- **Linting:** ruff

## Development

```bash
# Run in Docker (recommended, with auto-reload):
docker-compose up -d

# Or manually:
pip install poetry
poetry install
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Testing & Linting

```bash
poetry run pytest tests/ -v
poetry run ruff check app/ --fix
```

## Project Structure

```
app/
├── main.py                # FastAPI init, CORS, router registration, startup events
├── models.py              # SQLAlchemy models
├── schemas.py             # Pydantic request/response schemas
├── database.py            # DB connection, pooling, idempotent migrations
├── core/
│   ├── config.py          # Environment variable settings (pydantic-settings)
│   └── security.py        # JWT, Argon2, session management, token theft detection
├── api/routes/            # REST endpoints
│   ├── auth.py            # Login, register, token refresh, OIDC
│   ├── plants.py          # Plant CRUD, watering, fertilizing, notes, seasons
│   ├── locations.py       # Location CRUD, photos, activities
│   ├── users.py           # User management (admin)
│   ├── tags.py            # Tag CRUD and plant-tag associations
│   ├── share.py           # Token-based public share links
│   ├── statistics.py      # Dashboard statistics
│   ├── uploads.py         # Image serving (thumb/medium/original WebP variants)
│   └── weather.py         # Weather config, current conditions, logs, auto-waterings
├── services/              # Business logic
│   ├── llm_client.py      # LLM factory pattern (OpenAI, Claude, Mistral, HuggingFace, Ollama)
│   ├── openai.py, anthropic.py, mistralai.py, huggingface.py, ollama.py
│   ├── plantnet.py        # PlantNet species identification
│   ├── prompt_config.py   # LLM prompt templates
│   └── weather_service.py # Weather data fetching and auto-watering logic
└── utils/                 # EXIF extraction, text cleaning
```

## Key Conventions

- All settings via environment variables loaded through pydantic-settings `BaseSettings`
- Dependency injection via FastAPI `Depends()` for auth and DB sessions
- All routes prefixed with `/api`
- Image uploads generate 3 WebP variants: thumb (300px), medium (800px), original (2000px max)
- Three auth modes: `no` (open), `local` (JWT), `oidc` (external provider)
- Schema changes handled as idempotent migrations in `database.py`
