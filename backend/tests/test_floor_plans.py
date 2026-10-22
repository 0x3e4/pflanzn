import io
from unittest.mock import MagicMock, patch

import pytest
from PIL import Image

from app.models import FloorPlan, Plant, User


@pytest.fixture(autouse=True)
def _env(tmp_path):
    """Feature on, open mode (member), plan images written to a temp folder."""
    with patch("app.core.audit.SessionLocal"), \
         patch("app.core.security.AUTH_MODE", "no"), \
         patch("app.api.routes.floor_plans.app_settings.floor_plans_enabled", return_value=True), \
         patch("app.api.routes.floor_plans.FLOOR_PLAN_FOLDER", str(tmp_path)):
        yield tmp_path


def _png(size=(40, 20)) -> bytes:
    buffer = io.BytesIO()
    Image.new("RGB", size, "white").save(buffer, format="PNG")
    return buffer.getvalue()


def _plan(**overrides):
    values = dict(id=1, name="EG", address=None, image_path="floorplans/abc", width=40, height=20, sort_order=0)
    return FloorPlan(**{**values, **overrides})


# ==============================================================================
# Visibility: members only, feature switch
# ==============================================================================

class TestVisibility:
    def test_member_can_list(self, client, mock_db):
        mock_db.query.return_value.order_by.return_value.all.return_value = [_plan()]
        mock_db.query.return_value.filter.return_value.filter.return_value.all.return_value = [(5, 1, 0.5, 0.25)]
        body = client.get("/api/floor-plans").json()
        assert body[0]["name"] == "EG"
        assert body[0]["placements"] == [{"plant_id": 5, "x": 0.5, "y": 0.25}]

    def test_disabled_is_404(self, client):
        with patch("app.api.routes.floor_plans.app_settings.floor_plans_enabled", return_value=False):
            assert client.get("/api/floor-plans").status_code == 404

    def test_share_viewer_gets_404(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(expires_at=None)
        with patch("app.core.security.AUTH_MODE", "oidc"):
            response = client.get("/api/floor-plans", headers={"X-Share-Token": "tok"})
        assert response.status_code == 404

    def test_public_reader_gets_404(self, client):
        with patch("app.core.security.AUTH_MODE", "oidc"), patch("app.core.security.SHOW_PROTECTED_VIEW", False):
            assert client.get("/api/floor-plans").status_code == 404

    @pytest.mark.parametrize("path", ["floorplans/abc", "plants/../floorplans/abc", "./floorplans//abc"])
    def test_plan_images_hidden_from_share_viewers(self, client, mock_db, path):
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(expires_at=None)
        with patch("app.core.security.AUTH_MODE", "oidc"):
            response = client.get(f"/api/uploads/{path}", headers={"X-Share-Token": "tok"})
        assert response.status_code == 404

    def test_plant_api_does_not_expose_placement(self, client, mock_db):
        plant = Plant(id=5, name="Fern", floor_plan_id=1, plan_x=0.5, plan_y=0.5, images=[], waterings=[],
                      fertilizings=[], tags=[])
        mock_db.query.return_value.all.return_value = [plant]
        body = client.get("/api/plants/").json()
        assert "plan_x" not in body[0] and "floor_plan_id" not in body[0]


# ==============================================================================
# Uploads
# ==============================================================================

class TestUpload:
    def _create(self, client, content, name="EG"):
        return client.post("/api/floor-plans", data={"name": name, "address": "Hauptstr. 1"},
                           files={"file": ("plan.png", content, "image/png")})

    def test_valid_image_is_reencoded(self, client, mock_db, _env):
        mock_db.query.return_value.count.return_value = 0
        mock_db.query.return_value.order_by.return_value.first.return_value = None
        mock_db.refresh.side_effect = lambda plan: setattr(plan, "id", 1)
        response = self._create(client, _png())
        assert response.status_code == 200
        assert response.json()["width"] == 40 and response.json()["height"] == 20
        written = sorted(p.name.split("_")[-1] for p in _env.iterdir())
        assert written == ["medium.webp", "original.webp", "thumb.webp"]

    def test_non_image_rejected(self, client, mock_db, _env):
        mock_db.query.return_value.count.return_value = 0
        response = self._create(client, b"<svg onload=alert(1)>")
        assert response.status_code == 400
        assert list(_env.iterdir()) == []

    def test_too_large_rejected(self, client, mock_db):
        mock_db.query.return_value.count.return_value = 0
        with patch("app.api.routes.floor_plans.MAX_UPLOAD_BYTES", 100):
            assert self._create(client, _png((400, 400))).status_code == 413

    def test_too_many_pixels_rejected(self, client, mock_db):
        mock_db.query.return_value.count.return_value = 0
        with patch("app.api.routes.floor_plans.MAX_PIXELS", 100):
            assert self._create(client, _png()).status_code == 400

    def test_blank_name_rejected(self, client, mock_db):
        mock_db.query.return_value.count.return_value = 0
        assert self._create(client, _png(), name="\x00 ").status_code == 400

    def test_share_viewer_cannot_upload(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(expires_at=None)
        with patch("app.core.security.AUTH_MODE", "oidc"):
            response = client.post("/api/floor-plans", data={"name": "x"}, headers={"X-Share-Token": "tok"},
                                   files={"file": ("p.png", _png(), "image/png")})
        assert response.status_code == 404


# ==============================================================================
# Placements and deletion
# ==============================================================================

class TestPlacements:
    @pytest.mark.parametrize("body", [{"x": 1.5, "y": 0.2}, {"x": -0.1, "y": 0.2}, {"x": 0.1}, {"x": 0, "y": 0, "z": 1}])
    def test_invalid_coordinates(self, client, body):
        assert client.put("/api/floor-plans/1/placements/5", json=body).status_code == 422

    def test_place_plant(self, client, mock_db):
        plant = Plant(id=5, name="Fern", is_archived=False)
        mock_db.query.return_value.filter.return_value.first.side_effect = [_plan(), plant]
        response = client.put("/api/floor-plans/1/placements/5", json={"x": 0.25, "y": 0.75})
        assert response.status_code == 200
        assert (plant.floor_plan_id, plant.plan_x, plant.plan_y) == (1, 0.25, 0.75)

    def test_archived_plant_cannot_be_placed(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.side_effect = [_plan(), Plant(id=5, is_archived=True)]
        assert client.put("/api/floor-plans/1/placements/5", json={"x": 0.1, "y": 0.1}).status_code == 400

    def test_delete_clears_placements_and_files(self, client, mock_db, _env):
        (_env / "abc_original.webp").write_bytes(b"x")
        mock_db.query.return_value.filter.return_value.first.return_value = _plan(image_path="floorplans/abc")
        with patch("app.utils.uploads.settings.UPLOAD_FOLDER", str(_env.parent)), \
             patch("app.api.routes.floor_plans.delete_image_variants") as delete_files:
            assert client.delete("/api/floor-plans/1").status_code == 200
        update = mock_db.query.return_value.filter.return_value.update.call_args.args[0]
        assert set(update.values()) == {None}
        delete_files.assert_called_once()


def test_delete_image_variants_stays_inside_uploads(tmp_path):
    from app.utils.uploads import delete_image_variants

    outside = tmp_path / "outside_original.webp"
    outside.write_bytes(b"x")
    (tmp_path / "uploads").mkdir()
    with patch("app.utils.uploads.settings.UPLOAD_FOLDER", str(tmp_path / "uploads")):
        delete_image_variants("../outside")
    assert outside.exists()


# ==============================================================================
# Admin setting
# ==============================================================================

class TestSettings:
    def _user(self, role):
        return User(id=2, username="u", email="u@x", role=role, password="x")

    def test_non_admin_cannot_toggle(self, client, override_dep):
        from app.core.security import require_write_access

        override_dep(require_write_access, self._user("user"))
        with patch("app.core.security.AUTH_MODE", "oidc"):
            assert client.put("/api/settings", json={"floor_plans_enabled": True}).status_code == 403

    def test_admin_can_toggle(self, client, override_dep):
        from app.core.security import require_write_access

        override_dep(require_write_access, self._user("admin"))
        with patch("app.core.security.AUTH_MODE", "oidc"), \
             patch("app.api.routes.settings.app_settings.update", return_value={"floor_plans_enabled": True}) as upd:
            assert client.put("/api/settings", json={"floor_plans_enabled": True}).json() == {
                "floor_plans_enabled": True}
        upd.assert_called_once_with(upd.call_args.args[0], {"floor_plans_enabled": True})

    def test_unknown_keys_rejected(self, client):
        assert client.put("/api/settings", json={"auth_mode": "no"}).status_code == 422

    def test_share_viewer_cannot_toggle(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = MagicMock(expires_at=None)
        with patch("app.core.security.AUTH_MODE", "oidc"):
            response = client.put("/api/settings", json={"floor_plans_enabled": True},
                                  headers={"X-Share-Token": "tok"})
        assert response.status_code == 403

    def test_setting_values_are_type_checked(self):
        from app.services import app_settings

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = MagicMock(value='"yes"')
        assert app_settings.get_setting(db, "floor_plans_enabled") is False
        with pytest.raises(ValueError):
            app_settings.update(db, {"floor_plans_enabled": "yes"})

    def test_config_reports_flag(self, client):
        with patch("app.api.routes.config.app_settings.floor_plans_enabled", return_value=True):
            assert client.get("/api/config").json()["floor_plans_enabled"] is True


# ==============================================================================
# Request bodies are capped before multipart parsing (and before auth)
# ==============================================================================

class TestBodySizeLimit:
    @pytest.fixture
    def limited(self):
        from starlette.applications import Starlette
        from starlette.responses import PlainTextResponse
        from starlette.routing import Route
        from starlette.testclient import TestClient

        from app.core.body_limit import BodySizeLimitMiddleware

        async def echo(request):
            return PlainTextResponse(str(len(await request.body())))

        app = Starlette(routes=[Route("/", echo, methods=["POST"])])
        return TestClient(BodySizeLimitMiddleware(app, max_bytes=10))

    def test_small_body_passes(self, limited):
        assert limited.post("/", content=b"0123456789").text == "10"

    def test_declared_oversize_is_rejected_without_reading(self, limited):
        assert limited.post("/", content=b"x" * 11).status_code == 413

    def test_chunked_oversize_is_rejected(self, limited):
        def chunks():
            yield b"x" * 6
            yield b"x" * 6

        assert limited.post("/", content=chunks()).status_code == 413

    def test_app_rejects_oversized_upload_before_auth(self, client):
        from app.core.config import settings

        too_big = str(settings.MAX_UPLOAD_MB * 1024 * 1024 + 1)
        with patch("app.core.security.AUTH_MODE", "oidc"):
            response = client.post("/api/floor-plans", content=b"x", headers={"Content-Length": too_big,
                                                                             "Content-Type": "multipart/form-data"})
        assert response.status_code == 413
