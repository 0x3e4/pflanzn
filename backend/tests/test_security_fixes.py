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


# ==============================================================================
# The PlantNet API key (a query parameter) must never reach a response or a log
# ==============================================================================

class TestPlantNetKeyLeak:
    KEY = "PLANTNET-SECRET-KEY"

    @pytest.fixture
    def image(self, tmp_path):
        path = tmp_path / "x.jpg"
        path.write_bytes(b"jpeg")
        return str(path)

    def _response(self, status):
        import requests

        req = requests.Request("POST", "https://my-api.plantnet.org/v2/identify/all",
                               params={"api-key": self.KEY}).prepare()
        response = requests.Response()
        response.status_code, response.url, response.request = status, req.url, req
        return response

    @pytest.mark.parametrize("status", [400, 401, 429, 500])
    def test_http_errors_are_sanitized(self, image, status, caplog):
        from app.services.plantnet import PlantNetError, identify_species_via_plantnet

        with patch("app.services.plantnet.settings.PLANTNET_API_KEY", self.KEY), \
             patch("app.services.plantnet.requests.post", return_value=self._response(status)):
            with pytest.raises(PlantNetError) as exc:
                identify_species_via_plantnet(image, "image/jpeg", "x.jpg")
        assert self.KEY not in str(exc.value)
        # Nothing chained that could carry the keyed URL into a traceback.
        assert exc.value.__context__ is None or exc.value.__suppress_context__
        assert self.KEY not in caplog.text

    def test_connection_errors_are_sanitized(self, image, caplog):
        import requests

        from app.services.plantnet import PlantNetError, identify_species_via_plantnet

        boom = requests.ConnectionError(f"Max retries exceeded with url: /v2/identify/all?api-key={self.KEY}")
        with patch("app.services.plantnet.requests.post", side_effect=boom):
            with pytest.raises(PlantNetError) as exc:
                identify_species_via_plantnet(image, "image/jpeg", "x.jpg")
        assert self.KEY not in str(exc.value)
        assert self.KEY not in caplog.text

    def test_no_match_is_an_empty_result(self, image):
        from app.services.plantnet import identify_species_via_plantnet

        with patch("app.services.plantnet.requests.post", return_value=self._response(404)):
            assert identify_species_via_plantnet(image, "image/jpeg", "x.jpg") == {"results": []}

    def test_identify_route_never_echoes_exception_text(self, client, mock_db, tmp_path):
        from app.core.config import settings
        from app.models import Plant, PlantImage

        plant = Plant(id=1, name="Fern")
        plant.images = [PlantImage(id=1, plant_id=1, image_path="plants/x")]
        mock_db.query.return_value.filter.return_value.first.return_value = plant
        leaky = RuntimeError(f"for url: https://my-api.plantnet.org/?api-key={self.KEY}")
        with patch("app.core.security.AUTH_MODE", "no"), patch.object(settings, "PLANTNET_API_KEY", self.KEY), \
             patch("app.api.routes.plants._resolve_image_file", return_value="/tmp/x"), \
             patch("app.api.routes.plants._to_jpeg_for_plantnet", return_value=str(tmp_path / "j.jpg")), \
             patch("app.api.routes.plants.identify_species_via_plantnet", side_effect=leaky):
            response = client.post("/api/plants/1/identify")
        assert response.status_code == 200
        assert self.KEY not in response.text


# ==============================================================================
# Share links: only the random token is a credential, never the alias
# ==============================================================================

def _filter_sql(mock_db) -> str:
    clause = mock_db.query.return_value.filter.call_args.args[0]
    return str(clause.compile(compile_kwargs={"literal_binds": True}))


class TestShareAlias:
    def test_validate_matches_token_only(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = None
        response = client.get("/api/share/validate/family")
        assert response.status_code == 404
        sql = _filter_sql(mock_db)
        assert "share_links.token" in sql and "alias" not in sql

    def test_request_gate_matches_token_only(self):
        from app.core.security import _is_valid_share_token

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = None
        assert _is_valid_share_token("family", db) is False
        sql = _filter_sql(db)
        assert "share_links.token" in sql and "alias" not in sql


# ==============================================================================
# OIDC refresh tokens are bound to server state and revoked on logout
# ==============================================================================

class TestOidcRefreshBinding:
    def _refresh_token(self, sub="alice@example.com"):
        from datetime import timedelta

        from app.core.security import create_refresh_token

        return create_refresh_token({"sub": sub}, expires_delta=timedelta(days=1))

    def _post_refresh(self, client, token):
        client.cookies.set("refresh_token", token)
        try:
            with patch("app.api.routes.auth.AUTH_MODE", "oidc"):
                return client.post("/api/auth/refresh")
        finally:
            client.cookies.clear()

    def test_validly_signed_but_never_issued_token_is_refused(self, client):
        from app.api.routes import auth

        auth.redis_client.get.return_value = None  # nothing issued for this subject
        response = self._post_refresh(client, self._refresh_token())
        assert response.status_code == 401
        auth.redis_client.set.assert_not_called()  # never reached the IdP refresh

    def test_superseded_token_is_refused(self, client):
        from app.api.routes import auth

        auth.redis_client.get.return_value = self._refresh_token(sub="someone-else")
        assert self._post_refresh(client, self._refresh_token()).status_code == 401

    def test_logout_revokes_matching_server_state(self, client):
        from app.api.routes import auth

        token = self._refresh_token()
        auth.redis_client.get.return_value = token
        auth.redis_client.delete.reset_mock()
        client.cookies.set("refresh_token", token)
        try:
            client.post("/api/auth/logout")
        finally:
            client.cookies.clear()
        deleted = {key for call in auth.redis_client.delete.call_args_list for key in call.args}
        assert {"refresh:alice@example.com", "idp:refresh:alice@example.com"} <= deleted

    def test_logout_leaves_other_sessions_alone(self, client):
        from app.api.routes import auth

        auth.redis_client.get.return_value = "a-newer-token"
        auth.redis_client.delete.reset_mock()
        client.cookies.set("refresh_token", self._refresh_token())
        try:
            client.post("/api/auth/logout")
        finally:
            client.cookies.clear()
        auth.redis_client.delete.assert_not_called()

    def test_bad_signature_is_401_not_500(self, client):
        assert self._post_refresh(client, "not.a.jwt").status_code == 401


class TestSecretKeyCheck:
    @pytest.mark.parametrize("value", [None, "", "change_me", "CHANGE_ME "])
    def test_example_key_refused(self, value):
        from app.core.config import settings
        from app.main import check_secret_key

        with patch.object(settings, "AUTH_MODE", "oidc"), patch.object(settings, "SECRET_KEY", value):
            with pytest.raises(RuntimeError):
                check_secret_key()

    def test_open_mode_needs_no_key(self):
        from app.core.config import settings
        from app.main import check_secret_key

        with patch.object(settings, "AUTH_MODE", "no"), patch.object(settings, "SECRET_KEY", None):
            check_secret_key()

    def test_strong_key_accepted(self):
        from app.core.config import settings
        from app.main import check_secret_key

        with patch.object(settings, "AUTH_MODE", "local"), patch.object(settings, "SECRET_KEY", "k" * 48):
            check_secret_key()
