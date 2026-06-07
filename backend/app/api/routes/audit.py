import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.security import AUTH_MODE, get_current_user
from app.database import get_db
from app.models import AuditLog, User
from app.schemas import AuditLogPage, AuditLogResponse

logger = logging.getLogger(__name__)

router = APIRouter()


def _require_audit_access(current_user: Optional[User]) -> None:
    """Admins only — except in AUTH_MODE=no, where there are no roles so it's open."""
    if AUTH_MODE == "no":
        return
    if not current_user or current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/", response_model=AuditLogPage)
def list_audit_logs(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=200),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    username: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    q: Optional[str] = Query(None, description="Free-text match on path or username"),
):
    """Paginated audit log, newest first. Admin-only (open in AUTH_MODE=no)."""
    _require_audit_access(current_user)

    query = db.query(AuditLog)
    if action:
        query = query.filter(AuditLog.action == action)
    if entity_type:
        query = query.filter(AuditLog.entity_type == entity_type)
    if username:
        query = query.filter(AuditLog.username == username)
    if user_id is not None:
        query = query.filter(AuditLog.user_id == user_id)
    if date_from:
        query = query.filter(AuditLog.created_at >= date_from)
    if date_to:
        query = query.filter(AuditLog.created_at <= date_to)
    if q:
        like = f"%{q}%"
        query = query.filter((AuditLog.path.like(like)) | (AuditLog.username.like(like)))

    total = query.count()
    rows = (
        query.order_by(AuditLog.created_at.desc())
        .offset((page - 1) * per_page)
        .limit(per_page)
        .all()
    )

    items = []
    for r in rows:
        detail = None
        if r.details:
            try:
                detail = json.loads(r.details)
            except (json.JSONDecodeError, TypeError):
                detail = None
        items.append(
            AuditLogResponse(
                id=r.id,
                created_at=r.created_at,
                user_id=r.user_id,
                username=r.username,
                action=r.action,
                entity_type=r.entity_type,
                entity_id=r.entity_id,
                method=r.method,
                path=r.path,
                status_code=r.status_code,
                ip_address=r.ip_address,
                user_agent=r.user_agent,
                details=detail,
            )
        )

    return AuditLogPage(items=items, total=total, page=page, per_page=per_page)
