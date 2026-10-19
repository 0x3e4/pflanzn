from datetime import datetime, timedelta
from unittest.mock import MagicMock, patch

import pytest
from fastapi import HTTPException


@pytest.fixture(autouse=True)
def _no_audit_db():
    with patch("app.core.audit.SessionLocal"):
        yield


def _sql(expression) -> str:
    return str(expression.compile(compile_kwargs={"literal_binds": True}))


def _request(cookies=None, headers=None):
    request = MagicMock()
    request.cookies = cookies or {}
    request.headers = headers or {}
    request.query_params = {}
    return request


class TestReadAudience:
    """require_read_access decides who is reading, which decides what they may see."""

    def _audience(self, request, auth_mode="local", protected=True, share_valid=False, session_ok=True):
        from app.core import security

        def authenticate(_request, _db):
            if not session_ok:
                raise HTTPException(status_code=401, detail="Invalid or expired session")
            return MagicMock()

        with patch.object(security, "AUTH_MODE", auth_mode), \
             patch.object(security, "SHOW_PROTECTED_VIEW", protected), \
             patch.object(security, "_is_valid_share_token", return_value=share_valid), \
             patch.object(security, "_authenticate_from_cookie", side_effect=authenticate):
            return security.require_read_access(request, MagicMock())

    def test_open_mode_reads_as_member(self):
        assert self._audience(_request(), auth_mode="no") == "member"

    def test_session_reads_as_member_even_with_a_share_token(self):
        request = _request(cookies={"access_token": "t"}, headers={"X-Share-Token": "s"})
        assert self._audience(request, share_valid=True) == "member"

    def test_share_link_reads_as_share(self):
        assert self._audience(_request(headers={"X-Share-Token": "s"}), share_valid=True) == "share"

    def test_share_cookie_counts_for_image_requests(self):
        assert self._audience(_request(cookies={"share_token": "s"}), share_valid=True) == "share"

    def test_anonymous_reads_as_public_when_view_is_unprotected(self):
        assert self._audience(_request(), protected=False) == "public"

    def test_anonymous_is_refused_when_view_is_protected(self):
        with pytest.raises(HTTPException) as exc:
            self._audience(_request())
        assert exc.value.status_code == 401

    def test_expired_session_surfaces_as_401_so_the_client_refreshes(self):
        with pytest.raises(HTTPException) as exc:
            self._audience(_request(cookies={"access_token": "old"}), session_ok=False)
        assert exc.value.detail == "Invalid or expired session"

    def test_expired_session_falls_back_to_public_when_view_is_unprotected(self):
        request = _request(cookies={"access_token": "old"})
        assert self._audience(request, protected=False, session_ok=False) == "public"


class TestLocationQueries:
    def test_members_see_every_visibility(self):
        from app.api.routes.locations import _visible_locations

        db = MagicMock()
        _visible_locations(db, "member")
        db.query.return_value.filter.assert_not_called()

    @pytest.mark.parametrize("audience,levels", [
        ("share", "('shared', 'public')"),
        ("public", "('public')"),
    ])
    def test_others_are_limited_to_their_levels(self, audience, levels):
        """Regression: visibility was stored but never enforced — share-link viewers
        (and anonymous visitors) received private locations and their coordinates."""
        from app.api.routes.locations import _visible_locations

        db = MagicMock()
        _visible_locations(db, audience)
        (expression,), _ = db.query.return_value.filter.call_args
        assert _sql(expression) == f"locations.visibility IN {levels}"

    def test_hidden_location_is_a_404(self):
        from app.api.routes.locations import _get_visible_location

        db = MagicMock()
        db.query.return_value.filter.return_value.filter.return_value.first.return_value = None
        with pytest.raises(HTTPException) as exc:
            _get_visible_location(db, 5, "share")
        assert exc.value.status_code == 404

    def test_share_link_list_request_is_filtered(self, client, mock_db):
        link = MagicMock(expires_at=None)
        mock_db.query.return_value.filter.return_value.first.return_value = link
        listing = mock_db.query.return_value.filter.return_value.order_by.return_value.all
        listing.return_value = []

        with patch("app.core.security.AUTH_MODE", "local"):
            response = client.get("/api/locations/", headers={"X-Share-Token": "tok"})

        assert response.status_code == 200
        listing.assert_called_once()


class TestUploadVisibility:
    @pytest.fixture
    def uploads_dir(self, tmp_path):
        from app.api.routes import uploads

        for name in ("locations/spot.jpg", "plants/fern_original.webp"):
            path = tmp_path / "uploads" / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(b"x")
        with patch.object(uploads.settings, "UPLOAD_FOLDER", str(tmp_path / "uploads")):
            yield uploads

    def _db(self, visible):
        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.first.return_value = (1,) if visible else None
        return db

    @pytest.mark.parametrize("path", ["locations/spot.jpg", "plants/../locations/spot.jpg", "./locations//spot.jpg"])
    def test_hidden_location_photo_is_refused_on_every_spelling(self, uploads_dir, path):
        with pytest.raises(HTTPException) as exc:
            uploads_dir.serve_upload(path, size="original", db=self._db(visible=False), audience="share")
        assert exc.value.status_code == 404

    def test_visible_location_photo_is_served(self, uploads_dir):
        response = uploads_dir.serve_upload("locations/spot.jpg", size="original", db=self._db(True), audience="share")
        assert response.path.endswith("spot.jpg")

    def test_plant_photos_need_no_location_lookup(self, uploads_dir):
        db = MagicMock()
        response = uploads_dir.serve_upload("plants/fern", size="original", db=db, audience="public")
        assert response.path.endswith("fern_original.webp")
        db.query.assert_not_called()

    def test_anonymous_image_request_is_refused_when_view_is_protected(self, client):
        """Regression: /api/uploads had no auth at all."""
        with patch("app.core.security.AUTH_MODE", "local"), \
             patch("app.core.security.SHOW_PROTECTED_VIEW", True):
            response = client.get("/api/uploads/plants/fern?size=thumb")
        assert response.status_code == 401


class TestShareCookie:
    def test_valid_link_sets_an_uploads_scoped_cookie_holding_the_secret(self, client, mock_db):
        link = MagicMock(token="s3cret", alias="garden", expires_at=datetime.utcnow() + timedelta(days=1))
        mock_db.query.return_value.filter.return_value.first.return_value = link

        response = client.get("/api/share/validate/garden")

        assert response.status_code == 200
        cookie = response.headers["set-cookie"]
        assert cookie.startswith("share_token=s3cret;")
        assert "Path=/api/uploads" in cookie and "HttpOnly" in cookie and "expires=" in cookie

    def test_invalid_link_clears_the_cookie(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = None

        response = client.get("/api/share/validate/nope")

        assert response.status_code == 404
        assert response.json() == {"detail": "Invalid share link"}
        assert 'share_token=""' in response.headers["set-cookie"]
