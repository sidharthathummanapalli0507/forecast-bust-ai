"""
weather_provider/base.py — Abstract Weather Provider & Normalized Data Schemas
ForecastBustAI — Prototype AI-Based Forecast Bust Detection Engine
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone


def now_iso() -> str:
    """Return current UTC timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@dataclass
class NormalizedCurrentWeather:
    """Current atmospheric observation / analysis."""
    timestamp: str
    region_id: str
    latitude: float
    longitude: float
    temperature: Optional[float]
    humidity: Optional[float]
    precipitation: Optional[float]
    rain: Optional[float]
    wind: Optional[float]
    wind_gusts: Optional[float]
    pressure: Optional[float]
    surface_pressure: Optional[float]
    weather_code: Optional[int]
    lead_time: int = 0
    provider: str = "Open-Meteo"
    data_source: str = "Open-Meteo High-Resolution Analysis"
    is_real_data: bool = True
    synthetic: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class NormalizedDailyForecast:
    """Daily forecast step for lead times Day 1 through Day 10."""
    lead_time: int
    date: str
    temperature_max: Optional[float]
    temperature_min: Optional[float]
    temperature: Optional[float]
    humidity: Optional[float]
    precipitation: Optional[float]
    rain: Optional[float]
    wind: Optional[float]
    wind_gusts: Optional[float]
    pressure: Optional[float]
    weather_code: Optional[int]
    region_id: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    timestamp: str = field(default_factory=now_iso)
    provider: str = "Open-Meteo"
    data_source: str = "ECMWF IFS / GFS / ICON"
    is_real_data: bool = True
    synthetic: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


@dataclass
class NormalizedForecastResponse:
    """Normalized multi-day forecast bundle."""
    provider: str
    data_source: str
    retrieved_at: str
    latitude: float
    longitude: float
    region_id: str
    current: Optional[NormalizedCurrentWeather]
    daily: List[NormalizedDailyForecast]
    raw_daily: Dict[str, Any] = field(default_factory=dict)
    is_real_data: bool = True
    synthetic: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "provider": self.provider,
            "data_source": self.data_source,
            "retrieved_at": self.retrieved_at,
            "latitude": self.latitude,
            "longitude": self.longitude,
            "region_id": self.region_id,
            "current": self.current.to_dict() if self.current else None,
            "daily": [d.to_dict() for d in self.daily],
            "is_real_data": self.is_real_data,
            "synthetic": self.synthetic,
        }


class WeatherProvider(ABC):
    """
    Abstract Weather Provider Interface.
    Decouples data acquisition from the ML forecast-bust detection engine.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Name of the weather data provider."""
        pass

    @abstractmethod
    async def get_current_weather(
        self, lat: float, lon: float, region_id: str = ""
    ) -> Optional[NormalizedCurrentWeather]:
        """Fetch real-time current weather."""
        pass

    @abstractmethod
    async def get_forecast(
        self, lat: float, lon: float, region_id: str = "", days: int = 10
    ) -> Optional[NormalizedForecastResponse]:
        """Fetch 7-10 day weather forecast."""
        pass

    @abstractmethod
    async def get_historical_weather(
        self, lat: float, lon: float, start_date: str, end_date: str, region_id: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Fetch historical reanalysis / ground truth reference data (e.g. ERA5)."""
        pass

    @abstractmethod
    async def get_historical_forecast(
        self, lat: float, lon: float, start_date: str, end_date: str, region_id: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Fetch archived numerical weather predictions for verification."""
        pass

    @abstractmethod
    async def get_previous_runs(
        self, lat: float, lon: float, region_id: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Fetch previous model forecast cycles for run-to-run instability analysis."""
        pass

    @abstractmethod
    async def get_ensemble_spread(
        self, lat: float, lon: float, region_id: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Fetch multi-member ensemble forecasts to calculate ensemble spread."""
        pass

    @abstractmethod
    async def get_multi_model_forecast(
        self, lat: float, lon: float, region_id: str = ""
    ) -> Optional[Dict[str, Any]]:
        """Fetch multi-model forecasts (ECMWF, GFS, ICON) to calculate model divergence."""
        pass
