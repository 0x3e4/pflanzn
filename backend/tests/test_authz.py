from unittest.mock import MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _no_audit_db():
    """The audit middleware runs on every write; keep it off a real database."""
    with patch("app.core.audit.SessionLocal"):
        yield


# A representative slice of the endpoints that previously took no user dependency
# at all, so an anonymous request could create and destroy data at will.
WRITE_REQUESTS = [
    ("post", "/api/plants/", {"name": "x"}),
    ("put", "/api/plants/1", {"name": "x"}),
    ("delete", "/api/plants/1", None),
    ("post", "/api/plants/1/watering", {}),
    ("post", "/api/plants/waterings/bulk-delete", {"ids": [1]}),
    ("post", "/api/tags/", {"name": "x"}),
    ("put", "/api/tags/1", {"name": "x"}),
    ("delete", "/api/tags/1", None),
    ("post", "/api/locations/", {"name": "x"}),
    ("delete", "/api/locations/1", None),
]

IDS = [f"{m.upper()} {p}" for m, p, _ in WRITE_REQUESTS]


def _send(client, method, path, payload, **kwargs):
    call = getattr(client, method)
    if payload is not None:
        return call(path, json=payload, **kwargs)
    return call(path, **kwargs)


@pytest.mark.parametrize("method,path,payload", WRITE_REQUESTS, ids=IDS)
def test_write_requires_authentication(client, method, path, payload):
    """Regression: every one of these accepted anonymous writes in AUTH_MODE=local."""
    with patch("app.core.security.AUTH_MODE", "local"):
        response = _send(client, method, path, payload)

    assert response.status_code == 401


@pytest.mark.parametrize("method,path,payload", WRITE_REQUESTS, ids=IDS)
def test_share_token_cannot_write(client, method, path, payload):
    """Share links are read-only view links. get_current_user returns None for them,
    which used to fall straight through the attribution branch into a real write."""
    with patch("app.core.security.AUTH_MODE", "local"):
        response = _send(client, method, path, payload, headers={"X-Share-Token": "tok"})

    assert response.status_code == 403
    assert response.json()["detail"] == "Share links are read-only"


def test_open_mode_still_allows_writes(client, mock_db):
    """AUTH_MODE=no is documented open access; the fix must not close it."""
    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.refresh.side_effect = lambda t: setattr(t, "id", 1)

    response = client.post("/api/tags/", json={"name": "herbs"})

    assert response.status_code == 200


def test_share_token_can_still_read(client, mock_db):
    """Only writes are blocked — share links must keep rendering the plant list."""
    link = MagicMock()
    link.expires_at = None
    mock_db.query.return_value.filter.return_value.first.return_value = link
    mock_db.query.return_value.filter.return_value.all.return_value = []

    with patch("app.core.security.AUTH_MODE", "local"):
        response = client.get("/api/plants/", headers={"X-Share-Token": "tok"})

    assert response.status_code == 200


def test_logged_in_user_with_stale_share_token_can_write(client, mock_db, override_dep, make_user):
    """The frontend attaches X-Share-Token to every request once it is in
    sessionStorage, so a real session must win over a share token."""
    from app.core.security import require_write_access

    mock_db.query.return_value.filter.return_value.first.return_value = None
    mock_db.refresh.side_effect = lambda t: setattr(t, "id", 1)
    override_dep(require_write_access, make_user(role="user"))

    with patch("app.core.security.AUTH_MODE", "local"):
        response = client.post("/api/tags/", json={"name": "herbs"}, headers={"X-Share-Token": "tok"})

    assert response.status_code == 200


# Collection reads used to take no dependency at all, so in a protected deployment
# (AUTH_MODE=local/oidc + SHOW_PROTECTED_VIEW=true, the default) anyone could read
# every plant, note and location without a session or a share link.
READ_PATHS = [
    "/api/plants/",
    "/api/plants/1",
    "/api/plants/1/notes",
    "/api/plants/1/activities",
    "/api/plants/waterings/all",
    "/api/plants/identifications",
    "/api/tags/",
    "/api/tags/detailed",
    "/api/statistics/",
    "/api/locations/",
]


@pytest.mark.parametrize("path", READ_PATHS)
def test_anonymous_read_rejected_in_protected_view(client, path):
    with patch("app.core.security.AUTH_MODE", "local"), \
         patch("app.core.security.SHOW_PROTECTED_VIEW", True):
        response = client.get(path)

    assert response.status_code == 401


@pytest.mark.parametrize("auth_mode,show_protected_view", [("local", False), ("no", True)])
def test_reads_stay_public_when_view_is_unprotected(client, mock_db, auth_mode, show_protected_view):
    """SHOW_PROTECTED_VIEW=false ("browse publicly, log in to edit") and AUTH_MODE=no
    are documented public-read modes; the read gate must not close them."""
    mock_db.query.return_value.all.return_value = []

    with patch("app.core.security.AUTH_MODE", auth_mode), \
         patch("app.core.security.SHOW_PROTECTED_VIEW", show_protected_view):
        response = client.get("/api/tags/")

    assert response.status_code == 200
