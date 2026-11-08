"""Error responses say what failed, never the exception's own text.

Regression: about a dozen handlers returned `detail=f"...: {str(e)}"`. For OpenWeatherMap
that text is requests' error message, which repeats the full URL including `appid=<key>`;
elsewhere it could carry SQL or file paths.
"""
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest
import requests

from app.core.config import settings

KEY = "owm-secret-key-1234"


def _owm_error():
    response = MagicMock(status_code=401)
    response.raise_for_status.side_effect = requests.HTTPError(
        f"401 Client Error: Unauthorized for url: https://api.openweathermap.org/data/2.5/weather"
        f"?lat=48.2&lon=16.37&appid={KEY}&units=metric",
        response=response,
    )
    return response


class TestOpenWeatherMap:
    def test_service_error_drops_the_url(self):
        from app.services import weather_service

        with patch.object(settings, "OPENWEATHERMAP_API_KEY", KEY), \
             patch("app.services.weather_service.requests.get", return_value=_owm_error()):
            with pytest.raises(RuntimeError) as raised:
                weather_service._get_openweathermap(48.2, 16.37)

        assert KEY not in str(raised.value)
        assert "401" in str(raised.value)
        assert raised.value.__cause__ is None and raised.value.__suppress_context__

    def test_route_never_returns_the_key(self, client, mock_db):
        mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
            id=1, latitude=48.2, longitude=16.37, city_name="Wien")
        mock_db.query.return_value.first.return_value = mock_db.query.return_value.filter.return_value.first.return_value
        with patch.object(settings, "OPENWEATHERMAP_API_KEY", KEY), \
             patch("app.services.weather_service.requests.get", return_value=_owm_error()):
            response = client.get("/api/weather/current?config_id=1")

        assert response.status_code == 502
        assert KEY not in response.text
        assert response.json()["detail"] == "Failed to fetch weather (RuntimeError)"


def test_ai_failure_names_the_error_kind_not_its_text(client, mock_db, override_dep, make_user):
    from app.core.security import require_write_access

    override_dep(require_write_access, make_user(role="user"))
    mock_db.query.return_value.filter.return_value.first.return_value = SimpleNamespace(
        id=1, name="Rubber plant", species="Ficus elastica", description=None, watering_interval_days=None)
    with patch.object(settings, "LLM_PROVIDER", "claude"), \
         patch("app.api.routes.plants.LLMClient") as llm:
        llm.return_value.generate_species_description.side_effect = ValueError(
            "mysql://pflanzn:hunter2@db/plants_db at /backend/app/services/anthropic.py")
        response = client.post("/api/plants/1/generate_description")

    assert response.status_code == 500
    assert "hunter2" not in response.text and "/backend/" not in response.text
    assert response.json()["detail"] == "Failed to generate description (ValueError)"
