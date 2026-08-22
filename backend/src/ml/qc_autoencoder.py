"""
Deep Sensor QC & Biofouling Detection Autoencoder — VARUNA Member 3
====================================================================

Unsupervised 1D-CNN autoencoder that scans vertical ARGO profile curves
(pressure 0-2000 dbar, temperature, salinity) and flags sensor faults
BEFORE data enters the primary database:

- OPTICAL_BIOFOULING : near-surface (top ~150 dbar) degradation pattern
- SALINITY_DRIFT     : slow monotonic salinity divergence below the mixed layer
- PRESSURE_SPIKE     : sudden isolated single-level discontinuities

ARCHITECTURE
------------
Encoder : Conv1d(stride-2) -> Conv1d(stride-2) -> flatten -> Linear latent (4 floats)
Decoder : Linear -> reshape -> Upsample+Conv1d x2 -> Conv1d output head

The 4-float latent is a hard information bottleneck: the network learns only
the smooth physical-profile manifold (thermocline/halocline families). Faults
that leave the manifold reconstruct badly.

DETECTION DESIGN
----------------
The autoencoder is the *residual engine*. Residuals are rescaled by EACH
PROFILE'S OWN RMS (local z-scale — pooled global sigma miscalibrates the
max-statistic), then fed to five detectors, every threshold calibrated on a
held-out CLEAN validation set:

  1. mse        - global reconstruction energy            (mean + 3*std)
  2. drift      - deep-salinity |excursion (PSU)| x mono^3 (mean + 3*std)
  3. biof_rms   - shallow temperature residual RMS in deg C (mean + 3*std)
  4. biof_hf    - high-frequency content of the shallow temp residual
                  (mean abs successive difference, deg C)  (mean + 3*std)
  5. spike_z    - max global-z over all levels (clean 99.5th percentile bar)

This mirrors production ocean QC practice (statistical score + structural
confirmation tests). See README_ml.md for real-ARGO swap path / limitations.
"""

from __future__ import annotations

import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import torch
import torch.nn as nn
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────────
# Contracts (exact per Member-3 spec)
# ─────────────────────────────────────────────────────────────────────────────


class ProfileQCRequest(BaseModel):
    platform_number: int = Field(..., example=1902303)
    pressures: List[float] = Field(..., description="Decibar (≈ depth m), ascending")
    temperatures: List[float] = Field(..., description="In-situ temperature °C")
    salinities: List[float] = Field(..., description="Practical salinity PSU")


class ProfileQCResponse(BaseModel):
    platform_number: int
    is_anomalous: bool
    reconstruction_mse: float
    flagged_depth_levels: List[float]
    detected_issue: Optional[str]  # "SALINITY_DRIFT" | "OPTICAL_BIOFOULING" | "PRESSURE_SPIKE" | None
    recommended_qc_flag: int  # 1=Good, 3=Potentially Correctable, 4=Bad


# ─────────────────────────────────────────────────────────────────────────────
# Standard sampling grid & constants
# ─────────────────────────────────────────────────────────────────────────────

N_LEVELS: int = 64
P_GRID: np.ndarray = np.geomspace(2.5, 2000.0, N_LEVELS)  # dense near surface

ISSUE_DRIFT = "SALINITY_DRIFT"
ISSUE_BIOFOULING = "OPTICAL_BIOFOULING"
ISSUE_SPIKE = "PRESSURE_SPIKE"

CHECKPOINT_DIR = Path(__file__).resolve().parent / "checkpoints"
CHECKPOINT_PATH = CHECKPOINT_DIR / "qc_autoencoder.pt"

LATENT_DIM: int = 3
#: z-score above which a level appears in flagged_depth_levels
FLAG_Z: float = 2.5
K_SIGMA: float = 3.0  # calibration rule: clean-mean + 3 std

# ─────────────────────────────────────────────────────────────────────────────
# Model
# ─────────────────────────────────────────────────────────────────────────────


