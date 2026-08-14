# VARUNA — Cellular-Level Technical Audit & Codebase Inventory

> **Document Status**: Production Readiness & Cellular Codebase Audit  
> **Evaluation Date**: 2026-08-15  
> **Granularity**: Function-, Module-, Schema-, and Component-Level Analysis  

---

## 1. Audit Classification Legend

| Status Icon | Codebase State | Action Required |
|---|---|---|
| 🟢 **KEPT_AS_IS** | Complete, robust, verified working | Keep as is, minimal or no edits required |
| 🟡 **LITTLE_IMPROVEMENT** | Working foundation exists, needs minor upgrades | Minor refinement, typing fix, or styling sync |
| 🟠 **A_LOT_OF_IMPROVEMENT** | Partial or legacy structure, needs major refactor | Significant rewrite to meet VARUNA specs & OpenRouter integration |
| 🔴 **COMPLETELY_NEW** | File does not exist yet | Build from scratch per technical design |
| ⛔ **REMOVED_OR_REPLACED** | Legacy clutter, Docker, or broken local LLM code | Deprecated and purged from production path |

---

## 1.1 🔍 Critical Codebase Flags (High/Heavy Review Items)

```
┌──────────────────────────────────────┬──────────────────────┬────────────────────────────────────────────────────────────────────────┐
│ Flagged Module                       │ Assigned Member      │ Critical Finding & Required Action                                     │
├──────────────────────────────────────┼──────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ src/memory/conversation.py           │ Sahil Shah (M3)      │ [HIGH REVIEW] Top-level `import redis` blocks imports without Redis.   │
│                                      │                      │ Action: Wrap with resilient in-process dictionary fallback.            │
├──────────────────────────────────────┼──────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ src/llm/embedder.py                  │ Sahil Shah (M3)      │ [HIGH REVIEW] MD5 hash fallback produces orthogonal dummy vectors.     │
│                                      │                      │ Action: Wire `openrouter_client.embed_text()` to nomic-embed-text.     │
├──────────────────────────────────────┼──────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ src/chains/sql_rag_chain.py & rag_   │ Sahil Shah (M3)      │ [HEAVY REVIEW] Stale imports from `src.llm.ollama_client`.             │
│ chain.py                             │                      │ Action: Migrate all generation paths to `src.llm.openrouter_client`.   │
├──────────────────────────────────────┼──────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ src/database/postgres.py             │ Aditya Yadav (M2)    │ [HIGH REVIEW] Missing Darwin Core DDL & PostGIS lateral spatial join.  │
│                                      │                      │ Action: Implement `init_biodiversity_schema()` & `correlate_species`.  │
├──────────────────────────────────────┼──────────────────────┼────────────────────────────────────────────────────────────────────────┤
│ src/ingestion/pipeline.py & reader   │ Aditya Yadav (M2)    │ [HEAVY REVIEW] Verify PyArrow dimension slicing & QC bitmasking [1,2,5,8]│
│                                      │                      │ Action: Validate end-to-end against real/mock NetCDF profile arrays.   │
└──────────────────────────────────────┴──────────────────────┴────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Backend Subsystems: Cellular Audit

### 2.1 Agents & Multi-Agent Mesh (`backend/src/agents/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/agents/__init__.py` | 🔴 **COMPLETELY_NEW** | Critical Core | Create package initialization with public agent exports. | Aryan Lomte (M1) |
| `backend/src/agents/orchestrator.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Task DAG Planner Engine**: Build async `plan_query()`, DAG dependency graph builder, topological execution loop, parallel level execution (`asyncio.gather`), and `AgentExecutionTrace` emitter. | Aryan Lomte (M1) |
| `backend/src/agents/anomaly_agent.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Proactive Anomaly Scanner**: Build 6-hr async background worker, Hobday (2016) MHW $P_{90}$ threshold exceedance ($D \ge 5\text{d}$), hypoxia detector ($\text{DOXY} < 60\,\mu\text{mol/kg}$), and `public.anomaly_alerts` upsert. | Aryan Lomte (M1) |
| `backend/src/agents/synthesizer_agent.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Grounded Provenance Synthesizer**: Prompt Nemotron-550B with strict numerical assertion validation. Merges SQL tables, biodiversity matches, and anomaly alerts into cited Markdown. | Aryan Lomte (M1) |
| `backend/src/agents/sql_gen_agent.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **NL→SQL Sub-Agent Wrapper**: Accepts parameter DAG node, fetches schema context from Qdrant `argo_schema`, calls OpenRouter, applies AST sanitizer, and executes against PostgreSQL pool. | Sahil Shah (M3) |
| `backend/src/agents/retrieval_agent.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Hybrid Retrieval Sub-Agent**: Wrapper executing BM25 + Qdrant dense vector search with Reciprocal Rank Fusion across `argo_knowledge` and `bio_knowledge`. | Sahil Shah (M3) |
| `backend/src/agents/biodiversity_agent.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Cross-Domain Entity Resolver**: Calls `postgres.correlate_species_with_ocean()` ($\Delta r \le 50\text{km}, \Delta t \le 7\text{d}$) and formats environmental envelopes. | Aditya Yadav (M2) |

---

### 2.2 LLM & Cognitive Layer (`backend/src/llm/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/llm/openrouter_client.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Primary LLM Client**: Async httpx client to OpenRouter (`nvidia/nemotron-ultra-550b-a55b:free`), retry logic via `tenacity`, token telemetry tracing, and `embed_text()` endpoint. | Sahil Shah (M3) |
| `backend/src/llm/ollama_client.py` | ⛔ **REMOVED_OR_REPLACED** | Offline Fallback Only | Retain strictly as emergency offline mock fallback. Must **never** be imported in primary API paths. | Sahil Shah (M3) |
| `backend/src/llm/sql_gen.py` | 🟢 **KEPT_AS_IS** | Supporting | **Rule-Based Fallback Generator**: Deterministic SQL generator for common ARGO float queries (equator salinity, BGC last 6mo, Mumbai nearest floats). Keep as safety net. | Sahil Shah (M3) |
| `backend/src/llm/embedder.py` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **Text Embedder**: Upgrade `embed_texts()` to route through OpenRouter embedding API as primary path; keep MD5 deterministic hash vectorizer strictly for zero-network testing. | Sahil Shah (M3) |
| `backend/src/llm/summarizer.py` | 🟡 **LITTLE_IMPROVEMENT** | Supporting | Scientific prose summarizer. Refactor to invoke `openrouter_client.chat_complete()` with `task_tag="summarize"`. | Sahil Shah (M3) |

