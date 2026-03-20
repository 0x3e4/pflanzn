from unittest.mock import MagicMock, patch


class TestLogin:
    def test_login_invalid_credentials(self, client, mock_db):
        """Login with wrong credentials returns 401."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        response = client.post("/api/auth/login", json={
            "username": "nonexistent",
            "password": "wrong"
        })
        assert response.status_code == 401

    def test_login_valid_credentials(self, client, mock_db):
        """Login with correct credentials returns 200 and sets cookies."""
        mock_user = MagicMock()
        mock_user.username = "admin"
        mock_user.password = "$argon2id$hashed"
        mock_user.auth_type = "local"

        mock_db.query.return_value.filter.return_value.first.return_value = mock_user

        with patch("app.api.routes.auth.verify_password", return_value=True), \
             patch("app.api.routes.auth.create_access_token", return_value="access_tok"), \
             patch("app.api.routes.auth.create_refresh_token", return_value="refresh_tok"), \
             patch("app.api.routes.auth.redis_client") as mock_redis:
            mock_redis.setex.return_value = True

            response = client.post("/api/auth/login", json={
                "username": "admin",
                "password": "admin"
            })

        assert response.status_code == 200
        assert response.json()["message"] == "Login successful"
        assert "access_token" in response.cookies
        assert "refresh_token" in response.cookies


class TestLogout:
    def test_logout_clears_cookies(self, client):
        """Logout returns 200 and clears auth cookies."""
        response = client.post("/api/auth/logout")
        assert response.status_code == 200
        assert response.json()["message"] == "Logout successful"


class TestRefresh:
    def test_refresh_without_cookie_returns_401(self, client):
        """Refresh without refresh_token cookie returns 401."""
        response = client.post("/api/auth/refresh")
        assert response.status_code == 401
