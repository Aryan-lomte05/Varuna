# VARUNA.md — Engineering Handbook

This document is the permanent context for Antigravity AI throughout VARUNA development.
Single source of truth for architecture, team ownership, and engineering standards.

---

## 1. Project Overview

VARUNA is an Agentic AI Ocean and Marine Ecosystem Intelligence Platform for SIH 2026 (PS-25040 INCOIS + PS-25041 CMLRE).
Team: Ctrl Alt Defeat | Deadline: 24 August 2026 | Named after: Varuna — Vedic deity of ocean and water order.

VARUNA fuses physical ocean sensor data (ARGO floats: temp, salinity, BGC) with marine biodiversity data
(species distributions, Darwin Core taxonomy) through a multi-agent natural-language interface,
and PROACTIVELY WARNS before marine heatwaves and ecological anomalies hit.

What VARUNA is NOT:
- Not a single-shot RAG chatbot (that is OceanIQ, last year winner — we surpass it).
- Not a locally-run LLM stack. Zero Ollama. Zero HuggingFace. All inference via OpenRouter.
- Not a demo with placeholder data. Every answer traces back to a real ARGO record or OBIS/GBIF occurrence.

---

## 2. Architecture

### 2.1 System Overview

User Query (NL)
      |
      v
 PLANNER AGENT  (OpenRouter -> nvidia/nemotron-ultra-550b-a55b:free)
 Decomposes query into a Task DAG, dispatches to sub-agents
      |
  +---+---+---+
  |       |   |
SQL-GEN  RETRIEVAL  BIODIVERSITY AGENT
NL->SQL  BM25+Vec   OBIS/GBIF Darwin Core
  |       |         species <-> ocean joins
  +---+---+---------+
          |
     SYNTHESIZER
     Merges results, cited Markdown + viz specs
          |
     RESPONSE: answer_md, sql, chart_specs, map_points, agent_trace

 ANOMALY AGENT (background, NOT query-triggered)
 Scans ARGO data for:
  - Marine Heatwave precursors (SST > 90th percentile 5+ days)
  - Hypoxia / OMZ expansion (doxy < 60 umol/kg)
  - Chlorophyll bloom anomalies
 Pushes alerts -> /api/v1/anomalies -> frontend alert feed

### 2.2 Database Schema

marine_data          Physical ocean measurements (PostGIS, partitioned by year)
marine_biodiversity  Darwin Core species occurrences (OBIS/GBIF as CMLRE stand-in)
anomaly_alerts       Proactive early-warning records
floats               ARGO float registry
query_feedback       User ratings and corrections

### 2.3 Qdrant Collections

argo_knowledge   Ocean profile semantic embeddings
argo_schema      Schema snippets + few-shot SQL pairs (schema-linking)
bio_knowledge    Darwin Core species occurrence embeddings (NEW)

---

## 3. LLM Integration — OpenRouter ONLY

