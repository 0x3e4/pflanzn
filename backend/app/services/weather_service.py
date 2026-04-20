import logging
from datetime import datetime, timedelta, timezone

import requests
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import Plant, PlantWatering, WeatherConfig, WeatherLog

logger = logging.getLogger(__name__)


def get_current_weather(latitude: float, longitude: float) -> dict:
    """
    Fetch current weather using Open-Meteo (free, no API key required).
    Falls back to OpenWeatherMap if API key is configured.
    """
    if settings.OPENWEATHERMAP_API_KEY:
        return _get_openweathermap(latitude, longitude)
    return _get_open_meteo_current(latitude, longitude)


def _get_openweathermap(latitude: float, longitude: float) -> dict:
    """Fetch current weather from OpenWeatherMap API."""
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {
        "lat": latitude,
        "lon": longitude,
        "appid": settings.OPENWEATHERMAP_API_KEY,
        "units": "metric",
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    return response.json()


def _get_open_meteo_current(latitude: float, longitude: float) -> dict:
    """Fetch current weather from Open-Meteo (free, no key needed)."""
    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code",
        "timezone": "auto",
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()
    current = data.get("current", {})

    # Map WMO weather codes to conditions
    wmo_code = current.get("weather_code", 0)
    condition = _wmo_to_condition(wmo_code)

    # Convert to a common format compatible with our frontend
    return {
        "weather": [{"main": condition, "description": _wmo_to_description(wmo_code)}],
        "main": {
            "temp": current.get("temperature_2m"),
            "humidity": current.get("relative_humidity_2m"),
        },
        "rain": {"1h": current.get("precipitation", 0.0)},
    }


def _get_recent_rainfall(latitude: float, longitude: float, hours: int) -> float:
    """
    Check how much it rained in the last N hours using Open-Meteo historical data.
    This is free and doesn't require an API key.
    """
    now = datetime.now(timezone.utc)
    start = now - timedelta(hours=hours)

    url = "https://api.open-meteo.com/v1/forecast"
    params = {
        "latitude": latitude,
        "longitude": longitude,
        "hourly": "precipitation",
        "start_date": start.strftime("%Y-%m-%d"),
        "end_date": now.strftime("%Y-%m-%d"),
        "timezone": "UTC",
    }
    response = requests.get(url, params=params, timeout=10)
    response.raise_for_status()
    data = response.json()

    hourly = data.get("hourly", {})
    times = hourly.get("time", [])
    precip = hourly.get("precipitation", [])

    # Sum precipitation for the last N hours only (exclude future forecast)
    total = 0.0
    cutoff = start.strftime("%Y-%m-%dT%H:00")
    now_str = now.strftime("%Y-%m-%dT%H:00")
    for i, t in enumerate(times):
        if cutoff <= t <= now_str and i < len(precip) and precip[i] is not None:
            total += precip[i]

    return total


def _wmo_to_condition(code: int) -> str:
    """Map WMO weather code to a simple condition string."""
    if code == 0:
        return "Clear"
    if code in (1, 2, 3):
        return "Clouds"
    if code in (45, 48):
        return "Fog"
    if code in (51, 53, 55, 56, 57):
        return "Drizzle"
    if code in (61, 63, 65, 66, 67, 80, 81, 82):
        return "Rain"
    if code in (71, 73, 75, 77, 85, 86):
        return "Snow"
    if code in (95, 96, 99):
        return "Thunderstorm"
    return "Unknown"


def _wmo_to_description(code: int) -> str:
    """Map WMO weather code to a human-readable description."""
    descriptions = {
        0: "clear sky",
        1: "mainly clear", 2: "partly cloudy", 3: "overcast",
        45: "fog", 48: "depositing rime fog",
        51: "light drizzle", 53: "moderate drizzle", 55: "dense drizzle",
        56: "light freezing drizzle", 57: "dense freezing drizzle",
        61: "slight rain", 63: "moderate rain", 65: "heavy rain",
        66: "light freezing rain", 67: "heavy freezing rain",
        71: "slight snow", 73: "moderate snow", 75: "heavy snow",
        77: "snow grains",
        80: "slight rain showers", 81: "moderate rain showers", 82: "violent rain showers",
        85: "slight snow showers", 86: "heavy snow showers",
        95: "thunderstorm", 96: "thunderstorm with slight hail", 99: "thunderstorm with heavy hail",
    }
    return descriptions.get(code, "unknown")


def parse_rainfall(weather_data: dict) -> float:
    """Extract rainfall in mm from weather response (works for both APIs)."""
    rain = weather_data.get("rain", {})
    return rain.get("1h", rain.get("3h", 0.0))


def check_and_auto_water(db: Session) -> int:
    """
    Check weather for all enabled configs and auto-water outdoor plants
    that reach rain. Uses recent rainfall history (not just current weather)
    to avoid missing rain between checks.
    Returns total number of plants watered.
    """
    configs = db.query(WeatherConfig).filter(WeatherConfig.enabled == True).all()
    if not configs:
        return 0

    check_interval = settings.WEATHER_CHECK_INTERVAL_HOURS
    total_watered = 0
    watered_plant_ids: set = set()

    for config in configs:
        try:
            # Get current weather for display/logging
            weather_data = get_current_weather(config.latitude, config.longitude)
        except Exception as e:
            logger.error(f"Failed to fetch weather for config {config.id}: {e}")
            continue

        # Check recent rainfall over the check interval period
        try:
            recent_rainfall = _get_recent_rainfall(
                config.latitude, config.longitude, hours=check_interval
            )
        except Exception as e:
            logger.warning(f"Failed to fetch rainfall history for config {config.id}: {e}")
            recent_rainfall = parse_rainfall(weather_data)

        weather_main = weather_data.get("weather", [{}])[0].get("main", "Unknown")
        temperature = weather_data.get("main", {}).get("temp")
        current_rainfall = parse_rainfall(weather_data)

        # Use the higher of current or recent rainfall
        effective_rainfall = max(current_rainfall, recent_rainfall)

        # Check if rainfall exceeds configured threshold
        is_raining = effective_rainfall >= settings.WEATHER_RAINFALL_THRESHOLD_MM

        watered_count = 0
        if is_raining:
            query = db.query(Plant).filter(
                Plant.is_outdoor == True,
                Plant.reaches_rain == True,
                Plant.is_archived == False,
            )
            # Only water plants assigned to this weather zone, or unassigned plants (default)
            query = query.filter(
                (Plant.weather_config_id == config.id) | (Plant.weather_config_id == None)
            )
            plants = query.all()

            today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
            for plant in plants:
                already_watered = (
                    db.query(PlantWatering)
                    .filter(
                        PlantWatering.plant_id == plant.id,
                        PlantWatering.user_id == None,
                        PlantWatering.watered_at >= today_start,
                    )
                    .first()
                )
                if not already_watered and plant.id not in watered_plant_ids:
                    watering = PlantWatering(
                        plant_id=plant.id,
                        watered_at=datetime.utcnow(),
                        user_id=None,
                        rainfall_mm=effective_rainfall,
                    )
                    db.add(watering)
                    watered_plant_ids.add(plant.id)
                    watered_count += 1

        log = WeatherLog(
            latitude=config.latitude,
            longitude=config.longitude,
            city_name=config.city_name,
            weather_condition=weather_main,
            rainfall_mm=effective_rainfall,
            temperature=temperature,
            auto_watered_count=watered_count,
        )
        db.add(log)
        total_watered += watered_count

    db.commit()
    logger.info(f"Weather check complete. {total_watered} plants auto-watered.")
    return total_watered
