import logging
import os
from fastapi import FastAPI, Depends, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.api.routes import auth, plants, locations, users
from app.database import init_db
from app.core.security import create_admin_user
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

# Initialize database
init_db()
logger.info("Database initialized.")

# Initialize FastAPI
app = FastAPI(title="Plant Management API", version="1.0")

# CORS settings
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
UPLOAD_FOLDER = os.path.join(BASE_DIR, "uploads")

app.mount("/api/uploads", StaticFiles(directory=UPLOAD_FOLDER), name="uploads")

# Include routers
app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(plants.router, prefix="/api/plants", tags=["Plants"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(locations.router, prefix="/api/locations", tags=["Locations"])

@app.get("/")
def root():
    logger.info("Root endpoint accessed.")
    return {"message": "Welcome to the Plant Management API!"}

@app.on_event("startup")
def startup_event():
    if os.getenv("VITE_AUTH_MODE") == "local":
        create_admin_user()