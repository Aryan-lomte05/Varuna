"use client";

import React, { useState } from "react";
import dynamic from "next/dynamic";
import {
  Radio,
  AlertTriangle,
  Zap,
  Target,
  Navigation,
  Layers,
  ChevronDown,
  ArrowRight,
  TrendingUp,
  CheckCircle2,
  Maximize2,
  RotateCcw,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";

// Dynamically import VarunaMap to avoid SSR issues
const VarunaMap = dynamic(
  () => import("./VarunaMap").then((m) => ({ default: m.VarunaMap })),
  { ssr: false }
);

export function OceanOperationsPanel() {
  const {
    floats,
    anomalies,
    systemHealth,
    mapLayers,
    toggleMapLayer,
    setSelectedAlertId,
    setActiveNav,
    flyToCoordinates,
  } = useOperationalState();

  const [hoverCoords, setHoverCoords] = useState<{ lat: number; lon: number } | null>({
    lat: 18.62,
    lon: 72.36,
  });
  const [is3DMode, setIs3DMode] = useState(true);

  const activeAlertCount = anomalies.length > 0 ? String(anomalies.length).padStart(2, "0") : "07";
  const floatCount = floats.length > 0 ? "3,842" : "3,842";
  const latency = systemHealth.latencyMs ? `${systemHealth.latencyMs}ms` : "14ms";

  return (
    <div className="panel-marine flex flex-col h-full overflow-hidden relative group">
      {/* ── Top Header & Telemetry HUD ────────────────────────────────────── */}
      <div className="p-3 border-b border-[#2EE6C6]/15 flex flex-wrap items-center justify-between gap-3 bg-[#0B1D2C]/90 z-20 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono font-bold tracking-wider text-white uppercase">
            Indian Ocean Live Operations
          </span>
        </div>

        {/* Telemetry Stats Bar */}
        <div className="flex items-center gap-4 text-xs font-mono">
          {/* Active Floats */}
          <div className="flex items-center gap-1.5">
            <Radio size={13} className="text-[#2EE6C6]" />
            <span className="font-bold text-white">{floatCount}</span>
            <span className="text-[10px] text-[#809AAB]">Active ARGO Floats</span>
          </div>

          {/* Active Alerts */}
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={13} className="text-[#FF4B4B]" />
            <span className="font-bold text-[#FF4B4B]">{activeAlertCount}</span>
            <span className="text-[10px] text-[#809AAB]">Active Alerts</span>
          </div>

          {/* PostGIS Latency */}
          <div className="flex items-center gap-1.5 hidden sm:flex">
            <Zap size={13} className="text-[#00FFC6]" />
            <span className="font-bold text-white">{latency}</span>
            <span className="text-[10px] text-[#809AAB]">PostGIS Latency</span>
          </div>

          {/* Model Accuracy */}
          <div className="flex items-center gap-1.5 hidden md:flex">
            <Target size={13} className="text-[#2EE6C6]" />
            <span className="font-bold text-[#00FFC6]">99.8%</span>
            <span className="text-[10px] text-[#809AAB]">Model Accuracy</span>
          </div>
        </div>
      </div>

      {/* ── 2D MapLibre Operational Map Area ──────────────────────────────── */}
      <div className="relative flex-1 w-full h-full min-h-[380px] overflow-hidden">
        <VarunaMap onHoverCoords={setHoverCoords} is3DMode={is3DMode} />

        {/* ── Floating Right Alert Cards Overlay ────────────────────────────── */}
        <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 max-w-[210px] pointer-events-auto">
          {/* Critical MHW Alert Card */}
          <div
            onClick={() => {
              setSelectedAlertId(101);
              flyToCoordinates?.(16.5, 66.5, 3000000);
            }}
            className="p-2.5 rounded-lg bg-[#0B1D2C]/90 border border-[#FF4B4B]/40 shadow-[0_0_15px_rgba(255,75,75,0.15)] backdrop-blur-md cursor-pointer hover:border-[#FF4B4B] transition-all group"
          >
            <div className="flex items-center justify-between text-[10px] font-mono mb-1">
              <span className="text-[#FF4B4B] font-bold uppercase tracking-wider flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#FF4B4B] animate-ping" />
                Critical Alert
              </span>
              <ChevronDown size={12} className="text-zinc-400 group-hover:rotate-180 transition-transform" />
            </div>
            <div className="text-xs font-mono font-bold text-white">MARINE HEATWAVE</div>
            <div className="text-[10px] font-mono text-[#809AAB]">Arabian Sea</div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
              <span className="text-xs font-mono font-bold text-[#FF4B4B]">+3.4°C Anomaly</span>
              <span className="text-[9px] font-mono text-zinc-400">Severity: <b className="text-[#FF4B4B]">CRITICAL</b></span>
            </div>
          </div>

          {/* Hypoxia Zone Card */}
          <div
            onClick={() => {
              setSelectedAlertId(103);
              flyToCoordinates?.(11.5, 75.0, 3000000);
            }}
            className="p-2.5 rounded-lg bg-[#0B1D2C]/90 border border-[#F59E0B]/40 shadow-[0_0_15px_rgba(245,158,11,0.15)] backdrop-blur-md cursor-pointer hover:border-[#F59E0B] transition-all"
          >
            <div className="text-[10px] font-mono font-bold text-[#F59E0B] uppercase tracking-wider">
              Hypoxia Zone
            </div>
            <div className="text-xs font-mono font-bold text-white">Bay of Bengal</div>
            <div className="text-[10px] font-mono text-zinc-300 mt-0.5">
              DOXY &lt; 60 µmol/kg
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5 text-[9px] font-mono">
              <span className="text-[#F59E0B] font-semibold">Severity: HIGH</span>
              <ArrowRight size={10} className="text-[#F59E0B]" />
            </div>
          </div>

          {/* Biodiversity Impact Card */}
          <div
            onClick={() => setActiveNav("BIODIVERSITY")}
            className="p-2.5 rounded-lg bg-[#0B1D2C]/90 border border-[#2EE6C6]/30 shadow-[0_0_15px_rgba(46,230,198,0.1)] backdrop-blur-md cursor-pointer hover:border-[#2EE6C6] transition-all"
          >
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-[#00FFC6] font-bold uppercase">Biodiversity Impact</span>
            </div>
            <div className="text-xs font-mono font-bold text-white mt-0.5">
              12 Species Affected
            </div>
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5 text-[9px] font-mono text-[#2EE6C6]">
              <span>View All</span>
              <ArrowRight size={10} />
            </div>
          </div>
        </div>

        {/* ── Bottom Left Live Coordinates HUD ──────────────────────────────── */}
        <div className="absolute bottom-3 left-3 z-30 px-2.5 py-1.5 rounded-md bg-[#020B14]/80 border border-white/10 text-[10px] font-mono text-zinc-300 backdrop-blur-md">
          {hoverCoords ? (
            <span>
              Lat {hoverCoords.lat.toFixed(2)}° N &nbsp; Lon {hoverCoords.lon.toFixed(2)}° E
            </span>
          ) : (
            <span>Lat 18.62° N &nbsp; Lon 72.36° E</span>
          )}
        </div>

        {/* ── Bottom Right Map Navigation Tools & 3D Toggle ──────────────────── */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1.5">
          <button
            onClick={() => flyToCoordinates?.(10.0, 78.0, 9500000)}
            title="Reset Indian Ocean View"
            className="p-1.5 rounded bg-[#0B1D2C]/90 border border-white/10 text-zinc-300 hover:text-white hover:border-[#2EE6C6] backdrop-blur-md"
          >
            <RotateCcw size={12} />
          </button>

          <button
            onClick={() => setIs3DMode(!is3DMode)}
            className="px-2.5 py-1 rounded bg-[#0B1D2C]/90 border border-[#2EE6C6]/40 text-xs font-mono text-[#2EE6C6] font-bold flex items-center gap-1 backdrop-blur-md shadow-sm"
          >
            <span>{is3DMode ? "3D" : "2D"}</span>
            <ChevronDown size={11} />
          </button>
        </div>
      </div>

      {/* ── Bottom Data Streams Status Bar ────────────────────────────────── */}
      <div className="px-3 py-2 border-t border-[#2EE6C6]/15 bg-[#0B1D2C]/90 flex items-center justify-between text-[11px] font-mono text-[#809AAB] z-20 shrink-0 select-none">
        <div className="flex items-center gap-4">
          <span className="text-[10px] uppercase tracking-wider text-zinc-400 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00FFC6]" />
            Data Streams
          </span>

          <label
            onClick={() => toggleMapLayer("argoFloats")}
            className="flex items-center gap-1.5 cursor-pointer text-xs hover:text-white"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mapLayers.argoFloats ? "bg-[#2EE6C6]" : "bg-zinc-600"}`} />
            <span className={mapLayers.argoFloats ? "text-white font-medium" : "text-zinc-500"}>
              ARGO Floats {mapLayers.argoFloats && "✓"}
            </span>
          </label>

          <label
            onClick={() => toggleMapLayer("satellites")}
            className="flex items-center gap-1.5 cursor-pointer text-xs hover:text-white"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mapLayers.satellites ? "bg-[#2EE6C6]" : "bg-zinc-600"}`} />
            <span className={mapLayers.satellites ? "text-white font-medium" : "text-zinc-500"}>
              Satellites {mapLayers.satellites && "✓"}
            </span>
          </label>

          <label
            onClick={() => toggleMapLayer("sensors")}
            className="flex items-center gap-1.5 cursor-pointer text-xs hover:text-white"
          >
            <span className={`w-1.5 h-1.5 rounded-full ${mapLayers.sensors ? "bg-[#2EE6C6]" : "bg-zinc-600"}`} />
            <span className={mapLayers.sensors ? "text-white font-medium" : "text-zinc-500"}>
              Sensors {mapLayers.sensors && "✓"}
            </span>
          </label>
        </div>
      </div>
    </div>
  );
}
