from unittest.mock import patch

import pytest

from app.core.security import get_current_user, require_write_access


@pytest.fixture(autouse=True)
def _no_audit_db():
    """record_audit opens its own session; keep it away from a real database."""
    with patch("app.core.audit.SessionLocal"):
        yield


NEW_ADMIN = {
    "username": "attacker",
    "email": "attacker@example.com",
    "password": "hunter2",
    "role": "admin",
}


class TestCreateUserRequiresAdmin:
    def test_anonymous_cannot_create_admin(self, client, mock_db):
        """Regression: POST /api/users/ had no auth dependency, so anyone could
        create themselves an admin account and then simply log in."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.core.security.AUTH_MODE", "local"):
            response = client.post("/api/users/", json=NEW_ADMIN)

        assert response.status_code == 401
        assert not mock_db.add.called

    def test_open_mode_rejects_instead_of_crashing(self, client, mock_db):
        """With AUTH_MODE=no there is no current user; the admin guard must return
        401 rather than raising AttributeError on None.role."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        response = client.post("/api/users/", json=NEW_ADMIN)

        assert response.status_code == 401
        assert not mock_db.add.called

    def test_non_admin_cannot_create_user(self, client, mock_db, override_dep, make_user):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        override_dep(get_current_user, make_user(role="user"))

        response = client.post("/api/users/", json=NEW_ADMIN)

        assert response.status_code == 403
        assert not mock_db.add.called

    def test_admin_can_still_create_user_with_a_role(self, client, mock_db, override_dep, make_user):
        """The legitimate admin panel flow must keep working."""
        mock_db.query.return_value.filter.return_value.first.return_value = None
        mock_db.refresh.side_effect = lambda u: setattr(u, "id", 42)
        override_dep(get_current_user, make_user(id=1, username="root", role="admin"))

        response = client.post("/api/users/", json={
            "username": "newbie",
            "email": "newbie@example.com",
            "password": "pw",
            "role": "admin",
        })

        assert response.status_code == 200
        assert response.json()["role"] == "admin"
        assert mock_db.add.called


class TestUpdateUserRole:
    def test_non_admin_cannot_self_promote(self, client, mock_db, override_dep, make_user):
        """Regression: UserUpdate carries `role` and every submitted field was
        setattr'd blindly, so any user could promote themselves."""
        target = make_user(id=2, username="bob", role="user")
        mock_db.query.return_value.filter.return_value.first.return_value = target
        override_dep(require_write_access, make_user(id=2, username="bob", role="user"))

        response = client.put("/api/users/2", json={"role": "admin"})

        assert response.status_code == 403
        assert target.role == "user"
        assert not mock_db.commit.called

    def test_non_admin_can_still_edit_own_profile(self, client, mock_db, override_dep, make_user):
        """Self-service username/email edits must not be collateral damage."""
        target = make_user(id=2, username="bob", role="user")
        mock_db.query.return_value.filter.return_value.first.return_value = target
        override_dep(require_write_access, make_user(id=2, username="bob", role="user"))

        response = client.put("/api/users/2", json={"username": "bobby"})

        assert response.status_code == 200
        assert target.username == "bobby"

    def test_admin_can_change_a_role(self, client, mock_db, override_dep, make_user):
        target = make_user(id=2, username="bob", role="user")
        mock_db.query.return_value.filter.return_value.first.return_value = target
        override_dep(require_write_access, make_user(id=1, username="root", role="admin"))

        response = client.put("/api/users/2", json={"role": "admin"})

        assert response.status_code == 200
        assert target.role == "admin"

    def test_last_admin_still_cannot_be_demoted(self, client, mock_db, override_dep, make_user):
        """Pre-existing guard must survive the new role check."""
        target = make_user(id=1, username="root", role="admin")
        query = mock_db.query.return_value.filter.return_value
        query.first.return_value = target
        query.count.return_value = 1
        override_dep(require_write_access, make_user(id=1, username="root", role="admin"))

        response = client.put("/api/users/1", json={"role": "user"})

        assert response.status_code == 400
