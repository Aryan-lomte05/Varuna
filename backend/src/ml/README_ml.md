# VARUNA Predictive ML & Deep Sensor QC — Member 3 (Sahil Shah)

Two production-ready ML services with FastAPI endpoints:

| Service | File | Endpoint | What it does |
|---|---|---|---|
| **MHW Forecaster** | `mhw_forecast.py` | `POST /api/v1/ml/forecast-mhw` | Predicts SST-anomaly surface at T+7 / T+14 days from a 30-day 2°×2° grid (temp/salinity/DOXY), with per-cell 95% CI, hotspot coordinates and an Hobday-style declaration probability |
| **Sensor QC Autoencoder** | `qc_autoencoder.py` | `POST /api/v1/ml/qc-detect` | Scores a raw ARGO cast (0–2000 dbar) with an unsupervised 1D-CNN autoencoder; returns reconstruction MSE, flagged depth levels, classified issue (`SALINITY_DRIFT` / `OPTICAL_BIOFOULING` / `PRESSURE_SPIKE`) and an Argo-style QC flag (1/3/4) |

Both models load **once** at startup (`warmup()` in the app lifespan) — never per request.

---

## Environment (verified working)

```
Python 3.14.4   torch==2.13.0+cpu   numpy==2.5.2   pydantic==2.13.4
fastapi==0.141.1   pytest==9.1.1   httpx==0.28.1
```

```powershell
cd backend
py -3.14 -m venv .venv
.venv\Scripts\python -m pip install -r requirements.txt "torch==2.13.0+cpu" --index-url https://download.pytorch.org/whl/cpu --extra-index-url https://pypi.org/simple
.venv\Scripts\python -m pytest tests\test_ml_models.py -v   # 21 tests, ~2 s
```

> **Note:** `requirements.txt` leaves `qdrant-client>=1.8.0` unpinned; versions ≥1.10 removed
> `SearchRequest`, which `src/rag/retriever.py` imports. Pin `qdrant-client==1.9.2`
> until the retriever is migrated to the query API.

---

## Retraining

### MHW forecaster (~22 s CPU)

```powershell
.venv\Scripts\python -c "from src.ml import train_forecast_model; train_forecast_model(epochs=10, n_samples=384)"
```

- Model: **TCN** (4 dilated causal Conv1d blocks, d=1..8) + spatial conv head.
  Chosen over ConvLSTM: covers the 30-day receptive field deterministically,
  trains ~20× faster on CPU, and flat <100 ms inference (measured ≈5 ms warm).
- Data: `generate_synthetic_sample()` builds matched history/target pairs from one
  continuous process (seasonal climatology + AR(1) red-noise + MHW lifecycle with
  Gaussian epicenter, exponential rise→plateau→decay). Half of event samples are
  *established* at window end so the model learns to extrapolate growing events.
- Output: `checkpoints/mhw_tcn.pt` (weights, normalization stats, residual σ₇/σ₁₄).

### QC autoencoder (~30 s CPU)

```powershell
.venv\Scripts\python -c "from src.ml import train_qc_autoencoder; train_qc_autoencoder()"
```

- Model: Conv1d(stride-2)×2 encoder → **3-float linear bottleneck** → upsample-decoder.
- Trained denoising-style on clean synthetic casts (noisy input → clean target).
- Output: `checkpoints/qc_autoencoder.pt` (weights, per-level stats, all thresholds).

---

## Threshold calibration (all on clean validation data)

Every detector threshold is fit on held-out **clean** casts:

| Detector | Statistic | Rule |
|---|---|---|
| `mse` | global reconstruction energy | mean + 3·std |
| `drift` | log-depth slope of physical salinity residual × mono³ | mean + 3·std |
| `biof_rms` | shallow temp-residual RMS (°C) | mean + 3·std |
| `biof_hf` | high-frequency shallow temp residual (°C) | mean + 3·std |
| `spike_z` | max global-z level | clean 99.9th percentile |
| `disc` | max second difference of raw curve (°C/PSU) | mean + 3·std |

Measured accuracy over 80 fresh seeds: **CLEAN 74/80 · DRIFT 79/80 · BIOFOULING 76/80 · SPIKE 80/80**.

---

## Swapping in real ARGO data

1. **Forecasting**: call `set_history_provider(fn)` where `fn(basin, end_date)`
   returns `(T=30, 3, H, W)` float array `[sst_c, psal, doxy]` from PostGIS/satellite
   grids. Retrain with targets derived from observed next-week anomalies.
2. **QC**: replace `generate_clean_profile()` with a sampler over vetted delayed-mode
   casts, keep `corrupt_profile()` unchanged (it injects faults), rerun
   `train_and_calibrate()`. Per-level stats and thresholds refit automatically.

## Known limitations

- ⚠️ **All models are trained on physics-informed synthetic data** (no real ARGO archive
  ships with the repo). Absolute anomaly magnitudes and basin thresholds are demo-grade;
  retrain on real archives before operational claims.
- The calm/MHW probability mapping assumes Hobday P90-proxy thresholds per basin
  (constants in `mhw_forecast.py`) rather than empirically-derived climatologies.
- Single-cast drift detection is bounded by how far smooth ramps deviate from the
  learned manifold; cross-cycle trend tracking would improve it further.