---

### 2.3 API Gateway & Routing (`backend/src/api/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/api/app.py` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | FastAPI application factory, CORS origins, lifespan startup handler (initialize DB tables + start anomaly background loop), and global exception handler. | Aryan Lomte (M1) |
| `backend/src/api/routes.py` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **API Route Registry**: Add `/api/v1/agent/chat` (multi-agent DAG), `/api/v1/anomalies` (MHW feed), `/api/v1/biodiversity` (CMLRE species), and `/api/v1/correlate` (spatial join). Retain single-shot `/chat` for backwards compatibility. | Aryan Lomte (M1) |
| `backend/src/api/ws.py` | 🟢 **KEPT_AS_IS** | Critical Core | **WebSocket Streaming**: Token-by-token streaming endpoint for interactive chat. Fully functional and resilient. | Aryan Lomte (M1) |

---

### 2.4 Database & Ingestion Layer (`backend/src/database/` & `ingestion/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/database/postgres.py` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **PostgreSQL + PostGIS**: Add `init_biodiversity_schema()` (Darwin Core table DDL + GIST indexes), `init_anomaly_schema()`, and optimized lateral join `correlate_species_with_ocean()`. Connection pool is already solid. | Aditya Yadav (M2) |
| `backend/src/database/qdrant.py` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | **Qdrant Vector Engine**: Extend collection initialization to manage 3 namespaces: `argo_knowledge`, `argo_schema`, and `bio_knowledge`. | Sahil Shah (M3) |
| `backend/src/database/duckdb_client.py` | 🟢 **KEPT_AS_IS** | Supporting | **DuckDB Analytics Engine**: Zero-copy Parquet queries and CSV/JSON export formatting. Fully functional. | Aditya Yadav (M2) |
| `backend/src/ingestion/netcdf_reader.py` | 🟢 **KEPT_AS_IS** | Critical Core | **Vectorized NetCDF-4 Reader**: High-speed PyArrow extraction of ARGO vertical levels, JULD epoch translation, and QC filtering `[1, 2, 5, 8]`. | Aditya Yadav (M2) |
| `backend/src/ingestion/pipeline.py` | 🟢 **KEPT_AS_IS** | Critical Core | **Batch Ingestion Pipeline**: Ingests NetCDF files, saves immutable Parquet archives, and executes PostgreSQL `COPY` buffer. | Aditya Yadav (M2) |
| `backend/src/ingestion/seed_biodiversity.py` | 🔴 **COMPLETELY_NEW** | Critical Core | **Darwin Core Seeder**: Script populating 500+ Indian Ocean marine living resource occurrences (*Sardinella*, *Rastrelliger*, *Acropora*, *Thunnus*, *Dugong*) with accurate coordinate envelopes. | Aditya Yadav (M2) |

