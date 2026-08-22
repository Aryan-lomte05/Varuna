"""
Unit & integration tests for VARUNA Member 3 — Predictive ML & Deep Sensor QC.
Covers: MHW forecast contract/scenarios/latency, QC autoencoder detection of all
three synthetic failure modes, and the FastAPI endpoints via TestClient.

Run:  pytest backend/tests/test_ml_models.py -v
"""
from __future__ import annotations

import time
from typing import List, Optional, Tuple

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from src.ml import (
    MHWForecastRequest,
    ProfileQCRequest,
    corrupt_profile,
    evaluate_profile,
    generate_clean_profile,
    ml_router,
    predict_mhw_trend,
    set_history_provider,
    warmup,
)
from src.ml.mhw_forecast import BASIN_WINDOWS, generate_synthetic_history
from src.ml.qc_autoencoder import P_GRID

BASINS = ("arabian_sea", "bay_of_bengal", "equatorial_io")
CORRUPTION_MODES = ("SALINITY_DRIFT", "OPTICAL_BIOFOULING", "PRESSURE_SPIKE")


@pytest.fixture(scope="session", autouse=True)
def _loaded_models() -> None:
    """Load both model artifacts exactly once for the whole session."""
    assert warmup() is True


@pytest.fixture()
def client() -> TestClient:
    app = FastAPI()
    app.include_router(ml_router)
    return TestClient(app)


# ─────────────────────────────────────────────────────────────────────────────
# Deliverable 1 — MHW forecasting
# ─────────────────────────────────────────────────────────────────────────────


def _mhw_active_provider(basin: str, end_date):
    """History provider injecting an established, still-growing MHW event."""
    return generate_synthetic_history(
        basin, end_date, seed=123, inject_mhw=True, active_at_end=True
    )


@pytest.mark.parametrize("basin", BASINS)
def test_forecast_contract_and_calm_probability(basin: str) -> None:
    res = predict_mhw_trend(MHWForecastRequest(ocean_basin=basin, forecast_days=7))

    assert res.ocean_basin == basin
    assert res.forecast_horizon_days == 7
    assert len(res.time_series_forecast) == 7
    assert 0.0 <= res.mhw_probability <= 1.0
    # Calm default provider must yield LOW heatwave probability
    assert res.mhw_probability < 0.20

    day = res.time_series_forecast[0]
    assert {"date", "predicted_sst", "anomaly", "ci95_low", "ci95_high"} <= set(day)
    assert day["ci95_low"] <= day["anomaly"] <= day["ci95_high"]

    hotspot = res.max_anomaly_hotspot
    assert {"lat", "lon", "predicted_anomaly"} <= set(hotspot)
    lat0, lat1, lon0, lon1 = BASIN_WINDOWS[basin]
    assert lat0 <= hotspot["lat"] <= lat1
    assert lon0 <= hotspot["lon"] <= lon1


def test_known_mhw_event_yields_high_probability() -> None:
    set_history_provider(_mhw_active_provider)
    try:
        res = predict_mhw_trend(
            MHWForecastRequest(ocean_basin="bay_of_bengal", forecast_days=7)
        )
    finally:
        set_history_provider(None)

    assert res.mhw_probability > 0.30          # sane declaration threshold
    assert res.predicted_mean_anomaly > 0.30   # basin warms meaningfully
    assert res.max_anomaly_hotspot["predicted_anomaly"] > 1.00


def test_14_day_horizon_supported() -> None:
    res = predict_mhw_trend(
        MHWForecastRequest(ocean_basin="equatorial_io", forecast_days=14)
    )
    assert res.forecast_horizon_days == 14
    assert len(res.time_series_forecast) == 14


def test_lat_lon_subwindow_respected() -> None:
    lat_range = (8.0, 14.0)
    lon_range = (60.0, 70.0)
    res = predict_mhw_trend(
        MHWForecastRequest(
            ocean_basin="arabian_sea",
            forecast_days=7,
            lat_range=lat_range,
            lon_range=lon_range,
        )
    )
    hs = res.max_anomaly_hotspot
    assert lat_range[0] <= hs["lat"] <= lat_range[1]
    assert lon_range[0] <= hs["lon"] <= lon_range[1]


def test_invalid_inputs_raise_value_error() -> None:
    with pytest.raises(ValueError):
        predict_mhw_trend(MHWForecastRequest(ocean_basin="atlantic_ocean"))
    with pytest.raises(ValueError):
        predict_mhw_trend(
            MHWForecastRequest(ocean_basin="arabian_sea", forecast_days=10)
        )


def test_warm_inference_latency_under_100ms() -> None:
    predict_mhw_trend(MHWForecastRequest(ocean_basin="arabian_sea"))  # warm-up
    t0 = time.perf_counter()
    res = predict_mhw_trend(MHWForecastRequest(ocean_basin="arabian_sea"))
    wall_ms = (time.perf_counter() - t0) * 1000.0
    assert wall_ms < 100.0, f"inference took {wall_ms:.1f} ms"
    assert res.model_latency_ms < 100.0


