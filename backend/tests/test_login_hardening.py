from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def _no_audit_db():
    with patch("app.core.audit.SessionLocal"):
        yield


def _user(**overrides):
    user = MagicMock()
    user.id = 7
    user.username = "admin"
    user.password = "$argon2id$stored"
    user.auth_type = "local"
    for key, value in overrides.items():
        setattr(user, key, value)
    return user


def _redis(failures=None):
    redis = MagicMock()
    redis.get.return_value = failures
    redis.incr.return_value = 1
    return redis


class TestLoginLockout:
    def test_locked_account_is_refused_without_checking_password(self, client, mock_db):
        """Regression: login had no throttle — FAILED_LOGIN_ATTEMPTS was never used."""
        mock_db.query.return_value.filter.return_value.first.return_value = _user()

        with patch("app.api.routes.auth.redis_client", _redis(failures="10")), \
             patch("app.api.routes.auth.verify_password") as verify:
            response = client.post("/api/auth/login", json={"username": "admin", "password": "guess"})

        assert response.status_code == 429
        verify.assert_not_called()

    def test_failure_is_counted_against_the_account_id(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = _user()
        redis = _redis()

        with patch("app.api.routes.auth.redis_client", redis), \
             patch("app.api.routes.auth.verify_password", return_value=False):
            response = client.post("/api/auth/login", json={"username": "ADMIN ", "password": "guess"})

        assert response.status_code == 401
        redis.incr.assert_called_once_with("login_fail:user:7")
        redis.expire.assert_called_once_with("login_fail:user:7", 900)

    def test_unknown_usernames_lock_out_too(self, client, mock_db):
        """Otherwise only real accounts would ever answer 429 — an enumeration oracle."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.api.routes.auth.redis_client", _redis(failures="10")):
            response = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})

        assert response.status_code == 429

    def test_successful_login_clears_the_counter(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = _user()
        redis = _redis(failures="3")

        with patch("app.api.routes.auth.redis_client", redis), \
             patch("app.api.routes.auth.verify_password", return_value=True), \
             patch("app.api.routes.auth.create_access_token", return_value="a"), \
             patch("app.api.routes.auth.create_refresh_token", return_value="r"):
            response = client.post("/api/auth/login", json={"username": "admin", "password": "right"})

        assert response.status_code == 200
        redis.delete.assert_called_once_with("login_fail:user:7")


class TestLoginTiming:
    def test_unknown_user_still_pays_for_a_password_hash(self, client, mock_db):
        """Regression: a missing user short-circuited before Argon2 ran, so it answered faster."""
        from app.api.routes.auth import _DUMMY_PASSWORD_HASH

        mock_db.query.return_value.filter.return_value.first.return_value = None

        with patch("app.api.routes.auth.redis_client", _redis()), \
             patch("app.api.routes.auth.verify_password", return_value=False) as verify:
            response = client.post("/api/auth/login", json={"username": "nobody", "password": "x"})

        assert response.status_code == 401
        verify.assert_called_once_with("x", _DUMMY_PASSWORD_HASH)

    def test_passwordless_oidc_user_gets_401_not_500(self, client, mock_db):
        """verify_password(…, None) used to raise inside Argon2."""
        mock_db.query.return_value.filter.return_value.first.return_value = _user(password=None, auth_type="oidc")

        with patch("app.api.routes.auth.redis_client", _redis()):
            response = client.post("/api/auth/login", json={"username": "admin", "password": "x"})

        assert response.status_code == 401


class TestUploadContainment:
    def test_sibling_directory_sharing_the_prefix_is_refused(self, tmp_path):
        """Regression: startswith() accepted <root>/uploads_backup as inside <root>/uploads."""
        from app.api.routes import uploads

        (tmp_path / "uploads").mkdir()
        (tmp_path / "uploads_backup").mkdir()
        (tmp_path / "uploads_backup" / "secret.txt").write_text("nope")

        with patch.object(uploads.settings, "UPLOAD_FOLDER", str(tmp_path / "uploads")):
            with pytest.raises(HTTPException) as exc:
                uploads.serve_upload("../uploads_backup/secret.txt", size="original")

        assert exc.value.status_code == 403

    def test_file_inside_the_upload_folder_is_served(self, tmp_path):
        from app.api.routes import uploads

        (tmp_path / "uploads" / "plants").mkdir(parents=True)
        (tmp_path / "uploads" / "plants" / "abc_original.webp").write_bytes(b"RIFF")

        with patch.object(uploads.settings, "UPLOAD_FOLDER", str(tmp_path / "uploads")):
            response = uploads.serve_upload("plants/abc", size="original")

        assert response.path.endswith("abc_original.webp")
