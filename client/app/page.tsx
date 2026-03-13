"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { DataStatusBar } from "@/components/ui/DataStatusBar";
import { DockNav } from "@/components/ui/DockNav";
import { ChatPanel } from "@/components/ChatPanel";

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
  return (
    // taste-skill: NEVER h-screen → always min-h-[100dvh]
    <div className="flex flex-col min-h-[100dvh] overflow-hidden">
      {/* Top status strip */}
      <DataStatusBar />

      {/* taste-skill: asymmetric split-screen — not centered hero */}
      <motion.div
        className="flex flex-1 gap-3 p-3 overflow-hidden"
        variants={container}
        initial="hidden"
        animate="show"
      >
        {/* Left column — map (60%) + globe (40% of left column height) */}
        <motion.section
          variants={panel}
          className="flex flex-col flex-[3] gap-3 min-w-0 overflow-hidden"
        >
          {/* Primary map — fills most of left column */}
          <div className="flex-[2] relative rounded-2xl overflow-hidden glass noise min-h-0">
            <OceanMap />
            {/* Subtle corner label — taste-skill: don't float random UI */}
            <div className="absolute top-3 left-3 z-10 flex items-center gap-2 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur border border-white/8">
              <span className="w-1.5 h-1.5 rounded-full bg-accent dot-live" />
              <span className="text-[11px] font-mono text-zinc-400 uppercase tracking-widest">
                ARGO Fleet
              </span>
            </div>
          </div>

          {/* Globe strip — contextual minimap */}
          <div className="flex-[1] relative rounded-2xl overflow-hidden glass noise min-h-0" style={{ minHeight: "240px" }}>
            <OceanGlobe />
            <div className="absolute top-3 left-3 z-10 px-2.5 py-1 rounded-lg bg-black/60 backdrop-blur border border-white/8">
              <span className="text-[11px] font-mono text-zinc-500 uppercase tracking-widest">
                3D Globe Context
              </span>
            </div>
          </div>
        </motion.section>

        {/* Right column — Chat (40%) */}
        <motion.aside
          variants={panel}
          className="flex-[2] flex flex-col min-w-0 min-h-0"
          style={{ maxWidth: "460px" }}
        >
          <ChatPanel />
        </motion.aside>
      </motion.div>

      {/* macOS-style floating dock */}
      <DockNav />
    </div>
  );
}
