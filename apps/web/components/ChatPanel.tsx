"use client";

import { useChatStream } from "@/hooks/useChatStream";
import { Send, ArrowRight, RefreshCw, Terminal, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { ChartRouter } from "./Charts";

// taste-skill: stagger orchestration — parent wrapper lives in this client tree
const msgVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 28 } },
};

// taste-skill: bento grid of prompt chips, NOT a centered bot icon
const STARTER_PROMPTS = [
  { label: "5 floats near Mumbai",         query: "Find the 5 closest floats to Mumbai." },
  { label: "Temp profile Arabian Sea",     query: "Show me the temperature profile in the Arabian Sea 0–2000m." },
  { label: "Salinity Bay of Bengal",       query: "What is the average salinity in the Bay of Bengal?" },
  { label: "ARGO near Maldives",           query: "Show me the nearest ARGO float to the Maldives." },
  { label: "Oxygen trend Indian Ocean",    query: "Average oxygen levels in the Equatorial Indian Ocean?" },
  { label: "Float 1902303 trajectory",     query: "Where is float 1902303 right now?" },
];

// Skeleton shimmer for AI response loading — no spinner
function TypingSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex gap-2.5"
    >
      <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 shrink-0 mt-0.5 flex items-center justify-center">
        <Zap size={12} className="text-accent" />
      </div>
      <div className="flex flex-col gap-2 flex-1 pt-1">
        <div className="skeleton h-3 w-[80%] rounded" />
        <div className="skeleton h-3 w-[60%] rounded" />
        <div className="skeleton h-3 w-[70%] rounded" />
        <div className="skeleton h-3 w-[45%] rounded" />
      </div>
    </motion.div>
  );
}

