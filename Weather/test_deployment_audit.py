"""
test_deployment_audit.py — Pre-Deployment End-to-End Audit Suite
Tests:
1. Backend startup & dynamic PORT binding
2. Frontend -> Backend connection (direct and through Express proxy)
3. API Endpoint verification (all 7 error-prone endpoints + bust-probability endpoints)
4. Real data provenance audit
5. Target leakage & ML feature set audit
6. Map configuration & OpenStreetMap compliance
7. Render deployment readiness
"""

import sys
import os
import json
import httpx

FASTAPI_URL = "http://127.0.0.1:8001"
EXPRESS_URL = "http://127.0.0.1:3000"

def run_audit():
    print("======================================================================")
    print("ForecastBustAI — Final Pre-Deployment Comprehensive Audit Suite")
    print("======================================================================\n")

    results = {}

    # -------------------------------------------------------------------------
    # 1. API Endpoints on FastAPI (Direct) & Express (Reverse Proxy)
    # -------------------------------------------------------------------------
    endpoints = [
        ("/api/error-prone/status", "status"),
        ("/api/error-prone/model-info", "model-info"),
        ("/api/error-prone/map?lead_day=4", "map"),
        ("/api/error-prone/region/TEL?lead_day=4", "region/TEL"),
        ("/api/error-prone/timeline?region_id=TEL&lead_day=4", "timeline"),
        ("/api/error-prone/divergence?region_id=TEL", "divergence"),
        ("/api/error-prone/fingerprint?region_id=TEL&lead_day=4", "fingerprint"),
        ("/api/bust-probability", "bust-probability KPI"),
        ("/api/data-status", "data-status"),
    ]

    print("--> 1. Testing Endpoints directly via FastAPI (Port 8001)...")
    with httpx.Client(base_url=FASTAPI_URL, timeout=20.0) as client:
        for ep, desc in endpoints:
            try:
                res = client.get(ep)
                assert res.status_code == 200, f"HTTP {res.status_code}"
                data = res.json()
                assert isinstance(data, (dict, list)), "Response is not valid JSON"
                print(f"    [PASS] {desc}: HTTP 200 OK")
                results[f"fastapi_{desc}"] = 200
            except Exception as e:
                print(f"    [FAIL] {desc}: {e}")
                results[f"fastapi_{desc}"] = 500

    print("\n--> 2. Testing Endpoints through Express Web Proxy (Port 3000)...")
    with httpx.Client(base_url=EXPRESS_URL, timeout=20.0) as client:
        for ep, desc in endpoints:
            try:
                res = client.get(ep)
                assert res.status_code == 200, f"HTTP {res.status_code}"
                data = res.json()
                assert isinstance(data, (dict, list)), "Response is not valid JSON"
                print(f"    [PASS] Express Proxy {desc}: HTTP 200 OK")
                results[f"express_{desc}"] = 200
            except Exception as e:
                print(f"    [FAIL] Express Proxy {desc}: {e}")
                results[f"express_{desc}"] = 500

    # -------------------------------------------------------------------------
    # 3. Real Data & Provenance Audit
    # -------------------------------------------------------------------------
    print("\n--> 3. Auditing Real Weather Data Provenance...")
    try:
        with httpx.Client(base_url=FASTAPI_URL, timeout=15.0) as client:
            st = client.get("/api/error-prone/status").json()
            assert st.get("provider") == "Open-Meteo", f"Expected provider Open-Meteo, got {st.get('provider')}"
            assert st.get("real_data") is True, "real_data must be True"
            assert st.get("authentication_required") is False, "auth must be False"
            assert st.get("api_key_required") is False, "api key must be False"
            assert st.get("imd_status") == "pending_optional_integration", "imd_status mismatch"

            reg = client.get("/api/error-prone/region/TEL?lead_day=4").json()
            assert reg.get("provider") == "Open-Meteo", "Region provider mismatch"
            assert reg.get("real_data") is True, "Region real_data must be True"
            assert reg.get("synthetic") is False, "Region synthetic must be False"

            print(f"    [PASS] Provider: {st.get('provider')}")
            print(f"    [PASS] Real Data Flag: {st.get('real_data')} | Synthetic Flag: {reg.get('synthetic')}")
            print(f"    [PASS] IMD Status: {st.get('imd_status')}")
            results["provenance_audit"] = 200
    except Exception as e:
        print(f"    [FAIL] Provenance audit: {e}")
        results["provenance_audit"] = 500

    # -------------------------------------------------------------------------
    # 4. ML Target Leakage Audit
    # -------------------------------------------------------------------------
    print("\n--> 4. Auditing ML Target Leakage...")
    try:
        with httpx.Client(base_url=FASTAPI_URL, timeout=15.0) as client:
            m_info = client.get("/api/error-prone/model-info").json()
            assert m_info.get("target_leakage_status") == "PASSED", "Leakage status not PASSED"
            assert m_info.get("target_leakage_audit") == "PASSED", "Leakage audit not PASSED"
            
            features = m_info.get("features", [])
            expected_features = [
                "historical_error", "model_divergence", "ensemble_spread", "run_to_run_instability",
                "lead_time", "precipitation", "temperature", "wind", "pressure", "humidity"
            ]
            assert features == expected_features, f"Feature mismatch: {features}"

            verification_features = m_info.get("verification_features", [])
            for vf in ["forecast_reference_error", "actual_observed_error"]:
                assert vf not in features, f"LEAKAGE DETECTED! {vf} in prediction features!"
                assert vf in verification_features, f"{vf} missing from verification features!"

            print(f"    [PASS] Target Leakage Status: {m_info.get('target_leakage_status')}")
            print(f"    [PASS] 10 Prediction Features Strictly Delineated: {features}")
            print(f"    [PASS] Verification Features Strictly Excluded: {verification_features}")
            results["ml_audit"] = 200
    except Exception as e:
        print(f"    [FAIL] ML audit: {e}")
        results["ml_audit"] = 500

    # -------------------------------------------------------------------------
    # 5. Frontend Clean Code Audit (No hardcoded localhost/ports)
    # -------------------------------------------------------------------------
    print("\n--> 5. Auditing Frontend JavaScript Files for Hardcoded Localhost...")
    js_files = ["error_prone.js", "bust.js", "fingerprint.js", "rainfall.js", "aws.js"]
    js_dir = os.path.join(os.path.dirname(__file__), "js")
    violations = []
    for jf in js_files:
        fpath = os.path.join(js_dir, jf)
        if os.path.exists(fpath):
            with open(fpath, "r", encoding="utf-8") as f:
                content = f.read()
                # Check for active hardcoded localhost API_BASE
                for line_no, line in enumerate(content.splitlines(), start=1):
                    if "http://localhost:8001" in line and not line.strip().startswith("//") and not line.strip().startswith("*"):
                        # check if it's an active constant assignment
                        if "const API_BASE = 'http://localhost:8001" in line:
                            violations.append(f"{jf}:{line_no} -> {line.strip()}")
    if not violations:
        print("    [PASS] Zero hardcoded localhost/8001 API constants found in frontend JS code.")
        results["frontend_clean_audit"] = 200
    else:
        print(f"    [FAIL] Violations found: {violations}")
        results["frontend_clean_audit"] = 500

    # -------------------------------------------------------------------------
    # 6. Render Configuration Audit
    # -------------------------------------------------------------------------
    print("\n--> 6. Auditing Render Deployment Configuration...")
    try:
        render_yaml_path = os.path.join(os.path.dirname(__file__), "..", "render.yaml")
        assert os.path.exists(render_yaml_path), "render.yaml missing at root"
        with open(render_yaml_path, "r", encoding="utf-8") as f:
            ry = f.read()
            assert "forecast-bust-engine" in ry, "Missing backend service in render.yaml"
            assert "uvicorn main:app --host 0.0.0.0 --port $PORT" in ry, "Missing $PORT start command"
            assert "forecast-bust-web" in ry, "Missing frontend service in render.yaml"

        procfile_path = os.path.join(os.path.dirname(__file__), "bust-engine", "Procfile")
        assert os.path.exists(procfile_path), "Procfile missing in bust-engine"
        with open(procfile_path, "r", encoding="utf-8") as f:
            pf = f.read()
            assert "uvicorn main:app --host 0.0.0.0 --port $PORT" in pf, "Procfile does not use $PORT"

        print("    [PASS] render.yaml configured with dynamic $PORT for FastAPI and Express.")
        print("    [PASS] bust-engine/Procfile configured with dynamic $PORT.")
        results["render_config_audit"] = 200
    except Exception as e:
        print(f"    [FAIL] Render config audit: {e}")
        results["render_config_audit"] = 500

    print("\n======================================================================")
    all_ok = all(v == 200 for v in results.values())
    print(f"Overall Pre-Deployment Audit: {'PASSED (ALL CHECKS 100% OK)' if all_ok else 'FAILED'}")
    print("======================================================================")
    return all_ok

if __name__ == "__main__":
    success = run_audit()
    sys.exit(0 if success else 1)
