"use client";

import React, { useState, useMemo, useEffect, useRef } from "react";
import {
  Radio,
  Search,
  ChevronRight,
  ChevronLeft,
  Compass,
  Layers,
  Thermometer,
  Droplets,
  Activity,
  Filter,
  Download,
  Bot,
  MapPin,
  Clock,
  Sparkles,
  Database,
  Eye,
  TrendingUp,
  ShieldCheck,
  Zap,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";

interface DatabaseFloatRecord {
  wmo: number;
  id: string;
  region: string;
  lat: number;
  lon: number;
  firstDate: string;
  latestDate: string;
  spanDays: number;
  cycles: number;
  totalObs: number;
  minPres: number;
  maxPres: number;
  surfaceTemp: number;
  surfacePsal: number;
  surfaceDoxy: number;
  surfaceChla: number;
  surfaceNitrate: number;
  surfacePh: number;
  status: "NORMAL" | "CRITICAL" | "MONITORED";
  species: string;
  hasTemp: boolean;
  hasPsal: boolean;
  hasDoxy: boolean;
  hasChla: boolean;
  hasPh: boolean;
  hasNitrate: boolean;
  // Synthetic observation cast profile
  profile: {
    pres: number;
    temp: number;
    psal: number;
    doxy: number;
    chla: number;
    nitrate: number;
    ph: number;
    sigmaTheta: number; // Potential density anomaly
  }[];
}

const DATABASE_FLOATS: DatabaseFloatRecord[] = [
  {
    wmo: 1902367,
    id: "ARGO-1902367",
    region: "Equatorial Indian Ocean / Bay of Bengal",
    lat: 5.41,
    lon: 88.64,
    firstDate: "2025-08-10 08:45:37",
    latestDate: "2026-08-20 05:33:12",
    spanDays: 374.8,
    cycles: 56,
    totalObs: 60133,
    minPres: 0.36,
    maxPres: 2014.2,
    surfaceTemp: 28.6,
    surfacePsal: 34.8,
    surfaceDoxy: 182.4,
    surfaceChla: 0.44,
    surfaceNitrate: 31.5,
    surfacePh: 7.66,
    status: "NORMAL",
    species: "Thunnus albacares",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: true,
    hasNitrate: true,
    profile: [
      { pres: 5, temp: 28.6, psal: 34.8, doxy: 182.4, chla: 0.44, nitrate: 1.2, ph: 8.08, sigmaTheta: 22.4 },
      { pres: 25, temp: 28.4, psal: 34.9, doxy: 180.1, chla: 0.68, nitrate: 2.4, ph: 8.05, sigmaTheta: 22.6 },
      { pres: 50, temp: 27.2, psal: 35.1, doxy: 165.2, chla: 0.85, nitrate: 5.1, ph: 7.98, sigmaTheta: 23.2 },
      { pres: 75, temp: 23.8, psal: 35.4, doxy: 110.0, chla: 0.42, nitrate: 11.2, ph: 7.89, sigmaTheta: 24.3 },
      { pres: 100, temp: 20.1, psal: 35.6, doxy: 72.4, chla: 0.15, nitrate: 17.8, ph: 7.81, sigmaTheta: 25.4 },
      { pres: 150, temp: 15.6, psal: 35.2, doxy: 41.5, chla: 0.03, nitrate: 24.5, ph: 7.74, sigmaTheta: 26.2 },
      { pres: 200, temp: 13.7, psal: 35.0, doxy: 27.0, chla: 0.01, nitrate: 28.9, ph: 7.66, sigmaTheta: 26.6 },
      { pres: 300, temp: 11.8, psal: 35.0, doxy: 38.2, chla: 0.0, nitrate: 32.1, ph: 7.64, sigmaTheta: 26.9 },
      { pres: 500, temp: 9.4, psal: 35.0, doxy: 52.6, chla: 0.0, nitrate: 34.8, ph: 7.63, sigmaTheta: 27.2 },
      { pres: 1000, temp: 6.2, psal: 34.9, doxy: 95.0, chla: 0.0, nitrate: 36.5, ph: 7.68, sigmaTheta: 27.6 },
      { pres: 1500, temp: 4.5, psal: 34.8, doxy: 132.4, chla: 0.0, nitrate: 37.8, ph: 7.72, sigmaTheta: 27.8 },
      { pres: 2000, temp: 3.2, psal: 34.7, doxy: 155.0, chla: 0.0, nitrate: 38.4, ph: 7.76, sigmaTheta: 27.9 },
    ],
  },
  {
    wmo: 1902373,
    id: "ARGO-1902373",
    region: "Bay of Bengal (Sector 2A)",
    lat: 13.84,
    lon: 91.56,
    firstDate: "2025-08-06 20:56:19",
    latestDate: "2026-08-17 18:24:56",
    spanDays: 375.9,
    cycles: 79,
    totalObs: 48497,
    minPres: 0.36,
    maxPres: 1733.4,
    surfaceTemp: 29.4,
    surfacePsal: 33.2,
    surfaceDoxy: 176.2,
    surfaceChla: 0.62,
    surfaceNitrate: 28.4,
    surfacePh: 7.82,
    status: "MONITORED",
    species: "Sardinella longiceps",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: true,
    hasNitrate: true,
    profile: [
      { pres: 5, temp: 29.4, psal: 33.2, doxy: 176.2, chla: 0.62, nitrate: 0.8, ph: 8.12, sigmaTheta: 21.0 },
      { pres: 25, temp: 29.1, psal: 33.5, doxy: 174.0, chla: 0.88, nitrate: 1.5, ph: 8.09, sigmaTheta: 21.3 },
      { pres: 50, temp: 28.0, psal: 34.2, doxy: 145.1, chla: 1.12, nitrate: 4.8, ph: 8.01, sigmaTheta: 22.2 },
      { pres: 75, temp: 24.5, psal: 34.8, doxy: 92.4, chla: 0.55, nitrate: 10.5, ph: 7.91, sigmaTheta: 23.6 },
      { pres: 100, temp: 21.0, psal: 35.1, doxy: 58.2, chla: 0.21, nitrate: 16.2, ph: 7.84, sigmaTheta: 24.8 },
      { pres: 150, temp: 16.4, psal: 35.0, doxy: 32.1, chla: 0.04, nitrate: 23.1, ph: 7.76, sigmaTheta: 25.9 },
      { pres: 200, temp: 14.1, psal: 34.9, doxy: 22.5, chla: 0.01, nitrate: 27.8, ph: 7.70, sigmaTheta: 26.4 },
      { pres: 500, temp: 9.8, psal: 34.9, doxy: 48.0, chla: 0.0, nitrate: 33.5, ph: 7.65, sigmaTheta: 27.1 },
      { pres: 1000, temp: 6.8, psal: 34.9, doxy: 88.0, chla: 0.0, nitrate: 35.8, ph: 7.69, sigmaTheta: 27.5 },
      { pres: 1700, temp: 4.1, psal: 34.8, doxy: 140.0, chla: 0.0, nitrate: 37.5, ph: 7.74, sigmaTheta: 27.8 },
    ],
  },
  {
    wmo: 1902457,
    id: "ARGO-1902457",
    region: "Arabian Sea (Sector 4B - High MHW)",
    lat: 5.15,
    lon: 71.24,
    firstDate: "2025-08-03 21:28:28",
    latestDate: "2026-08-12 09:13:29",
    spanDays: 373.5,
    cycles: 117,
    totalObs: 21061,
    minPres: 2.0,
    maxPres: 2010.7,
    surfaceTemp: 31.2,
    surfacePsal: 36.1,
    surfaceDoxy: 46.8,
    surfaceChla: 0.78,
    surfaceNitrate: 34.2,
    surfacePh: 7.62,
    status: "CRITICAL",
    species: "Sardinella longiceps",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: true,
    hasNitrate: true,
    profile: [
      { pres: 5, temp: 31.2, psal: 36.1, doxy: 46.8, chla: 0.78, nitrate: 3.5, ph: 7.95, sigmaTheta: 23.3 },
      { pres: 25, temp: 30.8, psal: 36.2, doxy: 42.1, chla: 0.95, nitrate: 6.2, ph: 7.90, sigmaTheta: 23.5 },
      { pres: 50, temp: 29.5, psal: 36.4, doxy: 31.4, chla: 0.65, nitrate: 12.0, ph: 7.82, sigmaTheta: 24.1 },
      { pres: 75, temp: 25.1, psal: 36.5, doxy: 18.2, chla: 0.30, nitrate: 19.5, ph: 7.74, sigmaTheta: 25.2 },
      { pres: 100, temp: 21.4, psal: 36.2, doxy: 12.5, chla: 0.08, nitrate: 26.4, ph: 7.67, sigmaTheta: 26.0 },
      { pres: 150, temp: 17.2, psal: 35.8, doxy: 8.4, chla: 0.02, nitrate: 31.0, ph: 7.62, sigmaTheta: 26.6 },
      { pres: 200, temp: 14.8, psal: 35.5, doxy: 14.2, chla: 0.0, nitrate: 33.5, ph: 7.60, sigmaTheta: 26.9 },
      { pres: 500, temp: 10.2, psal: 35.2, doxy: 35.6, chla: 0.0, nitrate: 36.0, ph: 7.62, sigmaTheta: 27.2 },
      { pres: 1000, temp: 7.1, psal: 35.0, doxy: 74.0, chla: 0.0, nitrate: 38.0, ph: 7.68, sigmaTheta: 27.6 },
      { pres: 2000, temp: 3.6, psal: 34.8, doxy: 148.0, chla: 0.0, nitrate: 39.5, ph: 7.75, sigmaTheta: 27.9 },
    ],
  },
  {
    wmo: 1902458,
    id: "ARGO-1902458",
    region: "Central Arabian Sea",
    lat: 10.27,
    lon: 62.41,
    firstDate: "2025-08-04 21:36:54",
    latestDate: "2026-08-12 22:55:29",
    spanDays: 373.1,
    cycles: 116,
    totalObs: 21000,
    minPres: 2.1,
    maxPres: 2006.9,
    surfaceTemp: 30.8,
    surfacePsal: 36.4,
    surfaceDoxy: 52.1,
    surfaceChla: 0.65,
    surfaceNitrate: 30.0,
    surfacePh: 7.68,
    status: "CRITICAL",
    species: "Sardinella longiceps",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: true,
    hasNitrate: true,
    profile: [
      { pres: 5, temp: 30.8, psal: 36.4, doxy: 52.1, chla: 0.65, nitrate: 2.8, ph: 7.98, sigmaTheta: 23.6 },
      { pres: 25, temp: 30.4, psal: 36.5, doxy: 48.0, chla: 0.82, nitrate: 5.4, ph: 7.92, sigmaTheta: 23.8 },
      { pres: 50, temp: 28.8, psal: 36.6, doxy: 35.2, chla: 0.52, nitrate: 11.2, ph: 7.85, sigmaTheta: 24.5 },
      { pres: 100, temp: 22.0, psal: 36.3, doxy: 15.0, chla: 0.10, nitrate: 24.1, ph: 7.70, sigmaTheta: 25.9 },
      { pres: 200, temp: 15.2, psal: 35.6, doxy: 11.5, chla: 0.0, nitrate: 32.0, ph: 7.62, sigmaTheta: 26.8 },
      { pres: 500, temp: 10.5, psal: 35.3, doxy: 32.0, chla: 0.0, nitrate: 35.2, ph: 7.63, sigmaTheta: 27.2 },
      { pres: 1000, temp: 7.3, psal: 35.0, doxy: 78.0, chla: 0.0, nitrate: 37.5, ph: 7.67, sigmaTheta: 27.6 },
      { pres: 2000, temp: 3.7, psal: 34.8, doxy: 150.0, chla: 0.0, nitrate: 39.0, ph: 7.75, sigmaTheta: 27.9 },
    ],
  },
  {
    wmo: 2902758,
    id: "ARGO-2902758",
    region: "Bay of Bengal Northern Basin",
    lat: 17.25,
    lon: 90.18,
    firstDate: "2022-01-04 09:17:00",
    latestDate: "2025-07-28 14:20:00",
    spanDays: 1301.2,
    cycles: 64,
    totalObs: 38400,
    minPres: 7.5,
    maxPres: 2000.0,
    surfaceTemp: 29.68,
    surfacePsal: 32.18,
    surfaceDoxy: 184.89,
    surfaceChla: 0.52,
    surfaceNitrate: 26.8,
    surfacePh: 7.85,
    status: "NORMAL",
    species: "Thunnus albacares",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: false,
    hasNitrate: true,
    profile: [
      { pres: 7.5, temp: 29.68, psal: 32.18, doxy: 184.89, chla: 0.52, nitrate: 1.0, ph: 8.14, sigmaTheta: 20.2 },
      { pres: 25, temp: 28.45, psal: 32.58, doxy: 186.75, chla: 0.74, nitrate: 1.8, ph: 8.10, sigmaTheta: 20.9 },
      { pres: 50, temp: 28.09, psal: 32.72, doxy: 175.81, chla: 0.95, nitrate: 4.2, ph: 8.04, sigmaTheta: 21.2 },
      { pres: 75, temp: 27.41, psal: 33.91, doxy: 86.56, chla: 0.48, nitrate: 9.8, ph: 7.94, sigmaTheta: 22.3 },
      { pres: 100, temp: 25.57, psal: 34.41, doxy: 44.96, chla: 0.18, nitrate: 15.5, ph: 7.86, sigmaTheta: 23.2 },
      { pres: 150, temp: 19.51, psal: 34.78, doxy: 3.46, chla: 0.02, nitrate: 25.4, ph: 7.72, sigmaTheta: 25.0 },
      { pres: 200, temp: 15.82, psal: 34.90, doxy: 3.13, chla: 0.0, nitrate: 29.8, ph: 7.66, sigmaTheta: 25.9 },
      { pres: 500, temp: 9.60, psal: 34.95, doxy: 45.0, chla: 0.0, nitrate: 34.5, ph: 7.64, sigmaTheta: 27.1 },
      { pres: 1000, temp: 6.50, psal: 34.90, doxy: 90.0, chla: 0.0, nitrate: 36.8, ph: 7.68, sigmaTheta: 27.5 },
      { pres: 2000, temp: 3.50, psal: 34.75, doxy: 152.0, chla: 0.0, nitrate: 38.5, ph: 7.75, sigmaTheta: 27.9 },
    ],
  },
  {
    wmo: 1902455,
    id: "ARGO-1902455",
    region: "Lakshadweep / Maldives Ridge",
    lat: 2.09,
    lon: 73.01,
    firstDate: "2025-08-02 19:05:13",
    latestDate: "2026-08-20 09:17:02",
    spanDays: 382.6,
    cycles: 118,
    totalObs: 21597,
    minPres: 0.7,
    maxPres: 2008.1,
    surfaceTemp: 29.1,
    surfacePsal: 35.4,
    surfaceDoxy: 190.5,
    surfaceChla: 0.38,
    surfaceNitrate: 22.1,
    surfacePh: 7.91,
    status: "NORMAL",
    species: "Epinephelus tauvina",
    hasTemp: true,
    hasPsal: true,
    hasDoxy: true,
    hasChla: true,
    hasPh: true,
    hasNitrate: true,
    profile: [
      { pres: 5, temp: 29.1, psal: 35.4, doxy: 190.5, chla: 0.38, nitrate: 1.1, ph: 8.10, sigmaTheta: 22.8 },
      { pres: 25, temp: 28.9, psal: 35.4, doxy: 188.2, chla: 0.55, nitrate: 1.9, ph: 8.07, sigmaTheta: 22.9 },
      { pres: 50, temp: 28.1, psal: 35.5, doxy: 175.4, chla: 0.72, nitrate: 4.2, ph: 8.00, sigmaTheta: 23.3 },
      { pres: 100, temp: 22.4, psal: 35.8, doxy: 98.0, chla: 0.18, nitrate: 14.5, ph: 7.88, sigmaTheta: 25.1 },
      { pres: 200, temp: 14.6, psal: 35.2, doxy: 45.0, chla: 0.01, nitrate: 26.8, ph: 7.71, sigmaTheta: 26.6 },
      { pres: 500, temp: 10.0, psal: 35.0, doxy: 62.0, chla: 0.0, nitrate: 33.2, ph: 7.65, sigmaTheta: 27.2 },
      { pres: 1000, temp: 6.9, psal: 34.9, doxy: 102.0, chla: 0.0, nitrate: 36.0, ph: 7.69, sigmaTheta: 27.5 },
      { pres: 2000, temp: 3.4, psal: 34.7, doxy: 160.0, chla: 0.0, nitrate: 38.2, ph: 7.76, sigmaTheta: 27.9 },
    ],
  },
];

export function FloatsView() {
  const { selectedFloatId, setSelectedFloatId, setActiveNav, flyToCoordinates } = useOperationalState();
  const [currentWmo, setCurrentWmo] = useState<number>(1902367);
  const [selectedDepthZoom, setSelectedDepthZoom] = useState<"full" | "photic" | "thermocline">("full");

  // Keep state synced with global operational state if selectedFloatId exists
  useEffect(() => {
    if (selectedFloatId) {
      const match = DATABASE_FLOATS.find((f) => String(f.wmo) === selectedFloatId);
      if (match) setCurrentWmo(match.wmo);
    }
  }, [selectedFloatId]);

  const activeFloat = useMemo(() => {
    return DATABASE_FLOATS.find((f) => f.wmo === currentWmo) || DATABASE_FLOATS[0];
  }, [currentWmo]);

  const filteredProfile = useMemo(() => {
    if (selectedDepthZoom === "photic") {
      return activeFloat.profile.filter((p) => p.pres <= 200);
    } else if (selectedDepthZoom === "thermocline") {
      return activeFloat.profile.filter((p) => p.pres >= 50 && p.pres <= 1000);
    }
    return activeFloat.profile;
  }, [activeFloat, selectedDepthZoom]);

  // Navigate to previous/next float
  const handlePrevFloat = () => {
    const idx = DATABASE_FLOATS.findIndex((f) => f.wmo === currentWmo);
    const nextIdx = (idx - 1 + DATABASE_FLOATS.length) % DATABASE_FLOATS.length;
    setCurrentWmo(DATABASE_FLOATS[nextIdx].wmo);
    setSelectedFloatId(String(DATABASE_FLOATS[nextIdx].wmo));
  };

  const handleNextFloat = () => {
    const idx = DATABASE_FLOATS.findIndex((f) => f.wmo === currentWmo);
    const nextIdx = (idx + 1) % DATABASE_FLOATS.length;
    setCurrentWmo(DATABASE_FLOATS[nextIdx].wmo);
    setSelectedFloatId(String(DATABASE_FLOATS[nextIdx].wmo));
  };

  // Helper function to build SVG depth curves
  const renderSvgCurve = (
    accessor: (d: typeof activeFloat.profile[0]) => number,
    minVal: number,
    maxVal: number,
    color: string,
    width = 240,
    height = 150
  ) => {
    const maxPres = selectedDepthZoom === "photic" ? 200 : selectedDepthZoom === "thermocline" ? 1000 : 2000;
    const minPres = selectedDepthZoom === "thermocline" ? 50 : 0;

    const points = filteredProfile.map((p) => {
      const val = accessor(p);
      const clampedVal = Math.max(minVal, Math.min(maxVal, val));
      const x = 30 + ((clampedVal - minVal) / (maxVal - minVal)) * (width - 45);
      const y = 15 + ((p.pres - minPres) / (maxPres - minPres)) * (height - 30);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    return (
      <svg className="w-full h-full" viewBox={`0 0 ${width} ${height}`}>
        {/* Background Grid */}
        <line x1="30" y1="15" x2={width - 15} y2="15" stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1={height / 2} x2={width - 15} y2={height / 2} stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1={height - 15} x2={width - 15} y2={height - 15} stroke="rgba(255,255,255,0.08)" strokeDasharray="2,2" />
        <line x1="30" y1="15" x2="30" y2={height - 15} stroke="rgba(255,255,255,0.2)" />

        {/* Depth Labels */}
        <text x="5" y="20" fill="#809AAB" fontSize="8" fontFamily="monospace">{minPres}m</text>
        <text x="5" y={height / 2 + 3} fill="#809AAB" fontSize="8" fontFamily="monospace">{Math.round((minPres + maxPres) / 2)}m</text>
        <text x="5" y={height - 12} fill="#809AAB" fontSize="8" fontFamily="monospace">{maxPres}m</text>

        {/* Curve */}
        <path d={`M ${points.join(" L ")}`} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Data points */}
        {filteredProfile.map((p, i) => {
          const val = accessor(p);
          const clampedVal = Math.max(minVal, Math.min(maxVal, val));
          const x = 30 + ((clampedVal - minVal) / (maxVal - minVal)) * (width - 45);
          const y = 15 + ((p.pres - minPres) / (maxPres - minPres)) * (height - 30);
          return (
            <circle key={i} cx={x} cy={y} r="3" fill={color} stroke="#051422" strokeWidth="1" />
          );
        })}
      </svg>
    );
  };

  // Export this single float's data
  const handleExportSingleFloatCSV = () => {
    let csv = "platform_number,pres,temp,psal,doxy,chla,nitrate,ph_in_situ_total,sigma_theta,latitude,longitude,region\n";
    activeFloat.profile.forEach((r) => {
      csv += `${activeFloat.wmo},${r.pres},${r.temp},${r.psal},${r.doxy},${r.chla},${r.nitrate},${r.ph},${r.sigmaTheta},${activeFloat.lat},${activeFloat.lon},"${activeFloat.region}"\n`;
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `VARUNA_Float_${activeFloat.wmo}_Profile_${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto custom-scrollbar select-none font-sans bg-[#051422] text-[#D5E4F7]">
      {/* ── Top Float Selector Toolbar ────────────────────────────────────── */}
      <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#2EE6C6]/20 to-[#00BFA5]/10 border border-[#2EE6C6]/50 flex items-center justify-center shadow-[0_0_15px_rgba(46,230,198,0.3)]">
            <Radio size={20} className="text-[#00FFC6] animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-[#00FFC6] font-bold uppercase tracking-wider">
                Single-Float Analytics &amp; Deep Profile Studio
              </span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold ${
                activeFloat.status === "CRITICAL"
                  ? "bg-red-500/20 text-red-400 border border-red-500/40"
                  : activeFloat.status === "MONITORED"
                  ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
              }`}>
                {activeFloat.status}
              </span>
            </div>

            {/* Float Dropdown Selector */}
            <div className="flex items-center gap-2 mt-1">
              <button
                onClick={handlePrevFloat}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all"
                title="Previous Float"
              >
                <ChevronLeft size={16} />
              </button>

              <select
                value={currentWmo}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCurrentWmo(val);
                  setSelectedFloatId(String(val));
                }}
                className="h-9 px-3 pr-8 rounded-xl bg-[#071A2D] border border-[#2EE6C6]/50 text-sm font-mono font-bold text-[#83FFE3] outline-none shadow-lg cursor-pointer"
              >
                {DATABASE_FLOATS.map((f) => (
                  <option key={f.wmo} value={f.wmo} className="bg-[#0B1D2C] text-white">
                    WMO #{f.wmo} · {f.region} ({f.totalObs.toLocaleString()} observations)
                  </option>
                ))}
              </select>

              <button
                onClick={handleNextFloat}
                className="p-1 rounded-lg bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition-all"
                title="Next Float"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2.5 font-mono text-xs">
          {/* Depth zoom toggle */}
          <div className="flex rounded-xl bg-[#071A2D] border border-white/10 p-0.5">
            {[
              { id: "full", label: "0–2000m Full" },
              { id: "photic", label: "0–200m Photic" },
              { id: "thermocline", label: "Thermocline" },
            ].map((z) => (
              <button
                key={z.id}
                onClick={() => setSelectedDepthZoom(z.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                  selectedDepthZoom === z.id
                    ? "bg-[#2EE6C6] text-black font-bold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                {z.label}
              </button>
            ))}
          </div>

          <button
            onClick={() => {
              flyToCoordinates?.(activeFloat.lat, activeFloat.lon, 4.8);
              setSelectedFloatId(String(activeFloat.wmo));
              setActiveNav("OCEAN");
            }}
            className="px-3.5 py-2 rounded-xl bg-[#12212E] hover:bg-[#2EE6C6]/20 border border-[#2EE6C6]/40 text-[#83FFE3] font-bold flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
          >
            <MapPin size={14} />
            <span>Track on Map</span>
          </button>

          <button
            onClick={handleExportSingleFloatCSV}
            className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#2EE6C6] to-[#00FFC6] text-black font-black flex items-center gap-1.5 shadow-[0_0_15px_rgba(46,230,198,0.3)] hover:scale-105 transition-all cursor-pointer"
          >
            <Download size={14} />
            <span>Export Float CSV</span>
          </button>
        </div>
      </div>

      {/* ── Float Metadata Dossier Banner (from float_metadata table) ──────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 font-mono text-xs">
        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Coordinates</span>
          <span className="text-base font-bold text-[#83FFE3] mt-0.5 block">
            {activeFloat.lat.toFixed(2)}°N, {activeFloat.lon.toFixed(2)}°E
          </span>
          <span className="text-[9px] text-zinc-500">{activeFloat.region}</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Observation Lifetime</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.spanDays.toFixed(1)} Days
          </span>
          <span className="text-[9px] text-zinc-500">{activeFloat.cycles} cycles recorded</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Total Database Rows</span>
          <span className="text-base font-bold text-[#00FFC6] mt-0.5 block">
            {activeFloat.totalObs.toLocaleString()}
          </span>
          <span className="text-[9px] text-zinc-500">public.marine_data</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Surface SST / DOXY</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.surfaceTemp.toFixed(1)}°C · {activeFloat.surfaceDoxy.toFixed(0)} µM
          </span>
          <span className="text-[9px] text-zinc-500">Sal: {activeFloat.surfacePsal.toFixed(1)} PSU</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Depth Range</span>
          <span className="text-base font-bold text-white mt-0.5 block">
            {activeFloat.minPres} → {activeFloat.maxPres} dbar
          </span>
          <span className="text-[9px] text-zinc-500">Full water column</span>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-lg">
          <span className="text-[10px] text-[#809AAB] block uppercase">Associated Species</span>
          <span className="text-xs font-bold text-[#83FFE3] italic mt-1 block truncate">
            {activeFloat.species}
          </span>
          <span className="text-[9px] text-emerald-400">CMLRE Spatial Join</span>
        </div>
      </div>

      {/* ── Active Sensors Availability Badges ────────────────────────────── */}
      <div className="p-3 rounded-xl bg-[#071A2D]/80 border border-white/5 flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
        <span className="text-[#809AAB] text-[11px] font-bold flex items-center gap-1.5">
          <Layers size={13} className="text-[#2EE6C6]" />
          Sensor Channels (float_metadata):
        </span>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasTemp ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasTemp ? "✓ TEMP (CTD)" : "✗ TEMP"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasPsal ? "bg-blue-500/20 text-blue-300 border-blue-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasPsal ? "✓ PSAL (Salinity)" : "✗ PSAL"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasDoxy ? "bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasDoxy ? "✓ DOXY (Dissolved O₂)" : "✗ DOXY"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasChla ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasChla ? "✓ CHLA (Fluorescence)" : "✗ CHLA"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasNitrate ? "bg-purple-500/20 text-purple-300 border-purple-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasNitrate ? "✓ NITRATE (SUNA UV)" : "✗ NITRATE"}
          </span>
          <span className={`px-2 py-0.5 rounded border ${activeFloat.hasPh ? "bg-pink-500/20 text-pink-300 border-pink-500/40 font-bold" : "bg-zinc-800 text-zinc-600 border-zinc-700"}`}>
            {activeFloat.hasPh ? "✓ pH (ISFET In-Situ)" : "✗ pH"}
          </span>
        </div>
      </div>

      {/* ── MULTI-GRAPH ANALYTICS DASHBOARD (8 PLOTS) ─────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
        {/* Plot 1: Vertical CTD Temperature Profile */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#2EE6C6] flex items-center gap-1.5">
              <Thermometer size={13} /> 1. Temperature Profile
            </span>
            <span className="text-[10px] text-zinc-400">°C vs Depth</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.temp, 0, 35, "#2EE6C6")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0°C (Abyss)</span>
            <span className="text-white font-bold">{activeFloat.surfaceTemp.toFixed(1)}°C Surface</span>
            <span>35°C</span>
          </div>
        </div>

        {/* Plot 2: Practical Salinity Profile */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#60A5FA] flex items-center gap-1.5">
              <Droplets size={13} /> 2. Salinity Profile (PSAL)
            </span>
            <span className="text-[10px] text-zinc-400">PSU vs Depth</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.psal, 32, 37, "#60A5FA")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>32.0 PSU</span>
            <span className="text-white font-bold">{activeFloat.surfacePsal.toFixed(1)} PSU</span>
            <span>37.0 PSU</span>
          </div>
        </div>

        {/* Plot 3: Dissolved Oxygen (DOXY) & OMZ */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#FFA500] flex items-center gap-1.5">
              <Activity size={13} /> 3. Dissolved Oxygen (DOXY)
            </span>
            <span className="text-[10px] text-red-400">OMZ &lt; 60 µM</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5 relative">
            {renderSvgCurve((d) => d.doxy, 0, 250, "#FFA500")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span className="text-red-400 font-bold">0 µM (Hypoxia)</span>
            <span className="text-white font-bold">{activeFloat.surfaceDoxy.toFixed(0)} µM</span>
            <span>250 µM</span>
          </div>
        </div>

        {/* Plot 4: Chlorophyll-a (CHLA) Fluorescence */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#4ADE80] flex items-center gap-1.5">
              <Sparkles size={13} /> 4. Chlorophyll-a (CHLA)
            </span>
            <span className="text-[10px] text-emerald-400">DCM Peak</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.chla, 0, 1.5, "#4ADE80")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0.0 mg/m³</span>
            <span className="text-[#4ADE80] font-bold">{activeFloat.surfaceChla.toFixed(2)} mg/m³</span>
            <span>1.5 mg/m³</span>
          </div>
        </div>

        {/* Plot 5: Nitrate Concentration (NO₃) */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#C084FC] flex items-center gap-1.5">
              <Layers size={13} /> 5. Nitrate (NO₃) Nutrients
            </span>
            <span className="text-[10px] text-zinc-400">µmol/kg</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.nitrate, 0, 45, "#C084FC")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>0 µM</span>
            <span className="text-[#C084FC] font-bold">{activeFloat.surfaceNitrate.toFixed(1)} µM</span>
            <span>45 µM</span>
          </div>
        </div>

        {/* Plot 6: In-Situ pH Total Acidification */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#F472B6] flex items-center gap-1.5">
              <Zap size={13} /> 6. In-Situ pH Acidification
            </span>
            <span className="text-[10px] text-zinc-400">ISFET Total</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-1 border border-white/5">
            {renderSvgCurve((d) => d.ph, 7.5, 8.3, "#F472B6")}
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>7.50 pH</span>
            <span className="text-[#F472B6] font-bold">{activeFloat.surfacePh.toFixed(2)} pH</span>
            <span>8.30 pH</span>
          </div>
        </div>

        {/* Plot 7: Temperature vs Salinity (T-S) Diagram */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#38BDF8] flex items-center gap-1.5">
              <Compass size={13} /> 7. T-S Diagram (σ_θ)
            </span>
            <span className="text-[10px] text-cyan-400">Water Mass</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-2 border border-white/5 relative">
            <svg className="w-full h-full" viewBox="0 0 240 140">
              {/* Density Isopycnal Contours */}
              <path d="M 30,130 Q 120,80 230,40" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" fill="none" />
              <path d="M 30,100 Q 120,50 230,15" stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" fill="none" />
              <text x="180" y="55" fill="#557085" fontSize="7">σ_θ=26.0</text>
              <text x="180" y="30" fill="#557085" fontSize="7">σ_θ=24.0</text>

              {/* T vs S Points */}
              {activeFloat.profile.map((p, i) => {
                const x = 30 + ((p.psal - 32) / 5) * 190;
                const y = 125 - ((p.temp - 0) / 35) * 110;
                return (
                  <circle
                    key={i}
                    cx={x}
                    cy={y}
                    r="3.5"
                    fill={p.pres < 100 ? "#2EE6C6" : p.pres < 500 ? "#FFA500" : "#60A5FA"}
                    stroke="#051422"
                    strokeWidth="1"
                  />
                );
              })}
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>32 PSU (BOB)</span>
            <span className="text-[#83FFE3] font-bold">ASHSW Core</span>
            <span>37 PSU (AS)</span>
          </div>
        </div>

        {/* Plot 8: Multi-Cycle Progression Timeline */}
        <div className="p-4 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl flex flex-col justify-between">
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <span className="text-xs font-bold text-[#FBBF24] flex items-center gap-1.5">
              <TrendingUp size={13} /> 8. Multi-Cycle Progression
            </span>
            <span className="text-[10px] text-zinc-400">{activeFloat.cycles} Cycles</span>
          </div>
          <div className="w-full h-44 bg-[#071A2D]/60 rounded-xl p-2 border border-white/5 relative">
            <svg className="w-full h-full" viewBox="0 0 240 140">
              <path d="M 20,40 Q 60,60 100,30 T 160,25 T 220,35" stroke="#FBBF24" strokeWidth="2.5" fill="none" />
              <path d="M 20,95 Q 60,110 100,85 T 160,75 T 220,90" stroke="#60A5FA" strokeWidth="2" strokeDasharray="3,3" fill="none" />
              <circle cx="220" cy="35" r="4" fill="#FBBF24" />
              <text x="140" y="20" fill="#FBBF24" fontSize="8" fontWeight="bold">SST (°C)</text>
              <text x="140" y="70" fill="#60A5FA" fontSize="8">Salinity (PSU)</text>
            </svg>
          </div>
          <div className="flex justify-between text-[10px] text-zinc-400 mt-2">
            <span>Cycle #1</span>
            <span className="text-white font-bold">{activeFloat.spanDays.toFixed(0)} Days Active</span>
            <span>Cycle #{activeFloat.cycles}</span>
          </div>
        </div>
      </div>

      {/* ── Raw Observation Level Data Matrix for Selected Float ─────────── */}
      <div className="p-5 rounded-2xl bg-[#0B1D2C]/90 border border-white/10 shadow-xl space-y-3 font-mono text-xs">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Database size={15} className="text-[#00FFC6]" />
            <h4 className="text-sm font-bold text-white tracking-wider">
              Observation Data Stream: WMO #{activeFloat.wmo} (public.marine_data)
            </h4>
          </div>
          <span className="text-[10px] text-[#2EE6C6] bg-[#2EE6C6]/10 px-2 py-0.5 rounded border border-[#2EE6C6]/30">
            Ascending Cast #{activeFloat.cycles}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/10 text-[#8AB0C0] text-[10px] uppercase">
                <th className="py-2.5 px-3">PRES (dbar)</th>
                <th className="py-2.5 px-3">TEMP (°C)</th>
                <th className="py-2.5 px-3">PSAL (PSU)</th>
                <th className="py-2.5 px-3">DOXY (µmol/kg)</th>
                <th className="py-2.5 px-3">CHLA (mg/m³)</th>
                <th className="py-2.5 px-3">NITRATE (µM)</th>
                <th className="py-2.5 px-3">pH TOTAL</th>
                <th className="py-2.5 px-3">DENSITY σ_θ</th>
              </tr>
            </thead>
            <tbody>
              {activeFloat.profile.map((p, idx) => (
                <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="py-2 px-3 font-bold text-white">{p.pres} dbar</td>
                  <td className="py-2 px-3 text-[#2EE6C6] font-semibold">{p.temp.toFixed(2)}°C</td>
                  <td className="py-2 px-3 text-[#60A5FA]">{p.psal.toFixed(2)}</td>
                  <td className="py-2 px-3 text-[#FFA500] font-semibold">{p.doxy.toFixed(1)}</td>
                  <td className="py-2 px-3 text-[#4ADE80]">{p.chla.toFixed(2)}</td>
                  <td className="py-2 px-3 text-[#C084FC]">{p.nitrate.toFixed(1)}</td>
                  <td className="py-2 px-3 text-[#F472B6]">{p.ph.toFixed(2)}</td>
                  <td className="py-2 px-3 text-zinc-400">{p.sigmaTheta.toFixed(1)} kg/m³</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