export function ChatPanel() {
  const { messages, input, setInput, sendMessage, isTyping, error } = useChatStream();
  const bottomRef = useRef<HTMLDivElement>(null);
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full glass rounded-2xl overflow-hidden noise">
      {/* ── Terminal-style header ─────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Terminal size={13} className="text-accent" />
          </div>
          <div>
            <div className="text-[13px] font-mono font-medium text-zinc-200 leading-tight">
              FloatChat AI
            </div>
            <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest leading-tight">
              ARGO Intelligence Core
            </div>
          </div>
        </div>

        {/* Connection pill */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/8 border border-accent/15">
          <span className="w-1.5 h-1.5 rounded-full bg-accent dot-live" />
          <span className="text-[10px] font-mono text-accent uppercase tracking-widest">
            WS Connected
          </span>
        </div>
      </div>

      {/* ── Messages area ─────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Empty state: bento grid of prompt chips — not a centered icon */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full flex flex-col justify-center gap-6"
          >
            <div>
              <p className="text-xs font-mono uppercase tracking-widest text-zinc-600 mb-3">
                Query the intelligence core
              </p>
              {/* taste-skill: Bento Grid, NOT a centered bot icon */}
              <div className="grid grid-cols-2 gap-2">
                {STARTER_PROMPTS.map((p) => (
                  <motion.button
                    key={p.label}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setInput(p.query)}
                    className="
                      group text-left p-3 rounded-xl
                      bg-white/3 hover:bg-white/6
                      border border-white/6 hover:border-white/12
                      transition-colors duration-150
                    "
                  >
                    <span className="block text-[11px] font-mono text-zinc-400 group-hover:text-zinc-200 transition-colors leading-snug">
                      {p.label}
                    </span>
                    <ArrowRight
                      size={11}
                      className="mt-1.5 text-zinc-700 group-hover:text-accent transition-colors"
                    />
                  </motion.button>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* Message list */}
        <AnimatePresence initial={false}>
          {messages.map((m, idx) => (
            <motion.div
              key={m.id || idx}
              variants={msgVariants}
              initial="hidden"
              animate="show"
              className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}
            >
              {/* Avatar */}
              <div
                className={`
                  shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5 border text-[11px] font-mono font-bold
                  ${m.role === "user"
                    ? "bg-white/5 border-white/10 text-zinc-400"
                    : "bg-accent/10 border-accent/20 text-accent"
                  }
                `}
              >
                {m.role === "user" ? "U" : "AI"}
              </div>

              {/* Bubble */}
              <div
                className={`
                  max-w-[85%] rounded-2xl px-3.5 py-3 text-sm
                  ${m.role === "user"
                    ? "bg-white/5 border border-white/8 text-zinc-200 rounded-tr-sm"
                    : "bg-zinc-900/80 border border-white/6 backdrop-blur-sm prose prose-invert rounded-tl-sm"
                  }
                `}
              >
                {m.role === "assistant" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {m.content || "..."}
                  </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{m.content}</p>
                )}

                {/* Visualization */}
                {m.metadata?.viz_specs && (
                  <div className="mt-4 w-full h-[320px]">
                    <ChartRouter vizSpecs={m.metadata.viz_specs} />
                  </div>
                )}

                {/* SQL badge */}
                {m.metadata?.sql && (
                  <div className="mt-3 text-[10px] font-mono bg-black/40 px-2.5 py-2 rounded-lg border border-white/5 text-zinc-500 overflow-x-auto">
                    <span className="text-accent/70 mr-2 uppercase tracking-widest text-[9px]">SQL</span>
                    {m.metadata.sql}
                  </div>
                )}

                {/* Intent + Trace row */}
                {m.metadata?.intent && (
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded text-[9px] bg-accent/8 border border-accent/15 text-accent font-mono uppercase tracking-widest">
                      {m.metadata.intent}
                    </span>
                    {m.trace_id && (
                      <span
                        className="px-2 py-0.5 rounded text-[9px] bg-white/4 border border-white/8 text-zinc-600 font-mono uppercase cursor-help"
                        title={`Trace: ${m.trace_id}`}
                      >
                        {m.trace_id.substring(0, 8)}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* AI typing: skeleton shimmer, not a spinner */}
        <AnimatePresence>
          {isTyping && messages[messages.length - 1]?.role === "user" && (
            <TypingSkeleton />
          )}
        </AnimatePresence>

        {/* Error state */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/20 bg-red-500/5"
            >
              <div className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-red-500/20 flex items-center justify-center">
                <span className="text-red-400 text-[10px] font-bold">!</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-mono text-red-400 mb-2">{error}</p>
                {/* taste-skill: retry button with tactile feedback */}
                <button
                  onClick={() => sendMessage(input)}
                  className="flex items-center gap-1 text-[10px] font-mono text-zinc-500 hover:text-zinc-300 transition-colors active:scale-95"
                >
                  <RefreshCw size={10} />
                  Retry
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={bottomRef} />
      </div>

      {/* ── Input area ────────────────────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-t border-white/5">
        <form
          onSubmit={handleSubmit}
          className="relative flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            disabled={isTyping}
            placeholder={isTyping ? "Synthesizing…" : "Ask about ocean data…"}
            className={`
              flex-1 bg-white/4 rounded-xl px-4 py-2.5 text-[13px] font-sans
              text-zinc-200 placeholder-zinc-600
              border transition-all duration-200 outline-none
              disabled:opacity-40
              ${focused ? "border-accent/40 ring-1 ring-accent/20" : "border-white/8 hover:border-white/15"}
            `}
          />
          {/* taste-skill: tactile scale-[0.97] on active press */}
          <motion.button
            type="submit"
            disabled={!input.trim() || isTyping}
            whileTap={{ scale: 0.94 }}
            className={`
              shrink-0 w-9 h-9 rounded-xl flex items-center justify-center
              transition-colors duration-150
              ${input.trim() && !isTyping
                ? "bg-accent hover:bg-accent/90 text-white"
                : "bg-white/5 text-zinc-600 cursor-not-allowed"
              }
            `}
          >
            <Send size={15} />
          </motion.button>
        </form>
        <p className="text-[10px] font-mono text-zinc-700 mt-2 text-center">
          FloatChat AI — ARGO Intelligence Core
        </p>
      </div>
    </div>
  );
}

// Also keep default export for backward compatibility
export default ChatPanel;
