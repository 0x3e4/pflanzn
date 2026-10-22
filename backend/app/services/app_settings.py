"""Instance-wide settings changed from the UI (stored in `app_settings`).

Only keys declared in SETTINGS exist: unknown keys are never read or written, and
every value is checked against its declared type, so the table can't be turned
into an arbitrary key/value store from the API.
"""
import json
import logging
from typing import Any

from sqlalchemy.orm import Session

from app.models import AppSetting

logger = logging.getLogger(__name__)

# key -> (type, default)
SETTINGS: dict[str, tuple[type, Any]] = {
    "floor_plans_enabled": (bool, False),
}


def get_setting(db: Session, key: str) -> Any:
    expected_type, default = SETTINGS[key]
    try:
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        value = json.loads(row.value) if row else default
    except (TypeError, ValueError) as exc:
        logger.warning(f"Ignoring unreadable app setting {key}: {exc}")
        return default
    return value if isinstance(value, expected_type) else default


def get_all(db: Session) -> dict[str, Any]:
    return {key: get_setting(db, key) for key in SETTINGS}


def update(db: Session, values: dict[str, Any]) -> dict[str, Any]:
    """Writes the given known keys (already type-validated by the request schema)."""
    for key, value in values.items():
        expected_type, _ = SETTINGS[key]
        if not isinstance(value, expected_type):
            raise ValueError(f"{key} must be {expected_type.__name__}")
        row = db.query(AppSetting).filter(AppSetting.key == key).first()
        if row:
            row.value = json.dumps(value)
        else:
            db.add(AppSetting(key=key, value=json.dumps(value)))
    db.commit()
    return get_all(db)


def floor_plans_enabled(db: Session) -> bool:
    return bool(get_setting(db, "floor_plans_enabled"))
