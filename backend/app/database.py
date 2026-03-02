import logging
from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import sessionmaker
from mariadb import InterfaceError, OperationalError
from app.core.config import settings
from time import sleep

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

    if "location_images" in tables:
        location_image_indexes = {index["name"] for index in inspector.get_indexes("location_images")}
        if "idx_location_images_location_id" not in location_image_indexes:
            _execute_ddl("CREATE INDEX idx_location_images_location_id ON location_images (location_id)")

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
    logger.debug("Database tables ensured.")
