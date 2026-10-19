from unittest.mock import AsyncMock, MagicMock, patch

import pytest


@pytest.fixture(autouse=True)
def _no_audit_db():
    with patch("app.core.audit.SessionLocal"):
        yield


def _callback(client, user_info, token_extra=None, require_verified=True):
    from app.models import User

    # An existing account, so the callback links to it instead of creating one.
    existing = User(id=1, username="admin", email="admin@example.com", role="admin", auth_type="oidc")
    client.mock_db.query.return_value.filter.return_value.first.return_value = existing

    token = {"access_token": "idp-at", "expires_in": 3600, **(token_extra or {})}
    oauth = MagicMock()
    oauth.oidc.authorize_access_token = AsyncMock(return_value=token)
    oauth.oidc.userinfo = AsyncMock(return_value=user_info)

    with patch("app.api.routes.auth.AUTH_MODE", "oidc"), \
         patch("app.api.routes.auth.oauth", oauth), \
         patch("app.api.routes.auth.settings.OIDC_REQUIRE_VERIFIED_EMAIL", require_verified):
        return client.get("/api/auth/oidc/callback", follow_redirects=False)


@pytest.fixture
def client(client, mock_db):
    client.mock_db = mock_db
    return client


INFO = {"email": "admin@example.com", "preferred_username": "admin"}


def test_unverified_email_is_refused_before_any_account_is_touched(client, mock_db):
    """Regression: accounts are matched by email, and an unverified claim was trusted —
    anyone able to set that address at the IdP logged in as its owner."""
    response = _callback(client, {**INFO, "email_verified": False})

    assert response.status_code == 302
    assert response.headers["location"] == "/login?error=email_unverified"
    mock_db.query.assert_not_called()
    assert "access_token" not in response.cookies


def test_missing_claim_counts_as_unverified(client, mock_db):
    response = _callback(client, INFO)

    assert response.headers["location"] == "/login?error=email_unverified"


@pytest.mark.parametrize("user_info,token_extra", [
    ({**INFO, "email_verified": True}, None),
    ({**INFO, "email_verified": "true"}, None),  # some IdPs send a string
    (INFO, {"userinfo": {"email_verified": True}}),  # claim only in the ID token
])
def test_verified_email_signs_in(client, mock_db, user_info, token_extra):
    response = _callback(client, user_info, token_extra)

    assert response.status_code == 302
    assert response.headers["location"] == "/"
    assert "access_token" in response.cookies


def test_check_can_be_disabled_for_idps_without_the_claim(client, mock_db):
    response = _callback(client, {**INFO, "email_verified": False}, require_verified=False)

    assert response.headers["location"] == "/"
