"""Baseline audit middleware.

Logs every mutating request (POST/PUT/PATCH/DELETE under `/api/*`) as one
generic audit row. Routes that record their own *semantic* audit row (login,
logout, user admin actions) are listed in `_SEMANTIC_SKIP` so they are not
double-logged — this skip-list, not `request.state`, is the source of truth
for de-dup, which sidesteps the Starlette BaseHTTPMiddleware `request.state`
propagation caveat. The whole body is wrapped so auditing can never 500 a
real request.
"""
import logging
import re

from app.core.audit import AUDIT_ENABLED, parse_entity, record_audit

logger = logging.getLogger(__name__)

WRITE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}

_ACTION_BY_METHOD = {"POST": "create", "PUT": "update", "PATCH": "update", "DELETE": "delete"}

# Routes that emit their OWN semantic audit row -> middleware must not also log.
_SEMANTIC_SKIP = [
    ("POST", re.compile(r"^/api/auth/login/?$")),
    ("POST", re.compile(r"^/api/auth/logout/?$")),
    ("POST", re.compile(r"^/api/users/?$")),
    ("PUT", re.compile(r"^/api/users/\d+/?$")),
    ("PUT", re.compile(r"^/api/users/\d+/changepassword/?$")),
    ("DELETE", re.compile(r"^/api/users/\d+/?$")),
]

# Never audit: reads of the audit log itself, token-refresh noise, API docs.
_NEVER = [
    re.compile(r"^/api/audit"),
    re.compile(r"^/api/auth/refresh/?$"),
    re.compile(r"^/api/docs"),
]


def _is_semantic(method: str, path: str) -> bool:
    return any(m == method and rx.match(path) for m, rx in _SEMANTIC_SKIP)


def _is_never(path: str) -> bool:
    return any(rx.match(path) for rx in _NEVER)


async def audit_middleware(request, call_next):
    response = await call_next(request)

    if not AUDIT_ENABLED:
        return response

    try:
        method = request.method
        path = request.url.path

        if (
            method not in WRITE_METHODS
            or not path.startswith("/api/")
            or _is_never(path)
            or _is_semantic(method, path)
            or getattr(request.state, "audit_recorded", False)  # best-effort secondary guard
        ):
            return response

        entity_type, entity_id = parse_entity(path)
        record_audit(
            request,
            action=_ACTION_BY_METHOD.get(method, method.lower()),
            entity_type=entity_type,
            entity_id=entity_id,
            status_code=response.status_code,
        )
    except Exception as e:  # pragma: no cover - defensive
        logger.warning(f"Audit middleware error: {e}")

    return response
