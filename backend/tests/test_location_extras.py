"""Location tags, notes and harvest times (kept in the browser's localStorage before)."""
from datetime import datetime
from unittest.mock import patch

import pytest


def _location():
    from app.models import Location

    return Location(
        id=1, name="Acker", spot_type="field", visibility="private",
        created_at=datetime(2026, 1, 1), updated_at=datetime(2026, 1, 1),
    )


@pytest.fixture
def location(mock_db):
    loc = _location()
    mock_db.query.return_value.filter.return_value.first.return_value = loc

    def refresh(obj):  # stand in for the database handing out ids
        for i, row in enumerate([*obj.notes, *obj.season_events, *obj.tags], start=1):
            row.id = row.id or i

    mock_db.refresh.side_effect = refresh
    return loc


@pytest.fixture(autouse=True)
def _locations_on():
    from app.core.config import settings

    with patch("app.core.security.AUTH_MODE", "no"), patch.object(settings, "ENABLE_LOCATIONS", True):
        yield


def test_set_tags_dedupes_case_insensitively_and_drops_the_hash(client, location):
    body = client.put("/api/locations/1/tags", json={"tags": ["#Sonnig", "sonnig", " Nordhang ", "#"]}).json()
    assert body["tags"] == ["Sonnig", "Nordhang"]

    body = client.put("/api/locations/1/tags", json={"tags": ["nordhang"]}).json()
    assert body["tags"] == ["Nordhang"]


def test_note_and_harvest_time_come_back_as_utc(client, location):
    body = client.post("/api/locations/1/notes", json={"note_text": "  Boden lehmig "}).json()
    assert body["notes"][0]["note_text"] == "Boden lehmig"
    assert body["notes"][0]["created_at"].endswith("Z")

    # 10:30 in Vienna (summer time) is 08:30 UTC.
    body = client.post("/api/locations/1/season_events", json={"occurred_at": "2026-07-14T10:30:00+02:00"}).json()
    assert body["season_events"][0]["occurred_at"] == "2026-07-14T08:30:00Z"
    assert body["season_events"][0]["title"] == "Harvest time"


def test_deleting_a_note_of_another_location_is_404(client, location):
    assert client.delete("/api/locations/1/notes/42").status_code == 404


def test_import_from_the_browser_can_be_repeated(client, location):
    payload = {
        "tags": ["Bio", "bio"],
        "notes": [{"text": "Alt", "created_at": "2026-05-01T10:00:00.123Z"}],
        "season_events": [{"title": "Harvest time", "occurred_at": "2026-06-01T06:00:00Z"}],
    }
    client.post("/api/locations/1/import_local", json=payload)
    body = client.post("/api/locations/1/import_local", json=payload).json()

    assert body["tags"] == ["Bio"]
    assert [n["note_text"] for n in body["notes"]] == ["Alt"]
    assert body["notes"][0]["created_at"] == "2026-05-01T10:00:00Z"
    assert len(body["season_events"]) == 1


def test_writes_need_an_existing_location(client, mock_db):
    mock_db.query.return_value.filter.return_value.first.return_value = None
    assert client.post("/api/locations/9/notes", json={"note_text": "x"}).status_code == 404
