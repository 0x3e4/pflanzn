"""Upcoming reminders (home page, MCP) and the MCP tools around them."""
from datetime import date, datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest

from app.services import reminders as reminder_service
from app.services.mcp_tools import (
    LOCAL_TZ,
    ToolContext,
    ToolError,
    get_species_info,
    get_watering_plan,
    list_reminders,
    update_note,
)
from app.utils.time import utcnow


def _ctx(db):
    return ToolContext(db=db, user=None, scopes=set())


def _note(**kw):
    defaults = dict(id=4, plant_id=2, note_text="Repot", remind_at=datetime(2026, 11, 20, 8, 0),
                    reminded_at=None, plant=SimpleNamespace(name="Fern"))
    defaults.update(kw)
    return SimpleNamespace(**defaults)


class TestStartOfDay:
    def test_local_midnight_as_naive_utc(self):
        now = datetime(2026, 11, 16, 10, 0, tzinfo=timezone.utc)
        start = reminder_service.start_of_local_day(0, now)
        local_midnight = datetime.combine(now.astimezone(reminder_service.LOCAL_TZ).date(),
                                          datetime.min.time(), tzinfo=reminder_service.LOCAL_TZ)
        assert start == local_midnight.astimezone(timezone.utc).replace(tzinfo=None)
        assert reminder_service.start_of_local_day(2, now) == start - timedelta(days=2)


class TestRoute:
    def test_lists_upcoming_with_utc_times(self, client):
        with patch("app.core.security.AUTH_MODE", "no"), \
             patch("app.api.routes.reminders.reminder_service.upcoming", return_value=[_note()]) as upcoming:
            response = client.get("/api/reminders?days=7")
        assert response.status_code == 200
        assert response.json() == {"days": 7, "reminders": [{
            "id": 4, "plant_id": 2, "plant": "Fern", "text": "Repot",
            "remind_at": "2026-11-20T08:00:00Z", "sent": False,
        }]}
        assert upcoming.call_args.kwargs == {"days_ahead": 7, "plant_id": None}

    def test_days_are_bounded(self, client):
        with patch("app.core.security.AUTH_MODE", "no"):
            assert client.get("/api/reminders?days=500").status_code == 422


class TestListReminders:
    def test_shape(self):
        with patch("app.services.mcp_tools.reminder_service.upcoming", return_value=[_note(reminded_at=utcnow())]), \
             patch("app.services.mcp_tools.notification_service.configured", return_value=False):
            result = list_reminders(_ctx(MagicMock()), {"days_ahead": 3})
        assert result["count"] == 1 and result["days_ahead"] == 3
        reminder = result["reminders"][0]
        assert reminder["note_id"] == 4 and reminder["plant"] == "Fern" and reminder["sent"] is True
        assert reminder["remind_at"].startswith("2026-11-20")


class TestUpdateNote:
    def _db(self, note):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = note
        return db

    def test_moving_a_reminder_sends_it_again(self):
        note = _note(reminded_at=datetime(2026, 11, 20, 8, 0))
        future = (datetime.now(LOCAL_TZ) + timedelta(days=5)).date().isoformat()
        result = update_note(_ctx(self._db(note)), {"note_id": 4, "remind_at": future})
        assert result["updated"] == ["remind_at"]
        assert note.reminded_at is None and note.remind_at > utcnow()

    def test_null_removes_the_reminder_but_keeps_the_note(self):
        note = _note()
        db = self._db(note)
        update_note(_ctx(db), {"note_id": 4, "remind_at": None, "text": "Repotted"})
        assert note.remind_at is None and note.note_text == "Repotted"
        db.delete.assert_not_called()

    def test_needs_something_to_change_and_an_existing_note(self):
        with pytest.raises(ToolError):
            update_note(_ctx(self._db(_note())), {"note_id": 4})
        with pytest.raises(ToolError, match="not found"):
            update_note(_ctx(self._db(None)), {"note_id": 9, "text": "x"})


class TestWateringPlan:
    def test_due_dates_overdue_first(self):
        today = datetime.now(LOCAL_TZ).date()

        def watered(days_ago):  # noon local, as naive UTC
            local = datetime.combine(today - timedelta(days=days_ago), datetime.min.time(),
                                     tzinfo=LOCAL_TZ).replace(hour=12)
            return local.astimezone(timezone.utc).replace(tzinfo=None)

        plants = [
            SimpleNamespace(id=1, name="Ivy", watering_interval_days=7, is_outdoor=False, reaches_rain=False),
            SimpleNamespace(id=2, name="Fern", watering_interval_days=3, is_outdoor=False, reaches_rain=False),
            SimpleNamespace(id=3, name="Cactus", watering_interval_days=30, is_outdoor=False, reaches_rain=False),
        ]
        db = MagicMock()
        db.query.return_value.filter.return_value.order_by.return_value.all.return_value = plants
        db.query.return_value.filter.return_value.scalar.return_value = 4
        last = {1: watered(2), 2: watered(5), 3: watered(1)}
        with patch("app.services.mcp_tools._last_dates", return_value=last):
            result = get_watering_plan(_ctx(db), {"days": 7})
        assert [p["plant"] for p in result["plan"]] == ["Fern", "Ivy"]  # cactus is due in 29 days
        fern, ivy = result["plan"]
        assert fern["days_until_due"] == -2 and fern["overdue"]
        assert ivy["due_on"] == (today + timedelta(days=5)).isoformat()
        assert result["plants_without_schedule"] == 4
        assert date.fromisoformat(result["today"]) == today


class TestSpeciesInfo:
    def test_needs_a_species(self):
        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id=1, name="Mystery", species="Unknown")
        with pytest.raises(ToolError, match="no species"):
            get_species_info(_ctx(db), {"plant_id": 1})

    def test_reference(self):
        from app.services.plant_reference import PlantReference

        db = MagicMock()
        db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id=1, name="Rubber plant", species="Ficus elastica")
        reference = PlantReference("Ficus elastica Roxb.", "https://identify.plantnet.org/x",
                                   facts="Common names\nRubber tree", family="Moraceae", genus="Ficus")
        with patch("app.services.plant_reference.lookup", return_value=reference):
            result = get_species_info(_ctx(db), {"plant_id": 1})
        assert result["found"] and result["family"] == "Moraceae"
        assert result["common_names"] == ["Rubber tree"]
