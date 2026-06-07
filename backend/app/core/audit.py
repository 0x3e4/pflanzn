"""Centralized audit logging.

`record_audit` writes a single immutable row to `audit_logs` using its OWN
short-lived session — never the request's `get_db` session (which is already
closed by the time the middleware resumes, and whose transaction must not be
polluted by an audit write). Every code path swallows errors: auditing must
never break or 500 the request it is recording.
"""
import json
import logging
from typing import Optional, Tuple

from app.core.config import settings
from app.core.security import AUTH_MODE, decode_token
from app.database import SessionLocal
from app.models import AuditLog, User

logger = logging.getLogger(__name__)

AUDIT_ENABLED = getattr(settings, "AUDIT_ENABLED", True)


def client_ip(request) -> Optional[str]:
    """Real client IP, honoring the nginx X-Forwarded-For / X-Real-IP hops."""
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip() or None
    real = request.headers.get("x-real-ip")
    if real:
        return real.strip() or None
    return request.client.host if request.client else None


def resolve_actor(request, db) -> Tuple[Optional[int], Optional[str]]:
    """Best-effort actor from the access_token cookie.

    NEVER raises — returns (None, None) for AUTH_MODE=no, share tokens, and
    missing/expired/invalid tokens. If the token is valid but the user was
    deleted, keeps the username snapshot from the token subject.
    """
    if AUTH_MODE == "no":
        return None, None
    token = request.cookies.get("access_token")
    if not token:
        return None, None
    try:
        payload = decode_token(token)  # raises HTTPException on bad/expired token
        identifier = payload.get("sub")
        if not identifier:
            return None, None
        user = db.query(User).filter(
            (User.username == identifier) | (User.email == identifier)
        ).first()
        if user:
            return user.id, user.username
        return None, identifier  # token valid but user gone -> keep snapshot
    except Exception:
        return None, None


def parse_entity(path: str) -> Tuple[Optional[str], Optional[int]]:
    """`/api/{entity}/{id}/...` -> (singular_entity, id). Best-effort, never raises.

    e.g. `/api/plants/12/water` -> ("plant", 12); `/api/users/3` -> ("user", 3).
    """
    parts = [p for p in path.split("/") if p]  # ["api", "plants", "12", "water"]
    if len(parts) < 2 or parts[0] != "api":
        return None, None
    entity = parts[1][:-1] if parts[1].endswith("s") else parts[1]
    entity_id = None
    if len(parts) >= 3 and parts[2].isdigit():
        entity_id = int(parts[2])
    return entity or None, entity_id


def record_audit(
    request,
    *,
    action: str,
    entity_type: Optional[str] = None,
    entity_id: Optional[int] = None,
    user_id: Optional[int] = None,
    username: Optional[str] = None,
    status_code: Optional[int] = None,
    details: Optional[dict] = None,
) -> None:
    """Insert ONE audit row using a dedicated session.

    Swallows all errors so an audit hiccup can never roll back or 500 the real
    request. When user_id/username are not supplied, the actor is resolved from
    the request cookie.
    """
    if not AUDIT_ENABLED:
        return
    db = None
    try:
        db = SessionLocal()
        if user_id is None and username is None:
            user_id, username = resolve_actor(request, db)
        ua = request.headers.get("user-agent") or ""
        row = AuditLog(
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            user_id=user_id,
            username=username,
            method=request.method,
            path=request.url.path,
            status_code=status_code,
            ip_address=client_ip(request),
            user_agent=ua[:512] or None,
            details=json.dumps(details) if details is not None else None,
        )
        db.add(row)
        db.commit()
    except Exception as e:  # pragma: no cover - defensive
        logger.warning(f"Audit write failed (action={action}): {e}")
        if db is not None:
            try:
                db.rollback()
            except Exception:
                pass
    finally:
        if db is not None:
            db.close()