---

### 2.5 Chains, RAG & Memory (`backend/src/chains/`, `rag/`, `memory/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/chains/sql_rag_chain.py` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | Refactor imports and generation calls from `ollama_client` to `openrouter_client`. | Sahil Shah (M3) |
| `backend/src/chains/rag_chain.py` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | Same — swap `ollama_client` calls for OpenRouter completions. | Sahil Shah (M3) |
| `backend/src/rag/retriever.py` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | Hybrid BM25 + dense vector retriever. Verified working; ensure seamless integration with `bio_knowledge` collection. | Sahil Shah (M3) |
| `backend/src/rag/context_assembler.py`| 🟢 **KEPT_AS_IS** | Supporting | Deduplicates and formats retrieved chunks. | Sahil Shah (M3) |
| `backend/src/rag/decomposer.py` | 🟢 **KEPT_AS_IS** | Supporting | Legacy multi-hop query decomposer. Retained as fallback for single-shot chain. | Sahil Shah (M3) |
| `backend/src/rag/query_rewriter.py` | 🟢 **KEPT_AS_IS** | Supporting | Fast intent detection and ocean synonym expansion. | Sahil Shah (M3) |
| `backend/src/rag/reranker.py` | 🟢 **KEPT_AS_IS** | Supporting | Cross-encoder re-ranking module. | Sahil Shah (M3) |
| `backend/src/memory/conversation.py` | 🟢 **KEPT_AS_IS** | Critical Core | Redis session memory with graceful in-process dictionary fallback. | Sahil Shah (M3) |
| `backend/src/memory/feedback.py` | 🟢 **KEPT_AS_IS** | Supporting | Persists user ratings and query corrections to DB. | Sahil Shah (M3) |
| `backend/src/memory/knowledge_graph.py`| 🟢 **KEPT_AS_IS** | Supporting | NetworkX graph connecting Floats $\to$ Ocean Basins $\to$ Variables. | Sahil Shah (M3) |
| `backend/src/memory/personalization.py`| 🟢 **KEPT_AS_IS** | Supporting | User preference persistence (favorite basins/variables). | Sahil Shah (M3) |
| `backend/src/memory/temporal.py` | 🟢 **KEPT_AS_IS** | Supporting | Timestamp recency decay weighting. | Sahil Shah (M3) |

---

### 2.6 Utilities & Observability (`backend/src/utils/` & `observability/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `backend/src/utils/geo.py` | 🟢 **KEPT_AS_IS** | Critical Core | Indian Ocean bounding box definitions, city lookups (Mumbai, Kochi, Goa, Chennai), and coast classifier. | Aditya Yadav (M2) |
| `backend/src/utils/sql_extract.py` | 🟢 **KEPT_AS_IS** | Critical Core | AST & regex SQL extractor ensuring `SELECT`-only constraints. | Sahil Shah (M3) |
| `backend/src/utils/viz_builder.py` | 🟢 **KEPT_AS_IS** | Critical Core | Inspects returned SQL column headers and generates Plotly / Deck.gl chart specs. | Kanishka Sahal (M6) |
| `backend/src/utils/export_service.py`| 🟢 **KEPT_AS_IS** | Supporting | CSV and JSON export formatter. | Aditya Yadav (M2) |
| `backend/src/mcp/mcp_server.py` | 🟢 **KEPT_AS_IS** | Supporting | Model Context Protocol tool provider. | Aryan Lomte (M1) |
| `backend/src/observability/logger.py`| 🟢 **KEPT_AS_IS** | Critical Core | `structlog` color-coded pipeline span logging. | Aryan Lomte (M1) |
| `backend/src/observability/pipeline_log.py`| 🟢 **KEPT_AS_IS** | Critical Core | Trace ID storage and debug retrieval endpoint `/api/v1/debug/{trace_id}`. | Aryan Lomte (M1) |
| `backend/src/config.py` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | Update default `openrouter_model` to `nvidia/nemotron-ultra-550b-a55b:free` and remove Ollama defaults. | Sahil Shah (M3) |

