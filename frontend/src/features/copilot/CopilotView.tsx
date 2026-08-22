"use client";

import React, { useState } from "react";
import {
  Sparkles,
  Send,
  BrainCircuit,
  Database,
  ShieldCheck,
  Code,
  Copy,
  Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { useOperationalState } from "@/providers/OperationalProvider";
import { MultiAgentExecutionPanel } from "@/features/agent-graph/MultiAgentExecutionPanel";
import { apiClient } from "@/lib/api/client";
import type { ChatOut, AgentExecutionTrace } from "@/types/copilot";

const STARTER_PROMPTS = [
  "Compare dissolved oxygen in Arabian Sea over the last 6 months vs Equator and show Sardinella longiceps impact.",
  "Detect marine heatwave anomalies in Bay of Bengal vs 30-year climatological baseline.",
  "Identify coral bleaching vulnerability in Gulf of Mannar for Acropora millepora.",
  "Show vertical salinity and temperature profile for ARGO float 1902303.",
];

export function CopilotView() {
  const { setAgentTrace, setSelectedFloatId, setActiveNav } = useOperationalState();
  const [inputQuery, setInputQuery] = useState("");
  const [messages, setMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; sql?: string; trace?: AgentExecutionTrace }>
  >([
    {
      role: "assistant",
      content:
        "### 🌊 VARUNA Marine Ecosystem Copilot\n\nI fuse **INCOIS physical ocean observations** (autonomous ARGO floats) with **CMLRE marine biodiversity records** into an agentic AI intelligence platform.\n\nAsk me any complex oceanographic or cross-domain question!",
    },
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const handleSubmit = async (q = inputQuery) => {
    if (!q.trim() || isLoading) return;
    const userMsg = q.trim();
    setInputQuery("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const res = await apiClient<ChatOut>("/api/v1/agent/chat", {
        method: "POST",
        body: JSON.stringify({ question: userMsg, session_id: "varuna_copilot_full" }),
      });

      if (res.agent_trace) {
        setAgentTrace(res.agent_trace);
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: res.answer_markdown || "Analysis complete.",
          sql: res.sql || undefined,
          trace: res.agent_trace || undefined,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `⚠️ Request failed: ${err.message || "Backend service offline"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-3 p-1 overflow-hidden select-none">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 h-full">
        {/* Left Interactive Chat Panel (7 Cols) */}
        <div className="lg:col-span-7 panel-marine p-4 bg-[#0B1D2C]/90 flex flex-col justify-between h-[600px] overflow-hidden">
          {/* Chat Header */}
          <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2">
            <div className="flex items-center gap-2">
              <Sparkles size={14} className="text-[#00FFC6]" />
              <span className="text-xs font-mono font-bold text-white uppercase">
                Conversational Ocean Intelligence
              </span>
            </div>
            <span className="text-[9px] font-mono px-1.5 py-0.2 bg-[#00FFC6]/15 text-[#00FFC6] rounded">
              NVIDIA NEMOTRON-550B
            </span>
          </div>

          {/* Messages Stream */}
          <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs custom-scrollbar pr-1">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`p-3 rounded-xl ${
                  m.role === "user"
                    ? "bg-[#2EE6C6]/15 border border-[#2EE6C6]/30 text-white ml-6"
                    : "bg-[#0E2435] border border-white/10 text-zinc-200 mr-2"
                }`}
              >
                {m.role === "user" ? (
                  <p>{m.content}</p>
                ) : (
                  <div className="prose prose-invert prose-xs max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.content}</ReactMarkdown>

                    {/* Generated SQL Drawer */}
                    {m.sql && (
                      <div className="mt-3 p-2 rounded bg-black/50 border border-white/10 text-[10px]">
                        <div className="flex items-center justify-between text-zinc-400 mb-1">
                          <span className="flex items-center gap-1 text-[#2EE6C6] font-bold">
                            <Code size={11} /> Generated PostGIS SQL
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(m.sql || "");
                              setCopiedSql(true);
                              setTimeout(() => setCopiedSql(false), 2000);
                            }}
                            className="flex items-center gap-1 text-zinc-400 hover:text-white"
                          >
                            {copiedSql ? <Check size={11} className="text-[#00FFC6]" /> : <Copy size={11} />}
                            <span>{copiedSql ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <code className="text-zinc-300 font-mono block overflow-x-auto whitespace-pre-wrap">
                          {m.sql}
                        </code>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {isLoading && (
              <div className="p-3 rounded-xl bg-[#0E2435] border border-[#2EE6C6]/30 text-zinc-300 flex items-center gap-2">
                <Sparkles size={14} className="text-[#00FFC6] animate-spin" />
                <span className="text-xs font-mono">Decomposing &amp; Executing Multi-Agent DAG...</span>
              </div>
            )}
          </div>

          {/* Starter Query Chips & Input Bar */}
          <div className="pt-2 border-t border-white/10 space-y-2 shrink-0">
            <div className="flex gap-1.5 overflow-x-auto pb-1 text-[9px] font-mono">
              {STARTER_PROMPTS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSubmit(q)}
                  className="px-2 py-1 rounded bg-[#0E2435] hover:bg-[#10293A] text-zinc-300 hover:text-white border border-white/10 whitespace-nowrap transition-all"
                >
                  {q.substring(0, 32)}...
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                placeholder="Ask VARUNA (e.g. Compare Arabian Sea vs Equator)..."
                className="flex-1 h-9 px-3 rounded-lg bg-[#0B1D2C] border border-[#2EE6C6]/25 text-xs text-white placeholder-zinc-500 font-mono outline-none focus:border-[#2EE6C6]"
              />
              <button
                onClick={() => handleSubmit()}
                disabled={isLoading || !inputQuery.trim()}
                className="h-9 px-4 rounded-lg bg-[#2EE6C6] hover:bg-[#00FFC6] text-black font-bold flex items-center justify-center transition-all disabled:opacity-40"
              >
                <Send size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Right Multi-Agent DAG Inspector (5 Cols) */}
        <div className="lg:col-span-5 h-[600px]">
          <MultiAgentExecutionPanel />
        </div>
      </div>
    </div>
  );
}
