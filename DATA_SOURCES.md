# Meteorological Data Sources & Model Feature Specification

**Project:** ForecastBustAI — Prototype for Smart India Hackathon 2026  
**System Purpose:** **AI-Based Forecast Bust Risk Estimation for Medium-Range Weather Forecasts**  
*(Note: The AI does **NOT** predict the weather; it estimates the probability that an existing Numerical Weather Prediction [NWP] forecast will experience a significant forecast bust/error).*

---

## 1. Executive Summary & Operational Status

The operational weather data backbone is integrated with **Open-Meteo APIs**, providing real, open-access, keyless meteorological datasets across Indian subdivisions and regions. 

- **Primary Operational Provider:** Open-Meteo (Keyless, Free Non-Commercial Tier)
- **IMD Status:** `pending_optional_integration` (Optional secondary provider when authenticated credentials become available)
- **Authentication Required:** `false` (No `OPEN_METEO_API_KEY` required or exposed)
- **Synthetic Data Usage:** `false` (Zero fabricated, mock, or random values; authentic NWP model outputs and reanalysis datasets only)

---

## 2. Integrated Open-Meteo APIs & Endpoints

| Service / Capability | Endpoint URL | Primary Purpose in ForecastBustAI |
| :--- | :--- | :--- |
| **A. Forecast API** | `https://api.open-meteo.com/v1/forecast` | Current observations, 10-day daily forecasts, and multi-model forecast divergence comparison (ECMWF, GFS, ICON). |
| **B. Historical Weather API (ERA5)** | `https://archive-api.open-meteo.com/v1/archive` | ECMWF ERA5 reanalysis data used as the gold-standard historical reference/ground-truth. |
| **C. Historical Forecast API** | `https://historical-forecast-api.open-meteo.com/v1/forecast` | Archived operational forecasts to calculate historical model bias and past verification errors. |
| **D. Previous Model Runs API** | `https://previous-runs-api.open-meteo.com/v1/forecast` | Successive model runs (e.g., Run -6h, -12h, -24h) to assess forecast flip-flops and run-to-run instability. |
| **E. Ensemble Forecast API** | `https://ensemble-api.open-meteo.com/v1/ensemble` | Multi-member ensemble forecasts (e.g., ICON 40-member ensemble) to compute true ensemble standard deviation / spread. |

---

## 3. Meteorological Variables Retrieved

### Current & Hourly Forecasts:
- `temperature_2m` (°C)
- `relative_humidity_2m` (%)
- `precipitation` (mm)
- `rain` (mm)
- `pressure_msl` / `surface_pressure` (hPa)
- `wind_speed_10m` (km/h)
- `wind_gusts_10m` (km/h)
- `weather_code` (WMO code)

### Daily Forecasts (Days 1–10):
- `temperature_2m_max` (°C)
- `temperature_2m_min` (°C)
- `precipitation_sum` (mm)
- `rain_sum` (mm)
- `wind_speed_10m_max` (km/h)
- `wind_gusts_10m_max` (km/h)

### Verification & Reference Reanalysis:
- `temperature_2m_max` / `min` (ERA5 Reanalysis)
- `precipitation_sum` (ERA5 Reanalysis)
- `wind_speed_10m_max` (ERA5 Reanalysis)

---

## 4. Distinction Between Forecast Data & Verification Data

To ensure rigorous meteorological science and prevent data leakage, datasets are strictly classified:

```
[Forecast Data] ────────────────┐
(ECMWF IFS, GFS, ICON, etc.)    │
                                ├──► [Bust Risk Estimator ML] ──► Forecast Bust Probability
[Atmospheric States] ───────────┤
(Lead time, run instability)    │
                                │
[Verification Data] ────────────┴──► CANNOT be used at prediction time!
(ERA5 Reanalysis, Obs)                Used ONLY post-event for ground-truth labeling & verification.
```

1. **Forecast Data:** Generated **prior** to the verification time window. Represents numerical model guidance across forecast lead days (Day 1 through Day 10).
2. **Verification Data (ERA5 Reanalysis & Station Observations):** Generated **after** atmospheric events have occurred. Serves strictly as ground-truth for historical verification and retrospective audit.

---

## 5. ML Feature Architecture: Target Leakage Safeguards

The Random Forest forecast bust estimation pipeline adheres to strict temporal separation:

### A. Prediction-Time Features (Supplied to Random Forest during Inference)
These 10 features are available *at or before* the forecast release and contain zero target information:

