from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.routes.statistics import ACTIVITY_DAYS, ACTIVITY_WEEKS, build_activity
from app.core.config import settings
from app.models import Base, Plant, PlantFertilizing, PlantImage, PlantNote, PlantWatering

# Sunday 2026-11-08, 10:00 UTC = 11:00 in Vienna.
NOW = datetime(2026, 11, 8, 10, 0)


@pytest.fixture
def db():
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    session = sessionmaker(bind=engine)()
    try:
        yield session
    finally:
        session.close()
        engine.dispose()


def _plant(db, name, archived=False):
    plant = Plant(name=name, is_archived=archived)
    db.add(plant)
    db.flush()
    return plant


def _activity(db):
    with patch.object(settings, "TZ", "Europe/Vienna"):
        return build_activity(db, now_utc=NOW)


def test_empty_collection_has_a_full_year_and_twelve_weeks(db):
    data = _activity(db)
    assert len(data["days"]) == ACTIVITY_DAYS
    assert data["days"][-1]["date"] == "2026-11-08"
    assert len(data["weeks"]) == ACTIVITY_WEEKS
    assert data["weeks"][-1]["start"] == "2026-11-02"  # the Monday of this week
    assert data["mostCared"] == []
    assert data["recent"]["waterings"] == {"last30": 0, "previous30": 0}


def test_days_follow_the_local_calendar(db):
    plant = _plant(db, "Monstera")
    # 23:30 UTC on Nov 7 is already Nov 8 in Vienna.
    db.add(PlantWatering(plant_id=plant.id, watered_at=datetime(2026, 11, 7, 23, 30)))
    db.add(PlantFertilizing(plant_id=plant.id, fertilized_at=datetime(2026, 11, 6, 9, 0)))
    db.add(PlantImage(plant_id=plant.id, image_path="plants/x", uploaded_at=datetime(2026, 11, 6, 9, 0)))
    db.commit()

    days = {d["date"]: d for d in _activity(db)["days"]}
    assert days["2026-11-08"]["waterings"] == 1
    assert days["2026-11-07"]["waterings"] == 0
    assert days["2026-11-06"]["fertilizings"] == 1
    assert days["2026-11-06"]["photos"] == 1


def test_weeks_split_manual_and_rain(db):
    plant = _plant(db, "Basil")
    db.add(PlantWatering(plant_id=plant.id, watered_at=NOW - timedelta(hours=2)))
    db.add(PlantWatering(plant_id=plant.id, watered_at=NOW - timedelta(days=1), rainfall_mm=12.0))
    db.add(PlantWatering(plant_id=plant.id, watered_at=NOW - timedelta(days=9)))
    db.commit()

    weeks = _activity(db)["weeks"]
    assert weeks[-1] == {"start": "2026-11-02", "manual": 1, "rain": 1}
    assert weeks[-2] == {"start": "2026-10-26", "manual": 1, "rain": 0}


def test_recent_compares_the_last_30_days_with_the_30_before(db):
    plant = _plant(db, "Ficus")
    for days_ago in (1, 5, 29, 31, 59, 61):
        db.add(PlantWatering(plant_id=plant.id, watered_at=NOW - timedelta(days=days_ago)))
    db.commit()

    assert _activity(db)["recent"]["waterings"] == {"last30": 3, "previous30": 2}


def test_archived_plants_are_left_out(db):
    active, archived = _plant(db, "Active"), _plant(db, "Gone", archived=True)
    db.add(PlantWatering(plant_id=active.id, watered_at=NOW - timedelta(days=1)))
    db.add(PlantWatering(plant_id=archived.id, watered_at=NOW - timedelta(days=1)))
    db.commit()

    data = _activity(db)
    assert sum(d["waterings"] for d in data["days"]) == 1
    assert [p["name"] for p in data["mostCared"]] == ["Active"]


def test_most_cared_counts_hand_work_in_the_last_90_days(db):
    busy, rainy, old = _plant(db, "Busy"), _plant(db, "Rainy"), _plant(db, "Old")
    for _ in range(3):
        db.add(PlantWatering(plant_id=busy.id, watered_at=NOW - timedelta(days=2)))
    db.add(PlantFertilizing(plant_id=busy.id, fertilized_at=NOW - timedelta(days=3)))
    db.add(PlantNote(plant_id=busy.id, note_text="repotted", created_at=NOW - timedelta(days=4)))
    for _ in range(10):  # rain doesn't count as care
        db.add(PlantWatering(plant_id=rainy.id, watered_at=NOW - timedelta(days=2), rainfall_mm=15.0))
    db.add(PlantWatering(plant_id=old.id, watered_at=NOW - timedelta(days=120)))
    db.commit()

    most = _activity(db)["mostCared"]
    assert most == [{
        "id": busy.id, "name": "Busy", "total": 5,
        "waterings": 3, "fertilizings": 1, "photos": 0, "notes": 1,
    }]


