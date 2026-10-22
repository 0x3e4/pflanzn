"""Regression tests for the findings of the 2026-10 security audit."""
from unittest.mock import MagicMock, patch

import pytest

from app.models import User


@pytest.fixture(autouse=True)
def _no_audit_db():
    with patch("app.core.audit.SessionLocal"):
        yield


def _user(id=5, username="bob", email="bob@example.com", role="user"):
    return User(id=id, username=username, email=email, role=role, password="x", auth_type="local")


# ==============================================================================
# Renaming yourself to another account's email must not resolve to that account
# ==============================================================================

class TestSubjectAmbiguity:
    def test_ambiguous_subject_resolves_to_nobody(self):
        from app.core.security import find_user_by_subject

        db = MagicMock()
        admin = _user(id=1, username="admin", email="admin@example.com", role="admin")
        bob = _user(id=5, username="admin@example.com")
        db.query.return_value.filter.return_value.limit.return_value.all.return_value = [admin, bob]
        assert find_user_by_subject(db, "admin@example.com") is None

    def test_unique_subject_resolves(self):
        from app.core.security import find_user_by_subject

        db = MagicMock()
        bob = _user()
        db.query.return_value.filter.return_value.limit.return_value.all.return_value = [bob]
        assert find_user_by_subject(db, "bob") is bob

    def test_session_with_ambiguous_subject_is_rejected(self, client, mock_db):
        admin = _user(id=1, username="admin", email="admin@example.com", role="admin")
        bob = _user(id=5, username="admin@example.com")
        mock_db.query.return_value.filter.return_value.limit.return_value.all.return_value = [admin, bob]
        client.cookies.set("access_token", "t")
        try:
            with patch("app.core.security.AUTH_MODE", "local"), \
                 patch("app.core.security.decode_token", return_value={"sub": "admin@example.com"}), \
                 patch("app.core.security.validate_session"):
                assert client.get("/api/users/profile").status_code == 401
        finally:
            client.cookies.clear()

    @pytest.mark.parametrize("field", ["username", "email"])
    def test_cannot_take_another_accounts_identifier(self, client, mock_db, override_dep, field):
        from app.core.security import require_write_access

        bob = _user()
        mock_db.query.return_value.filter.return_value.first.return_value = bob
        # identifier_in_use: another row (the admin) already uses this value
        mock_db.query.return_value.filter.return_value.filter.return_value.first.return_value = (1,)
        override_dep(require_write_access, bob)

        response = client.put("/api/users/5", json={field: "admin@example.com"})
        assert response.status_code == 400
        mock_db.commit.assert_not_called()
