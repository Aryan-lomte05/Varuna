"use client";

import { motion, useMotionValue, useTransform, useSpring } from "framer-motion";
import { useRef, useState } from "react";
import { type LucideIcon, Map, MessageSquare, Database, Settings, Activity, Waves } from "lucide-react";

/**
 * Navigation items for the "Exploration Vessel" HUD
 * Reusing IDs for the multimodal Command Center
 */
const NAV_ITEMS = [
  { id: "map",      icon: Map,            label: "Fleet Map"       },
  { id: "chat",     icon: MessageSquare,  label: "AI Analysis"     },
  { id: "ANALYSIS", icon: Database,       label: "Data Explorer"   },
  { id: "ACTIVITY", icon: Activity,       label: "Pipeline"        },
  { id: "settings", icon: Settings,       label: "Settings"        },
];

function DockItem({
  icon: Icon, label, active, onSelect, mouseX,
}: {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onSelect: (id: string) => void;
  mouseX: ReturnType<typeof useMotionValue<number>>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { id } = NAV_ITEMS.find(item => item.label === label) || { id: "map" };

  const distance = useTransform(mouseX, (val) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return 0;
    return val - (rect.left + rect.width / 2);
  });

  const scale = useTransform(distance, [-80, 0, 80], [1, 1.55, 1]);
  const springScale = useSpring(scale, { stiffness: 280, damping: 22 });

  const [hovered, setHovered] = useState(false);

  return (
    <div className="relative flex flex-col items-center" ref={ref}>
      {/* Label Tooltip */}
      {hovered && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="absolute -top-10 px-2 py-1 rounded text-[10px] font-mono bg-zinc-900 border border-white/10 text-zinc-300 whitespace-nowrap pointer-events-none z-50 shadow-2xl"
        >
          {label}
        </motion.div>
      )}

      <motion.div
        style={{ scale: springScale }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onSelect(id)}
        className={`
          w-10 h-10 rounded-xl flex items-center justify-center cursor-pointer relative
          transition-colors duration-200 origin-bottom
          ${active
            ? "bg-accent/20 border border-accent/40 shadow-[0_0_20px_rgba(46,230,198,0.15)]"
            : "bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20"
          }
        `}
        whileTap={{ scale: 0.92 }}
      >
        <Icon
          size={18}
          className={active ? "text-accent" : "text-zinc-400 group-hover:text-zinc-200"}
        />
        {active && (
          <motion.span 
            layoutId="dock-dot"
            className="absolute -bottom-1.5 w-1 h-1 rounded-full bg-accent shadow-[0_0_8px_var(--accent)]" 
          />
        )}
      </motion.div>
    </div>
  );
}

export function DockNav({ 
  activeId, 
  onViewChange 
}: { 
  activeId: string; 
  onViewChange: (id: string) => void;
}) {
  const mouseX = useMotionValue(Infinity);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, type: "spring", stiffness: 200, damping: 22 }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-4"
      onMouseMove={(e) => mouseX.set(e.clientX)}
      onMouseLeave={() => mouseX.set(Infinity)}
    >
      <div className="glass-strong rounded-2xl px-4 py-2.5 flex items-end gap-2.5 border border-white/5 shadow-2xl backdrop-blur-2xl">
        <div className="w-10 h-10 rounded-xl bg-accent/15 border border-accent/30 flex items-center justify-center mr-1">
          <Waves size={18} className="text-accent" />
        </div>
        <span className="w-px h-6 self-center bg-white/10" />

        {NAV_ITEMS.map((item) => (
          <DockItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activeId === item.id}
            onSelect={onViewChange}
            mouseX={mouseX}
          />
        ))}
      </div>
    </motion.div>
  );
}
