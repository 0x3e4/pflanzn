import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.api.routes.auth import COOKIE_SAMESITE, COOKIE_SECURE
from app.core.security import AUTH_MODE, SHARE_COOKIE, get_current_admin_user
from app.database import get_db
from app.models import ShareLink, User
from app.schemas import ShareLinkCreate, ShareLinkResponse

router = APIRouter()
logger = logging.getLogger(__name__)


def _share_enabled() -> bool:
    return AUTH_MODE in ("local", "oidc")


# Image requests (<img>) can't send X-Share-Token, so a valid share link also gets an
# HttpOnly cookie that only travels to /api/uploads.
SHARE_COOKIE_PATH = "/api/uploads"


def _share_link_refused(status_code: int, detail: str) -> JSONResponse:
    response = JSONResponse(status_code=status_code, content={"detail": detail})
    response.delete_cookie(SHARE_COOKIE, path=SHARE_COOKIE_PATH)
    return response


@router.get("/validate/{token}")
def validate_share_link(token: str, db: Session = Depends(get_db)):
    """Public endpoint - validates a share token for read-only access."""
    link = db.query(ShareLink).filter(ShareLink.token == token).first()
    if not link:
        return _share_link_refused(404, "Invalid share link")
    if link.expires_at and link.expires_at < datetime.utcnow():
        return _share_link_refused(410, "Share link has expired")

    response = JSONResponse(content={"valid": True, "alias": link.alias})
    response.set_cookie(
        key=SHARE_COOKIE,
        value=link.token,
        httponly=True,
        secure=COOKIE_SECURE,
        samesite=COOKIE_SAMESITE,
        path=SHARE_COOKIE_PATH,
        # Session cookie, capped at the link's own expiry.
        expires=link.expires_at.replace(tzinfo=timezone.utc) if link.expires_at else None,
    )
    return response


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
