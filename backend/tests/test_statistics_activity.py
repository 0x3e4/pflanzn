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
