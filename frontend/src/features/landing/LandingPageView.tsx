"use client";

import React from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function LandingPageView() {
  return (
    <div className="relative w-screen h-screen min-h-screen overflow-hidden bg-[#020B14] text-white flex flex-col justify-between p-6 sm:p-10 lg:p-16 select-none font-sans">
      {/* ── 1. Full-Bleed Background Image (100% Screen Width & Height) ───── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <Image
          src="/assets/varuna_ocean_station.jpg"
          alt="VARUNA National Marine Surveillance Outpost"
          fill
          priority
          className="object-cover object-center scale-[1.02]"
        />
        {/* Soft Left Text Shadow Vignette (Leaving right 70% station and sea waves vibrant) */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#020B14]/90 via-[#020B14]/40 to-transparent w-[70%]" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#020B14]/75 via-transparent to-transparent h-[35%] bottom-0" />
      </div>

      {/* ── 2. Top Header Bar ─────────────────────────────────────────────── */}
      <header className="relative z-10 w-full flex items-center justify-between">
        {/* Brand Logo & Name */}
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#2EE6C6]/15 border border-[#2EE6C6]/40 flex items-center justify-center shadow-[0_0_20px_rgba(46,230,198,0.35)] backdrop-blur-md">
            <svg className="w-5 h-5 text-[#00FFC6]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v20" />
              <path d="M5 4v6a7 7 0 0 0 14 0V4" />
              <circle cx="12" cy="2" r="1" fill="#00FFC6" />
              <circle cx="5" cy="4" r="1" fill="#00FFC6" />
              <circle cx="19" cy="4" r="1" fill="#00FFC6" />
            </svg>
          </div>
          <span className="text-xl font-mono font-black tracking-widest text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
            VARUNA
          </span>
        </div>

        {/* Launch Command Center Glassmorphic Button */}
        <Link
          href="/command-center"
          className="px-6 py-2.5 rounded-full bg-[#0B1D2C]/60 hover:bg-[#2EE6C6] text-white hover:text-black border border-white/25 hover:border-[#2EE6C6] font-mono text-xs font-bold flex items-center gap-2 backdrop-blur-xl transition-all shadow-[0_0_20px_rgba(0,0,0,0.6)] group hover:scale-105"
        >
          <span>Launch Command Center</span>
          <ArrowUpRight size={14} className="text-[#00FFC6] group-hover:text-black transition-colors" />
        </Link>
      </header>

      {/* ── 3. Main Hero Left-Aligned Copy ────────────────────────────────── */}
      <main className="relative z-10 max-w-2xl space-y-4 my-auto pl-2">
        {/* Main Triple Catchphrase */}
        <h1 className="text-5xl sm:text-7xl lg:text-8xl font-sans font-black text-white tracking-tight leading-[0.92] drop-shadow-[0_4px_24px_rgba(0,0,0,0.9)]">
          Understand.<br />
          Predict<span className="text-[#00FFC6]">.</span><br />
          Protect<span className="text-[#00FFC6]">.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg font-mono font-bold text-[#00FFC6] pt-1 drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]">
          India&apos;s Ocean. Powered by AI.
        </p>

        {/* Mission Statement */}
        <p className="text-xs sm:text-sm text-zinc-300 max-w-lg leading-relaxed font-sans drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
          Bridging INCOIS physical oceanography<br />
          + CMLRE marine living resources.
        </p>
      </main>

      {/* ── 4. Bottom Statistics Row ──────────────────────────────────────── */}
      <footer className="relative z-10 w-full flex flex-wrap items-center gap-8 sm:gap-14 lg:gap-20 pt-5 border-t border-white/15 font-mono max-w-3xl pl-2">
        <div>
          <div className="text-xl sm:text-2xl font-bold text-[#00FFC6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            3,800+
          </div>
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider mt-0.5">
            ARGO Floats
          </div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-[#00FFC6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            500+
          </div>
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider mt-0.5">
            Marine Species
          </div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-[#00FFC6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            6
          </div>
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider mt-0.5">
            Ocean Basins
          </div>
        </div>
        <div>
          <div className="text-xl sm:text-2xl font-bold text-[#00FFC6] drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]">
            30M+
          </div>
          <div className="text-[11px] text-zinc-400 uppercase tracking-wider mt-0.5">
            Lives Impacted
          </div>
        </div>
      </footer>
    </div>
  );
}
