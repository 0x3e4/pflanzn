from datetime import datetime, timedelta
from unittest.mock import MagicMock


def _make_share_link(token="abc123", alias="my-garden", expired=False):
    link = MagicMock()
    link.id = 1
    link.token = token
    link.alias = alias
    link.created_at = datetime.utcnow()
    link.created_by_id = 1
    if expired:
        link.expires_at = datetime.utcnow() - timedelta(hours=1)
    else:
        link.expires_at = None
    return link


class TestValidateShareLink:
    def test_valid_token(self, client, mock_db):
        """Valid share token returns 200 with valid=True."""
        mock_link = _make_share_link()
        mock_db.query.return_value.filter.return_value.first.return_value = mock_link

        response = client.get("/api/share/validate/abc123")
        assert response.status_code == 200
        assert response.json()["valid"] is True

    def test_invalid_token(self, client, mock_db):
        """Invalid share token returns 404."""
        mock_db.query.return_value.filter.return_value.first.return_value = None

        response = client.get("/api/share/validate/nonexistent")
        assert response.status_code == 404

    def test_expired_token(self, client, mock_db):
        """Expired share token returns 410."""
        mock_link = _make_share_link(expired=True)
        mock_db.query.return_value.filter.return_value.first.return_value = mock_link

        response = client.get("/api/share/validate/abc123")
        assert response.status_code == 410
