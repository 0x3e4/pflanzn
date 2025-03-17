import logging
from sqlalchemy import create_engine
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
    logger.debug("Database tables ensured.")