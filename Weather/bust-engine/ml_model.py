"""
ml_model.py — Forecast Bust Probability Risk Engine
ForecastBustAI — Prototype AI Estimate (clearly labeled)

Architecture:
  Historical Error Features
  + Forecast Divergence
  + Ensemble Spread
  + Run-to-Run Change
  + Atmospheric / Event Indicators
  + Lead Time
  → Feature Engineering
  → Bust Risk Model
  → Bust Probability (0-1)

NOTE: All outputs are clearly labeled "Prototype AI Estimate".
      This does NOT represent an official IMD probability.
"""

import math
import random
import numpy as np
from typing import Tuple, Dict

from config import (
    IMD_SUBDIVISIONS,
    WEATHER_EVENT_SEVERITY,
    RISK_LEVELS,
    SPREAD_NORMS,
    get_risk_level,
    get_season_factor,
)
from schemas import RiskFactors, RegionBustEstimate, TimelinePoint


# ── Feature Weights (derived from synthetic historical analysis) ─────────────
FEATURE_WEIGHTS = {
    "lead_time":          0.22,
    "historical_rmse":    0.20,
    "ensemble_spread":    0.18,
    "model_divergence":   0.16,
    "weather_event":      0.12,
    "run_to_run_change":  0.07,
    "orography":          0.05,
}

# Confidence scale by data quality
CONFIDENCE_BY_SOURCE = {
    "open-meteo-ensemble": 0.72,
    "imd-live":            0.85,
    "climatology":         0.50,
    "synthetic":           0.42,
}


def _sigmoid(x: float, gain: float = 6.0, midpoint: float = 0.45) -> float:
    """Logistic function mapping raw score to probability."""
    return 1.0 / (1.0 + math.exp(-gain * (x - midpoint)))


def compute_bust_probability(
    lead_day: int,
    historical_rmse_norm: float,
    ensemble_spread_norm: float,
    model_divergence_norm: float,
    weather_event_severity: float,
    orography_complexity: float,
    season_factor: float,
    run_to_run_change: float,
    data_source: str = "climatology",
) -> Tuple[float, RiskFactors, str, float]:
    """
    Compute forecast bust probability for a region at a given lead day.

    Returns
    -------
    bust_probability : float (0–1)
    factors          : RiskFactors (contribution breakdown)
    primary_driver   : str (dominant risk factor label)
    confidence       : float (0–1)
    """
    lead_factor = lead_day / 10.0

    # ── Raw weighted score ────────────────────────────────────────────────────
    raw_contributions = {
        "lead_time":         FEATURE_WEIGHTS["lead_time"]       * lead_factor,
        "historical_rmse":   FEATURE_WEIGHTS["historical_rmse"] * historical_rmse_norm,
        "ensemble_spread":   FEATURE_WEIGHTS["ensemble_spread"] * ensemble_spread_norm,
        "model_divergence":  FEATURE_WEIGHTS["model_divergence"]* model_divergence_norm,
        "weather_event":     FEATURE_WEIGHTS["weather_event"]   * weather_event_severity,
        "run_to_run_change": FEATURE_WEIGHTS["run_to_run_change"]* run_to_run_change,
        "orography":         FEATURE_WEIGHTS["orography"]       * orography_complexity,
    }

    score = sum(raw_contributions.values())

    # ── Season adjustment ─────────────────────────────────────────────────────
    score = score * (1.0 + 0.18 * season_factor)
    score = min(score, 1.0)

    # ── Sigmoid to probability ───────────────────────────────────────────────
    probability = _sigmoid(score)
    probability = max(0.05, min(0.95, probability))

    # ── Normalised factor contributions (relative to total score) ────────────
    total = sum(raw_contributions.values()) or 1e-9

    factors = RiskFactors(
        lead_time_uncertainty         = raw_contributions["lead_time"]         / total,
        historical_failure_similarity = raw_contributions["historical_rmse"]   / total,
        ensemble_spread               = raw_contributions["ensemble_spread"]   / total,
        forecast_divergence           = raw_contributions["model_divergence"]  / total,
        weather_event_complexity      = raw_contributions["weather_event"]     / total,
        run_to_run_instability        = raw_contributions["run_to_run_change"] / total,
        orography_complexity          = raw_contributions["orography"]         / total,
    )

    # ── Primary driver ────────────────────────────────────────────────────────
    driver_labels = {
        "lead_time":         "Lead-time uncertainty",
        "historical_rmse":   "Historical failure similarity",
        "ensemble_spread":   "High ensemble spread",
        "model_divergence":  "Model forecast divergence",
        "weather_event":     "High-impact weather event",
        "run_to_run_change": "Run-to-run instability",
        "orography":         "Complex orography",
    }
    primary_key = max(raw_contributions, key=raw_contributions.get)
    primary_driver = driver_labels.get(primary_key, "Unknown")

    # ── Confidence ───────────────────────────────────────────────────────────
    base_conf = CONFIDENCE_BY_SOURCE.get(data_source, 0.50)
    lead_penalty = 0.02 * (lead_day - 1)
    confidence = max(0.25, min(0.90, base_conf - lead_penalty))

    return probability, factors, primary_driver, confidence


