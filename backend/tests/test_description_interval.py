from types import SimpleNamespace
from unittest.mock import patch

import pytest

from app.core.config import settings
from app.utils.watering_hint import split_watering_interval

TEXT = "The rubber plant comes from South-East Asia.\n\nIt likes bright, indirect light."


class TestSplitWateringInterval:
    def test_reads_and_removes_the_marker(self):
        description, days = split_watering_interval(f"{TEXT}\n\nWATERING_INTERVAL_DAYS: 7")
        assert days == 7
        assert description == TEXT

    @pytest.mark.parametrize("line", [
        "watering_interval_days: 10 days",
        "WATERING INTERVAL DAYS = 10",
        "`WATERING_INTERVAL_DAYS: 10`",
        "  WATERING_INTERVAL_DAYS:10",
    ])
    def test_tolerates_small_variations(self, line):
        description, days = split_watering_interval(f"{TEXT}\n{line}")
        assert days == 10
        assert "WATERING" not in description.upper()

    def test_no_marker_leaves_the_text(self):
        assert split_watering_interval(f"  {TEXT}  ") == (TEXT, None)

    @pytest.mark.parametrize("days", ["0", "120"])
    def test_out_of_range_is_dropped_but_still_removed(self, days):
        description, parsed = split_watering_interval(f"{TEXT}\nWATERING_INTERVAL_DAYS: {days}")
        assert parsed is None
        assert description == TEXT

    def test_a_number_in_the_prose_is_not_read(self):
        assert split_watering_interval("Water it every 7 days.")[1] is None


class TestGenerateDescriptionSetsInterval:
    @pytest.fixture
    def writer(self, override_dep, make_user):
        from app.core.security import require_write_access

        override_dep(require_write_access, make_user(role="user"))

    def _post(self, client, mock_db, plant, generated):
        mock_db.query.return_value.filter.return_value.first.return_value = plant
        with patch.object(settings, "LLM_PROVIDER", "claude"), \
             patch("app.api.routes.plants.LLMClient") as llm:
            llm.return_value.generate_species_description.return_value = generated
            return client.post(f"/api/plants/{plant.id}/generate_description")

    def _plant(self, interval=None):
        return SimpleNamespace(id=1, name="Rubber plant", species="Ficus elastica",
                               description=None, watering_interval_days=interval)

    def test_fills_an_empty_interval(self, client, mock_db, writer):
        plant = self._plant()
        response = self._post(client, mock_db, plant, f"{TEXT}\nWATERING_INTERVAL_DAYS: 9")

        assert response.status_code == 200
        body = response.json()
        assert body["description"] == TEXT
        assert body["watering_interval_applied"] is True
        assert body["watering_interval_days"] == 9
        assert plant.watering_interval_days == 9
        assert plant.description == TEXT

    def test_keeps_an_interval_set_by_hand(self, client, mock_db, writer):
        plant = self._plant(interval=4)
        body = self._post(client, mock_db, plant, f"{TEXT}\nWATERING_INTERVAL_DAYS: 9").json()

        assert body["watering_interval_applied"] is False
        assert body["suggested_watering_interval_days"] == 9
        assert body["watering_interval_days"] == 4
        assert plant.watering_interval_days == 4

    def test_no_suggestion_changes_nothing(self, client, mock_db, writer):
        plant = self._plant()
        body = self._post(client, mock_db, plant, TEXT).json()

        assert body["suggested_watering_interval_days"] is None
        assert body["watering_interval_applied"] is False
        assert plant.watering_interval_days is None
