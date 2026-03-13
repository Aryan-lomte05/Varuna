"use client";

import { useChatStream } from '@/hooks/useChatStream';
import { Send, Loader2, Bot, User, X } from 'lucide-react';
import { useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { motion, AnimatePresence } from 'framer-motion';
import { ChartRouter } from './Charts';

export default function ChatPanel() {
  const { messages, input, setInput, sendMessage, isTyping, error } = useChatStream();
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom of chat
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <div className="flex flex-col h-full glass-card rounded-2xl">
      {/* Header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between z-10 bg-surface/50 backdrop-blur-md rounded-t-2xl">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-argo-blue/20 flex items-center justify-center border border-argo-blue/50 shadow-[0_0_15px_rgba(58,134,255,0.3)]">
            <Bot size={18} className="text-argo-cyan" />
          </div>
          <div>
            <h2 className="text-white font-display font-medium leading-tight">FloatChat AI</h2>
            <p className="text-xs text-argo-cyan/70 font-mono">ARGO Intelligence Core</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
            <Bot size={48} className="text-argo-cyan mb-2" />
            <p className="text-sm max-w-[250px]">
              Ask me about ocean temperatures, ARGO trajectories, or complex marine data analysis.
            </p>
            <div className="flex flex-wrap gap-2 justify-center max-w-[300px] mt-4">
              <span className="text-xs border border-white/10 rounded-full px-3 py-1 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setInput("Where is float 1902303?")}>
                Where is float 1902303?
              </span>
              <span className="text-xs border border-white/10 rounded-full px-3 py-1 cursor-pointer hover:bg-white/5 transition-colors" onClick={() => setInput("Show me the temperature profile in the Arabian Sea.")}>
                Temp profile Arabian Sea
              </span>
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((m, idx) => (
            <motion.div 
              key={m.id || idx}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`flex gap-3 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
            >
              <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border ${
                m.role === 'user' 
                  ? 'bg-ocean border-white/10' 
                  : 'bg-argo-blue/10 border-argo-cyan/30 text-argo-cyan'
              }`}>
                {m.role === 'user' ? <User size={16} /> : <Bot size={16} />}
              </div>

              <div className={`max-w-[85%] rounded-2xl p-4 ${
                m.role === 'user'
                  ? 'bg-ocean border border-white/5 text-white'
                  : 'bg-surface/30 border border-white/5 backdrop-blur-sm prose prose-invert'
              }`}>
                {m.role === 'assistant' ? (
                   <ReactMarkdown remarkPlugins={[remarkGfm]}>
                     {m.content || "..."}
                   </ReactMarkdown>
                ) : (
                  <p className="whitespace-pre-wrap text-sm">{m.content}</p>
                )}

                {/* Sub-components for metadata (SQL, Debug, Viz) */}
                {m.metadata?.viz_specs && (
                  <div className="mt-4 w-full h-[350px]">
                    <ChartRouter vizSpecs={m.metadata.viz_specs} />
                  </div>
                )}

                {m.metadata?.sql && (
                  <div className="mt-3 text-xs font-mono bg-black/50 p-2 rounded border border-white/5 text-gray-400 overflow-x-auto">
                    <span className="text-argo-gold mr-2 text-[10px] uppercase tracking-wider">Executed SQL</span>
                    {m.metadata.sql}
                  </div>
                )}
                
                {/* Intent Badge */}
                {m.metadata?.intent && (
                  <div className="mt-2 flex gap-2">
                    <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-argo-cyan font-mono uppercase">
                      INTENT: {m.metadata.intent}
                    </span>
                    {m.trace_id && (
                       <span className="inline-block px-2 py-0.5 rounded text-[10px] bg-white/5 border border-white/10 text-text-muted font-mono uppercase cursor-help" title={`Trace ID: ${m.trace_id}`}>
                         TRACE: {m.trace_id.substring(0,6)}
                       </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        
        {isTyping && messages[messages.length-1]?.role === 'user' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
             <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 border bg-argo-blue/10 border-argo-cyan/30 text-argo-cyan">
                <Bot size={16} />
              </div>
              <div className="bg-surface/30 border border-white/5 rounded-2xl p-4 flex items-center gap-2">
                <Loader2 size={16} className="animate-spin text-argo-cyan" />
                <span className="text-sm text-text-muted">Synthesizing...</span>
              </div>
          </motion.div>
        )}
        
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-3 rounded-xl text-sm flex items-start gap-2">
            <X size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 bg-surface/50 backdrop-blur-md border-t border-white/5 rounded-b-2xl z-10">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            placeholder={isTyping ? "Model is thinking..." : "Ask about ocean data..."}
            className="w-full bg-black/40 border border-white/10 rounded-full py-3 pl-5 pr-12 text-sm text-white placeholder-text-muted focus:outline-none focus:border-argo-cyan/50 focus:ring-1 focus:ring-argo-cyan/50 transition-all disabled:opacity-50 font-sans"
          />
          <button 
            type="submit" 
            disabled={!input.trim() || isTyping}
            className="absolute right-2 p-2 bg-argo-blue hover:bg-opacity-80 disabled:bg-white/10 text-white rounded-full transition-colors flex items-center justify-center group"
          >
            {isTyping ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} className="group-hover:translate-x-0.5 transition-transform" />
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