def build_region_estimate(
    region_id: str,
    lead_day: int,
    forecast_variable: str = "rainfall",
    weather_event: str = "all",
    ensemble_spread_data: dict = None,
) -> RegionBustEstimate:
    """
    Build a full bust probability estimate for a subdivision + lead day.
    Uses real ensemble spread if available, otherwise climatology proxy.
    """
    sub = IMD_SUBDIVISIONS.get(region_id)
    if sub is None:
        raise ValueError(f"Unknown subdivision: {region_id}")

    # ── Historical RMSE (normalised 0-1 from config) ─────────────────────────
    hist_rmse_raw = sub["hist_rmse"].get(forecast_variable, sub["hist_rmse"].get("rainfall", 0.6))
    hist_rmse_norm = min(hist_rmse_raw, 1.0)

    # ── Ensemble spread (real or proxy) ──────────────────────────────────────
    data_src = "climatology"
    if ensemble_spread_data and region_id in ensemble_spread_data:
        spread_info = ensemble_spread_data[region_id]
        day_idx = min(lead_day - 1, len(spread_info.get("daily_temp_spread", [])) - 1)
        if day_idx >= 0:
            raw_spread = spread_info["daily_temp_spread"][day_idx]
            norm_key = "temperature" if forecast_variable == "temperature" else "rainfall"
            spread_norm = min(raw_spread / SPREAD_NORMS.get(norm_key, 5.0), 1.0)
            data_src = "open-meteo-ensemble"
        else:
            spread_norm = _climatology_spread_proxy(lead_day, hist_rmse_norm)
    else:
        spread_norm = _climatology_spread_proxy(lead_day, hist_rmse_norm)

    # ── Model divergence proxy ────────────────────────────────────────────────
    # Proxy: correlated with spread and lead time, with small stochastic noise
    rng = random.Random(hash(region_id + str(lead_day)) % (2**31))
    noise = rng.gauss(0, 0.06)
    model_div_norm = min(max(spread_norm * (lead_day / 10.0) * 0.85 + noise, 0.0), 1.0)

    # ── Run-to-run change proxy ───────────────────────────────────────────────
    run_change = min(max(model_div_norm * 0.7 + rng.gauss(0, 0.05), 0.0), 1.0)

    # ── Weather event severity ────────────────────────────────────────────────
    event_sev = WEATHER_EVENT_SEVERITY.get(weather_event, 1.0)
    # Boost for cyclone-prone regions during cyclone events
    if weather_event == "cyclone" and sub.get("cyclone_prone"):
        event_sev = min(event_sev * 1.25, 1.0)

    # ── Season factor ─────────────────────────────────────────────────────────
    season = get_season_factor()
    if sub.get("monsoon_prone") and weather_event in ("monsoon", "heavy_rainfall", "active_monsoon"):
        season = min(season * 1.15, 1.0)

    # ── Compute probability ───────────────────────────────────────────────────
    probability, factors, primary_driver, confidence = compute_bust_probability(
        lead_day             = lead_day,
        historical_rmse_norm = hist_rmse_norm,
        ensemble_spread_norm = spread_norm,
        model_divergence_norm= model_div_norm,
        weather_event_severity= event_sev,
        orography_complexity = sub["orography"],
        season_factor        = season,
        run_to_run_change    = run_change,
        data_source          = data_src,
    )

    risk = get_risk_level(probability)

    return RegionBustEstimate(
        region_id            = region_id,
        region_name          = sub["name"],
        latitude             = sub["lat"],
        longitude            = sub["lon"],
        lead_day             = lead_day,
        bust_probability     = round(probability, 4),
        risk_level           = risk["label"],
        risk_color           = risk["color"],
        confidence           = round(confidence, 3),
        primary_risk_driver  = primary_driver,
        ensemble_spread_norm = round(spread_norm, 4),
        historical_rmse_norm = round(hist_rmse_norm, 4),
        model_divergence_norm= round(model_div_norm, 4),
        forecast_variable    = forecast_variable,
        weather_event        = weather_event,
        data_source          = data_src,
        is_prototype         = True,
        factors              = factors,
    )