---

## 3. Frontend Subsystems: Cellular Audit

### 3.1 App Shell, Navigation & HUD (`frontend/app/` & `components/ui/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `frontend/app/page.tsx` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **Main Command Center Shell**: Rebrand header to VARUNA, wire 4 operational view modes (`MAP`, `ANALYSIS`, `ALERTS`, `BIODIVERSITY`), wire floating HUDs, and connect telemetry bars. | Advay Chavan (M4) |
| `frontend/app/layout.tsx` | 🟢 **KEPT_AS_IS** | Critical Core | HTML root metadata, Geist Mono & Inter font loading, dark theme baseline. | Advay Chavan (M4) |
| `frontend/app/globals.css` | 🟢 **KEPT_AS_IS** | Critical Core | **Design System Tokens**: Liquid glass (`.glass`, `.glass-strong`), midnight water `#071A2D`, tropical aqua `#2EE6C6`, bioluminescent glow `#00FFC6`, coral orange `#FF7F50`. Perfect as is. | Advay Chavan (M4) |
| `frontend/components/ui/DockNav.tsx` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | **Spring-Physics Dock Navigation**: Add view triggers for `ALERTS` (bell icon) and `BIODIVERSITY` (leaf/coral icon). | Advay Chavan (M4) |
| `frontend/components/ui/DataStatusBar.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Kinetic marquee telemetry bar displaying live fleet sync, active floats, and system latency. | Advay Chavan (M4) |
| `frontend/components/Globe/OceanGlobe.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Three.js WebGL 3D Globe with bathymetry and float points. Fully functional. | Advay Chavan (M4) |
| `frontend/components/DebugPanel/` | 🟢 **KEPT_AS_IS** | Supporting | Collapsible RAG & Agent trace inspector for developers and judges. | Advay Chavan (M4) |

---

### 3.2 Chat & Multi-Agent Interface (`frontend/components/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `frontend/components/ChatPanel.tsx` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **Ocean Copilot HUD**: Add Agentic Mode toggle, render live `AgentGraph.tsx` DAG tree for multi-step responses, syntax-highlighted SQL drawer with copy/run, and starter prompt bento grid. | Advay Chavan (M4) |
| `frontend/components/AgentGraph.tsx` | 🔴 **COMPLETELY_NEW** | Critical Core | **Live Task DAG Visualizer**: Framer Motion animated node graph displaying Planner, sub-agent dispatches, parallel execution timings, and completion checkmarks. | Advay Chavan (M4) |
| `frontend/hooks/useChatStream.ts` | 🟡 **LITTLE_IMPROVEMENT** | Critical Core | WebSocket streaming hook. Extend response state interface to parse `agent_trace` payloads. | Advay Chavan (M4) |

---

