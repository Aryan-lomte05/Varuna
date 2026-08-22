"use client";

import React, { useState } from "react";
import {
  Radio,
  Search,
  ChevronRight,
  Compass,
  Layers,
  Thermometer,
  Droplets,
  Activity,
  Filter,
} from "lucide-react";
import { useOperationalState } from "@/providers/OperationalProvider";
import { ArgoVerticalProfilePanel } from "@/features/argo-profile/ArgoVerticalProfilePanel";
import { DeepDiveModePanel } from "@/features/deep-dive/DeepDiveModePanel";

export function FloatsView() {
  const { floats, selectedFloatId, setSelectedFloatId, flyToCoordinates } = useOperationalState();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = floats.filter((f) =>
    String(f.wmo_id).includes(searchQuery)
  );

  return (
    <div className="flex flex-col h-full space-y-3 p-1 overflow-y-auto custom-scrollbar select-none">
      {/* ── Main Layout: Float Directory on Left + Profile/Deep Dive on Right ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left Float Directory Panel (4 Cols) */}
        <div className="lg:col-span-4 panel-marine p-3.5 bg-[#0B1D2C]/90 flex flex-col justify-between h-[600px]">
          <div>
            <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2.5">
              <div className="flex items-center gap-2">
                <Radio size={14} className="text-[#2EE6C6]" />
                <span className="text-xs font-mono font-bold text-white uppercase">
                  ARGO Float Fleet ({floats.length || 3842})
                </span>
              </div>
              <span className="text-[9px] font-mono text-[#00FFC6] font-bold">LIVE TELEMETRY</span>
            </div>

            {/* Float Search Input */}
            <div className="relative mb-2">
              <Search size={12} className="absolute left-2.5 top-2.5 text-zinc-500" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search WMO ID (e.g. 1902303)..."
                className="w-full h-8 pl-7 pr-2 rounded bg-black/40 border border-white/10 text-xs font-mono text-white placeholder-zinc-500 outline-none focus:border-[#2EE6C6]"
              />
            </div>

            {/* Float List Scrollable */}
            <div className="space-y-1.5 max-h-[460px] overflow-y-auto custom-scrollbar">
              {filtered.map((f) => {
                const isSelected = String(f.wmo_id) === selectedFloatId;
                return (
                  <div
                    key={f.wmo_id}
                    onClick={() => {
                      setSelectedFloatId(String(f.wmo_id));
                      flyToCoordinates?.(f.last_lat, f.last_lon, 2000000);
                    }}
                    className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer text-xs font-mono transition-all ${
                      isSelected
                        ? "bg-[#0E2435] border-[#00FFC6] shadow-[0_0_15px_rgba(0,255,198,0.2)]"
                        : "bg-[#0E2435]/60 border-white/5 hover:border-white/20"
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-1.5 font-bold text-white">
                        <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-[#00FFC6]" : "bg-[#2EE6C6]"}`} />
                        <span>WMO #{f.wmo_id}</span>
                      </div>
                      <div className="text-[10px] text-zinc-400 mt-0.5">
                        Pos: {f.last_lat.toFixed(2)}°N, {f.last_lon.toFixed(2)}°E
                      </div>
                      <div className="text-[9px] text-zinc-500">
                        Last Seen: {f.last_seen ? f.last_seen.substring(0, 10) : "2026-08-14"}
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] font-bold text-[#2EE6C6] block">
                        {f.total_profiles || 280} casts
                      </span>
                      <ChevronRight size={13} className="text-zinc-500 ml-auto mt-1" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Scientific Visualizations (8 Cols) */}
        <div className="lg:col-span-8 space-y-3">
          {/* Vertical Depth Cast Panel */}
          <div className="h-[320px]">
            <ArgoVerticalProfilePanel />
          </div>

          {/* Deep Dive Subsea Strata Mode */}
          <div className="h-[268px]">
            <DeepDiveModePanel />
          </div>
        </div>
      </div>
    </div>
  );
}
