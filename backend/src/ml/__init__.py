"""
VARUNA — Predictive ML & Deep Sensor QC package (Member 3)
==========================================================

Owns:
- Spatio-Temporal Marine Heatwave Forecasting (TCN, 7/14-day)   -> src.ml.mhw_forecast
- Unsupervised 1D-CNN Autoencoder sensor QC / biofouling detect -> src.ml.qc_autoencoder

Exposes `ml_router` (mounted under /api/v1/ml) and a `warmup()` hook that
loads both model artifacts exactly once at application startup.
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException

from src.ml.mhw_forecast import (  # noqa: F401
    MHWForecastRequest,
    MHWForecastResponse,
    VALID_BASINS,
    ensure_ready as ensure_forecast_ready,
    generate_synthetic_history,
    predict_mhw_trend,
    set_history_provider,
    train_model as train_forecast_model,
)
from src.ml.qc_autoencoder import (  # noqa: F401
    ProfileQCRequest,
    ProfileQCResponse,
    corrupt_profile,
    ensure_ready as ensure_qc_ready,
    evaluate_profile,
    generate_clean_profile,
    train_and_calibrate as train_qc_autoencoder,
)

ml_router = APIRouter(
    prefix="/api/v1/ml",
    tags=["🧠 Predictive ML & Deep Sensor QC"],
)


@ml_router.post(
    "/forecast-mhw",
    response_model=MHWForecastResponse,
    summary="7/14-Day Spatio-Temporal Marine Heatwave Forecast",
    description=(
        "Runs the trained Temporal Convolutional Network on the latest 30-day "
        "2°×2° physical grid (temp/salinity/DOXY) and returns the predicted SST "
        "anomaly surface at T+7 or T+14 days, per-cell 95% confidence bounds, "
        "hottest hotspot coordinates, day-by-day basin forecast series and an "
        "Hobday-style MHW declaration probability."
    ),
)
async def forecast_mhw(req: MHWForecastRequest) -> MHWForecastResponse:
    try:
        return predict_mhw_trend(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001 — surface clean 500s, never stack traces
        raise HTTPException(status_code=500, detail=f"MHW forecast inference failed: {exc}")


@ml_router.post(
    "/qc-detect",
    response_model=ProfileQCResponse,
    summary="Deep 1D-CNN Sensor QC & Biofouling Detection",
    description=(
        "Scores one raw ARGO cast with the unsupervised 1D-CNN autoencoder: "
        "returns reconstruction MSE, flagged depth levels and the classified "
        "sensor issue (SALINITY_DRIFT | OPTICAL_BIOFOULING | PRESSURE_SPIKE) "
        "with a recommended Argo-style QC flag (1/3/4)."
    ),
)
def qc_detect(req: ProfileQCRequest) -> ProfileQCResponse:
    try:
        return evaluate_profile(req)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Sensor QC inference failed: {exc}")


def warmup() -> bool:
    """Load both models once. Call from app lifespan/startup (not per-request)."""
    ok_forecast = ensure_forecast_ready()
    ok_qc = ensure_qc_ready()
    return bool(ok_forecast and ok_qc)


__all__ = [
    "MHWForecastRequest",
    "MHWForecastResponse",
    "ProfileQCRequest",
    "ProfileQCResponse",
    "VALID_BASINS",
    "corrupt_profile",
    "evaluate_profile",
    "generate_clean_profile",
    "generate_synthetic_history",
    "ml_router",
    "predict_mhw_trend",
    "set_history_provider",
    "train_forecast_model",
    "train_qc_autoencoder",
    "warmup",
]
