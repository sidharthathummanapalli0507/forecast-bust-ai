"""
schemas.py — Pydantic data models
ForecastBustAI — Forecast Bust Probability Engine
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, List, Any
from datetime import datetime


class NormalizedForecastRecord(BaseModel):
    """Common schema for all ingested forecast data."""
    region_id: str
    region_name: str
    latitude: float
    longitude: float
    forecast_issue_time: Optional[str] = None
    valid_time: Optional[str] = None
    lead_day: int
    forecast_variable: str
    forecast_value: Optional[float] = None
    observation_value: Optional[float] = None
    ensemble_mean: Optional[float] = None
    ensemble_spread: Optional[float] = None
    model_divergence: Optional[float] = None
    historical_error: Optional[float] = None
    weather_event: Optional[str] = None
    data_source: str


class RiskFactors(BaseModel):
    """Contribution breakdown of each risk factor (0-1 scale each)."""
    lead_time_uncertainty: float = Field(..., ge=0, le=1)
    historical_failure_similarity: float = Field(..., ge=0, le=1)
    ensemble_spread: float = Field(..., ge=0, le=1)
    forecast_divergence: float = Field(..., ge=0, le=1)
    weather_event_complexity: float = Field(..., ge=0, le=1)
    run_to_run_instability: float = Field(..., ge=0, le=1)
    orography_complexity: float = Field(..., ge=0, le=1)


class RegionBustEstimate(BaseModel):
    """Bust probability estimate for one region at one lead day."""
    region_id: str
    region_name: str
    latitude: float
    longitude: float
    lead_day: int
    bust_probability: float = Field(..., ge=0, le=1)
    risk_level: str
    risk_color: str
    confidence: float = Field(..., ge=0, le=1)
    primary_risk_driver: str
    ensemble_spread_norm: float
    historical_rmse_norm: float
    model_divergence_norm: float
    forecast_variable: str
    weather_event: str
    data_source: str
    is_prototype: bool = True
    factors: RiskFactors


class MapResponse(BaseModel):
    timestamp: str
    lead_day: int
    forecast_variable: str
    weather_event: str
    is_prototype: bool = True
    data_freshness: str
    regions: List[RegionBustEstimate]


class TimelinePoint(BaseModel):
    lead_day: int
    bust_probability: float
    risk_level: str
    risk_color: str
    confidence: float
    ensemble_spread_norm: float


class TimelineResponse(BaseModel):
    region_id: str
    region_name: str
    forecast_variable: str
    weather_event: str
    is_prototype: bool = True
    timeline: List[TimelinePoint]
    india_average: List[TimelinePoint]


class RegionRanking(BaseModel):
    rank: int
    region_id: str
    region_name: str
    bust_probability: float
    risk_level: str
    risk_color: str
    primary_driver: str
    lead_day: int


class RankingResponse(BaseModel):
    lead_day: int
    forecast_variable: str
    is_prototype: bool = True
    timestamp: str
    regions: List[RegionRanking]


class ExplanationResponse(BaseModel):
    region_id: str
    region_name: str
    lead_day: int
    bust_probability: float
    risk_level: str
    is_prototype: bool = True
    summary: str
    factors: RiskFactors
    factor_descriptions: Dict[str, str]
    historical_context: str
    confidence_note: str
    data_sources_used: List[str]


class DataSourceStatus(BaseModel):
    source_name: str
    status: str           # LIVE | DEGRADED | UNAVAILABLE | SIMULATED
    last_checked: str
    last_success: Optional[str]
    note: str
    endpoint: Optional[str] = None


class DataStatusResponse(BaseModel):
    overall_status: str
    last_updated: str
    data_sources: List[DataSourceStatus]
    model_info: Dict[str, Any]


class KPISummary(BaseModel):
    india_risk_level: str
    india_risk_color: str
    india_avg_probability: float
    highest_risk_region: str
    highest_risk_region_id: str
    max_bust_probability: float
    critical_lead_day: int
    total_high_risk_regions: int
    timestamp: str
    is_prototype: bool = True