1. `historical_error`: Mean Absolute Error (MAE) of the forecasting model over the preceding 30 days evaluated against historical ERA5 reference data.
2. `model_divergence`: Normalized multi-model spread between ECMWF IFS, GFS, and ICON forecasts for the target valid period.
3. `ensemble_spread`: Normalized standard deviation across perturbed ensemble members (ICON EPS).
4. `run_to_run_instability`: Absolute day-to-day trajectory delta between successive model forecast cycles for the same target valid date.
5. `lead_time`: Forecast lead time in days (1 to 10 days; uncertainty compounding factor).
6. `precipitation`: Forecast daily precipitation sum (mm).
7. `temperature`: Forecast daily maximum 2m temperature (°C).
8. `wind`: Forecast daily maximum 10m wind speed (km/h).
9. `pressure`: Forecast surface pressure (hPa).
10. `humidity`: Forecast relative humidity (%).

### B. Verification-Only Features (STRICTLY PROHIBITED at Prediction Time)
The following metrics are **NEVER** provided to the Random Forest model during operational risk inference:

- `forecast_reference_error`: Direct error between the forecast and actual reference observation for the target event.
- `actual_observed_error`: Observed ground-truth deviation.
- `composite_error`: Multi-variable composite verification score.

*Use Case:* Verification-only metrics are used solely for:
1. Constructing binary bust labels ($y \in \{0, 1\}$) during offline training on historical archive cases.
2. Post-event verification scorecards after ground-truth observations arrive.
3. Quantifying model skill scores (Brier Score, ROC-AUC, Reliability Diagrams).

---

## 6. Adapter Architecture (`weather_provider`)

The codebase implements a decoupled provider design pattern:

```
                  ┌──────────────────────┐
                  │    WeatherProvider   │  (Abstract Base Interface)
                  └──────────┬───────────┘
                             │
            ┌────────────────┴────────────────┐
            ▼                                 ▼
┌───────────────────────┐         ┌───────────────────────┐
│   OpenMeteoProvider   │         │      IMDProvider      │
│ (Primary Operational) │         │ (Optional / Secondary)│
└───────────────────────┘         └───────────────────────┘
```

- **OpenMeteoProvider (`bust-engine/weather_provider/open_meteo.py`):**
  - Manages asynchronous HTTP requests with concurrency semaphores (`asyncio.Semaphore(3)`).
  - Handles keyless queries to Forecast, Historical, Historical Forecast, Previous Runs, and Ensemble APIs.
  - Normalizes responses into standardized dataclasses (`NormalizedCurrentWeather`, `NormalizedDailyForecast`, `NormalizedForecastResponse`).
  - In-memory LRU caching (`cachetools.TTLCache`) prevents rate-limiting and redundant external queries.
  - Returns `null` on missing variables rather than synthesizing arbitrary values.
  - Attaches strict provenance metadata: `{"provider": "Open-Meteo", "is_real_data": true, "synthetic": false}`.

---

## 7. Model Sources & Provenance

ForecastBustAI aggregates guidance from world-leading Numerical Weather Prediction centers via Open-Meteo:
- **ECMWF IFS (European Centre for Medium-Range Weather Forecasts):** High-resolution global medium-range model (0.1° resolution).
- **NOAA GFS (Global Forecast System):** 0.25° resolution global numerical model run by the US National Weather Service.
- **DWD ICON (Deutscher Wetterdienst):** High-resolution non-hydrostatic global model and 40-member ensemble.
- **ECMWF ERA5:** Global atmospheric reanalysis combining model data with observations from across the world into a globally complete and consistent dataset (0.25° resolution).

---

## 8. Limitations & Constraints

1. **Free Tier Rate Limits:** Open-Meteo's public API allows up to 10,000 daily API calls and a rate limit of 600 calls/minute. ForecastBustAI employs intelligent server-side caching (TTL: 1 hour) and asynchronous throttling to operate comfortably within these limits.
2. **Reanalysis Lag:** ERA5 reanalysis data typically has a 5-day publication latency. Historical error features use archived operational forecasts and ERA5 historical records prior to this lag.
3. **Complex Orography:** High-altitude Himalayan regions (e.g., Jammu & Kashmir, Arunachal Pradesh) exhibit steep topography where 0.1°–0.25° grid models may show systematic elevation smoothing; regional orography bias weighting is applied in the risk formulation.

---

## 9. Data Attribution Requirements

In compliance with Open-Meteo's open-access terms and fair use policy:
- **Open-Meteo Weather API:** Weather data by [Open-Meteo.com](https://open-meteo.com/) licensed under Attribution 4.0 International (CC BY 4.0).
- **Copernicus Climate Change Service (ERA5):** Contains modified Copernicus Climate Change Service information [2024–2026].
