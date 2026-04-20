import logging
from time import sleep

from mariadb import InterfaceError, OperationalError
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker

from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# SQLAlchemy setup for ORM
DATABASE_URL = f"mariadb+mariadbconnector://{settings.DB_USER}:{settings.DB_PASSWORD}@{settings.DB_HOST}:{settings.DB_PORT}/{settings.DB_NAME}"

engine = create_engine(
    DATABASE_URL,
    pool_size=10,
    max_overflow=20,
    pool_timeout=30,
    pool_recycle=300,
    pool_pre_ping=True
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def _execute_ddl(statement: str):
    with engine.begin() as connection:
        connection.execute(text(statement))


def _ensure_locations_schema():
    """
    Lightweight idempotent migration for deployments that already had a minimal
    `locations` table from earlier iterations of the feature.
    """
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "locations" in tables:
        location_columns = {column["name"] for column in inspector.get_columns("locations")}
        location_alters = []

        if "item_name" not in location_columns:
            location_alters.append("ADD COLUMN item_name VARCHAR(255) NULL AFTER name")
        if "description" not in location_columns:
            location_alters.append("ADD COLUMN description TEXT NULL")
        if "spot_type" not in location_columns:
            location_alters.append("ADD COLUMN spot_type VARCHAR(50) NOT NULL DEFAULT 'other'")
        if "visibility" not in location_columns:
            location_alters.append("ADD COLUMN visibility VARCHAR(20) NOT NULL DEFAULT 'private'")
        if "latitude" not in location_columns:
            location_alters.append("ADD COLUMN latitude DOUBLE NULL")
        if "longitude" not in location_columns:
            location_alters.append("ADD COLUMN longitude DOUBLE NULL")
        if "coordinate_source" not in location_columns:
            location_alters.append("ADD COLUMN coordinate_source VARCHAR(20) NULL")
        if "created_at" not in location_columns:
            location_alters.append("ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP")
        if "updated_at" not in location_columns:
            location_alters.append("ADD COLUMN updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP")

        for alter in location_alters:
            _execute_ddl(f"ALTER TABLE locations {alter}")

        inspector = inspect(engine)
        location_indexes = {index["name"] for index in inspector.get_indexes("locations")}
        if "idx_locations_spot_type" not in location_indexes:
            _execute_ddl("CREATE INDEX idx_locations_spot_type ON locations (spot_type)")
        if "idx_locations_visibility" not in location_indexes:
            _execute_ddl("CREATE INDEX idx_locations_visibility ON locations (visibility)")

        unique_constraints = {uc["name"] for uc in inspector.get_unique_constraints("locations")}
        if "name" in unique_constraints:
            _execute_ddl("ALTER TABLE locations DROP INDEX `name`")

    if "location_images" in tables:
        location_image_indexes = {index["name"] for index in inspector.get_indexes("location_images")}
        if "idx_location_images_location_id" not in location_image_indexes:
            _execute_ddl("CREATE INDEX idx_location_images_location_id ON location_images (location_id)")

def _ensure_share_links_schema():
    """Idempotent migration for the share_links table."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "share_links" not in tables:
        return  # create_all already handled it


def _ensure_fertilizings_schema():
    """Idempotent migration for the plant_fertilizings table."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())
    if "plant_fertilizings" not in tables:
        return  # create_all already handled it


def _ensure_weather_schema():
    """Idempotent migration for weather and plant outdoor fields."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    if "weather_logs" in tables:
        log_columns = {column["name"] for column in inspector.get_columns("weather_logs")}
        if "city_name" not in log_columns:
            _execute_ddl("ALTER TABLE weather_logs ADD COLUMN city_name VARCHAR(255) NULL AFTER longitude")

    if "plant_waterings" in tables:
        watering_columns = {column["name"] for column in inspector.get_columns("plant_waterings")}
        if "rainfall_mm" not in watering_columns:
            _execute_ddl("ALTER TABLE plant_waterings ADD COLUMN rainfall_mm FLOAT NULL")

    if "plants" in tables:
        plant_columns = {column["name"] for column in inspector.get_columns("plants")}
        if "is_outdoor" not in plant_columns:
            _execute_ddl("ALTER TABLE plants ADD COLUMN is_outdoor TINYINT(1) NOT NULL DEFAULT 0")
        if "reaches_rain" not in plant_columns:
            _execute_ddl("ALTER TABLE plants ADD COLUMN reaches_rain TINYINT(1) NOT NULL DEFAULT 0")
        if "weather_config_id" not in plant_columns:
            _execute_ddl("ALTER TABLE plants ADD COLUMN weather_config_id INT NULL")
            # FK can only be added after weather_configs table exists (create_all runs first)
            try:
                _execute_ddl(
                    "ALTER TABLE plants ADD CONSTRAINT fk_plants_weather_config "
                    "FOREIGN KEY (weather_config_id) REFERENCES weather_configs(id) ON DELETE SET NULL"
                )
            except Exception:
                pass  # FK may already exist or table not ready


def get_db():
    db = None
    for attempt in range(3):
        try:
            db = SessionLocal()
            yield db
            break
        except (InterfaceError, OperationalError) as e:
            logger.warning(f"Database connection lost: {e}. Retrying in 2 seconds (attempt {attempt+1}/3)...")
            sleep(2)
        finally:
            if db:
                db.close()
                logger.debug("Database session closed.")

def init_db():
    """
    Initializes the database by creating necessary tables based on models.py.
    """
    from app import models
    models.Base.metadata.create_all(bind=engine)
    _ensure_locations_schema()
    _ensure_share_links_schema()
    _ensure_fertilizings_schema()
    _ensure_weather_schema()
    logger.debug("Database tables ensured.")
