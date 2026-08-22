"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Database,
  Download,
  Search,
  Radio,
  SlidersHorizontal,
  X,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  FileSpreadsheet,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";

interface FloatRowItem {
  id: string;
  wmo: number;
  region: string;
  lat: number;
  lon: number;
  temp: number;
  salinity: number;
  doxy: number;
  chla: number;
  status: "NORMAL" | "CRITICAL" | "MONITORED";
  species: string;
}

export function DatasetsView() {
  const { floats, setSelectedFloatId, setActiveNav, flyToCoordinates } = useOperationalState();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFloat, setSelectedFloat] = useState<FloatRowItem | null>(null);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // Map real ARGO floats into Netal dataset schema
  const datasetRows: FloatRowItem[] = (floats && floats.length > 0 ? floats : [
    { wmo_id: 1902303, last_lat: 18.62, last_lon: 72.36, last_seen: "2026-08-21" },
    { wmo_id: 2902764, last_lat: 2.82, last_lon: 76.72, last_seen: "2026-08-21" },
    { wmo_id: 2902936, last_lat: 14.42, last_lon: 63.32, last_seen: "2026-08-21" },
    { wmo_id: 3902657, last_lat: 20.76, last_lon: 63.88, last_seen: "2026-08-20" },
    { wmo_id: 4903899, last_lat: 1.53, last_lon: 82.95, last_seen: "2026-08-20" },
    { wmo_id: 7902312, last_lat: 1.50, last_lon: 85.91, last_seen: "2026-08-20" },
    { wmo_id: 1902845, last_lat: 10.75, last_lon: 68.22, last_seen: "2026-08-19" },
    { wmo_id: 6990514, last_lat: 15.14, last_lon: 62.30, last_seen: "2026-08-19" },
  ] as any[]).map((f: any, idx: number) => {
    const wmo = Number(f.wmo_id ?? f.platform_number ?? 2902764);
    const lat = Number(f.last_lat ?? f.latitude ?? 14.0);
    const lon = Number(f.last_lon ?? f.longitude ?? 72.0);

    let region = "Arabian Sea";
    if (lon > 80) region = "Bay of Bengal";
    else if (lat < 5) region = "Equatorial Indian Ocean";
    else if (lon < 74 && lat < 12) region = "Lakshadweep Basin";

    const isCritical = lat > 14 && lat < 20 && lon > 64 && lon < 74;
    const isMonitored = lon > 82 && lat > 12;

    return {
      id: `ARGO-${wmo}`,
      wmo,
      region,
      lat: Math.round(lat * 100) / 100,
      lon: Math.round(lon * 100) / 100,
      temp: isCritical ? 31.4 : 28.4 - idx * 0.3,
      salinity: 35.2 + (idx % 3) * 0.4,
      doxy: isCritical ? 48.2 : 185.0 - idx * 8,
      chla: 0.42 + (idx % 4) * 0.15,
      status: isCritical ? "CRITICAL" : isMonitored ? "MONITORED" : "NORMAL",
      species: isCritical ? "Sardinella longiceps" : "Thunnus albacares",
    };
  });

  const filteredRows = datasetRows.filter(
    (item) =>
      item.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.region.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.status.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.species.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── CSV Export Function ───────────────────────────────────────────────────
  const handleExportCSV = () => {
    let csv = "Float_ID,Region,Latitude,Longitude,Temperature_C,Salinity_PSU,DOXY_umol_kg,CHLA_mg_m3,Status,Species_Impact\n";
    datasetRows.forEach((r) => {
      csv += `${r.id},"${r.region}",${r.lat},${r.lon},${r.temp},${r.salinity},${r.doxy},${r.chla},${r.status},"${r.species}"\n`;
    });

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VARUNA_ARGO_Floats_Export_${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── Modal Canvas Depth Profile Render ─────────────────────────────────────
  useEffect(() => {
    if (!selectedFloat || !modalCanvasRef.current) return;
    const canvas = modalCanvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = canvas.parentElement?.clientWidth || 700;
    canvas.height = 300;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    // Background Depth Grid
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;

    for (let y = 30; y < h - 30; y += 45) {
      ctx.beginPath();
      ctx.moveTo(50, y);
      ctx.lineTo(w - 20, y);
      ctx.stroke();

      const depthVal = Math.round(((y - 30) / (h - 60)) * 2000);
      ctx.fillStyle = "#84948F";
      ctx.font = '10px "JetBrains Mono", monospace';
      ctx.fillText(`${depthVal}m`, 10, y + 4);
    }

    // Temperature Profile Line (Cyan)
    ctx.beginPath();
    ctx.strokeStyle = "#2EE6C6";
    ctx.lineWidth = 2.5;

    for (let depth = 0; depth <= 2000; depth += 40) {
      const y = 30 + (depth / 2000) * (h - 60);
      const tempAtDepth = 4 + (selectedFloat.temp - 4) * Math.exp(-depth / 400);
      const x = 50 + (tempAtDepth / 35) * (w - 70);
      if (depth === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // DOXY Profile Line (Orange Dashed)
    ctx.beginPath();
    ctx.strokeStyle = "#FFA500";
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);

    for (let depth = 0; depth <= 2000; depth += 40) {
      const y = 30 + (depth / 2000) * (h - 60);
      const doxyAtDepth = Math.max(10, selectedFloat.doxy * (0.3 + 0.7 * Math.sin(depth / 300)));
      const x = 50 + (doxyAtDepth / 250) * (w - 70);
      if (depth === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Legend
    ctx.fillStyle = "#2EE6C6";
    ctx.fillRect(w - 240, 10, 10, 10);
    ctx.fillStyle = "#D5E4F7";
    ctx.font = '11px "Plus Jakarta Sans", sans-serif';
    ctx.fillText("Temperature Profile (°C)", w - 224, 19);

    ctx.fillStyle = "#FFA500";
    ctx.fillRect(w - 240, 26, 10, 2);
    ctx.fillText("DOXY Profile (µmol/kg)", w - 224, 30);
  }, [selectedFloat]);

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto custom-scrollbar select-none font-sans bg-[#051422] text-[#D5E4F7]">
      {/* ── Header & Action Bar ───────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="font-mono text-xs font-bold text-[#00FFC6] uppercase tracking-widest flex items-center gap-1.5">
            <Database size={14} className="text-[#00FFC6]" />
            National In-Situ Ocean Repository
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight mt-1">
            Datasets &amp; NetCDF Exports
          </h1>
          <p className="text-xs sm:text-sm text-[#A0C4D8] mt-1 max-w-2xl">
            Query, inspect, and export multi-parameter physical and biogeochemical observation matrices from the active Indian Ocean observation mesh.
          </p>
        </div>

        {/* Export Button */}
        <button
          onClick={handleExportCSV}
          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2EE6C6] to-[#00FFC6] text-black font-mono text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(46,230,198,0.4)] hover:scale-105 transition-all cursor-pointer"
        >
          <Download size={15} />
          <span>Export Dataset CSV</span>
        </button>
      </div>

      {/* ── Search & Filter Controls ──────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Float ID, Basin, Species, or Status..."
            className="w-full h-10 pl-9 pr-3 rounded-xl bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-[#2EE6C6] transition-all"
          />
        </div>

        <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
          <span className="px-2.5 py-1 rounded bg-[#0E2435] border border-white/5 text-[#2EE6C6] font-bold">
            {filteredRows.length} Floats Listed
          </span>
        </div>
      </div>

      {/* ── Netal Tactical Table ──────────────────────────────────────────── */}
      <div className="p-5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-2xl overflow-x-auto">
        <table className="w-full text-left font-mono text-xs">
          <thead>
            <tr className="border-b border-white/10 text-[#8AB0C0] text-[10px] uppercase tracking-wider">
              <th className="py-3 px-3.5">FLOAT ID</th>
              <th className="py-3 px-3.5">REGION</th>
              <th className="py-3 px-3.5">COORDINATES</th>
              <th className="py-3 px-3.5">SURFACE TEMP</th>
              <th className="py-3 px-3.5">SALINITY</th>
              <th className="py-3 px-3.5">DOXY OXYGEN</th>
              <th className="py-3 px-3.5">STATUS</th>
              <th className="py-3 px-3.5 text-right">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((item) => {
              const statusClass =
                item.status === "CRITICAL"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : item.status === "MONITORED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";

              return (
                <tr
                  key={item.id}
                  className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                >
                  <td className="py-3 px-3.5 font-bold text-white flex items-center gap-1.5">
                    <Radio size={12} className="text-[#2EE6C6]" />
                    <span>{item.id}</span>
                  </td>
                  <td className="py-3 px-3.5 text-[#D5E4F7]">{item.region}</td>
                  <td className="py-3 px-3.5 text-[#83FFE3]">
                    {item.lat}°N, {item.lon}°E
                  </td>
                  <td className="py-3 px-3.5 text-white font-semibold">
                    {item.temp.toFixed(1)}°C
                  </td>
                  <td className="py-3 px-3.5 text-[#A0C4D8]">
                    {item.salinity.toFixed(1)} PSU
                  </td>
                  <td className="py-3 px-3.5 text-[#FFA500] font-semibold">
                    {item.doxy.toFixed(1)} µmol/kg
                  </td>
                  <td className="py-3 px-3.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusClass}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="py-3 px-3.5 text-right">
                    <button
                      onClick={() => setSelectedFloat(item)}
                      className="px-3 py-1 bg-[#12212E] border border-[#2EE6C6]/40 hover:bg-[#2EE6C6]/20 text-[#83FFE3] text-xs font-mono rounded-lg transition-all"
                    >
                      Inspect Profile
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Float Telemetry Detail Modal (Netal Style) ────────────────────── */}
      {selectedFloat && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="max-w-2xl w-full bg-[#0B1D2C] border border-[#2EE6C6]/50 rounded-2xl p-6 shadow-2xl space-y-4 font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Radio size={16} className="text-[#00FFC6]" />
                <h3 className="text-xl font-bold text-white">
                  {selectedFloat.id} · {selectedFloat.region}
                </h3>
              </div>
              <button
                onClick={() => setSelectedFloat(null)}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Float Stats Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Coordinates</span>
                <span className="text-white font-bold">{selectedFloat.lat}°N, {selectedFloat.lon}°E</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Surface Temp</span>
                <span className="text-[#2EE6C6] font-bold">{selectedFloat.temp}°C</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">Salinity</span>
                <span className="text-white font-bold">{selectedFloat.salinity} PSU</span>
              </div>
              <div className="p-2.5 rounded-lg bg-black/40 border border-white/5">
                <span className="text-[10px] text-zinc-400 block">DOXY Oxygen</span>
                <span className="text-[#FFA500] font-bold">{selectedFloat.doxy} µmol/kg</span>
              </div>
            </div>

            {/* Depth Profile Chart Canvas */}
            <div className="p-3 bg-[#071A2D]/70 rounded-xl border border-white/5">
              <h4 className="text-xs font-bold text-white mb-2">VERTICAL HYDROSTATIC PROFILE (0m - 2000m)</h4>
              <canvas ref={modalCanvasRef} className="w-full h-56 rounded" />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
              <span className="text-[#8AB0C0]">
                Associated Species: <b className="text-[#83FFE3] italic">{selectedFloat.species}</b>
              </span>
              <button
                onClick={() => {
                  setSelectedFloatId(String(selectedFloat.wmo));
                  flyToCoordinates?.(selectedFloat.lat, selectedFloat.lon, 4.8);
                  setSelectedFloat(null);
                  setActiveNav("OCEAN");
                }}
                className="px-4 py-1.5 rounded-lg bg-[#2EE6C6] hover:bg-[#00FFC6] text-black font-bold flex items-center gap-1 transition-all"
              >
                <span>Track on Map</span>
                <ChevronRight size={13} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