# ─────────────────────────────────────────────────────────────────────────────
# Deliverable 2 — Sensor QC autoencoder
# ─────────────────────────────────────────────────────────────────────────────


def _qc_request(mode: Optional[str] = None, seed: int = 7) -> ProfileQCRequest:
    temps, salts = generate_clean_profile(seed=seed)
    if mode is not None:
        temps, salts = corrupt_profile(temps, salts, mode, seed=seed + 1)
    return ProfileQCRequest(
        platform_number=1902303,
        pressures=list(P_GRID),
        temperatures=[float(x) for x in temps],
        salinities=[float(x) for x in salts],
    )


def test_clean_profile_passes_qc() -> None:
    res = evaluate_profile(_qc_request(seed=21))
    assert res.is_anomalous is False
    assert res.recommended_qc_flag == 1
    assert res.detected_issue is None
    assert res.flagged_depth_levels == []
    assert res.reconstruction_mse >= 0.0


@pytest.mark.parametrize("mode", CORRUPTION_MODES)
def test_corrupted_profiles_flagged_with_correct_issue(mode: str) -> None:
    res = evaluate_profile(_qc_request(mode=mode, seed=11))
    assert res.is_anomalous is True
    assert res.detected_issue == mode
    assert res.recommended_qc_flag in (3, 4)
    assert len(res.flagged_depth_levels) > 0


def test_pressure_spike_is_hard_failure_flag4() -> None:
    res = evaluate_profile(_qc_request(mode="PRESSURE_SPIKE", seed=31))
    assert res.recommended_qc_flag == 4


def test_multiple_clean_seeds_all_pass() -> None:
    for seed in range(40, 52):
        res = evaluate_profile(_qc_request(seed=seed))
        assert not res.is_anomalous, f"clean seed {seed} flagged (mse={res.reconstruction_mse})"


def test_qc_input_validation_errors() -> None:
    base = _qc_request()
    mismatched = ProfileQCRequest(
        platform_number=base.platform_number,
        pressures=base.pressures[:-1],
        temperatures=base.temperatures,
        salinities=base.salinities,
    )
    with pytest.raises(ValueError):
        evaluate_profile(mismatched)

    too_short = ProfileQCRequest(
        platform_number=1,
        pressures=[5.0, 10.0, 20.0],
        temperatures=[29.0, 28.8, 28.0],
        salinities=[35.6, 35.6, 35.7],
    )
    with pytest.raises(ValueError):
        evaluate_profile(too_short)


# ─────────────────────────────────────────────────────────────────────────────
# Deliverable 3 — FastAPI service endpoints (/api/v1/ml/*)
# ─────────────────────────────────────────────────────────────────────────────


def test_endpoint_forecast_happy_path(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ml/forecast-mhw",
        json={"ocean_basin": "arabian_sea", "forecast_days": 7},
    )
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "ocean_basin",
        "forecast_horizon_days",
        "predicted_mean_anomaly",
        "max_anomaly_hotspot",
        "time_series_forecast",
        "mhw_probability",
    ):
        assert key in body
    assert body["forecast_horizon_days"] == 7
    assert 0.0 <= body["mhw_probability"] <= 1.0


def test_endpoint_forecast_unknown_basin_is_422(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ml/forecast-mhw",
        json={"ocean_basin": "pacific_ocean"},
    )
    assert resp.status_code == 422


def test_endpoint_forecast_bad_types_is_422(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ml/forecast-mhw",
        json={"ocean_basin": 12345, "forecast_days": "seven"},
    )
    assert resp.status_code == 422


def test_endpoint_qc_happy_path(client: TestClient) -> None:
    req = _qc_request(seed=77)
    resp = client.post(
        "/api/v1/ml/qc-detect",
        json={
            "platform_number": req.platform_number,
            "pressures": req.pressures,
            "temperatures": req.temperatures,
            "salinities": req.salinities,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    for key in (
        "platform_number",
        "is_anomalous",
        "reconstruction_mse",
        "flagged_depth_levels",
        "detected_issue",
        "recommended_qc_flag",
    ):
        assert key in body
    assert body["recommended_qc_flag"] == 1


def test_endpoint_qc_corrupted_flags_anomaly(client: TestClient) -> None:
    req = _qc_request(mode="SALINITY_DRIFT", seed=13)
    resp = client.post(
        "/api/v1/ml/qc-detect",
        json={
            "platform_number": req.platform_number,
            "pressures": req.pressures,
            "temperatures": req.temperatures,
            "salinities": req.salinities,
        },
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["is_anomalous"] is True
    assert body["detected_issue"] == "SALINITY_DRIFT"


def test_endpoint_qc_mismatched_arrays_is_422(client: TestClient) -> None:
    resp = client.post(
        "/api/v1/ml/qc-detect",
        json={
            "platform_number": 1902303,
            "pressures": [5.0, 10.0, 500.0],
            "temperatures": [29.4],
            "salinities": [35.6],
        },
    )
    assert resp.status_code == 422
