"""Reminders, Apprise notifications, LLM provider choice and the Pl@ntNet quota."""
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests
from fastapi import HTTPException

from app.core.config import settings
from app.schemas import PlantNoteCreate
from app.services import notifications, plantnet


def _ok(status=200):
    return SimpleNamespace(ok=200 <= status < 300, status_code=status)


class TestSend:
    def test_key_mode_posts_to_the_key_with_tag(self):
        with patch.object(settings, "APPRISE_URL", "http://apprise:8000/"), \
             patch.object(settings, "APPRISE_KEY", "pflanzn"), \
             patch.object(settings, "APPRISE_TAG", "plants"), \
             patch.object(settings, "APPRISE_URLS", ""), \
             patch("app.services.notifications.requests.post", return_value=_ok()) as post:
            notifications.send("Title", "Body")
        url = post.call_args.args[0]
        assert url == "http://apprise:8000/notify/pflanzn"
        assert post.call_args.kwargs["json"] == {
            "title": "Title", "body": "Body", "type": "info", "format": "text", "tag": "plants"}

    def test_urls_mode_posts_the_urls_stateless(self):
        with patch.object(settings, "APPRISE_URL", "http://apprise:8000"), \
             patch.object(settings, "APPRISE_KEY", ""), \
             patch.object(settings, "APPRISE_URLS", "ntfy://topic, tgram://bot/chat"), \
             patch("app.services.notifications.requests.post", return_value=_ok()) as post:
            notifications.send("T", "B")
        assert post.call_args.args[0] == "http://apprise:8000/notify/"
        assert post.call_args.kwargs["json"]["urls"] == "ntfy://topic,tgram://bot/chat"

    def test_summary_names_services_but_not_their_tokens(self):
        with patch.object(settings, "APPRISE_URL", "http://apprise:8000"), \
             patch.object(settings, "APPRISE_KEY", ""), \
             patch.object(settings, "APPRISE_URLS", "tgram://SECRET/123 ntfy://topic"):
            summary = notifications.target_summary()
        assert summary["services"] == ["ntfy", "tgram"]
        assert "SECRET" not in str(summary)

    def test_failure_and_unreachable_raise_without_details(self):
        with patch.object(settings, "APPRISE_URL", "http://apprise:8000"), \
             patch.object(settings, "APPRISE_KEY", "k"):
            with patch("app.services.notifications.requests.post", return_value=_ok(500)):
                with pytest.raises(notifications.NotificationError, match="HTTP 500"):
                    notifications.send("T", "B")
            boom = requests.ConnectionError("http://apprise:8000/notify/k?token=x")
            with patch("app.services.notifications.requests.post", side_effect=boom):
                with pytest.raises(notifications.NotificationError) as info:
                    notifications.send("T", "B")
                assert "token" not in str(info.value)

    def test_not_configured(self):
        with patch.object(settings, "APPRISE_URL", ""):
            assert not notifications.configured()
            with pytest.raises(notifications.NotificationError):
                notifications.send("T", "B")


class TestReminders:
    def _db(self, notes, claimed=1):
        db = MagicMock()
        db.query.return_value.join.return_value.filter.return_value.order_by.return_value \
            .limit.return_value.all.return_value = notes
        db.query.return_value.filter.return_value.update.return_value = claimed
        return db

    def _note(self):
        return SimpleNamespace(id=7, plant_id=3, note_text=" Repot ", plant=SimpleNamespace(name="Fern"))

    def test_due_reminder_is_claimed_and_sent(self):
        db = self._db([self._note()])
        with patch.object(settings, "DOMAIN", "https://plants.example"), \
             patch("app.services.notifications.send") as send:
            assert notifications.send_due_reminders(db) == 1
        send.assert_called_once_with("Reminder: Fern", "Repot\n\nhttps://plants.example/plant/3")

    def test_reminder_claimed_elsewhere_is_skipped(self):
        db = self._db([self._note()], claimed=0)
        with patch("app.services.notifications.send") as send:
            assert notifications.send_due_reminders(db) == 0
        send.assert_not_called()

    def test_failed_send_is_released_for_the_next_tick(self):
        db = self._db([self._note()])
        with patch("app.services.notifications.send", side_effect=notifications.NotificationError("x")):
            assert notifications.send_due_reminders(db) == 0
        # claim, then release
        updates = [c.args[0] for c in db.query.return_value.filter.return_value.update.call_args_list]
        assert list(updates[-1].values()) == [None]


class TestWateringDigest:
    def test_text(self):
        due = [(SimpleNamespace(name="Fern"), 2), (SimpleNamespace(name="Ivy"), 0)]
        with patch.object(settings, "DOMAIN", ""):
            title, body = notifications.watering_digest_text(due)
        assert title == "2 plants need water"
        assert body == "• Fern (2 days overdue)\n• Ivy (today)"

    def test_single_plant_wording(self):
        title, _ = notifications.watering_digest_text([(SimpleNamespace(name="Fern"), 1)])
        assert title == "1 plant needs water"

    def _settings(self, values):
        return patch("app.services.notifications.app_settings.get_setting", side_effect=lambda db, k: values[k])

    def test_not_before_the_set_time_and_once_a_day(self):
        redis = MagicMock()
        redis.set.side_effect = [True, False]
        values = {"notify_watering": True, "notify_watering_time": "08:00"}
        due = [(SimpleNamespace(name="Fern"), 0)]
        local = notifications.LOCAL_TZ
        early = datetime(2026, 11, 16, 7, 59, tzinfo=local)
        late = datetime(2026, 11, 16, 8, 0, tzinfo=local)
        with self._settings(values), patch("app.core.security.redis_client", redis), \
             patch("app.services.notifications.plants_due_for_water", return_value=due), \
             patch("app.services.notifications.send") as send:
            assert notifications.send_watering_digest(MagicMock(), early) is False
            assert notifications.send_watering_digest(MagicMock(), late) is True
            assert notifications.send_watering_digest(MagicMock(), late + timedelta(minutes=1)) is False
        assert send.call_count == 1
        assert redis.set.call_args_list[0].args[0] == "pflanzn:notify:watering:2026-11-16"

    def test_switched_off(self):
        with self._settings({"notify_watering": False, "notify_watering_time": "08:00"}), \
             patch("app.services.notifications.send") as send:
            assert notifications.send_watering_digest(MagicMock()) is False
        send.assert_not_called()


