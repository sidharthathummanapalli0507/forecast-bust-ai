"""
test_open_meteo_pipeline.py — Comprehensive Validation Test Suite
ForecastBustAI — Operational Open-Meteo Weather Integration
"""

import sys
import os
import json
import asyncio
import httpx

# Ensure bust-engine is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "bust-engine")))

from weather_provider import OpenMeteoProvider
from error_prone_ml import predict_forecast_bust, train_or_get_ml_model

async def run_all_tests():
    print("======================================================================")
    print("ForecastBustAI — 12-Point Comprehensive Operational Validation Suite")
    print("======================================================================\n")

    results = {}
    provider = OpenMeteoProvider()
    tel_lat, tel_lon = 17.85, 79.15  # Telangana representative coordinates

    # -------------------------------------------------------------------------
    # 1. Current weather for Telangana
    # -------------------------------------------------------------------------
    print("--> Test 1: Current weather for Telangana (Open-Meteo Forecast API)...")
    try:
        curr = await provider.get_current_weather(tel_lat, tel_lon, region_id="TEL")
        assert curr is not None, "Current weather returned None"
        assert curr.temperature is not None, "Temperature is None"
        assert curr.is_real_data is True, "is_real_data must be True"
        assert curr.synthetic is False, "synthetic must be False"
        print(f"    [PASS] Temp: {curr.temperature}°C, Wind: {curr.wind} km/h, Code: {curr.weather_code}")
        results["1_current_weather_telangana"] = {"status": 200, "details": curr.to_dict()}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["1_current_weather_telangana"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 2. 7-day forecast for Telangana
    # -------------------------------------------------------------------------
    print("\n--> Test 2: 7-day forecast for Telangana (Open-Meteo Forecast API)...")
    try:
        fc = await provider.get_forecast(tel_lat, tel_lon, region_id="TEL", days=7)
        assert fc is not None and len(fc.daily) >= 7, "Expected at least 7 daily forecasts"
        day1 = fc.daily[0]
        print(f"    [PASS] Retrieved {len(fc.daily)} days. Day 1 Max: {day1.temperature_max}°C, Precip: {day1.precipitation}mm")
        results["2_forecast_7day_telangana"] = {"status": 200, "count": len(fc.daily)}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["2_forecast_7day_telangana"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 3. Historical ERA5 data
    # -------------------------------------------------------------------------
    print("\n--> Test 3: Historical ERA5 reanalysis data (Open-Meteo Archive API)...")
    try:
        era5 = await provider.get_historical_weather(tel_lat, tel_lon, "2024-06-01", "2024-06-07")
        assert era5 is not None and "daily" in era5, "ERA5 daily data missing"
        daily_time = era5.get("daily", {}).get("time", [])
        print(f"    [PASS] Retrieved {len(daily_time)} ERA5 reference days from {daily_time[0]} to {daily_time[-1]}")
        results["3_historical_era5"] = {"status": 200, "days": len(daily_time)}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["3_historical_era5"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 4. Historical forecast data
    # -------------------------------------------------------------------------
    print("\n--> Test 4: Historical forecast archive data (Open-Meteo Historical Forecast API)...")
    try:
        hist_fc = await provider.get_historical_forecast(tel_lat, tel_lon, "2024-06-01", "2024-06-07")
        assert hist_fc is not None and "daily" in hist_fc, "Historical forecast daily data missing"
        daily_time = hist_fc.get("daily", {}).get("time", [])
        print(f"    [PASS] Retrieved {len(daily_time)} archived forecast days")
        results["4_historical_forecast"] = {"status": 200, "days": len(daily_time)}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["4_historical_forecast"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 5. Previous-run data
    # -------------------------------------------------------------------------
    print("\n--> Test 5: Previous model runs comparison (Open-Meteo Previous Runs API)...")
    try:
        prev_runs = await provider.get_previous_runs(tel_lat, tel_lon, past_days=2, forecast_days=3)
        assert prev_runs is not None, "Previous runs response is None"
        instability = prev_runs.get("run_to_run_instability", 0.0)
        print(f"    [PASS] Previous runs analysis returned run-to-run instability: {instability}")
        results["5_previous_runs"] = {"status": 200, "instability": instability}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["5_previous_runs"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 6. Model divergence
    # -------------------------------------------------------------------------
    print("\n--> Test 6: Multi-model forecast divergence (ECMWF, GFS, ICON)...")
    try:
        div = await provider.get_model_divergence(tel_lat, tel_lon, forecast_days=5)
        assert div is not None and "models" in div, "Model divergence missing models dict"
        print(f"    [PASS] Models compared: {list(div['models'].keys())}, Mean divergence score: {div.get('mean_divergence_score')}")
        results["6_model_divergence"] = {"status": 200, "models": list(div["models"].keys())}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["6_model_divergence"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 7. Ensemble spread
    # -------------------------------------------------------------------------
    print("\n--> Test 7: Ensemble spread calculation (Open-Meteo Ensemble API)...")
    try:
        ens = await provider.get_ensemble_spread(tel_lat, tel_lon, forecast_days=5)
        assert ens is not None and "ensemble_spread" in ens, "Ensemble spread key missing"
        spread_val = ens.get("ensemble_spread")
        print(f"    [PASS] Ensemble spread computed: {spread_val} (Valid members: {ens.get('member_count', 0)})")
        results["7_ensemble_spread"] = {"status": 200, "spread": spread_val}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["7_ensemble_spread"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # 8. ML prediction pipeline (Random Forest inference)
    # -------------------------------------------------------------------------
    print("\n--> Test 8: AI/ML Forecast Bust Prediction inference...")
    try:
        bust_prob, risk_score, confidence_score, risk_level, top_drivers, factors, prov = await predict_forecast_bust(
            region_id="TEL",
            lead_day=4,
            forecast_variable="rainfall"
        )
        assert bust_prob is not None, "Bust prob is None"
        assert prov.get("is_real_data") is True, "Provenance real_data must be True"
        assert prov.get("synthetic") is False, "Provenance synthetic must be False"
        print(f"    [PASS] Bust Probability: {bust_prob:.4f}, Risk Category: {risk_level}, Score: {risk_score}, Conf: {confidence_score}")
        print(f"           Top drivers: {top_drivers}")
        print(f"           Provenance: {prov}")
        results["8_ml_prediction"] = {"status": 200, "bust_probability": bust_prob, "risk_level": risk_level}
    except Exception as e:
        print(f"    [FAIL] {e}")
        results["8_ml_prediction"] = {"status": 500, "error": str(e)}

    # -------------------------------------------------------------------------
    # REST API Verification (FastAPI endpoints on http://127.0.0.1:8001)
    # -------------------------------------------------------------------------
    # Server probe: wait up to 10 seconds for server to be responsive
    for attempt in range(10):
        try:
            async with httpx.AsyncClient(base_url="http://127.0.0.1:8001", timeout=3.0) as chk_client:
                chk = await chk_client.get("/api/error-prone/status")
                if chk.status_code == 200:
                    break
        except Exception:
            await asyncio.sleep(1.0)

    async with httpx.AsyncClient(base_url="http://127.0.0.1:8001", timeout=25.0) as client:
        # 9. GET /api/error-prone/map
        print("\n--> Test 9: GET /api/error-prone/map (FastAPI)...")
        try:
            r = await client.get("/api/error-prone/map?lead_day=4")
            assert r.status_code == 200, f"Status code {r.status_code}"
            data = r.json()
            assert "regions" in data and len(data["regions"]) > 0, "No regions returned"
            print(f"    [PASS] HTTP 200 — {len(data['regions'])} regions returned, Provider: {data.get('provider')}")
            results["9_api_map"] = {"status": r.status_code, "regions": len(data["regions"])}
        except Exception as e:
            print(f"    [FAIL] {e}")
            results["9_api_map"] = {"status": getattr(e, "response", None) and e.response.status_code or 500, "error": str(e)}

        # 10. GET /api/error-prone/region/TEL
        print("\n--> Test 10: GET /api/error-prone/region/TEL (FastAPI)...")
        try:
            r = await client.get("/api/error-prone/region/TEL?lead_day=4")
            assert r.status_code == 200, f"Status code {r.status_code}"
            data = r.json()
            assert data.get("region_id") == "TEL", "Region ID mismatch"
            assert data.get("provider") == "Open-Meteo", "Provider mismatch"
            assert data.get("real_data") is True, "real_data mismatch"
            print(f"    [PASS] HTTP 200 — Region: {data.get('region_name')}, Bust Prob: {data.get('bust_probability')}, Real Data: {data.get('real_data')}")
            results["10_api_region_tel"] = {"status": r.status_code, "region": data.get("region_name")}
        except Exception as e:
            print(f"    [FAIL] {e}")
            results["10_api_region_tel"] = {"status": getattr(e, "response", None) and e.response.status_code or 500, "error": str(e)}

        # 11. GET /api/error-prone/model-info
        print("\n--> Test 11: GET /api/error-prone/model-info (FastAPI)...")
        try:
            r = await client.get("/api/error-prone/model-info")
            assert r.status_code == 200, f"Status code {r.status_code}"
            data = r.json()
            assert data.get("target_leakage_status") == "PASSED", "Target leakage status not PASSED"
            assert len(data.get("prediction_time_features", [])) == 10, "Expected 10 prediction features"
            print(f"    [PASS] HTTP 200 — Model: {data.get('model_name')}, Leakage Status: {data.get('target_leakage_status')}, Features: {len(data.get('prediction_time_features'))}")
            results["11_api_model_info"] = {"status": r.status_code, "leakage_status": data.get("target_leakage_status")}
        except Exception as e:
            print(f"    [FAIL] {e}")
            results["11_api_model_info"] = {"status": getattr(e, "response", None) and e.response.status_code or 500, "error": str(e)}

        # 12. GET /api/error-prone/status
        print("\n--> Test 12: GET /api/error-prone/status (FastAPI)...")
        try:
            r = await client.get("/api/error-prone/status")
            assert r.status_code == 200, f"Status code {r.status_code}"
            data = r.json()
            assert data.get("provider") == "Open-Meteo", "Provider mismatch"
            assert data.get("authentication_required") is False, "Auth required should be False"
            assert data.get("api_key_required") is False, "API key required should be False"
            assert data.get("real_data") is True, "real_data should be True"
            assert data.get("imd_status") == "pending_optional_integration", "imd_status mismatch"
            print(f"    [PASS] HTTP 200 — Provider: {data.get('provider')}, Auth Req: {data.get('authentication_required')}, IMD Status: {data.get('imd_status')}")
            results["12_api_status"] = {"status": r.status_code, "provider": data.get("provider"), "imd_status": data.get("imd_status")}
        except Exception as e:
            print(f"    [FAIL] {e}")
            results["12_api_status"] = {"status": getattr(e, "response", None) and e.response.status_code or 500, "error": str(e)}

    print("\n======================================================================")
    print("Validation Summary:")
    all_passed = True
    for test_name, res in results.items():
        st = res.get("status")
        passed = (st == 200)
        if not passed:
            all_passed = False
        print(f"  - {test_name}: {'PASSED (200)' if passed else 'FAILED (' + str(st) + ')'}")
    print(f"\nFinal Result: {'ALL 12 TESTS PASSED PERFECTLY!' if all_passed else 'SOME TESTS FAILED'}")
    print("======================================================================")

if __name__ == "__main__":
    asyncio.run(run_all_tests())