### 3.3 Geospatial Situational Canvas (`frontend/components/` & `Map/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `frontend/components/OceanMap.tsx` | 🟠 **A_LOT_OF_IMPROVEMENT** | Critical Core | **Deck.gl WebGL Canvas**: Add vertical depth slider ($0-2000\text{m}$), toggleable CMLRE species observation layer, and MHW thermal anomaly raster overlay. | Netal Gupta (M5) |
| `frontend/components/AnomalyAlerts.tsx` | 🔴 **COMPLETELY_NEW** | Critical Core | **Proactive Early-Warning Room**: Card feed of active Marine Heatwaves, Hobday climatology curves, vulnerable species impact badges, and 1-click fisheries advisory exports. | Netal Gupta (M5) |
| `frontend/components/Map/FloatMap.tsx` | 🟢 **KEPT_AS_IS** | Supporting | Individual float marker popup inspector. | Netal Gupta (M5) |
| `frontend/components/Map/TrajectoryLayer.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Deck.gl `PathLayer` rendering 90-day float drift vectors with gradient depth coloring. | Netal Gupta (M5) |

---

### 3.4 Oceanographic Analytics & Cross-Domain Hub (`frontend/components/` & `Charts/`)

| File / Component | Status | Relevance | Assessment & Cellular Action | Owner |
|---|---|---|---|---|
| `frontend/components/CrossDomainExplorer.tsx`| 🔴 **COMPLETELY_NEW** | Critical Core | **INCOIS ↔ CMLRE Explorer**: Species selector, environmental thermal tolerance envelope ($22-26^\circ\text{C}$ vs observed $29.2^\circ\text{C}$), correlated float observation ledger, and AI diagnosis. | Kanishka Sahal (M6) |
| `frontend/components/AnalysisHub.tsx` | 🟢 **KEPT_AS_IS** | Critical Core | 15+ chart laboratory layout with tabbed oceanographic view selectors. | Kanishka Sahal (M6) |
| `frontend/components/Charts/TSIsopycnals.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | T-S diagram with background UNESCO potential density $\sigma_\theta$ isopycnal curves. | Kanishka Sahal (M6) |
| `frontend/components/Charts/HovmollerDiagram.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Depth-time Hovmöller contour diagram ($0-2000\text{m}$ inverted y-axis). | Kanishka Sahal (M6) |
| `frontend/components/Charts/DepthProfile.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Vertical depth casts ($T, S, \text{DOXY}, \text{CHLA}$ vs Depth). | Kanishka Sahal (M6) |
| `frontend/components/Charts/Surface3D.tsx` | 🟢 **KEPT_AS_IS** | Critical Core | 3D WebGL bathymetric surface mesh. | Kanishka Sahal (M6) |
| `frontend/components/Charts/AnomalySeries.tsx`| 🟢 **KEPT_AS_IS** | Critical Core | Temperature/Salinity anomaly time series with baseline deviations. | Kanishka Sahal (M6) |
| `frontend/components/Charts/ChlaNitrateScatter.tsx`| 🟢 **KEPT_AS_IS** | Supporting | Chlorophyll-a vs Nitrate nutrient scatter with Redfield ratio ($N:P = 16:1$). | Kanishka Sahal (M6) |
| `frontend/components/Charts/O2TempCorrelation.tsx`| 🟢 **KEPT_AS_IS** | Supporting | Dissolved oxygen vs temperature correlation scatter. | Kanishka Sahal (M6) |
| `frontend/components/Charts/SeasonalBoxplots.tsx`| 🟢 **KEPT_AS_IS** | Supporting | Monthly distribution boxplots of ocean parameters. | Kanishka Sahal (M6) |
| `frontend/components/Charts/TimeSeries.tsx` | 🟢 **KEPT_AS_IS** | Supporting | Multi-variable temporal line charts. | Kanishka Sahal (M6) |
| `frontend/components/Charts/WindRose.tsx` | 🟢 **KEPT_AS_IS** | Supporting | Monsoon wind & surface current directional polar histogram. | Kanishka Sahal (M6) |
| `frontend/components/Charts/FloatTrajectoryChart.tsx`| 🟢 **KEPT_AS_IS** | Supporting | 2D latitude vs longitude drift track chart. | Kanishka Sahal (M6) |
| `frontend/components/Charts/CrossCorrelogram.tsx`| 🔴 **COMPLETELY_NEW (STUB)** | Supporting | Fill empty stub with $5\times 5$ correlation matrix heatmap of $[T, S, \text{DOXY}, \text{CHLA}, \text{NITRATE}]$. | Kanishka Sahal (M6) |
| `frontend/components/Charts/ObsDensityMap.tsx`| 🔴 **COMPLETELY_NEW (STUB)** | Supporting | Fill empty stub with observation density grid heatmap. | Kanishka Sahal (M6) |
| `frontend/components/Charts/ProfileCount.tsx` | 🔴 **COMPLETELY_NEW (STUB)** | Supporting | Fill empty stub with monthly profile count bar chart. | Kanishka Sahal (M6) |
| `frontend/components/Charts/QCHistogram.tsx` | 🔴 **COMPLETELY_NEW (STUB)** | Supporting | Fill empty stub with sensor QC flag distribution histogram ($1..9$). | Kanishka Sahal (M6) |
