import secrets
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import ShareLink, User
from app.schemas import ShareLinkCreate, ShareLinkResponse
from app.core.security import get_current_admin_user, AUTH_MODE
from app.core.config import settings
from typing import List

router = APIRouter()
logger = logging.getLogger(__name__)


def _share_enabled() -> bool:
    return AUTH_MODE in ("local", "oidc")


@router.get("/validate/{token}")
def validate_share_link(token: str, db: Session = Depends(get_db)):
    """Public endpoint - validates a share token for read-only access."""
    link = db.query(ShareLink).filter(
        (ShareLink.token == token) | (ShareLink.alias == token)
    ).first()
    if not link:
        raise HTTPException(status_code=404, detail="Invalid share link")
    if link.expires_at and link.expires_at < datetime.utcnow():
        raise HTTPException(status_code=410, detail="Share link has expired")
    return {"valid": True, "alias": link.alias}


@router.get("/", response_model=List[ShareLinkResponse])
def list_share_links(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    if not _share_enabled():
        raise HTTPException(status_code=403, detail="Sharing is not available in this auth mode")
    return db.query(ShareLink).order_by(ShareLink.created_at.desc()).all()


@router.post("/", response_model=ShareLinkResponse)
def create_share_link(
    payload: ShareLinkCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    if not _share_enabled():
        raise HTTPException(status_code=403, detail="Sharing is not available in this auth mode")

    # Check alias uniqueness
    existing = db.query(ShareLink).filter(ShareLink.alias == payload.alias).first()
    if existing:
        raise HTTPException(status_code=409, detail="A share link with this alias already exists")

    expires_at = None
    if payload.expires_in_hours is not None:
        expires_at = datetime.utcnow() + timedelta(hours=payload.expires_in_hours)

    link = ShareLink(
        token=secrets.token_urlsafe(32),
        alias=payload.alias,
        expires_at=expires_at,
        created_by_id=current_user.id,
    )
    db.add(link)
    db.commit()
    db.refresh(link)
    return link


@router.delete("/{link_id}")
def delete_share_link(
    link_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    if not _share_enabled():
        raise HTTPException(status_code=403, detail="Sharing is not available in this auth mode")

    link = db.query(ShareLink).filter(ShareLink.id == link_id).first()
    if not link:
        raise HTTPException(status_code=404, detail="Share link not found")

    db.delete(link)
    db.commit()
    return {"message": "Share link deleted"}
