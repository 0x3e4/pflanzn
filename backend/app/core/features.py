"""Route dependencies for features that can be switched off per deployment.

The frontend hides the matching buttons based on /api/config, but the backend is
the source of truth: a disabled feature answers 404 no matter who calls it.
"""
from fastapi import HTTPException

from app.core.config import settings


def require_llm() -> None:
    """AI text generation (care advice, species/location descriptions)."""
    if not settings.llm_available:
        raise HTTPException(status_code=404, detail="AI text generation is disabled on this server")


def require_identification() -> None:
    """PlantNet species identification."""
    if not settings.identification_available:
        raise HTTPException(status_code=404, detail="Plant identification is disabled on this server")
