"""
config.py — IMD Meteorological Subdivisions + Domain Constants
ForecastBustAI — Forecast Bust Probability Engine
"""

import os
import math
from datetime import datetime
from pathlib import Path
from dotenv import load_dotenv

# Search and load .env from current directory, parent directory, or working directory
_env_locations = [
    Path(__file__).resolve().parent / ".env",
    Path(__file__).resolve().parent.parent / ".env",
    Path.cwd() / ".env",
]
for _p in _env_locations:
    if _p.is_file():
        load_dotenv(dotenv_path=_p)
        break
else:
    load_dotenv()

# ── API Keys & Base URLs (Safely loaded from environment) ───────────────────
OPENMETEO_BASE_URL = os.getenv("OPENMETEO_BASE_URL", "https://api.open-meteo.com/v1").strip()
IMD_API_KEY = os.getenv("IMD_API_KEY", "").strip()
MAPPLS_API_KEY = os.getenv("MAPPLS_API_KEY", "").strip()

IMD_BASE_URL = os.getenv("IMD_BASE_URL", "https://api.imd.gov.in").strip()
MAPPLS_BASE_URL = os.getenv("MAPPLS_BASE_URL", "https://apis.mappls.com/advancedmaps/v1").strip()


def is_key_configured(key: str) -> bool:
    """Check if an API key is non-empty and not a default placeholder string."""
    if not key:
        return False
    placeholders = {
        "your_imd_api_key_here",
        "your_mappls_vector_map_key_here",
        "your_mappls_rest_api_key_here",
        "placeholder",
        "none",
        "null",
        "",
    }
    return key.lower().strip() not in placeholders

