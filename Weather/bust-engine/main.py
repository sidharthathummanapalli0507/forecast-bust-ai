"""
main.py — FastAPI Application: Forecast Bust Probability Engine
ForecastBustAI · Port 8001

Endpoints:
  GET /api/bust-probability              → KPI summary
  GET /api/bust-probability/map          → per-region map data
  GET /api/bust-probability/timeline     → Day 1-10 timeline
  GET /api/bust-probability/regions      → ranked region list
  GET /api/bust-probability/explanations/{region_id}
  GET /api/data-status                   → data source health
"""

import asyncio
import numpy as np
from datetime import datetime
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, Query, Path, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from config import (
    IMD_SUBDIVISIONS,
    WEATHER_EVENT_SEVERITY,
    get_risk_level,
    FASTAPI_PORT,
)
from schemas import (
    KPISummary,
    MapResponse,
    TimelineResponse,
    RankingResponse,
    RegionRanking,
    ExplanationResponse,
    DataStatusResponse,
)
from ml_model import (
    build_region_estimate,
    build_timeline,
    build_india_average_timeline,
    generate_factor_descriptions,
)
from data_ingestion import (
    ingest_all_data,
    get_all_source_statuses,
)
from error_prone_router import router as error_prone_router

# ── Global state ──────────────────────────────────────────────────────────────
_ensemble_spread_cache: dict = {}
_last_ingest: Optional[str] = None


def _now_iso() -> str:
    return datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")


# ── Lifespan: run ingestion on startup ───────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    global _ensemble_spread_cache, _last_ingest
    print("[BustEngine] Starting data ingestion …")
    _ensemble_spread_cache = await ingest_all_data()
    _last_ingest = _now_iso()
    print(f"[BustEngine] Ingestion complete. {len(_ensemble_spread_cache)} spread records loaded.")
    yield
    print("[BustEngine] Shutting down.")


# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title       = "ForecastBustAI — Bust Probability Engine",
    description = (
        "Prototype AI service for estimating where and when NWP medium-range "
        "forecasts are most likely to fail over India. "
        "All outputs are clearly labeled 'Prototype AI Estimate' and do NOT "
        "represent official IMD probabilities."
    ),
    version     = "1.0.0",
    lifespan    = lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["GET", "OPTIONS"],
    allow_headers  = ["*"],
)

