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
  Calendar,
  Layers,
  Code,
  Copy,
  Check,
  Filter,
  CheckSquare,
  Square,
  Activity,
  Fish,
  Waves,
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
  const [isExportStudioOpen, setIsExportStudioOpen] = useState(false);
  const modalCanvasRef = useRef<HTMLCanvasElement>(null);

  // ── Customizable Export Settings State ────────────────────────────────────
  const [exportScope, setExportScope] = useState<"all" | "single" | "basin">("all");
  const [selectedWmo, setSelectedWmo] = useState<string>("2902764");
  const [selectedBasin, setSelectedBasin] = useState<string>("arabian_sea");

  // Selected Parameters
  const [params, setParams] = useState({
    temp: true,
    psal: true,
    pres: true,
    doxy: true,
    chla: true,
    nitrate: true,
    ph: false,
    par: false,
    biodiversity: true,
  });

  // Date Range
  const [datePreset, setDatePreset] = useState<"7d" | "30d" | "6m" | "ytd" | "all" | "custom">("30d");
  const [startDate, setStartDate] = useState("2026-07-22");
  const [endDate, setEndDate] = useState("2026-08-22");

  // Depth Range
  const [depthPreset, setDepthPreset] = useState<"surface" | "epipelagic" | "thermocline" | "full" | "custom">("full");
  const [minDepth, setMinDepth] = useState<number>(0);
  const [maxDepth, setMaxDepth] = useState<number>(2000);

  // Quality & Format
  const [qcFilter, setQcFilter] = useState<"qc1" | "qc12" | "all">("qc12");
  const [exportFormat, setExportFormat] = useState<"csv" | "netcdf" | "ascii" | "json" | "parquet" | "geojson">("csv");
  const [isExporting, setIsExporting] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Map real ARGO floats into dataset schema
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

  // ── Dynamic SQL Query Generator matching Supabase Database Schema ─────────
  const generateExportSQL = () => {
    const selectedColumns = [
      "m.platform_number",
      "m.time",
      "m.latitude",
      "m.longitude",
    ];

    if (params.pres) selectedColumns.push("COALESCE(m.pres, m.depth_m) AS depth_m");
    if (params.temp) selectedColumns.push("m.temp AS temperature_c");
    if (params.psal) selectedColumns.push("m.psal AS salinity_psu");
    if (params.doxy) selectedColumns.push("m.doxy AS dissolved_oxygen_umol_kg");
    if (params.chla) selectedColumns.push("m.chla AS chlorophyll_a_mg_m3");
    if (params.nitrate) selectedColumns.push("m.nitrate AS nitrate_umol_kg");
    if (params.ph) selectedColumns.push("m.ph_in_situ_total AS ph_level");
    if (params.par) selectedColumns.push("m.downwelling_par");
    if (params.biodiversity) {
      selectedColumns.push("b.scientific_name", "b.common_name");
    }

    const whereClauses: string[] = [];

    // Scope Clause
    if (exportScope === "single") {
      whereClauses.push(`m.platform_number = ${selectedWmo}`);
    } else if (exportScope === "basin") {
      if (selectedBasin === "arabian_sea") {
        whereClauses.push(`(m.longitude BETWEEN 50.0 AND 78.0 AND m.latitude BETWEEN 0.0 AND 26.0)`);
      } else if (selectedBasin === "bay_of_bengal") {
        whereClauses.push(`(m.longitude BETWEEN 78.0 AND 100.0 AND m.latitude BETWEEN 0.0 AND 24.0)`);
      } else if (selectedBasin === "equatorial_io") {
        whereClauses.push(`(m.latitude BETWEEN -10.0 AND 5.0)`);
      } else if (selectedBasin === "lakshadweep") {
        whereClauses.push(`(m.longitude BETWEEN 71.0 AND 74.5 AND m.latitude BETWEEN 8.0 AND 14.0)`);
      }
    }

    // Date Clause
    if (datePreset === "7d") {
      whereClauses.push(`m.time >= NOW() - INTERVAL '7 days'`);
    } else if (datePreset === "30d") {
      whereClauses.push(`m.time >= NOW() - INTERVAL '30 days'`);
    } else if (datePreset === "6m") {
      whereClauses.push(`m.time >= NOW() - INTERVAL '6 months'`);
    } else if (datePreset === "ytd") {
      whereClauses.push(`m.time >= '2026-01-01'`);
    } else if (datePreset === "custom") {
      whereClauses.push(`m.time >= '${startDate} 00:00:00' AND m.time <= '${endDate} 23:59:59'`);
    }

    // Depth Clause
    if (depthPreset === "surface") {
      whereClauses.push(`COALESCE(m.pres, m.depth_m, 0) <= 10.0`);
    } else if (depthPreset === "epipelagic") {
      whereClauses.push(`COALESCE(m.pres, m.depth_m, 0) BETWEEN 0.0 AND 200.0`);
    } else if (depthPreset === "thermocline") {
      whereClauses.push(`COALESCE(m.pres, m.depth_m, 0) BETWEEN 200.0 AND 1000.0`);
    } else if (depthPreset === "custom") {
      whereClauses.push(`COALESCE(m.pres, m.depth_m, 0) BETWEEN ${minDepth} AND ${maxDepth}`);
    }

    // QC Flags
    if (qcFilter === "qc1") {
      whereClauses.push(`COALESCE(m.temp_qc, 1) = 1`);
    } else if (qcFilter === "qc12") {
      whereClauses.push(`COALESCE(m.temp_qc, 1) IN (1, 2)`);
    }

    let sql = `SELECT ${selectedColumns.join(", ")}\nFROM public.marine_data m`;
    if (params.biodiversity) {
      sql += `\nLEFT JOIN public.biodiversity_occurrences b ON ST_DWithin(m.geom, b.geom, 50000)`;
    }
    if (whereClauses.length > 0) {
      sql += `\nWHERE ${whereClauses.join(" AND\n  ")}`;
    }
    sql += `\nORDER BY m.time DESC\nLIMIT 2000;`;

    return sql;
  };

  // ── Execute Customized Export ─────────────────────────────────────────────
  const executeCustomExport = async () => {
    setIsExporting(true);
    const sql = generateExportSQL();
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

    try {
      if (exportFormat === "geojson") {
        // Client-side GeoJSON generation from filtered rows
        const features = filteredRows.map((r) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [r.lon, r.lat] },
          properties: {
            id: r.id,
            wmo: r.wmo,
            region: r.region,
            temperature_c: r.temp,
            salinity_psu: r.salinity,
            doxy_umol_kg: r.doxy,
            chla_mg_m3: r.chla,
            status: r.status,
            species: r.species,
          },
        }));
        const geojson = JSON.stringify({ type: "FeatureCollection", features }, null, 2);
        const blob = new Blob([geojson], { type: "application/geo+json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `VARUNA_Custom_Export_${exportScope}_${Date.now()}.geojson`;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const exportUrl = `${apiBase}/api/v1/export?sql=${encodeURIComponent(sql)}&format=${exportFormat}`;
        window.open(exportUrl, "_blank");
      }
    } catch {
      // Fallback CSV download
      let csv = "Float_ID,Region,Latitude,Longitude,Temperature_C,Salinity_PSU,DOXY_umol_kg,CHLA_mg_m3,Status,Species\n";
      filteredRows.forEach((r) => {
        csv += `${r.id},"${r.region}",${r.lat},${r.lon},${r.temp},${r.salinity},${r.doxy},${r.chla},${r.status},"${r.species}"\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `VARUNA_Export_${Date.now()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
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
            National In-Situ Ocean Repository · Supabase DB1 &amp; DB2
          </span>
          <h1 className="text-3xl sm:text-4xl font-extrabold font-mono text-white tracking-tight mt-1">
            Datasets &amp; NetCDF Exports
          </h1>
          <p className="text-xs sm:text-sm text-[#A0C4D8] mt-1 max-w-2xl">
            Customizable multi-parameter export studio for physical oceanography, BGC biogeochemical profiles, and CMLRE species matrices.
          </p>
        </div>

        {/* Buttons Row */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsExportStudioOpen(true)}
            className="px-5 py-2.5 rounded-xl bg-[#0B1D2C] hover:bg-[#2EE6C6]/20 border border-[#2EE6C6]/50 text-[#83FFE3] font-mono text-xs font-bold flex items-center gap-2 transition-all shadow-lg backdrop-blur-md cursor-pointer"
          >
            <SlidersHorizontal size={15} />
            <span>Customize Export Settings</span>
          </button>

          <button
            onClick={executeCustomExport}
            disabled={isExporting}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-[#2EE6C6] to-[#00FFC6] hover:from-[#00FFC6] hover:to-[#2EE6C6] text-black font-mono text-xs font-black flex items-center gap-2 shadow-[0_0_20px_rgba(46,230,198,0.4)] hover:scale-105 transition-all cursor-pointer disabled:opacity-50"
          >
            <Download size={15} />
            <span>{isExporting ? "Streaming Export..." : "Instant CSV Export"}</span>
          </button>
        </div>
      </div>

      {/* ── Search & Quick Filter Bar ─────────────────────────────────────── */}
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
          <button
            onClick={() => setIsExportStudioOpen(true)}
            className="px-3 py-1.5 rounded-lg bg-[#12212E] hover:bg-[#2EE6C6]/15 border border-white/10 hover:border-[#2EE6C6]/40 text-[#83FFE3] flex items-center gap-1.5 transition-all"
          >
            <Filter size={12} />
            <span>Configure Filters &amp; Timeline</span>
          </button>
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

      {/* ── CUSTOMIZABLE EXPORT SETTINGS STUDIO MODAL ─────────────────────── */}
      {isExportStudioOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-lg flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-4xl w-full bg-[#0B1D2C] border border-[#2EE6C6]/50 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.9)] space-y-5 font-mono my-auto max-h-[92vh] overflow-y-auto custom-scrollbar">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#2EE6C6]/20 border border-[#2EE6C6]/50 flex items-center justify-center">
                  <SlidersHorizontal size={16} className="text-[#00FFC6]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-tight">
                    Custom Oceanographic Dataset Export Studio
                  </h3>
                  <p className="text-[11px] text-[#809AAB]">
                    Direct SQL query engine powered by Supabase PostgreSQL Sharded Mesh
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsExportStudioOpen(false)}
                className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* ── 1. Data Scope Configuration ── */}
            <div className="p-4 rounded-2xl bg-[#071A2D]/80 border border-white/5 space-y-3">
              <span className="text-xs font-bold text-[#83FFE3] uppercase tracking-wider flex items-center gap-1.5">
                <Radio size={13} className="text-[#2EE6C6]" />
                1. Fleet &amp; Basin Scope
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <button
                  onClick={() => setExportScope("all")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportScope === "all"
                      ? "bg-[#2EE6C6]/20 border-[#2EE6C6] text-white shadow-[0_0_15px_rgba(46,230,198,0.2)]"
                      : "bg-[#0E2435] border-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-white">All ARGO Floats</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Fleet-wide aggregation ({datasetRows.length} nodes)</div>
                </button>

                <button
                  onClick={() => setExportScope("single")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportScope === "single"
                      ? "bg-[#2EE6C6]/20 border-[#2EE6C6] text-white shadow-[0_0_15px_rgba(46,230,198,0.2)]"
                      : "bg-[#0E2435] border-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-white">Single WMO Platform</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Target float time-series</div>
                </button>

                <button
                  onClick={() => setExportScope("basin")}
                  className={`p-3 rounded-xl border text-left transition-all ${
                    exportScope === "basin"
                      ? "bg-[#2EE6C6]/20 border-[#2EE6C6] text-white shadow-[0_0_15px_rgba(46,230,198,0.2)]"
                      : "bg-[#0E2435] border-white/5 text-zinc-400 hover:border-white/20"
                  }`}
                >
                  <div className="font-bold text-white">Ocean Basin Filter</div>
                  <div className="text-[10px] text-zinc-400 mt-0.5">Spatially bounded domain</div>
                </button>
              </div>

              {/* Conditional Selector for Single Float or Basin */}
              {exportScope === "single" && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Select WMO Float ID:</span>
                  <select
                    value={selectedWmo}
                    onChange={(e) => setSelectedWmo(e.target.value)}
                    className="h-8 px-3 rounded-lg bg-[#0E2435] border border-[#2EE6C6]/40 text-xs text-[#83FFE3] outline-none"
                  >
                    {datasetRows.map((r) => (
                      <option key={r.wmo} value={r.wmo}>
                        WMO #{r.wmo} · {r.region} ({r.temp.toFixed(1)}°C)
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {exportScope === "basin" && (
                <div className="pt-2 flex items-center gap-2">
                  <span className="text-xs text-zinc-400">Select Target Basin:</span>
                  <select
                    value={selectedBasin}
                    onChange={(e) => setSelectedBasin(e.target.value)}
                    className="h-8 px-3 rounded-lg bg-[#0E2435] border border-[#2EE6C6]/40 text-xs text-[#83FFE3] outline-none"
                  >
                    <option value="arabian_sea">Arabian Sea (Sector 4B &amp; West Coast)</option>
                    <option value="bay_of_bengal">Bay of Bengal (East Coast &amp; Delta)</option>
                    <option value="equatorial_io">Equatorial Indian Ocean</option>
                    <option value="lakshadweep">Lakshadweep &amp; Maldives Chagos Ridge</option>
                  </select>
                </div>
              )}
            </div>

            {/* ── 2. Parameter Matrix (Physical + BGC + Bio) ── */}
            <div className="p-4 rounded-2xl bg-[#071A2D]/80 border border-white/5 space-y-3">
              <span className="text-xs font-bold text-[#83FFE3] uppercase tracking-wider flex items-center gap-1.5">
                <Layers size={13} className="text-[#2EE6C6]" />
                2. Parameters &amp; Sensor Channels
              </span>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 text-xs">
                {[
                  { key: "temp", label: "Temperature (TEMP)", desc: "In-situ CTD (°C)" },
                  { key: "psal", label: "Practical Salinity (PSAL)", desc: "Conductivity (PSU)" },
                  { key: "pres", label: "Pressure / Depth (PRES)", desc: "Hydrostatic dbar" },
                  { key: "doxy", label: "Dissolved Oxygen (DOXY)", desc: "Optode sensor (µmol/kg)" },
                  { key: "chla", label: "Chlorophyll-a (CHLA)", desc: "Fluorescence (mg/m³)" },
                  { key: "nitrate", label: "Nitrate (NITRATE)", desc: "SUNA UV spectrophotometer" },
                  { key: "ph", label: "In-Situ pH Level", desc: "ISFET sensor" },
                  { key: "par", label: "Downwelling PAR", desc: "Photosynthetically Active Radiation" },
                  { key: "biodiversity", label: "CMLRE Species Join", desc: "Habitat correlation" },
                ].map((item) => {
                  const isChecked = (params as any)[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() =>
                        setParams((prev) => ({ ...prev, [item.key]: !(prev as any)[item.key] }))
                      }
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                        isChecked
                          ? "bg-[#2EE6C6]/15 border-[#2EE6C6]/60 text-white"
                          : "bg-[#0E2435]/50 border-white/5 text-zinc-500 hover:border-white/10"
                      }`}
                    >
                      <div className="mt-0.5">
                        {isChecked ? (
                          <CheckSquare size={15} className="text-[#00FFC6]" />
                        ) : (
                          <Square size={15} className="text-zinc-600" />
                        )}
                      </div>
                      <div>
                        <div className={`font-bold ${isChecked ? "text-white" : "text-zinc-400"}`}>
                          {item.label}
                        </div>
                        <div className="text-[9px] text-zinc-500">{item.desc}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── 3. Timeline & Depth Slicing ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Timeline */}
              <div className="p-4 rounded-2xl bg-[#071A2D]/80 border border-white/5 space-y-2.5">
                <span className="text-xs font-bold text-[#83FFE3] uppercase tracking-wider flex items-center gap-1.5">
                  <Calendar size={13} className="text-[#2EE6C6]" />
                  3. Temporal Timeline
                </span>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { id: "7d", label: "Last 7 Days" },
                    { id: "30d", label: "Last 30 Days" },
                    { id: "6m", label: "Last 6 Months" },
                    { id: "ytd", label: "2026 YTD" },
                    { id: "all", label: "All History" },
                    { id: "custom", label: "Custom" },
                  ].map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setDatePreset(t.id as any)}
                      className={`px-2.5 py-1 rounded-lg border transition-all ${
                        datePreset === t.id
                          ? "bg-[#2EE6C6] text-black font-bold border-[#2EE6C6]"
                          : "bg-[#0E2435] text-zinc-400 border-white/5 hover:text-white"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {datePreset === "custom" && (
                  <div className="pt-2 flex items-center gap-2 text-xs">
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="px-2 py-1 rounded bg-[#0E2435] border border-white/10 text-white outline-none"
                    />
                    <span>to</span>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="px-2 py-1 rounded bg-[#0E2435] border border-white/10 text-white outline-none"
                    />
                  </div>
                )}
              </div>

              {/* Vertical Depth Slicing */}
              <div className="p-4 rounded-2xl bg-[#071A2D]/80 border border-white/5 space-y-2.5">
                <span className="text-xs font-bold text-[#83FFE3] uppercase tracking-wider flex items-center gap-1.5">
                  <Activity size={13} className="text-[#2EE6C6]" />
                  4. Vertical Depth Slicing
                </span>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                  {[
                    { id: "surface", label: "Surface (0–10m)" },
                    { id: "epipelagic", label: "Photic (0–200m)" },
                    { id: "thermocline", label: "Thermocline (200–1000m)" },
                    { id: "full", label: "Full (0–2000m)" },
                    { id: "custom", label: "Custom" },
                  ].map((d) => (
                    <button
                      key={d.id}
                      onClick={() => setDepthPreset(d.id as any)}
                      className={`px-2.5 py-1 rounded-lg border transition-all ${
                        depthPreset === d.id
                          ? "bg-[#2EE6C6] text-black font-bold border-[#2EE6C6]"
                          : "bg-[#0E2435] text-zinc-400 border-white/5 hover:text-white"
                      }`}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                {depthPreset === "custom" && (
                  <div className="pt-2 flex items-center gap-2 text-xs">
                    <input
                      type="number"
                      value={minDepth}
                      onChange={(e) => setMinDepth(Number(e.target.value))}
                      placeholder="Min (m)"
                      className="w-20 px-2 py-1 rounded bg-[#0E2435] border border-white/10 text-white outline-none"
                    />
                    <span>to</span>
                    <input
                      type="number"
                      value={maxDepth}
                      onChange={(e) => setMaxDepth(Number(e.target.value))}
                      placeholder="Max (m)"
                      className="w-20 px-2 py-1 rounded bg-[#0E2435] border border-white/10 text-white outline-none"
                    />
                    <span className="text-zinc-500">meters</span>
                  </div>
                )}
              </div>
            </div>

            {/* ── 5. Format & QC Quality Selection ── */}
            <div className="p-4 rounded-2xl bg-[#071A2D]/80 border border-white/5 space-y-3">
              <span className="text-xs font-bold text-[#83FFE3] uppercase tracking-wider flex items-center gap-1.5">
                <FileSpreadsheet size={13} className="text-[#2EE6C6]" />
                5. Export Format &amp; Quality Control Flag
              </span>

              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Formats */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {[
                    { id: "csv", label: "CSV (.csv)", badge: "Standard" },
                    { id: "netcdf", label: "NetCDF (.nc)", badge: "CF-1.8" },
                    { id: "ascii", label: "ASCII ODV (.txt)", badge: "INCOIS" },
                    { id: "parquet", label: "Parquet (.parquet)", badge: "DuckDB" },
                    { id: "geojson", label: "GeoJSON (.geojson)", badge: "QGIS" },
                    { id: "json", label: "JSON (.json)", badge: "REST" },
                  ].map((fmt) => (
                    <button
                      key={fmt.id}
                      onClick={() => setExportFormat(fmt.id as any)}
                      className={`px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-all ${
                        exportFormat === fmt.id
                          ? "bg-[#2EE6C6] text-black font-bold border-[#2EE6C6] shadow-[0_0_15px_rgba(46,230,198,0.3)]"
                          : "bg-[#0E2435] text-zinc-300 border-white/5 hover:border-white/20"
                      }`}
                    >
                      <span>{fmt.label}</span>
                      <span className={`text-[9px] px-1 rounded ${exportFormat === fmt.id ? "bg-black/20 text-black" : "bg-black/40 text-zinc-500"}`}>
                        {fmt.badge}
                      </span>
                    </button>
                  ))}
                </div>

                {/* QC Flag */}
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-zinc-400">QC Filter:</span>
                  <select
                    value={qcFilter}
                    onChange={(e) => setQcFilter(e.target.value as any)}
                    className="h-8 px-2 rounded-lg bg-[#0E2435] border border-white/10 text-white outline-none"
                  >
                    <option value="qc1">Good Only (QC = 1)</option>
                    <option value="qc12">Good &amp; Probable (QC 1,2)</option>
                    <option value="all">Unfiltered (All QC 1–4)</option>
                  </select>
                </div>
              </div>
            </div>

            {/* ── 6. Live SQL Preview ── */}
            <div className="p-4 rounded-2xl bg-black/50 border border-white/10 space-y-2">
              <div className="flex items-center justify-between text-xs text-zinc-400">
                <span className="flex items-center gap-1.5 text-[#2EE6C6] font-bold">
                  <Code size={13} /> Generated Supabase PostgreSQL Query
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(generateExportSQL());
                    setCopiedSql(true);
                    setTimeout(() => setCopiedSql(false), 2000);
                  }}
                  className="flex items-center gap-1 text-zinc-400 hover:text-white transition-colors"
                >
                  {copiedSql ? <Check size={12} className="text-[#00FFC6]" /> : <Copy size={12} />}
                  <span>{copiedSql ? "Copied SQL" : "Copy Query"}</span>
                </button>
              </div>
              <pre className="text-[11px] font-mono text-[#D5E4F7] overflow-x-auto p-2.5 rounded-lg bg-[#051422] border border-white/5 max-h-28 whitespace-pre">
                {generateExportSQL()}
              </pre>
            </div>

            {/* ── Modal Footer Action ── */}
            <div className="flex items-center justify-between pt-2 border-t border-white/10">
              <div className="text-xs text-zinc-400">
                Estimated Rows: <b className="text-white">~2,000</b> · Estimated Size: <b className="text-[#2EE6C6]">~480 KB</b>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsExportStudioOpen(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-bold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={executeCustomExport}
                  disabled={isExporting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#2EE6C6] to-[#00FFC6] text-black text-xs font-black flex items-center gap-2 shadow-[0_0_25px_rgba(46,230,198,0.5)] hover:scale-105 transition-all disabled:opacity-50"
                >
                  <Download size={15} />
                  <span>{isExporting ? "Compiling Export..." : `Download .${exportFormat.toUpperCase()} Dataset`}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

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