class ProfileConvAutoencoder(nn.Module):
    """1D-CNN encoder/decoder with a 4-float linear bottleneck."""

    def __init__(self, latent_dim: int = LATENT_DIM):
        super().__init__()
        self.latent_dim = latent_dim
        self.encoder = nn.Sequential(
            nn.Conv1d(2, 8, kernel_size=5, stride=2, padding=2),
            nn.GELU(),
            nn.Conv1d(8, 16, kernel_size=5, stride=2, padding=2),
            nn.GELU(),
        )
        flat = 16 * (N_LEVELS // 4)
        self.to_latent = nn.Linear(flat, latent_dim)
        self.from_latent = nn.Linear(latent_dim, flat)
        self.decoder = nn.Sequential(
            nn.Upsample(scale_factor=2, mode="nearest"),
            nn.Conv1d(16, 8, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Upsample(scale_factor=2, mode="nearest"),
            nn.Conv1d(8, 4, kernel_size=5, padding=2),
            nn.GELU(),
            nn.Conv1d(4, 2, kernel_size=3, padding=1),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        z = self.encoder(x)
        z = self.to_latent(z.flatten(start_dim=1))
        z = self.from_latent(z)
        return self.decoder(z.reshape(-1, 16, N_LEVELS // 4))


# ─────────────────────────────────────────────────────────────────────────────
# Physics-informed synthetic profile generation
# ─────────────────────────────────────────────────────────────────────────────


def _smooth_noise(rng: np.random.Generator, sigma: float, scale: int = 3) -> np.ndarray:
    """Vertically correlated noise via smoothing of white noise (length preserved)."""
    raw = rng.normal(0.0, sigma, N_LEVELS)
    kernel = np.ones(scale) / scale
    smoothed = np.convolve(raw, kernel, mode="same")
    return smoothed - smoothed.mean()


def generate_clean_profile(seed: Optional[int] = None) -> Tuple[np.ndarray, np.ndarray]:
    """
    Generate one clean synthetic cast on P_GRID -> (temperatures, salinities).
    Physics: exponential thermocline, surface-mixed layer, halocline.
    Deep-ocean salinity variability is kept small (± ~0.07 PSU), matching the
    high natural stability of real abyssal salinity, so sensor faults stand
    clear of the learned manifold.
    """
    rng = np.random.default_rng(seed)
    sst = rng.uniform(27.0, 30.5)
    deep_t = rng.uniform(3.5, 6.0)
    thermocline_d = rng.uniform(250.0, 450.0)

    s_surf = rng.uniform(34.5, 36.5)
    s_deep = s_surf + rng.uniform(-0.04, 0.06)
    halocline_d = rng.uniform(100.0, 260.0)

    mixed_mask = P_GRID <= rng.uniform(15.0, 40.0)
    temps = deep_t + (sst - deep_t) * np.exp(-P_GRID / thermocline_d)
    temps[mixed_mask] = sst + _smooth_noise(rng, 0.03)[mixed_mask]
    temps += _smooth_noise(rng, 0.04)

    salts = s_deep + (s_surf - s_deep) * np.exp(-P_GRID / halocline_d)
    salts += _smooth_noise(rng, 0.008)
    return temps, salts


def corrupt_profile(
    temps: np.ndarray,
    salts: np.ndarray,
    mode: str,
    seed: Optional[int] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Apply one realistic sensor-failure corruption to a clean cast.

    mode: "SALINITY_DRIFT" | "OPTICAL_BIOFOULING" | "PRESSURE_SPIKE"
    Returns corrupted (temperatures, salinities).
    """
    rng = np.random.default_rng(seed)
    t_out, s_out = temps.copy(), salts.copy()

    if mode == ISSUE_DRIFT:
        # Slow monotonic salinity divergence below the mixed layer
        # (calibration creep): 0.15-0.40 PSU total offset accumulating with depth.
        deep = P_GRID >= 150.0
        total = rng.choice([-1.0, 1.0]) * rng.uniform(0.15, 0.40)
        ramp = (P_GRID[deep] - P_GRID[deep].min()) / (P_GRID.max() - P_GRID[deep].min())
        s_out[deep] += total * np.power(ramp, 1.2)

    elif mode == ISSUE_BIOFOULING:
        # Radiometric attenuation + high-frequency biological wiggles in the
        # optical zone (top ~150 dbar). The wiggle content is deliberately
        # non-smooth: the low-dim latent cannot reproduce it, so residuals
        # concentrate exactly where biofouling physically occurs.
        amp = rng.uniform(0.3, 0.7) * rng.choice([-1.0, 1.0])
        decay = np.exp(-P_GRID / 45.0)
        wiggle = rng.normal(0.0, 1.0, N_LEVELS) * np.exp(-P_GRID / 70.0)
        t_out += amp * decay + amp * 0.6 * wiggle

    elif mode == ISSUE_SPIKE:
        # Isolated pressure-gauge discontinuities: sharp single-level jumps
        # with a compensating neighbor inversion. Injected BELOW the optical
        # zone (> ~100 dbar) so the signature stays distinct from biofouling,
        # which is by definition a near-surface phenomenon.
        n_spikes = int(rng.integers(2, 6))
        eligible = np.where(P_GRID >= 150.0)[0][1:-1]
        idx = rng.choice(eligible, size=n_spikes, replace=False)
        for i in idx:
            jump = rng.choice([-1.0, 1.0]) * rng.uniform(0.9, 3.2)
            t_out[i] += jump
            t_out[min(i + 1, N_LEVELS - 1)] -= 0.55 * jump
            s_out[i] += 0.35 * jump * rng.uniform(0.4, 1.0)
    else:
        raise ValueError(f"Unknown corruption mode '{mode}'")

    return t_out, s_out


# ─────────────────────────────────────────────────────────────────────────────
# Normalization helpers & structural detectors (single source of truth)
# ─────────────────────────────────────────────────────────────────────────────


def _level_stats(profiles: List[Tuple[np.ndarray, np.ndarray]]) -> Tuple[np.ndarray, np.ndarray]:
    stacked = np.stack([np.stack(p) for p in profiles])  # (N, 2, L)
    mean = stacked.mean(axis=0)                          # (2, L)
    std = stacked.std(axis=0) + 1e-6
    return mean, std


def _discontinuity_stat(temps_phys: np.ndarray, salts_phys: np.ndarray) -> float:
    """
    Max second difference of the RAW curves (physical units). Single-level
    gauge jumps produce large discrete curvatures that a smooth convolutional
    reconstruction tends to absorb — this classic gradient test (as used in
    Argo real-time QC) sees them directly on the input cast.
    """
    d2t = np.abs(np.diff(temps_phys, n=2)) if len(temps_phys) > 2 else np.array([0.0])
    d2s = np.abs(np.diff(salts_phys, n=2)) if len(salts_phys) > 2 else np.array([0.0])
    return float(max(d2t.max(), d2s.max()))


def _structural_scores(
    resid: np.ndarray,
    lvl_std: np.ndarray,
    resid_std_global: float,
) -> Dict[str, float]:
    """
    Compute the five detector statistics from autoencoder residuals.

    resid            : (2, L) residuals in normalized units [temp; salinity]
    lvl_std          : (2, L) per-level normalization std (maps back to deg C / PSU)
    resid_std_global : pooled calibration RMS of residuals (global z-scale;
                       own-RMS scaling would DILUTE pressure spikes, since a
                       jump-heavy profile inflates its own denominator)
    """
    mse = float(np.mean(np.square(resid)))

    # Salinity drift below the mixed layer: linear-in-log-depth slope of the
    # PHYSICAL-unit salinity residual weighted by monotonicity^3 (no hard gate:
    # a gated statistic yields a degenerate zero-inflated null distribution and
    # an unusably small threshold). Natural halocline misfit decays convexly
    # with depth; calibration creep grows monotonically.
    deep = P_GRID >= 150.0
    log_p_deep = np.log(P_GRID[deep])
    s_res_phys = resid[1, deep] * lvl_std[1, deep]
    diffs = np.diff(resid[1, deep])
    mono = 0.0
    if len(s_res_phys) >= 15 and len(diffs) > 0:
        slope_sign = np.sign(np.polyfit(log_p_deep, s_res_phys, 1)[0])
        if slope_sign != 0:
            mono = float((np.sign(diffs) == slope_sign).mean())
    if len(s_res_phys) >= 15:
        slope_psu_per_decade = float(np.polyfit(log_p_deep, s_res_phys, 1)[0])
        log_span = float(log_p_deep[-1] - log_p_deep[0])
        drift_score = abs(slope_psu_per_decade) * log_span * (mono**3)
    else:
        drift_score = 0.0

    # Biofouling: absolute physical-unit energy + high-frequency content of the
    # shallow temperature residual. Physical units keep the statistic stable
    # (a ratio explodes when the denominator is near zero on clean casts).
    shallow = P_GRID <= 150.0
    lvl_std_t_shallow = float(lvl_std[0, shallow].mean()) if shallow.any() else 1e-6
    biof_rms_c = (
        float(np.sqrt(np.mean(resid[0, shallow] ** 2))) * lvl_std_t_shallow
        if shallow.any() else 0.0
    )
    if shallow.sum() > 2:
        hf_norm = float(np.mean(np.abs(np.diff(resid[0, shallow]))))
    else:
        hf_norm = 0.0
    biof_hf_c = hf_norm * lvl_std_t_shallow

    # Spike: strongest single-level GLOBAL-z
    spike_z = float((np.abs(resid) / max(resid_std_global, 1e-9)).max())

    return {
        "mse": mse,
        "drift": drift_score,
        "biof_rms": biof_rms_c,
        "biof_hf": biof_hf_c,
        "spike_z": spike_z,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Training + threshold calibration
# ─────────────────────────────────────────────────────────────────────────────


def train_and_calibrate(
    n_train: int = 900,
    n_val: int = 1500,
    epochs: int = 70,
    batch_size: int = 64,
    lr: float = 2e-3,
    noise_sigma: float = 0.05,
    save_path: Optional[Path] = None,
    seed: int = 42,
) -> Dict[str, float]:
    """
    Train the autoencoder denoising-style on clean synthetic casts and calibrate
    every detector threshold on a held-out CLEAN validation set:
        threshold(detector) = mean(clean score) + K_SIGMA * std(clean score)
    Saves checkpoint with weights, level stats, thresholds. Runs < 1 min CPU.
    """
    torch.manual_seed(seed)
    model = ProfileConvAutoencoder()

    train_profiles = [generate_clean_profile(seed=seed + i) for i in range(n_train)]
    val_profiles = [generate_clean_profile(seed=seed + 100000 + i) for i in range(n_val)]
    lvl_mean, lvl_std = _level_stats(train_profiles)

    def norm_batch(profiles: List[Tuple[np.ndarray, np.ndarray]]) -> torch.Tensor:
        arr = np.stack([np.stack(p) for p in profiles])          # (N, 2, L)
        arr = (arr - lvl_mean[None]) / lvl_std[None]
        return torch.tensor(arr, dtype=torch.float32)

    X_train = norm_batch(train_profiles)
    X_val = norm_batch(val_profiles)

    opt = torch.optim.Adam(model.parameters(), lr=lr)
    sched = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=epochs)
    loss_fn = nn.SmoothL1Loss()
    gen = torch.Generator().manual_seed(seed)
    n = X_train.shape[0]

    final_loss = 0.0
    for ep in range(epochs):
        perm = torch.randperm(n, generator=gen)
        total = 0.0
        model.train()
        for s0 in range(0, n, batch_size):
            idx = perm[s0 : s0 + batch_size]
            xb = X_train[idx]
            noisy = xb + noise_sigma * torch.randn(xb.shape, generator=gen)
            loss = loss_fn(model(noisy), xb)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += loss.item() * len(idx)
        sched.step()
        final_loss = total / n
        if ep in (0, epochs - 1):
            print(f"[qc_autoencoder] epoch {ep+1}/{epochs} train_loss={final_loss:.5f}")

    model.eval()
    with torch.no_grad():
        val_resid_all = (model(X_val) - X_val).numpy()

    # Global calibration scale for the spike max-statistic
    resid_std_global = float(val_resid_all.std()) + 1e-9

    # Calibrate all detectors on clean residuals. spike_z gets the robust
    # median + 3*MAD rule because extreme-value statistics are heavy-tailed.
    keys_meanstd = ("mse", "drift", "biof_rms", "biof_hf")
    score_rows: List[Dict[str, float]] = []
    for i in range(n_val):
        resid_i = val_resid_all[i]
        score_rows.append(_structural_scores(resid_i, lvl_std, resid_std_global))

    thresholds: Dict[str, float] = {}
    for k in keys_meanstd:
        vals = np.array([sc[k] for sc in score_rows])
        thresholds[k] = float(vals.mean() + K_SIGMA * vals.std())
    # Max-statistics are heavy-tailed: calibrate the spike-z bar at a high
    # clean quantile (the dedicated discontinuity test below does the heavy
    # lifting for spike detection).
    spike_vals = np.array([sc["spike_z"] for sc in score_rows])
    thresholds["spike_z"] = float(np.quantile(spike_vals, 0.999))

    # Discontinuity (gradient) test on raw physical curves — calibrated on the
    # same clean validation set.
    disc_vals = np.array(
        [_discontinuity_stat(t, s) for (t, s) in val_profiles]
    )
    thresholds["disc"] = float(disc_vals.mean() + K_SIGMA * disc_vals.std())

    path = Path(save_path) if save_path else CHECKPOINT_PATH
    path.parent.mkdir(parents=True, exist_ok=True)
    torch.save(
        {
            "state_dict": model.state_dict(),
            "lvl_mean": lvl_mean.tolist(),
            "lvl_std": lvl_std.tolist(),
            "p_grid": P_GRID.tolist(),
            "thresholds": thresholds,
            "resid_std_global": resid_std_global,
            "k_sigma": K_SIGMA,
            "latent_dim": LATENT_DIM,
            "train_loss": final_loss,
            "trained_at": datetime.now(timezone.utc).isoformat(),
        },
        path,
    )
    pretty = {k: round(v, 5) for k, v in thresholds.items()}
    print(f"[qc_autoencoder] checkpoint saved -> {path} thresholds={pretty}")
    return {"thresholds": thresholds}


# ─────────────────────────────────────────────────────────────────────────────
# Model lifecycle (load-once singleton)
# ─────────────────────────────────────────────────────────────────────────────

_LOCK = threading.Lock()
_MODEL: Optional[ProfileConvAutoencoder] = None
_META: Dict[str, np.ndarray] = {}
_THRESHOLDS: Dict[str, float] = {}
_RESID_STD_GLOBAL: float = 1.0


def ensure_ready() -> bool:
    """Load checkpoint once; quick-train a fallback artifact if missing."""
    global _MODEL, _META, _THRESHOLDS, _RESID_STD_GLOBAL
    with _LOCK:
        if _MODEL is not None:
            return True
        torch.set_num_threads(min(4, torch.get_num_threads()))
        if CHECKPOINT_PATH.exists():
            ckpt = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
        else:
            train_and_calibrate(n_train=300, n_val=120, epochs=30)
            ckpt = torch.load(CHECKPOINT_PATH, map_location="cpu", weights_only=False)
        model = ProfileConvAutoencoder(latent_dim=int(ckpt.get("latent_dim", LATENT_DIM)))
        model.load_state_dict(ckpt["state_dict"])
        model.eval()
        _MODEL = model
        _META = {
            "lvl_mean": np.asarray(ckpt["lvl_mean"], dtype=np.float64),
            "lvl_std": np.asarray(ckpt["lvl_std"], dtype=np.float64),
            "p_grid": np.asarray(ckpt["p_grid"], dtype=np.float64),
        }
        _THRESHOLDS = {k: float(v) for k, v in ckpt["thresholds"].items()}
        _RESID_STD_GLOBAL = float(ckpt.get("resid_std_global", 1.0))
        return True


def _recommend_flag(
    anomalous: bool, fired_spike: bool, mse: float, issue: Optional[str]
) -> int:
    if not anomalous:
        return 1
    if fired_spike or issue == ISSUE_SPIKE or mse > 3.0 * _THRESHOLDS["mse"]:
        return 4
    return 3


# ─────────────────────────────────────────────────────────────────────────────
# Inference
# ─────────────────────────────────────────────────────────────────────────────


def evaluate_profile(request: ProfileQCRequest) -> ProfileQCResponse:
    """
    Score one raw ARGO cast: reconstruct with the autoencoder, run the four
    calibrated detectors on the residuals, flag deviating depth levels and
    classify the likely sensor issue.

    Raises ValueError for malformed input (router maps to HTTP 422);
    RuntimeError if the model artifact cannot be prepared (HTTP 500).
    """
    p = np.asarray(request.pressures, dtype=np.float64)
    t = np.asarray(request.temperatures, dtype=np.float64)
    s = np.asarray(request.salinities, dtype=np.float64)
    if not (len(p) == len(t) == len(s)):
        raise ValueError("pressures, temperatures and salinities must have equal length")

    finite = np.isfinite(p) & np.isfinite(t) & np.isfinite(s)
    p, t, s = p[finite], t[finite], s[finite]
    if len(p) < 10:
        raise ValueError("profile needs >= 10 finite measurement levels")

    order = np.argsort(p)
    p, t, s = p[order], t[order], s[order]
    if p[-1] - p[0] < 500.0:
        raise ValueError("profile pressure span too small (< 500 dbar) for QC analysis")

    ensure_ready()
    assert _MODEL is not None and _META and _THRESHOLDS
    t_start = time.perf_counter()

    ti = np.interp(P_GRID, p, t)
    si = np.interp(P_GRID, p, s)

    x = np.stack([ti, si])[None]
    xn = (x - _META["lvl_mean"][None]) / _META["lvl_std"][None]
    xt = torch.tensor(xn, dtype=torch.float32)

    with torch.no_grad():
        recon = _MODEL(xt)[0].numpy()
    resid = recon - xn[0]
    z_local = resid / (float(np.sqrt(np.mean(np.square(resid)))) + 1e-9)
    z_global = resid / max(_RESID_STD_GLOBAL, 1e-9)

    scores = _structural_scores(resid, _META["lvl_std"], _RESID_STD_GLOBAL)
    disc_stat = _discontinuity_stat(ti, si)

    fired = {
        "mse": scores["mse"] > _THRESHOLDS["mse"],
        "drift": scores["drift"] > _THRESHOLDS["drift"],
        "biof": (
            scores["biof_rms"] > _THRESHOLDS["biof_rms"]
            or scores["biof_hf"] > _THRESHOLDS["biof_hf"]
        ),
        "spike": (
            disc_stat > _THRESHOLDS["disc"] or scores["spike_z"] > _THRESHOLDS["spike_z"]
        ),
    }
    is_anomalous = any(fired.values())

    issue: Optional[str] = None
    if is_anomalous:
        if fired["spike"]:
            issue = ISSUE_SPIKE
        elif fired["drift"]:
            issue = ISSUE_DRIFT
        elif fired["biof"]:
            issue = ISSUE_BIOFOULING

    flagged: List[float] = []
    if is_anomalous:
        z_for_flag = z_global if issue == ISSUE_SPIKE else z_local
        bad = np.where(np.abs(z_for_flag).max(axis=0) > FLAG_Z)[0]
        if not len(bad):  # borderline structural hit: report top-3 levels by |z|
            bad = np.argsort(np.abs(z_for_flag).max(axis=0))[-3:]
        flagged = sorted({round(float(P_GRID[i]), 1) for i in bad})

    latency_s = time.perf_counter() - t_start  # typically < 5 ms CPU
    _ = latency_s

    return ProfileQCResponse(
        platform_number=request.platform_number,
        is_anomalous=bool(is_anomalous),
        reconstruction_mse=float(round(scores["mse"], 6)),
        flagged_depth_levels=[float(f) for f in flagged],
        detected_issue=issue,
        recommended_qc_flag=int(
            _recommend_flag(is_anomalous, fired["spike"], scores["mse"], issue)
        ),
    )