app.include_router(error_prone_router)


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/bust-probability  →  KPI summary
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bust-probability", response_model=KPISummary, tags=["Bust Probability"])
async def get_kpi_summary(
    lead_day:         int = Query(1, ge=1, le=10, description="Lead day (1–10)"),
    forecast_variable:str = Query("rainfall", description="Variable: rainfall | temperature | wind | pressure | humidity"),
    weather_event:    str = Query("all",      description="Event filter"),
):
    """Return India-wide KPI summary for top-bar cards."""
    all_regions = [
        build_region_estimate(rid, lead_day, forecast_variable, weather_event, _ensemble_spread_cache)
        for rid in IMD_SUBDIVISIONS
    ]

    probs          = [r.bust_probability for r in all_regions]
    avg_prob       = float(np.mean(probs))
    max_prob       = float(np.max(probs))
    max_region     = all_regions[int(np.argmax(probs))]
    high_risk_cnt  = sum(1 for p in probs if p >= 0.45)
    india_risk     = get_risk_level(avg_prob)

    # Critical lead day = first day where avg India prob exceeds 0.55
    critical_day = 1
    for day in range(1, 11):
        day_probs = [
            build_region_estimate(rid, day, forecast_variable, weather_event, _ensemble_spread_cache).bust_probability
            for rid in IMD_SUBDIVISIONS
        ]
        if float(np.mean(day_probs)) >= 0.55:
            critical_day = day
            break

    return KPISummary(
        india_risk_level          = india_risk["label"],
        india_risk_color          = india_risk["color"],
        india_avg_probability     = round(avg_prob, 4),
        highest_risk_region       = max_region.region_name,
        highest_risk_region_id    = max_region.region_id,
        max_bust_probability      = round(max_prob, 4),
        critical_lead_day         = critical_day,
        total_high_risk_regions   = high_risk_cnt,
        timestamp                 = _now_iso(),
        is_prototype              = True,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/bust-probability/map
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bust-probability/map", response_model=MapResponse, tags=["Bust Probability"])
async def get_map_data(
    lead_day:         int = Query(1, ge=1, le=10),
    forecast_variable:str = Query("rainfall"),
    weather_event:    str = Query("all"),
):
    """Return bust probability for all 36+ IMD subdivisions (map choropleth data)."""
    regions = [
        build_region_estimate(rid, lead_day, forecast_variable, weather_event, _ensemble_spread_cache)
        for rid in IMD_SUBDIVISIONS
    ]

    # Determine data freshness label
    live_count = sum(1 for r in regions if r.data_source == "open-meteo-ensemble")
    if live_count > 20:
        freshness = "LIVE"
    elif live_count > 0:
        freshness = "PARTIAL"
    else:
        freshness = "CLIMATOLOGY"

    return MapResponse(
        timestamp         = _now_iso(),
        lead_day          = lead_day,
        forecast_variable = forecast_variable,
        weather_event     = weather_event,
        is_prototype      = True,
        data_freshness    = freshness,
        regions           = regions,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/bust-probability/timeline
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bust-probability/timeline", response_model=TimelineResponse, tags=["Bust Probability"])
async def get_timeline(
    region_id:        str = Query("all", description="Region ID or 'all' for India average"),
    forecast_variable:str = Query("rainfall"),
    weather_event:    str = Query("all"),
):
    """Return Day 1–10 bust probability timeline for a region or all-India average."""
    india_avg = build_india_average_timeline(forecast_variable, weather_event, _ensemble_spread_cache)

    if region_id == "all":
        return TimelineResponse(
            region_id         = "all",
            region_name       = "All India Average",
            forecast_variable = forecast_variable,
            weather_event     = weather_event,
            is_prototype      = True,
            timeline          = india_avg,
            india_average     = india_avg,
        )

    if region_id not in IMD_SUBDIVISIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region_id}' not found.")

    sub_name = IMD_SUBDIVISIONS[region_id]["name"]
    region_timeline = build_timeline(region_id, forecast_variable, weather_event, _ensemble_spread_cache)

    return TimelineResponse(
        region_id         = region_id,
        region_name       = sub_name,
        forecast_variable = forecast_variable,
        weather_event     = weather_event,
        is_prototype      = True,
        timeline          = region_timeline,
        india_average     = india_avg,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/bust-probability/regions
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bust-probability/regions", response_model=RankingResponse, tags=["Bust Probability"])
async def get_ranked_regions(
    lead_day:         int = Query(1, ge=1, le=10),
    forecast_variable:str = Query("rainfall"),
    weather_event:    str = Query("all"),
    limit:            int = Query(15, ge=1, le=38),
    risk_level_filter:str = Query("all", description="Filter: all | LOW | MODERATE | HIGH | CRITICAL"),
):
    """Return regions ranked by bust probability (descending)."""
    all_regions = [
        build_region_estimate(rid, lead_day, forecast_variable, weather_event, _ensemble_spread_cache)
        for rid in IMD_SUBDIVISIONS
    ]

    # Apply risk level filter
    if risk_level_filter != "all":
        all_regions = [r for r in all_regions if r.risk_level == risk_level_filter.upper()]

    # Sort descending
    all_regions.sort(key=lambda r: r.bust_probability, reverse=True)
    top = all_regions[:limit]

    rankings = [
        RegionRanking(
            rank            = i + 1,
            region_id       = r.region_id,
            region_name     = r.region_name,
            bust_probability= r.bust_probability,
            risk_level      = r.risk_level,
            risk_color      = r.risk_color,
            primary_driver  = r.primary_risk_driver,
            lead_day        = lead_day,
        )
        for i, r in enumerate(top)
    ]

    return RankingResponse(
        lead_day          = lead_day,
        forecast_variable = forecast_variable,
        is_prototype      = True,
        timestamp         = _now_iso(),
        regions           = rankings,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/bust-probability/explanations/{region_id}
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/bust-probability/explanations/{region_id}", response_model=ExplanationResponse, tags=["Bust Probability"])
async def get_explanation(
    region_id:        str = Path(..., description="IMD subdivision code, e.g. 'JAK'"),
    lead_day:         int = Query(1, ge=1, le=10),
    forecast_variable:str = Query("rainfall"),
    weather_event:    str = Query("all"),
):
    """Return detailed risk factor explanation for a specific region."""
    if region_id not in IMD_SUBDIVISIONS:
        raise HTTPException(status_code=404, detail=f"Region '{region_id}' not found.")

    est    = build_region_estimate(region_id, lead_day, forecast_variable, weather_event, _ensemble_spread_cache)
    sub    = IMD_SUBDIVISIONS[region_id]
    risk   = get_risk_level(est.bust_probability)
    fdescs = generate_factor_descriptions(est.factors)

    # Historical context
    hist_rmse = sub["hist_rmse"].get(forecast_variable, sub["hist_rmse"].get("rainfall", 0.6))
    hist_ctx = (
        f"{sub['name']} has a historical {forecast_variable} forecast RMSE normalised score of "
        f"{hist_rmse:.2f} (range 0–1). "
    )
    if sub.get("cyclone_prone"):
        hist_ctx += "This subdivision is cyclone-prone, leading to elevated uncertainty during Bay of Bengal / Arabian Sea cyclone events. "
    if sub.get("orography") > 0.7:
        hist_ctx += "Complex orography (mountains/valleys) significantly degrades NWP skill by introducing sub-grid terrain effects. "
    if sub.get("monsoon_prone"):
        hist_ctx += "Strong sensitivity to monsoon variability — active/break spells and depressions drive the largest error episodes."

    # Data sources actually used
    srcs = ["Climatology Baseline (IMD normals)"]
    if est.data_source == "open-meteo-ensemble":
        srcs.insert(0, "Open-Meteo ICON-Seamless Ensemble (40 members)")

    return ExplanationResponse(
        region_id         = region_id,
        region_name       = sub["name"],
        lead_day          = lead_day,
        bust_probability  = est.bust_probability,
        risk_level        = risk["label"],
        is_prototype      = True,
        summary           = (
            f"{sub['name']} has a {risk['label']} forecast bust risk at Day {lead_day} "
            f"({est.bust_probability * 100:.0f}% prototype probability). "
            f"The dominant risk factor is '{est.primary_risk_driver}'."
        ),
        factors            = est.factors,
        factor_descriptions= fdescs,
        historical_context = hist_ctx,
        confidence_note    = (
            f"Confidence: {est.confidence * 100:.0f}%. "
            "This is a prototype AI estimate using rule-based logistic regression. "
            "It does NOT represent an official IMD probability forecast."
        ),
        data_sources_used  = srcs,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/data-status
# ─────────────────────────────────────────────────────────────────────────────
@app.get("/api/data-status", response_model=DataStatusResponse, tags=["System"])
async def get_data_status():
    """Return health status of all data sources and model metadata."""
    statuses = get_all_source_statuses()

    live_count = sum(1 for s in statuses if s.status == "LIVE")
    if live_count >= 2:
        overall = "OPERATIONAL"
    elif live_count == 1:
        overall = "DEGRADED"
    else:
        overall = "MINIMAL"

    return DataStatusResponse(
        overall_status = overall,
        last_updated   = _last_ingest or _now_iso(),
        data_sources   = statuses,
        model_info     = {
            "name":        "ForecastBustAI Risk Engine v1.0",
            "type":        "Weighted Logistic Regression (Prototype)",
            "label":       "Prototype AI Estimate — NOT an official IMD product",
            "features":    7,
            "subdivisions":len(IMD_SUBDIVISIONS),
            "lead_days":   10,
            "last_trained":"2024-12-01T00:00:00Z",  # synthetic
        },
    )


# ── Dev runner ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=FASTAPI_PORT, reload=True)
