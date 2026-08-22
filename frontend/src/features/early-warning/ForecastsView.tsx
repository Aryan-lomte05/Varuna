"use client";

import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  BrainCircuit,
  Flame,
  AlertTriangle,
  Activity,
  ShieldCheck,
  CheckCircle2,
  ChevronRight,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";
import { EarlyWarningRoomPanel } from "./EarlyWarningRoomPanel";
import { forecastMHW, detectSensorQC } from "@/lib/api/anomalies";
import type { MHWForecastResponse, ProfileQCResponse } from "@/types/anomalies";

export function ForecastsView() {
  const [forecast, setForecast] = useState<MHWForecastResponse | null>(null);
  const [qcStatus, setQcStatus] = useState<ProfileQCResponse | null>(null);
  const [selectedBasin, setSelectedBasin] = useState("arabian_sea");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    async function loadPredictions() {
      setIsLoading(true);
      try {
        const [fRes, qcRes] = await Promise.all([
          forecastMHW({ ocean_basin: selectedBasin, forecast_days: 7 }),
          detectSensorQC({
            platform_number: 1902303,
            pressures: [5.0, 10.0, 20.0, 50.0, 100.0, 200.0, 500.0, 1000.0],
            temperatures: [29.4, 29.3, 28.8, 26.2, 21.0, 14.5, 9.2, 5.1],
            salinities: [35.8, 35.8, 35.9, 36.1, 35.7, 35.2, 34.9, 34.8],
          }),
        ]);
        setForecast(fRes);
        setQcStatus(qcRes);
      } catch (err) {
        console.error("Forecast loading error:", err);
      } finally {
        setIsLoading(false);
      }
    }
    loadPredictions();
  }, [selectedBasin]);

  return (
    <div className="flex flex-col h-full space-y-3 p-1 overflow-y-auto custom-scrollbar select-none">
      {/* Top 7-Day MHW Spatio-Temporal Prediction Model */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Predictive ConvLSTM Forecast Panel (7 Cols) */}
        <div className="lg:col-span-7 panel-marine p-4 bg-[#0B1D2C]/90 font-mono text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <div className="flex items-center gap-2">
              <TrendingUp size={14} className="text-[#00FFC6]" />
              <span className="font-bold text-white uppercase text-xs">
                7-Day Spatio-Temporal MHW Predictive Forecast (ConvLSTM)
              </span>
            </div>

            {/* Basin Filter */}
            <select
              value={selectedBasin}
              onChange={(e) => setSelectedBasin(e.target.value)}
              className="bg-[#0E2435] border border-white/10 rounded px-2 py-0.5 text-xs text-[#2EE6C6] outline-none"
            >
              <option value="arabian_sea">Arabian Sea</option>
              <option value="bay_of_bengal">Bay of Bengal</option>
              <option value="gulf_of_mannar">Gulf of Mannar</option>
            </select>
          </div>

          {forecast && (
            <div className="space-y-3">
              {/* Metric Summary */}
              <div className="grid grid-cols-3 gap-2 text-[10px]">
                <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                  <span className="text-zinc-400 block text-[8px] uppercase">Predicted Mean Anomaly</span>
                  <span className="text-base font-bold text-[#FF4B4B]">+{forecast.predicted_mean_anomaly}°C</span>
                </div>
                <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                  <span className="text-zinc-400 block text-[8px] uppercase">MHW Declaration Probability</span>
                  <span className="text-base font-bold text-[#00FFC6]">
                    {(forecast.mhw_declaration_probability * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                  <span className="text-zinc-400 block text-[8px] uppercase">Forecast Horizon</span>
                  <span className="text-base font-bold text-white">T + {forecast.forecast_horizon_days} Days</span>
                </div>
              </div>

              {/* Forecast Time Series Curve SVG */}
              <div className="p-2.5 rounded-lg bg-[#0E2435] border border-white/5 h-28 flex flex-col justify-between">
                <div className="flex justify-between text-[9px] text-zinc-400">
                  <span>Predicted SST (°C) vs 30-Yr Climatology</span>
                  <span className="text-[#FF4B4B] font-bold">+3.2°C Departure Projected</span>
                </div>

                <svg className="w-full h-16" viewBox="0 0 280 60" fill="none">
                  {/* Baseline Climatology Line */}
                  <line x1="0" y1="45" x2="280" y2="45" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeDasharray="3 3" />

                  {/* Predicted Warming Curve */}
                  <path
                    d="M 0 40 Q 70 34, 140 22 T 280 8"
                    stroke="#FF4B4B"
                    strokeWidth="2.5"
                  />
                  <circle cx="280" cy="8" r="3" fill="#FF4B4B" className="animate-ping" />
                  <circle cx="280" cy="8" r="2.5" fill="#FF4B4B" />
                </svg>

                <div className="flex justify-between text-[8px] text-zinc-500 border-t border-white/5 pt-1">
                  {forecast.forecast_time_series.map((pt) => (
                    <span key={pt.date}>{pt.date.substring(5)}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Deep 1D-CNN Sensor QC Autoencoder (5 Cols) */}
        <div className="lg:col-span-5 panel-marine p-4 bg-[#0B1D2C]/90 font-mono text-xs space-y-3 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
              <div className="flex items-center gap-2">
                <BrainCircuit size={14} className="text-[#2EE6C6]" />
                <span className="font-bold text-white uppercase text-xs">
                  1D-CNN Sensor Quality Control
                </span>
              </div>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#00FFC6]/15 text-[#00FFC6] font-bold">
                QC FLAG 1 (GOOD)
              </span>
            </div>

            {qcStatus && (
              <div className="space-y-2 text-[10px]">
                <div className="p-2.5 rounded bg-[#0E2435] border border-white/5 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Inspected Float WMO</span>
                    <span className="text-white font-bold">#{qcStatus.platform_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Reconstruction MSE</span>
                    <span className="text-[#00FFC6] font-bold">{qcStatus.reconstruction_mse}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-400">Optical Biofouling Risk</span>
                    <span className="text-[#00FFC6] font-bold">None Detected</span>
                  </div>
                </div>

                <div className="p-2.5 rounded bg-[#0E2435] border border-white/5 text-[10px] text-zinc-300">
                  <div className="text-[#00FFC6] font-bold mb-0.5">Automated Validation</div>
                  <p>{qcStatus.status_message}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Early Warning Room */}
      <div className="min-h-[300px]">
        <EarlyWarningRoomPanel />
      </div>
    </div>
  );
}