Model: nvidia/nemotron-ultra-550b-a55b:free via OpenRouter
Client: backend/src/llm/openrouter_client.py (MUST CREATE — M3 priority #1)

CRITICAL RULE: Zero local LLM inference. ollama_client.py is offline fallback ONLY.
All production AI generation goes through openrouter_client.py.

Environment variables (.env, never committed):
  OPENROUTER_API_KEY=sk-or-...
  OPENROUTER_MODEL=nvidia/nemotron-ultra-550b-a55b:free
  OPENROUTER_EMBED_MODEL=nomic-ai/nomic-embed-text-v1.5:free
  PG_DSN=postgresql://argo_admin:argo_password@localhost:5432/argo_data
  QDRANT_URL=http://localhost:6333
  REDIS_URL=redis://localhost:6379/0

---

## 4. Frontend Design System

Stack: Next.js 14 (App Router), TailwindCSS v3, Framer Motion, Mapbox GL + Deck.gl, Plotly.js, Three.js

COLOR SYSTEM — DO NOT CHANGE:
  --bg:       #071A2D   Midnight Water (main background)
  --bg-1:     #0A2540   Deep Ocean (panels)
  --bg-2:     #051421   Abyss (deep contrast)
  --accent:   #2EE6C6   Tropical Aqua (primary interactive)
  --glow:     #00FFC6   Bioluminescent Green (AI identity)
  --coral:    #FF7F50   Coral Orange (warnings)
  --text:     #D6F6FF   Soft Ice Blue

DESIGN PHILOSOPHY: Naval operations room crossed with bioluminescent deep ocean.
- No generic gradients. Every element carries information or serves depth.
- Glassmorphism for panels only (.glass class with inset shadow refraction).
- Micro-animations: skeleton loaders, spring physics nav, stagger reveals on content.
- Map is always present — blurs in background when switching views, never disappears.
- Plotly: always config={{ displayModeBar: false }}, transparent background, ocean palette.
- Anomaly alert cards: severity color ring + pulsing dot if active.

---

## 5. Directory -> Owner Mapping

backend/src/agents/                   Aryan Lomte (M1, Lead)
backend/src/api/                      Aryan Lomte (M1)
backend/src/ingestion/                Aditya Yadav (M2)
backend/src/database/postgres.py      Aditya Yadav (M2) [schema changes need M1 sign-off]
backend/src/llm/openrouter_client.py  Sahil Shah (M3)
backend/src/chains/                   Sahil Shah (M3)
backend/src/rag/                      Sahil Shah (M3)
backend/src/memory/                   Sahil Shah (M3)
frontend/app/page.tsx                 Advay Chavan (M4)
frontend/components/ChatPanel.tsx     Advay Chavan (M4)
frontend/components/AgentGraph.tsx    Advay Chavan (M4)
frontend/components/Globe/            Advay Chavan (M4)
frontend/components/OceanMap.tsx      Netal Gupta (M5)
frontend/components/AnomalyAlerts.tsx Netal Gupta (M5)
frontend/components/Charts/           Kanishka Sahal (M6)
frontend/components/CrossDomainExplorer.tsx  Kanishka Sahal (M6)

---

## 6. Codebase Audit — Honest Current State

BACKEND:
  src/api/app.py               WORKS       FastAPI setup correct
  src/api/routes.py            INCOMPLETE  Missing /agent/chat, /anomalies, /biodiversity, /correlate
  src/api/ws.py                WORKS       WebSocket streaming functional
  src/llm/ollama_client.py     WRONG PATH  Points to local Ollama. Must NOT be primary LLM path.
  src/llm/openrouter_client.py MISSING     Create from scratch (M3 priority #1)
  src/llm/embedder.py          BROKEN      MD5 hash fallback is useless for real RAG
  src/llm/sql_gen.py           WORKS       Rule-based fallback SQL — keep as safety net
  src/chains/sql_rag_chain.py  STALE       References ollama_client -> swap to openrouter
  src/chains/rag_chain.py      STALE       Same issue
  src/database/postgres.py     GOOD        Missing marine_biodiversity + cross-domain joins
  src/database/qdrant.py       WORKS       Needs 3rd bio_knowledge collection
  src/ingestion/pipeline.py    GOOD        Works but untested E2E (no real NetCDF locally yet)
  src/ingestion/seed_biodiversity.py  MISSING  Create (M2 priority)
  src/agents/                  MISSING     Entire directory does not exist (M1 priority)
  src/memory/conversation.py   WORKS       Redis + in-memory fallback
  src/config.py                STALE       openrouter_model has old Nemotron 340b name

FRONTEND:
  app/page.tsx                 GOOD        Needs VARUNA rebrand + new Anomaly/Agent tabs
  app/globals.css              PERFECT     Keep exactly as-is
  components/ChatPanel.tsx     WORKS       Needs agent DAG display mode
  components/OceanMap.tsx      WORKS       Needs biodiversity species occurrence Deck.gl layer
  components/Charts/           PARTIAL     CrossCorrelogram, ObsDensityMap, ProfileCount, QCHistogram are empty stubs
  components/AgentGraph.tsx    MISSING     Create (M4 priority)
  components/AnomalyAlerts.tsx MISSING     Create (M5 priority)
  components/CrossDomainExplorer.tsx  MISSING  Create (M6 priority)

INFRASTRUCTURE:
  PostgreSQL + PostGIS   IN docker-compose.yml — good
  Qdrant                 IN docker-compose.yml — good
  Redis                  IN docker-compose.yml — good
  Ollama                 MUST REMOVE from docker-compose

---

## 7. Build Order (Priority for 24 Aug Deadline)

1. [M3] Create openrouter_client.py — this unblocks all LLM-dependent work
2. [M3] Update config.py model name + swap all chain Ollama references
3. [M1] Create backend/src/agents/ with orchestrator.py planner
4. [M2] Add marine_biodiversity schema to postgres.py + create seed_biodiversity.py
5. [M1] Create anomaly_agent.py + wire /api/v1/anomalies route
6. [M4] Build AgentGraph.tsx + update ChatPanel.tsx for agent execution responses
7. [M5] Build AnomalyAlerts.tsx + add species occurrence layer to OceanMap.tsx
8. [M6] Build CrossDomainExplorer.tsx + fill empty chart stubs
9. [All] Integration test: compound cross-domain query end-to-end
10. [M6] PPT deck + video recording (honesty: state what is built vs roadmapped)

---

## 8. Rules Antigravity Must Never Violate

1. NEVER add Ollama as primary LLM path. All generation -> openrouter_client.py.
2. NEVER load SentenceTransformers at server startup — blocks event loop, crashes uvicorn.
3. NEVER remove the SQL sanitizer. SELECT-only enforcement must always be on the execution path.
4. NEVER commit .env files. Use .env.example only.
5. NEVER generate a number in chat without tracing it to a SQL row or ARGO float record.
6. NEVER blend INCOIS + CMLRE data without cross-domain entity resolution step (<=50km, <=7 days window).
7. NEVER use "unique", "first", or "100%" in any output. SIH rubric explicitly penalises these claims.
8. NEVER hardcode API keys. Always use settings.openrouter_api_key from config.py.
9. NEVER break the .glass CSS class. It is the visual foundation of the entire UI.
10. NEVER change the color variables in globals.css without full team decision.

---

## 9. Key Commands

  # Docker (PostgreSQL + Qdrant + Redis — no Ollama)
  docker-compose up -d postgres qdrant redis

  # Backend
  cd backend
  python -m venv venv && venv\Scripts\activate
  pip install -r requirements.txt
  uvicorn main:app --reload --port 8000

  # Frontend
  cd frontend && npm install && npm run dev

  # Seed biodiversity data (after DB up)
  cd backend && python -m src.ingestion.seed_biodiversity

  # Run ARGO ingestion (after placing NetCDF in backend/data/raw/)
  cd backend && python -c "import asyncio; from src.ingestion.pipeline import run_batch; asyncio.run(run_batch('./data/raw'))"

---

*Last updated: 2026-08-15 | Aryan Lomte (M1 Lead) | Deadline: 2026-08-24*
