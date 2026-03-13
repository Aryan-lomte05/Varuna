"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { Waves } from "lucide-react";
import { DataStatusBar } from "@/components/ui/DataStatusBar";
import { DockNav } from "@/components/ui/DockNav";
import { ChatPanel } from "@/components/ChatPanel";
import { AnalysisHub } from "@/components/AnalysisHub";

export type ActiveView = "MAP" | "ANALYSIS" | "ACTIVITY" | "SETTINGS";

// Heavy WebGL components — dynamic import to avoid SSR crash
const OceanMap  = dynamic(() => import("@/components/OceanMap"),  { ssr: false });
const OceanGlobe = dynamic(
  () => import("@/components/Globe/OceanGlobe").then((m) => ({ default: m.OceanGlobe })),
  { ssr: false }
);

// taste-skill: stagger parent → children waterfall reveal
const container = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

const panel = {
  hidden: { opacity: 0, y: 16 },
  show:   { opacity: 1, y: 0, transition: { type: "spring", stiffness: 220, damping: 26 } },
};

export default function DashboardPage() {
  const [chatOpen, setChatOpen] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>("MAP");

  return (
    <div className="relative w-full h-[100dvh] overflow-hidden bg-bg">
      {/* ── Background Map layer (Always present, but blurred in other views) ── */}
      <div className={`absolute inset-0 z-0 transition-all duration-700 ${activeView !== "MAP" ? "blur-md scale-105 opacity-40" : "blur-0 scale-100 opacity-100"}`}>
        <OceanMap />
        {/* Layered Gradient for depth */}
        <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-bg/40 via-transparent to-bg/60" />
      </div>

      {/* ── View Content Area ────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {activeView === "ANALYSIS" && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0, filter: "blur(10px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, filter: "blur(10px)" }}
            transition={{ duration: 0.5 }}
            className="absolute inset-0 z-10"
          >
            <AnalysisHub />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Top Navigation / Branding ────────────────────────────────────── */}
      <motion.div 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="absolute top-0 left-0 right-0 z-20 p-6 flex items-center justify-between pointer-events-none"
      >
        <div className="flex items-center gap-4 pointer-events-auto">
          <div className="glass px-4 py-2 rounded-xl flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-accent/20 border border-accent/40 flex items-center justify-center">
              <Waves size={18} className="text-accent" />
            </div>
            <div>
              <h1 className="text-sm font-mono font-bold tracking-tight text-text">FLOAT_CHAT.v2</h1>
              <p className="text-[10px] font-mono text-text-3 uppercase tracking-[0.2em]">Ocean Intelligence Core</p>
            </div>
          </div>
          
          <div className="hidden lg:flex items-center gap-2 px-4 py-2 rounded-xl glass">
            <span className="w-2 h-2 rounded-full bg-accent dot-live" />
            <span className="text-[10px] font-mono text-text-2 uppercase tracking-widest">Global Fleet: Live</span>
          </div>
        </div>

        <div className="flex items-center gap-3 pointer-events-auto">
          <DataStatusBar />
        </div>
      </motion.div>

      {/* ── Floating Side HUD (Chat) ─────────────────────────────────────── */}
      <AnimatePresence>
        {chatOpen && (
          <motion.aside
            initial={{ x: 400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 400, opacity: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="absolute top-24 bottom-28 right-6 z-20 w-full max-w-[420px] pointer-events-auto"
          >
            <ChatPanel />
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Metrics Overlay (Left Side) ──────────────────────────────────── */}
      <motion.div 
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="absolute bottom-28 left-6 z-20 flex flex-col gap-3 pointer-events-auto"
      >
        <div className="glass p-4 rounded-2xl w-64">
          <h3 className="text-[10px] font-mono text-text-3 uppercase tracking-widest mb-3">Fleet Health</h3>
          <div className="space-y-3">
            {[
              { label: "Active Nodes", val: "3,842", color: "var(--accent)" },
              { label: "Data Latency", val: "14ms", color: "var(--accent-secondary)" },
              { label: "System Sync", val: "99.8%", color: "var(--accent)" }
            ].map(m => (
              <div key={m.label} className="flex items-end justify-between">
                <span className="text-[11px] text-text-2 font-mono">{m.label}</span>
                <span className="text-sm font-bold font-mono" style={{ color: m.color }}>{m.val}</span>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* ── Navigation Dock ──────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-30 pointer-events-none">
        <div className="pointer-events-auto pb-6">
          <DockNav 
            activeId={activeView} 
            onViewChange={(id) => {
              if (id === "chat") {
                setChatOpen(!chatOpen);
              } else {
                setActiveView(id as ActiveView);
              }
            }} 
          />
        </div>
      </div>
    </div>
  );
}
