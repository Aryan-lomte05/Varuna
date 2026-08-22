"use client";

import React, { useState } from "react";
import Image from "next/image";
import {
  Fish,
  Search,
  Radio,
  ChevronRight,
  ShieldCheck,
  AlertTriangle,
  Compass,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";

export function BiodiversityView() {
  const {
    biodiversity,
    selectedSpecies,
    setSelectedSpecies,
    correlations,
    setSelectedFloatId,
    flyToCoordinates,
    setActiveNav,
  } = useOperationalState();

  const [searchQuery, setSearchQuery] = useState("");

  const filtered = biodiversity.filter(
    (b) =>
      b.scientific_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      b.common_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedBio =
    biodiversity.find((b) => b.scientific_name.toLowerCase() === selectedSpecies.toLowerCase()) ||
    biodiversity[0];

  return (
    <div className="flex flex-col h-full space-y-3 p-1 overflow-y-auto custom-scrollbar select-none">
      {/* ── Main Layout: Species Directory on Left + Species Profile & Joins on Right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Species Directory (4 Cols) */}
        <div className="lg:col-span-4 panel-marine p-3.5 bg-[#0B1D2C]/90 flex flex-col justify-between h-[600px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Fish size={14} className="text-[#00FFC6]" />
                <span className="text-xs font-mono font-bold text-white uppercase">
                  CMLRE Living Resources ({biodiversity.length || 500})
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#00FFC6] font-bold">DARWIN CORE</span>
            </div>

            {/* Species Search Bar */}
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search marine species (e.g. Sardine)..."
                className="w-full h-8 pl-7 pr-2 rounded bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-[#00FFC6]"
              />
            </div>

            {/* Species Scrollable List */}
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto custom-scrollbar">
              {filtered.map((s) => {
                const isSelected = s.scientific_name.toLowerCase() === selectedSpecies.toLowerCase();
                return (
                  <div
                    key={s.id}
                    onClick={() => {
                      setSelectedSpecies(s.scientific_name);
                      flyToCoordinates?.(s.latitude, s.longitude, 2000000);
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer text-xs font-mono transition-all ${
                      isSelected
                        ? "bg-[#0E2435] border-[#00FFC6] shadow-[0_0_15px_rgba(0,255,198,0.2)]"
                        : "bg-[#0E2435]/60 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="font-bold text-white italic">{s.scientific_name}</div>
                      <div className="text-[10px] text-[#809AAB]">{s.common_name}</div>
                      <div className="text-[9px] text-zinc-500 mt-0.5">
                        Family: {s.family} · Depth: {s.depth_m || 15}m
                      </div>
                    </div>
                    <ChevronRight size={13} className="text-zinc-500" />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Species Detailed Profile & ARGO Spatial Joins (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Species Profile Dossier */}
          {selectedBio && (
            <div className="panel-marine p-4 bg-[#0B1D2C]/90 font-mono text-xs space-y-3">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div>
                  <h3 className="text-base font-bold text-white italic">{selectedBio.scientific_name}</h3>
                  <p className="text-xs text-[#2EE6C6]">{selectedBio.common_name} (WoRMS AphiaID: {selectedBio.aphia_id})</p>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#2EE6C6]/15 text-[#2EE6C6] border border-[#2EE6C6]/30">
                  {selectedBio.institution_code} Standardized
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                {/* Specimen Artwork */}
                <div className="md:col-span-5 relative h-28 rounded-lg overflow-hidden border border-white/10 bg-black/60">
                  <Image
                    src="/assets/sardinella_longiceps.jpg"
                    alt={selectedBio.scientific_name}
                    fill
                    className="object-cover"
                  />
                </div>

                {/* Darwin Core Taxonomy Grid */}
                <div className="md:col-span-7 grid grid-cols-2 gap-2 text-[10px]">
                  <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                    <span className="text-zinc-400 block text-[8px]">Kingdom</span>
                    <span className="text-white font-bold">{selectedBio.kingdom}</span>
                  </div>
                  <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                    <span className="text-zinc-400 block text-[8px]">Phylum</span>
                    <span className="text-white font-bold">{selectedBio.phylum}</span>
                  </div>
                  <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                    <span className="text-zinc-400 block text-[8px]">Family</span>
                    <span className="text-white font-bold">{selectedBio.family}</span>
                  </div>
                  <div className="p-2 rounded bg-[#0E2435] border border-white/5">
                    <span className="text-zinc-400 block text-[8px]">Thermal Optimum</span>
                    <span className="text-[#00FFC6] font-bold">
                      {selectedBio.thermal_range_min_c}°C – {selectedBio.thermal_range_max_c}°C
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Spatio-Temporal PostGIS Joins (≤50km, ≤7days) */}
          <div className="panel-marine p-4 bg-[#0B1D2C]/90 font-mono text-xs space-y-2.5">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-[#2EE6C6]" />
                <span className="font-bold text-white uppercase text-xs">
                  Spatio-Temporal Physical Oceanographic Joins (≤50 km · ≤7 days)
                </span>
              </div>
              <span className="text-[10px] text-zinc-400">INCOIS ⇄ CMLRE Fusion</span>
            </div>

            {/* List of Joined ARGO Observations */}
            <div className="space-y-2">
              {correlations.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded-lg bg-[#0E2435] border border-white/5 flex flex-wrap items-center justify-between gap-3"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-white">Nearest ARGO Float #{c.nearest_float_wmo}</span>
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-[#2EE6C6]/15 text-[#2EE6C6]">
                        {c.spatial_distance_km} km away
                      </span>
                      <span className="text-[9px] text-zinc-500">
                        Δt: {c.temporal_delta_days} days
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400">
                      In-situ SST: <b className="text-white font-normal">{c.in_situ_temperature}°C</b> · Salinity: <b className="text-white font-normal">{c.in_situ_salinity} PSU</b> · DOXY: <b className="text-white font-normal">{c.in_situ_doxy} µmol/kg</b>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <span className="text-[9px] text-zinc-400 block">Thermal Stress Departure</span>
                      <span className="text-xs font-bold text-red-400">+{c.thermal_stress_delta}°C Exceedance</span>
                    </div>
                    <button
                      onClick={() => {
                        setSelectedFloatId(String(c.nearest_float_wmo));
                        setActiveNav("FLOATS");
                      }}
                      className="px-2 py-1 rounded bg-[#2EE6C6]/20 hover:bg-[#2EE6C6] text-[#2EE6C6] hover:text-black font-bold text-[9px] transition-colors"
                    >
                      Inspect Float
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
