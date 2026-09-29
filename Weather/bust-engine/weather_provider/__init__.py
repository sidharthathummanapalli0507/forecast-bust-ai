"""
weather_provider package — Weather Data Provider Abstraction Layer
"""

from .base import (
    WeatherProvider,
    NormalizedCurrentWeather,
    NormalizedDailyForecast,
    NormalizedForecastResponse,
    now_iso,
)
from .open_meteo import OpenMeteoProvider

__all__ = [
    "WeatherProvider",
    "OpenMeteoProvider",
    "NormalizedCurrentWeather",
    "NormalizedDailyForecast",
    "NormalizedForecastResponse",
    "now_iso",
]
