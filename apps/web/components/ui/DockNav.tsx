"use client";

import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { Map, MessageSquare, Database, Settings, Activity, Waves } from "lucide-react";

const NAV_ITEMS = [
  { id: "map",      icon: Map,            label: "Fleet Map",       active: true  },
  { id: "chat",     icon: MessageSquare,  label: "AI Analysis",     active: false },
  { id: "data",     icon: Database,       label: "Data Explorer",   active: false },
  { id: "activity", icon: Activity,       label: "Pipeline",        active: false },
  { id: "settings", icon: Settings,       label: "Settings",        active: false },
];

function DockItem({
  icon: Icon, label, active, mouseX,
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  label: string;
  active: boolean;
  mouseX: ReturnType<typeof useMotionValue<number>>;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return val - (rect.left + rect.width / 2);
  });

  // magnification spring — taste-skill magnetic effect
  const scale = useTransform(distance, [-80, 0, 80], [1, 1.55, 1]);
  const springScale = useSpring(scale, { stiffness: 280, damping: 22 });

  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex flex-col items-center" ref={ref}>
      {/* Label */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute -top-8 px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 border border-white/10 text-zinc-300 whitespace-nowrap pointer-events-none"
        >
          {label}
        </motion.div>
      )}

      <motion.div
        style={{ scale: springScale }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className={`
          w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer relative
          transition-colors duration-150 origin-bottom
          ${active
            ? "bg-accent/15 border border-accent/30"
            : "bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15"
          }
        `}
        whileTap={{ scale: 0.94 }}
      >
        <Icon
          size={18}
          className={active ? "text-accent" : "text-zinc-400"}
        />
        {active && (
          <span className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-accent accent-pulse" />
        )}
      </motion.div>
    </div>
  );
}

export function DockNav() {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, type: "spring", stiffness: 200, damping: 22 }}
      className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-end gap-2.5">
        {/* Logo pip */}
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mr-1">
          <Waves size={18} className="text-accent" />
        </div>
        <span className="w-px h-6 self-center bg-white/8" />

        {NAV_ITEMS.map((item) => (
          <DockItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={item.active}
            mouseX={mouseX}
          />
        ))}
      </div>
    </motion.div>
  );
}