# ── 36 IMD Meteorological Subdivisions ──────────────────────────────────────
IMD_SUBDIVISIONS = {
    "AN":  {"name": "Andaman & Nicobar Islands",       "lat": 11.70, "lon": 92.70,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.41, "wind": 0.55}, "orography": 0.30, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["Andaman and Nicobar Islands"]},
    "AP":  {"name": "Coastal Andhra Pradesh",           "lat": 15.50, "lon": 80.50,  "hist_rmse": {"rainfall": 0.58, "temperature": 0.42, "wind": 0.52}, "orography": 0.25, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["Andhra Pradesh"]},
    "ARP": {"name": "Arunachal Pradesh",                "lat": 27.50, "lon": 94.50,  "hist_rmse": {"rainfall": 0.74, "temperature": 0.56, "wind": 0.61}, "orography": 0.90, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Arunachal Pradesh"]},
    "ASS": {"name": "Assam & Meghalaya",                "lat": 26.20, "lon": 91.50,  "hist_rmse": {"rainfall": 0.70, "temperature": 0.50, "wind": 0.58}, "orography": 0.65, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Assam", "Meghalaya"]},
    "BIH": {"name": "Bihar",                            "lat": 25.10, "lon": 85.30,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.48, "wind": 0.45}, "orography": 0.20, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Bihar"]},
    "CHG": {"name": "Chhattisgarh",                     "lat": 21.30, "lon": 81.60,  "hist_rmse": {"rainfall": 0.58, "temperature": 0.44, "wind": 0.40}, "orography": 0.35, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Chhattisgarh"]},
    "EMP": {"name": "East Madhya Pradesh",              "lat": 23.50, "lon": 80.00,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.50, "wind": 0.42}, "orography": 0.30, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "ERA": {"name": "East Rajasthan",                   "lat": 26.50, "lon": 75.00,  "hist_rmse": {"rainfall": 0.65, "temperature": 0.62, "wind": 0.50}, "orography": 0.20, "cyclone_prone": False, "monsoon_prone": False, "states": []},
    "EUP": {"name": "East Uttar Pradesh",               "lat": 26.00, "lon": 83.00,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.52, "wind": 0.44}, "orography": 0.15, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "GAJ": {"name": "Gangetic West Bengal",             "lat": 23.00, "lon": 88.00,  "hist_rmse": {"rainfall": 0.65, "temperature": 0.46, "wind": 0.50}, "orography": 0.10, "cyclone_prone": True,  "monsoon_prone": True,  "states": []},
    "GOA": {"name": "Goa",                              "lat": 15.30, "lon": 74.10,  "hist_rmse": {"rainfall": 0.55, "temperature": 0.38, "wind": 0.48}, "orography": 0.45, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Goa"]},
    "GUJ": {"name": "Gujarat Region",                  "lat": 22.30, "lon": 72.60,  "hist_rmse": {"rainfall": 0.68, "temperature": 0.58, "wind": 0.55}, "orography": 0.20, "cyclone_prone": True,  "monsoon_prone": False, "states": ["Gujarat", "Dadra and Nagar Haveli"]},
    "HAR": {"name": "Haryana, Chandigarh & Delhi",     "lat": 29.10, "lon": 76.80,  "hist_rmse": {"rainfall": 0.68, "temperature": 0.65, "wind": 0.50}, "orography": 0.15, "cyclone_prone": False, "monsoon_prone": False, "states": ["Haryana", "Delhi"]},
    "HP":  {"name": "Himachal Pradesh",                 "lat": 31.80, "lon": 77.10,  "hist_rmse": {"rainfall": 0.72, "temperature": 0.65, "wind": 0.70}, "orography": 0.92, "cyclone_prone": False, "monsoon_prone": False, "states": ["Himachal Pradesh"]},
    "JAK": {"name": "Jammu & Kashmir & Ladakh",        "lat": 34.00, "lon": 76.00,  "hist_rmse": {"rainfall": 0.75, "temperature": 0.68, "wind": 0.72}, "orography": 0.98, "cyclone_prone": False, "monsoon_prone": False, "states": ["Jammu & Kashmir", "Ladakh"]},
    "JHA": {"name": "Jharkhand",                        "lat": 23.60, "lon": 85.30,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.46, "wind": 0.42}, "orography": 0.38, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Jharkhand"]},
    "KAR": {"name": "South Interior Karnataka",         "lat": 13.00, "lon": 76.50,  "hist_rmse": {"rainfall": 0.58, "temperature": 0.40, "wind": 0.45}, "orography": 0.55, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "KER": {"name": "Kerala",                           "lat": 10.50, "lon": 76.20,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.38, "wind": 0.52}, "orography": 0.60, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Kerala"]},
    "KON": {"name": "Konkan & Goa",                    "lat": 16.50, "lon": 73.50,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.40, "wind": 0.55}, "orography": 0.55, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Maharashtra"]},
    "LAK": {"name": "Lakshadweep",                      "lat": 10.60, "lon": 72.60,  "hist_rmse": {"rainfall": 0.55, "temperature": 0.35, "wind": 0.60}, "orography": 0.05, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["Lakshadweep"]},
    "MAD": {"name": "Madhya Maharashtra",               "lat": 18.00, "lon": 75.50,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.52, "wind": 0.45}, "orography": 0.42, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "MAR": {"name": "Marathwada",                       "lat": 18.50, "lon": 76.50,  "hist_rmse": {"rainfall": 0.65, "temperature": 0.55, "wind": 0.42}, "orography": 0.30, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "MNP": {"name": "Manipur, Mizoram & Tripura",      "lat": 23.80, "lon": 92.90,  "hist_rmse": {"rainfall": 0.68, "temperature": 0.52, "wind": 0.55}, "orography": 0.70, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Manipur", "Mizoram", "Tripura"]},
    "NAG": {"name": "Nagaland & Assam Hills",           "lat": 25.70, "lon": 93.70,  "hist_rmse": {"rainfall": 0.70, "temperature": 0.54, "wind": 0.58}, "orography": 0.75, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Nagaland"]},
    "NIO": {"name": "North Interior Karnataka",         "lat": 15.50, "lon": 76.50,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.48, "wind": 0.44}, "orography": 0.40, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Karnataka"]},
    "ORR": {"name": "Odisha",                           "lat": 20.30, "lon": 85.80,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.44, "wind": 0.52}, "orography": 0.25, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["Odisha"]},
    "PUN": {"name": "Punjab",                           "lat": 31.10, "lon": 75.30,  "hist_rmse": {"rainfall": 0.66, "temperature": 0.64, "wind": 0.52}, "orography": 0.12, "cyclone_prone": False, "monsoon_prone": False, "states": ["Punjab", "Chandigarh"]},
    "RAJ": {"name": "West Rajasthan",                  "lat": 27.00, "lon": 71.00,  "hist_rmse": {"rainfall": 0.78, "temperature": 0.72, "wind": 0.62}, "orography": 0.10, "cyclone_prone": False, "monsoon_prone": False, "states": ["Rajasthan"]},
    "SAU": {"name": "Saurashtra & Kutch",              "lat": 22.00, "lon": 70.50,  "hist_rmse": {"rainfall": 0.72, "temperature": 0.60, "wind": 0.62}, "orography": 0.10, "cyclone_prone": True,  "monsoon_prone": False, "states": ["Daman and Diu"]},
    "SIO": {"name": "South Interior Karnataka",         "lat": 13.50, "lon": 76.50,  "hist_rmse": {"rainfall": 0.58, "temperature": 0.42, "wind": 0.44}, "orography": 0.52, "cyclone_prone": False, "monsoon_prone": True,  "states": []},
    "TN":  {"name": "Tamil Nadu & Puducherry",          "lat": 11.10, "lon": 78.70,  "hist_rmse": {"rainfall": 0.60, "temperature": 0.40, "wind": 0.50}, "orography": 0.35, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["Tamil Nadu", "Puducherry"]},
    "TEL": {"name": "Telangana",                        "lat": 17.40, "lon": 79.10,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.50, "wind": 0.44}, "orography": 0.28, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Telangana"]},
    "UKD": {"name": "Uttarakhand",                      "lat": 30.30, "lon": 79.10,  "hist_rmse": {"rainfall": 0.74, "temperature": 0.66, "wind": 0.70}, "orography": 0.95, "cyclone_prone": False, "monsoon_prone": False, "states": ["Uttarakhand"]},
    "WB":  {"name": "West Bengal & Sikkim",             "lat": 23.00, "lon": 87.50,  "hist_rmse": {"rainfall": 0.64, "temperature": 0.48, "wind": 0.52}, "orography": 0.30, "cyclone_prone": True,  "monsoon_prone": True,  "states": ["West Bengal", "Sikkim"]},
    "WMP": {"name": "West Madhya Pradesh",              "lat": 23.00, "lon": 76.00,  "hist_rmse": {"rainfall": 0.62, "temperature": 0.55, "wind": 0.44}, "orography": 0.28, "cyclone_prone": False, "monsoon_prone": True,  "states": ["Madhya Pradesh"]},
    "WRA": {"name": "East Rajasthan",                   "lat": 26.50, "lon": 74.50,  "hist_rmse": {"rainfall": 0.68, "temperature": 0.65, "wind": 0.55}, "orography": 0.18, "cyclone_prone": False, "monsoon_prone": False, "states": []},
    "WUP": {"name": "West Uttar Pradesh",               "lat": 27.00, "lon": 79.00,  "hist_rmse": {"rainfall": 0.64, "temperature": 0.58, "wind": 0.48}, "orography": 0.15, "cyclone_prone": False, "monsoon_prone": False, "states": ["Uttar Pradesh"]},
}

# ── Key representative sampling points (for Open-Meteo ensemble calls) ──────
SAMPLING_POINTS = [
    {"id": "P1", "lat": 28.61, "lon": 77.21, "subdivisions": ["HAR", "PUN", "WUP", "ERA"]},
    {"id": "P2", "lat": 19.08, "lon": 72.88, "subdivisions": ["KON", "MAD", "GOA"]},
    {"id": "P3", "lat": 13.08, "lon": 80.27, "subdivisions": ["TN", "KAR", "SIO"]},
    {"id": "P4", "lat": 22.57, "lon": 88.36, "subdivisions": ["GAJ", "WB", "ORR"]},
    {"id": "P5", "lat": 26.14, "lon": 91.74, "subdivisions": ["ASS", "NAG", "ARP", "MNP"]},
    {"id": "P6", "lat": 17.38, "lon": 78.49, "subdivisions": ["TEL", "NIO", "AP"]},
    {"id": "P7", "lat": 23.02, "lon": 72.57, "subdivisions": ["GUJ", "SAU", "RAJ"]},
    {"id": "P8", "lat": 23.26, "lon": 77.41, "subdivisions": ["WMP", "EMP", "CHG", "BIH"]},
    {"id": "P9", "lat": 31.10, "lon": 77.17, "subdivisions": ["HP", "UKD", "JAK"]},
    {"id": "P10","lat": 10.82, "lon": 76.27, "subdivisions": ["KER", "LAK", "AN"]},
]

# ── Weather event severity multipliers ──────────────────────────────────────
WEATHER_EVENT_SEVERITY = {
    "all":                1.0,
    "monsoon":            0.70,
    "heavy_rainfall":     0.80,
    "cyclone":            1.00,
    "heat_wave":          0.75,
    "western_disturbance":0.68,
    "active_monsoon":     0.72,
    "break_monsoon":      0.65,
}

# ── Risk level thresholds ────────────────────────────────────────────────────
RISK_LEVELS = [
    {"min": 0.00, "max": 0.25, "label": "LOW",      "color": "#22C55E", "bg": "#F0FDF4"},
    {"min": 0.25, "max": 0.45, "label": "MODERATE", "color": "#EAB308", "bg": "#FEFCE8"},
    {"min": 0.45, "max": 0.65, "label": "HIGH",     "color": "#F97316", "bg": "#FFF7ED"},
    {"min": 0.65, "max": 1.00, "label": "CRITICAL", "color": "#EF4444", "bg": "#FFF1F2"},
]

def get_risk_level(prob: float) -> dict:
    for lvl in RISK_LEVELS:
        if lvl["min"] <= prob <= lvl["max"]:
            return lvl
    return RISK_LEVELS[-1]

def get_season_factor() -> float:
    """Return monsoon season weight based on current month."""
    month = datetime.utcnow().month
    if month in (6, 7, 8, 9):      # JJAS monsoon
        return 1.0
    elif month in (10, 11):         # Post-monsoon / NE monsoon
        return 0.7
    elif month in (12, 1, 2):       # Winter
        return 0.4
    else:                           # Pre-monsoon
        return 0.6

# ── Forecast variables ───────────────────────────────────────────────────────
FORECAST_VARIABLES = ["rainfall", "temperature", "wind", "pressure", "humidity"]

# ── NCUM / model spread normalization constants ──────────────────────────────
SPREAD_NORMS = {
    "temperature": 3.5,   # °C  — typical ensemble spread at day 5
    "rainfall":    12.0,  # mm  — typical ensemble spread at day 5
    "wind":        6.0,   # m/s — typical ensemble spread at day 5
}

# ── Objective Forecast Bust Thresholds (Configurable) ───────────────────────
BUST_THRESHOLDS = {
    "composite_normalized": 1.10,   # Normalized composite error across atmospheric variables
    "rainfall_abs_mm":      15.0,   # Absolute rainfall verification error threshold in mm
    "temperature_abs_c":     3.0,   # Absolute temperature verification error threshold in °C
    "wind_abs_kmh":         15.0,   # Absolute wind speed verification error threshold in km/h
}

FASTAPI_PORT = int(os.getenv("PORT", 8001))
CACHE_TTL_SECONDS = 3600   # 1 hour cache for computed probabilities
