import asyncio
import logging
import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware

from app.api.routes import auth, locations, plants, share, statistics, tags, uploads, users, weather
from app.core.config import settings
from app.core.security import create_admin_user
from app.database import SessionLocal, init_db

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize database
init_db()
logger.debug("Database initialized.")

# Initialize FastAPI
app = FastAPI(
    title="Plant Management API",
    version="1.0.0",
    docs_url="/api/docs"
)

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.VITE_DOMAIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add SessionMiddleware BEFORE mounting routers
if os.getenv("VITE_AUTH_MODE") == "oidc":
    same_site_setting = "none" if "://" in settings.OIDC_PROVIDER_URL and not settings.VITE_DOMAIN.endswith(settings.OIDC_PROVIDER_URL.split("//")[1]) else "strict"

    app.add_middleware(
        SessionMiddleware,
        secret_key=settings.SECRET_KEY,
        same_site=same_site_setting,
        max_age=3600,
        https_only=True,
    )

# Include routers
app.include_router(uploads.router, prefix="/api/uploads", tags=["Uploads"])
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(plants.router, prefix="/api/plants", tags=["Plants"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(statistics.router, prefix="/api/statistics", tags=["Statistics"])
app.include_router(tags.router, prefix="/api/tags", tags=["Tags"])
if settings.VITE_ENABLE_LOCATIONS:
    app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])
app.include_router(share.router, prefix="/api/share", tags=["Share"])
app.include_router(weather.router, prefix="/api/weather", tags=["Weather"])

@app.get("/")
def root():
    logger.debug("Root endpoint accessed.")
    return {"message": "Welcome to the Plant Management API!"}

async def _weather_check_loop():
    """Background loop that periodically checks weather and auto-waters plants."""
    interval_seconds = settings.WEATHER_CHECK_INTERVAL_HOURS * 3600
    while True:
        await asyncio.sleep(interval_seconds)
        try:
            db = SessionLocal()
            try:
                from app.services.weather_service import check_and_auto_water
                check_and_auto_water(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Weather check loop error: {e}")


@app.on_event("startup")
def startup_event():
    if os.getenv("VITE_AUTH_MODE") == "local":
        create_admin_user()

    if settings.WEATHER_ENABLED:
        asyncio.get_event_loop().create_task(_weather_check_loop())
        logger.info(
            f"Weather auto-watering enabled (interval: {settings.WEATHER_CHECK_INTERVAL_HOURS}h)"
        )
