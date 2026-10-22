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