class TestReminderSchema:
    def test_offset_is_converted_to_naive_utc(self):
        note = PlantNoteCreate(note_text="x", remind_at="2026-11-20T09:00:00+01:00")
        assert note.remind_at == datetime(2026, 11, 20, 8, 0)

    def test_null_is_kept_as_explicitly_set(self):
        note = PlantNoteCreate(note_text="x", remind_at=None)
        assert "remind_at" in note.model_fields_set and note.remind_at is None
        assert "remind_at" not in PlantNoteCreate(note_text="x").model_fields_set


class TestMcpReminder:
    def test_date_alone_means_nine_local(self):
        from app.services.mcp_tools import LOCAL_TZ, _arg_remind_at

        future = (datetime.now(LOCAL_TZ) + timedelta(days=3)).date()
        value = _arg_remind_at({"remind_at": future.isoformat()})
        expected = datetime(future.year, future.month, future.day, 9, tzinfo=LOCAL_TZ)
        assert value == expected.astimezone(timezone.utc).replace(tzinfo=None)

    def test_past_is_refused(self):
        from app.services.mcp_tools import ToolError, _arg_remind_at

        with pytest.raises(ToolError):
            _arg_remind_at({"remind_at": "2020-01-01"})
        assert _arg_remind_at({}) is None


class TestLlmProviders:
    def test_default_first_then_every_configured_one(self, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "x")
        monkeypatch.setenv("OLLAMA_URL", "http://ollama")
        monkeypatch.delenv("CLAUDE_API_KEY", raising=False)
        monkeypatch.delenv("MISTRALAI_API_KEY", raising=False)
        monkeypatch.delenv("HUGGINGFACE_API_KEY", raising=False)
        with patch.object(settings, "LLM_PROVIDER", "ollama"), patch.object(settings, "AI_ENABLED", True), \
             patch.object(settings, "LLM_ENABLED", True):
            assert settings.llm_providers == ["ollama", "openai"]
        with patch.object(settings, "LLM_PROVIDER", "ollama"), patch.object(settings, "LLM_ENABLED", False):
            assert settings.llm_providers == []

    def test_choice_must_be_configured(self):
        from app.core.features import llm_provider_choice

        with patch.object(type(settings), "llm_providers", property(lambda self: ["claude", "openai"])):
            assert llm_provider_choice("OpenAI") == "openai"
            assert llm_provider_choice(None) is None
            with pytest.raises(HTTPException) as info:
                llm_provider_choice("mistralai")
        assert info.value.status_code == 400


class TestPlantNetQuota:
    def _response(self, status, body):
        response = MagicMock(status_code=status, ok=200 <= status < 300)
        response.json.return_value = body
        return response

    def test_remaining_is_recorded_and_429_says_so(self, tmp_path):
        image = tmp_path / "a.jpg"
        image.write_bytes(b"x")
        with patch("app.services.plantnet._record_quota") as record:
            with patch("app.services.plantnet.requests.post",
                       return_value=self._response(200, {"results": [], "remainingIdentificationRequests": 42})):
                plantnet.identify_species_via_plantnet(str(image), "image/jpeg", "a.jpg")
            record.assert_called_with(42)
            with patch("app.services.plantnet.requests.post", return_value=self._response(429, {})):
                with pytest.raises(plantnet.PlantNetQuotaError):
                    plantnet.identify_species_via_plantnet(str(image), "image/jpeg", "a.jpg")
            record.assert_called_with(0)

    def test_status_forgets_yesterdays_reading(self):
        import json

        redis = MagicMock()
        yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).isoformat()
        redis.get.return_value = json.dumps({"remaining": 3, "updated_at": yesterday})
        with patch("app.core.security.redis_client", redis):
            assert plantnet.quota_status()["remaining"] is None
        redis.get.return_value = json.dumps({"remaining": 3, "updated_at": datetime.now(timezone.utc).isoformat()})
        with patch("app.core.security.redis_client", redis):
            assert plantnet.quota_status()["remaining"] == 3


class TestActivityFilter:
    def test_unknown_type_is_refused(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id=1, name="Fern", weather_config_id=None)
        with patch("app.core.security.AUTH_MODE", "no"):
            response = client.get("/api/plants/1/activities?types=watering,bogus")
        assert response.status_code == 422

    def test_only_notes(self, client, mock_db):
        note = SimpleNamespace(
            id=5, note_text="Repot", created_by=None,
            created_at=datetime(2026, 11, 10, 12, 0), remind_at=datetime(2026, 11, 20, 8, 0))
        plant = SimpleNamespace(id=1, name="Fern", weather_config_id=None)
        query = MagicMock()
        query.filter.return_value.first.return_value = plant
        query.filter.return_value.order_by.return_value.all.return_value = [note]
        mock_db.query.return_value = query
        with patch("app.core.security.AUTH_MODE", "no"):
            response = client.get("/api/plants/1/activities?types=note")
        assert response.status_code == 200
        items = response.json()
        assert [i["activity_type"] for i in items] == ["note"]
        assert items[0]["activity_data"]["remind_at"] == "2026-11-20T08:00:00Z"