def test_endpoint_is_mounted(client, mock_db):
    with patch("app.api.routes.statistics.build_activity", return_value={"days": []}) as build:
        response = client.get("/api/statistics/activity")
    assert response.status_code == 200
    assert response.json() == {"days": []}
    build.assert_called_once()


# ── build_recent: the home page feed ─────────────────────────────────────────

from app.api.routes.statistics import NOTE_PREVIEW, build_recent  # noqa: E402
from app.models import PlantCareAdvice, User  # noqa: E402


def _recent(db, member=True, **kwargs):
    with patch.object(settings, "TZ", "Europe/Vienna"):
        return build_recent(db, member=member, now_utc=NOW, **kwargs)["events"]


def test_water_all_is_one_event_with_every_plant(db):
    ann = User(username="ann", email="ann@example.com", role="user")
    db.add(ann)
    plants = [_plant(db, name) for name in ("Fern", "Ficus", "Basil")]
    db.flush()
    for i, plant in enumerate(plants):
        db.add(PlantWatering(plant_id=plant.id, user_id=ann.id, watered_at=NOW - timedelta(minutes=10, seconds=i * 20)))
    db.commit()

    events = _recent(db)
    assert len(events) == 1
    assert events[0]["type"] == "watering" and events[0]["by"] == "ann" and events[0]["rain"] is False
    assert [p["name"] for p in events[0]["plants"]] == ["Fern", "Ficus", "Basil"]
    assert events[0]["at"].startswith("2026-11-08T10:50")  # local time, Vienna


def test_rain_and_hand_watering_stay_apart(db):
    fern, ficus = _plant(db, "Fern"), _plant(db, "Ficus")
    db.add(PlantWatering(plant_id=fern.id, watered_at=NOW - timedelta(hours=1), rainfall_mm=12.0))
    db.add(PlantWatering(plant_id=ficus.id, watered_at=NOW - timedelta(hours=1, seconds=30), rainfall_mm=12.0))
    db.add(PlantWatering(plant_id=fern.id, watered_at=NOW - timedelta(hours=1, minutes=1)))
    db.commit()

    events = _recent(db)
    assert [(e["rain"], len(e["plants"])) for e in events] == [(True, 2), (False, 1)]


def test_readers_without_a_login_do_not_see_who(db):
    ann = User(username="ann", email="ann@example.com", role="user")
    db.add(ann)
    fern = _plant(db, "Fern")
    db.flush()
    db.add(PlantNote(plant_id=fern.id, user_id=ann.id, note_text="Repotted", created_at=NOW - timedelta(hours=2)))
    db.commit()

    assert _recent(db, member=True)[0]["by"] == "ann"
    assert _recent(db, member=False)[0]["by"] is None


def test_notes_are_previewed_and_kinds_are_newest_first(db):
    fern = _plant(db, "Fern")
    db.add(PlantNote(plant_id=fern.id, note_text="word " * 100, created_at=NOW - timedelta(hours=1)))
    db.add(PlantCareAdvice(plant_id=fern.id, advice_text="x", generated_at=NOW - timedelta(hours=2)))
    db.add(PlantImage(plant_id=fern.id, image_path="plants/a", uploaded_at=NOW - timedelta(hours=3)))
    db.add(PlantFertilizing(plant_id=fern.id, fertilized_at=NOW - timedelta(hours=4)))
    db.commit()

    events = _recent(db)
    assert [e["type"] for e in events] == ["note", "care_advice", "photo", "fertilizing"]
    assert len(events[0]["detail"]) == NOTE_PREVIEW and events[0]["detail"].endswith("…")
    assert events[1]["detail"] is None  # advice text stays on the plant page


def test_old_archived_and_beyond_the_limit_are_left_out(db):
    fern, gone = _plant(db, "Fern"), _plant(db, "Gone", archived=True)
    db.add(PlantWatering(plant_id=gone.id, watered_at=NOW - timedelta(hours=1)))
    db.add(PlantWatering(plant_id=fern.id, watered_at=NOW - timedelta(days=20)))
    for hours in range(1, 12):
        db.add(PlantNote(plant_id=fern.id, note_text=f"n{hours}", created_at=NOW - timedelta(hours=hours)))
    db.commit()

    events = _recent(db, limit=5)
    assert len(events) == 5
    assert {p["name"] for e in events for p in e["plants"]} == {"Fern"}
    assert [e["detail"] for e in events] == ["n1", "n2", "n3", "n4", "n5"]


def test_recent_endpoint_hides_names_from_share_viewers(client, mock_db):
    from app.core.security import AUDIENCE_SHARE, require_read_access
    from app.main import app

    app.dependency_overrides[require_read_access] = lambda: AUDIENCE_SHARE
    try:
        with patch("app.api.routes.statistics.build_recent", return_value={"days": 14, "events": []}) as build:
            assert client.get("/api/statistics/recent").status_code == 200
        assert build.call_args.kwargs["member"] is False
    finally:
        app.dependency_overrides.pop(require_read_access, None)
