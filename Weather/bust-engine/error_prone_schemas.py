from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any

class ErrorFactors(BaseModel):
    historical_error: float = Field(..., ge=0, le=100)
    forecast_divergence: float = Field(..., ge=0, le=100)
    ensemble_spread: float = Field(..., ge=0, le=100)
    run_to_run_instability: float = Field(..., ge=0, le=100)
    rapid_evolution: float = Field(default=0.0, ge=0, le=100)
    lead_time_uncertainty: float = Field(..., ge=0, le=100)
    forecast_reference_error: float = Field(default=0.0, ge=0, le=100)

class ErrorProneRegion(BaseModel):
    region_id: str
    region_name: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    lead_day: Optional[int] = None
    score: float = Field(..., ge=0, le=100)
    risk_level: str
    confidence: float
    critical_lead_time: int
    top_driver: str
    factors: ErrorFactors
    forecast_bust_probability: Optional[float] = None
    confidence_score: Optional[float] = None

class MapResponse(BaseModel):
    lead_day: int
    timestamp: str
    data_freshness: str
    provider: Optional[str] = "Open-Meteo"
    real_data: Optional[bool] = True
    regions: List[ErrorProneRegion]

class HistoricalCase(BaseModel):
    event_date: str
    region_name: str
    similarity: float
    observed_error: str
    forecast_lead_time: int

class MetricValue(BaseModel):
    value: float
    unit: str

class ErrorMetrics(BaseModel):
    absolute: float
    mae: float
    rmse: float
    bias: Optional[float] = 0.0

class RiskData(BaseModel):
    score: float
    level: str

class MLModelValidationMetrics(BaseModel):
    precision: float
    recall: float
    f1: float
    roc_auc: Optional[float] = None
    mae: float
    rmse: float

class MLModelMetadata(BaseModel):
    model_type: str
    is_trained: bool
    type: Optional[str] = None
    trained: Optional[bool] = None
    target_leakage_audit: Optional[str] = "PASSED"
    target_leakage_status: Optional[str] = "PASSED"
    model_name: Optional[str] = "RandomForestClassifier (Calibrated)"
    training_samples: int
    validation_samples: int
    features: List[str]
    prediction_features: Optional[List[str]] = None
    prediction_time_features: Optional[List[str]] = None
    verification_features: Optional[List[str]] = None
    feature_importances: Optional[Dict[str, float]] = None
    metrics: MLModelValidationMetrics
    training_period: str
    validation_period: str
    bust_threshold: Dict[str, float]
    explainability_method: str
    probability_calibration: str

# Final API response for a specific region
class RegionDetailResponse(BaseModel):
    status: str
    source: str
    last_updated: str
    region: str
    region_id: str
    region_name: Optional[str] = None
    lead_day: int
    variable: str
    
    # ML Outputs required by prompt
    forecast_bust_probability: float
    risk_score: float
    confidence_score: float
    risk_level: str
    top_drivers: List[str]
    model: Optional[MLModelMetadata] = None

    # Provenance Information
    provider: Optional[str] = "Open-Meteo"
    data_source: Optional[str] = "Open-Meteo High-Resolution Multi-Model & ERA5 Reanalysis"
    is_real_data: Optional[bool] = True
    real_data: Optional[bool] = True
    synthetic: Optional[bool] = False
    retrieved_at: Optional[str] = None

    # Preserved fields for existing UI components
    score: Optional[float] = None
    forecast: Optional[MetricValue] = None
    reference: Optional[MetricValue] = None
    error: Optional[ErrorMetrics] = None
    risk: Optional[RiskData] = None
    confidence: Optional[float] = None
    drivers: Optional[List[str]] = None
    factors: Optional[ErrorFactors] = None
    critical_lead_time: Optional[int] = 5

class FingerprintResponse(BaseModel):
    region_id: str
    method: str = "Prototype Historical Failure Similarity"
    cases: List[HistoricalCase]
    message: Optional[str] = None

class ModelDivergence(BaseModel):
    lead_day: int
    model_a: Optional[float] = None
    model_b: Optional[float] = None
    model_c: Optional[float] = None
    ensemble_mean: float
    spread: Optional[float] = None
    divergence_score: Optional[float] = None

class DivergenceResponse(BaseModel):
    region_id: str
    models_evaluated: Optional[Dict[str, Optional[str]]] = None
    divergence: List[ModelDivergence]

class TimelinePoint(BaseModel):
    lead_day: int
    score: float
    confidence: Optional[float] = None
    predictability_cliff: bool

class TimelineResponse(BaseModel):
    region_id: str
    timeline: List[TimelinePoint]
    cliff_detected_at: Optional[int]

class ExplanationResponse(BaseModel):
    region_id: str
    explanation: str

class RegionRanking(BaseModel):
    rank: int
    region_id: str
    region_name: str
    score: float
    lead_day: int
    top_driver: str

class RankingResponse(BaseModel):
    lead_day: int
    regions: List[RegionRanking]


class ApiStatusResponse(BaseModel):
    provider: str = "Open-Meteo"
    forecast_source: str = "Open-Meteo"
    historical_source: str = "ERA5/Open-Meteo"
    authentication_required: bool = False
    api_key_required: bool = False
    real_data: bool = True
    open_meteo: str
    era5: str
    imd: str
    imd_status: Optional[str] = "pending_optional_integration"
    mappls: str
    sources: Optional[List[Dict[str, Any]]] = None