def build_timeline(
    region_id: str,
    forecast_variable: str = "rainfall",
    weather_event: str = "all",
    ensemble_spread_data: dict = None,
) -> list:
    """Build Day 1–10 timeline for a region."""
    timeline = []
    for day in range(1, 11):
        est = build_region_estimate(region_id, day, forecast_variable, weather_event, ensemble_spread_data)
        timeline.append(TimelinePoint(
            lead_day             = day,
            bust_probability     = est.bust_probability,
            risk_level           = est.risk_level,
            risk_color           = est.risk_color,
            confidence           = est.confidence,
            ensemble_spread_norm = est.ensemble_spread_norm,
        ))
    return timeline


def build_india_average_timeline(
    forecast_variable: str = "rainfall",
    weather_event: str = "all",
    ensemble_spread_data: dict = None,
) -> list:
    """Compute all-India average bust probability per lead day."""
    region_ids = list(IMD_SUBDIVISIONS.keys())
    days_probs: Dict[int, list] = {d: [] for d in range(1, 11)}

    for rid in region_ids:
        for day in range(1, 11):
            est = build_region_estimate(rid, day, forecast_variable, weather_event, ensemble_spread_data)
            days_probs[day].append(est.bust_probability)

    result = []
    for day in range(1, 11):
        avg_prob = float(np.mean(days_probs[day]))
        risk = get_risk_level(avg_prob)
        # average confidence decreases with lead time
        conf = max(0.25, 0.70 - 0.04 * (day - 1))
        result.append(TimelinePoint(
            lead_day             = day,
            bust_probability     = round(avg_prob, 4),
            risk_level           = risk["label"],
            risk_color           = risk["color"],
            confidence           = round(conf, 3),
            ensemble_spread_norm = round(0.15 + 0.07 * day, 3),
        ))
    return result


# ── Helper ────────────────────────────────────────────────────────────────────
def _climatology_spread_proxy(lead_day: int, hist_rmse_norm: float) -> float:
    """
    Estimate normalised ensemble spread from lead time and historical RMSE.
    Approximates the increase of ensemble divergence with forecast range.
    """
    base = hist_rmse_norm * 0.6
    growth = 0.04 * lead_day          # ensemble spread grows ~4% per day
    return min(base + growth, 1.0)


def generate_factor_descriptions(factors: RiskFactors) -> Dict[str, str]:
    """Human-readable explanation of each risk factor contribution."""
    f = factors
    def pct(v): return f"{v * 100:.0f}%"

    return {
        "lead_time_uncertainty": (
            f"Lead-time accounts for {pct(f.lead_time_uncertainty)} of total risk. "
            "Forecast skill degrades rapidly beyond Day 5–6 for mesoscale events."
        ),
        "historical_failure_similarity": (
            f"Historical error pattern contributes {pct(f.historical_failure_similarity)}. "
            "This region has shown systematic model bias in past events of this type."
        ),
        "ensemble_spread": (
            f"Ensemble spread contributes {pct(f.ensemble_spread)}. "
            "High inter-member variance indicates atmospheric predictability limits."
        ),
        "forecast_divergence": (
            f"Model divergence accounts for {pct(f.forecast_divergence)}. "
            "Large 24h run-to-run changes suggest unstable forecast state."
        ),
        "weather_event_complexity": (
            f"Event type complexity contributes {pct(f.weather_event_complexity)}. "
            "High-impact events (cyclones, heavy rain) are inherently harder to predict."
        ),
        "run_to_run_instability": (
            f"Run-to-run instability contributes {pct(f.run_to_run_instability)}. "
            "Successive model runs show significant amplitude/position shifts."
        ),
        "orography_complexity": (
            f"Orographic complexity accounts for {pct(f.orography_complexity)}. "
            "Complex terrain amplifies NWP errors through unresolved mesoscale processes."
        ),
    }
