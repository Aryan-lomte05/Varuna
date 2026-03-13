# FloatChat → OceanMind AI: Complete Production-Grade Redesign

> **Goal**: Transform FloatChat into a world-class AI-powered oceanographic intelligence platform for marine scientists at INCOIS/MoES.

---

## Current Codebase Audit (All 4 Branches)

### What Exists (Good Foundations)
| Branch | What's There |
|---|---|
| [main](file:///e:/floatchatai-main/apps/backend/src/embeddings/build_vectorstore.py#18-32) | FastAPI server, Qwen2.5-3B+LoRA NL→SQL, psycopg2, in-memory sessions, geo utils |
| `Adi_main_api_backend` | Node.js Argo NetCDF ingestion service (cron-based), fintuning data (JSONL) |
| `Adi_semantic` | Qdrant RAG agent, SentenceTransformer embeddings (768d), geospatial query decomposition |
| `FINAL_MAIN` | Full Next.js 14 frontend with 15+ Plotly chart types (Hovmöller, TS-Isopycnals, 3D Surface, Anomaly, WindRose, DepthProfiles, Scatter, TimeSeries), MapCanvas (Leaflet), ChatDock, DiagramGallery |
| `Aditya_ui` | React+Vite float dashboard, TrajectoryMap, ProfileCharts |

### Critical Weaknesses
1. **No real ingestion pipeline** — NetCDF → DB automated flow is broken/incomplete
2. **Chroma vectorstore has only 2 hardcoded docs** — completely useless for RAG
3. **HuggingFace model loading in FastAPI process** — blocks server, can't scale
4. **In-memory `deque` sessions** — lost on restart, no persistence
5. **No PostGIS** — haversine computed in SQL on every query (slow at scale)
6. **Single LLM for all tasks** — SQL gen, narration, reasoning all use same model
7. **No query rewriting, BM25, or re-ranking** — retrieval quality very poor
8. **No telemetry or observability** — can't debug pipeline failures
9. **No feedback loop** — no learning from user corrections
10. **Frontend is stub files** — Adi and Final branches have the real UI, not merged

---

## Proposed New Architecture

```
floatchatai/
├── services/
│   ├── api/                    # Python FastAPI — main backend
│   │   ├── src/
│   │   │   ├── server/         # FastAPI app, routes, WS
│   │   │   ├── rag/            # Full RAG pipeline
│   │   │   │   ├── retriever.py     # Hybrid BM25 + vector
│   │   │   │   ├── reranker.py      # Cross-encoder re-ranking
│   │   │   │   ├── query_rewriter.py
│   │   │   │   ├── context_assembler.py
│   │   │   │   ├── decomposer.py    # Multi-hop decomposition
│   │   │   │   └── generator.py     # Grounded generation
│   │   │   ├── memory/
│   │   │   │   ├── conversation.py  # Redis-backed sessions
│   │   │   │   ├── knowledge_graph.py
│   │   │   │   ├── temporal.py
│   │   │   │   └── feedback.py
│   │   │   ├── models/
│   │   │   │   ├── ollama_client.py # Unified Ollama interface
│   │   │   │   ├── sql_gen.py       # Qwen2.5 → SQL
│   │   │   │   ├── summarizer.py    # Llama3 → scientific prose
│   │   │   │   └── embedder.py      # nomic-embed-text
│   │   │   ├── db/
│   │   │   │   ├── postgres.py      # PostGIS queries
│   │   │   │   ├── qdrant.py        # Vector store ops
│   │   │   │   └── duckdb.py        # Parquet analytics
│   │   │   ├── chains/
│   │   │   │   ├── sql_rag_chain.py # NL→SQL (upgraded)
│   │   │   │   └── rag_chain.py     # Semantic RAG chain
│   │   │   ├── observability/
│   │   │   │   ├── tracer.py        # OpenTelemetry spans
│   │   │   │   ├── logger.py        # Structlog colored logs
│   │   │   │   └── pipeline_log.py  # Per-query trace store
│   │   │   └── ingestion/
│   │   │       ├── netcdf_reader.py
│   │   │       ├── argo_parser.py
│   │   │       └── pipeline.py      # NetCDF → Parquet → PG → Qdrant
│   │   └── requirements.txt
│   │
│   ├── gateway/                # Node.js/Express API gateway
│   │   ├── src/
│   │   │   ├── index.ts        # Express app
│   │   │   ├── ws.ts           # WebSocket server
│   │   │   ├── proxy.ts        # Route to Python services
│   │   │   └── auth.ts         # Session/JWT
│   │   └── package.json
│   │
│   └── ingestion/              # From Adi_main_api_backend (upgraded)
│       ├── index.ts            # Cron job runner
│       ├── argo_fetcher.ts     # Fetch from ftp.ifremer.fr
│       ├── netcdf_parser.ts    # NetCDF → Arrow
│       └── db_loader.ts        # Arrow → PostgreSQL
│
├── apps/
│   └── web/                    # Next.js 14 App Router (merged from FINAL_MAIN)
│       ├── app/
│       │   ├── page.tsx        # Main layout — globe + chat
│       │   ├── floats/[id]/    # Float detail page
│       │   └── explore/        # Dataset browser
│       ├── components/
│       │   ├── Globe/          # Three.js / Cesium 3D globe
│       │   ├── Chat/           # Chat interface (ChatDock upgraded)
│       │   ├── Charts/         # All 15 Plotly chart types from FINAL_MAIN
│       │   ├── Map/            # MapCanvas (Leaflet + Deck.gl)
│       │   ├── DebugPanel/     # RAG pipeline live debugger
│       │   └── Explorer/       # Dataset browser
│       └── package.json
│
├── data/
│   ├── raw/                    # NetCDF files (immutable)
│   ├── processed/              # Parquet files
│   └── embeddings/             # Qdrant snapshots
│
├── docker-compose.yml          # PG+PostGIS, Qdrant, Redis, Ollama
└── README.md
```

---

## RAG Pipeline Architecture

```
User Query
   │
   ▼
┌─────────────────────────────────────────────────┐
│ 1. QUERY UNDERSTANDING                           │
│    • Intent Detection (data/semantic/smalltalk)  │
│    • Query Rewriting (Qwen2.5 via Ollama)        │
│    • Query Expansion (synonyms, ocean terms)     │
│    • Query Decomposition (multi-hop)             │
└────────────────────┬────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         ▼                       ▼
┌─────────────────┐   ┌──────────────────────────┐
│ 2A. SQL PATH    │   │ 2B. SEMANTIC PATH         │
│ NL→SQL via      │   │ Hybrid retrieval:          │
│ Qwen2.5+Ollama  │   │ • BM25 (rank_bm25)        │
│ + schema prompt │   │ • Qdrant vector search     │
│ + few-shots     │   │ • Cross-encoder rerank     │
│ → PostgreSQL    │   │ → Chunk assembly           │
└────────┬────────┘   └──────────┬───────────────┘
         └─────────┬─────────────┘
                   ▼
         ┌──────────────────────┐
         │ 3. CONTEXT ASSEMBLY  │
         │ • Dedup chunks       │
         │ • Compress via LLM   │
         │ • Inject KG facts    │
         │ • Order logically    │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 4. GROUNDED GEN      │
         │ Llama3 via Ollama    │
         │ • Cite sources       │
         │ • No hallucination   │
         │ • Structured output  │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │ 5. RESPONSE + VIZ    │
         │ • markdown prose     │
         │ • SQL shown          │
         │ • chart specs        │
         │ • map points         │
         │ • pipeline trace     │
         └──────────────────────┘
```

---

## Memory Stack (11 Layers)

| # | Layer | Storage | Purpose |
|---|---|---|---|
| 1 | Raw Knowledge | MinIO / local FS | Immutable NetCDF + papers |
| 2 | Processed Knowledge | Parquet + DuckDB | Columnar analytics |
| 3 | Embedding Memory | Qdrant | Vector index of summaries + docs |
| 4 | RAG Working Memory | In-process dict | Context per query |
| 5 | Context Assembly | In-process | Ranked chunk window |
| 6 | Conversation Memory | Redis | Session history (20-turn window) |
| 7 | User Personalization | PostgreSQL | Preferred regions, variables |
| 8 | Feedback Memory | PostgreSQL | User corrections, ratings |
| 9 | Knowledge Graph | Neo4j / NetworkX | Float→Region→Variable links |
| 10 | Temporal Memory | PostgreSQL (time-indexed) | Timestamp-aware recency bias |
| 11 | Forgetting Layer | Redis TTL | Decay stale working context |

---

## Multi-Model System (Ollama)

| Model | Task | When Used |
|---|---|---|
| `qwen2.5:14b` | NL → SQL generation | Every data query |
| `llama3:8b` | Scientific narration + summarization | After SQL results |
| `deepseek-coder:6.7b` | Complex SQL + code generation | BGC/multi-table joins |
| `nomic-embed-text` | Text embeddings (768d) | Ingestion + retrieval |
| `qwen2.5:3b` | Query rewriting + intent detection | Fast, every query |

**All served via Ollama** — no HuggingFace inference in the API process.

---

## Database Schema (PostgreSQL + PostGIS)

```sql
-- Core float metadata
CREATE TABLE floats (
  wmo_id        VARCHAR PRIMARY KEY,
  platform_type VARCHAR,
  deployment_date TIMESTAMP,
  program       VARCHAR,  -- e.g. 'Argo', 'BGC-Argo'
  country       VARCHAR,
  geom          GEOGRAPHY(POINT, 4326)  -- PostGIS
);

-- Time-partitioned measurements (by year)
CREATE TABLE marine_data (
  id             BIGSERIAL,
  platform_number INT4,
  time           TIMESTAMPTZ NOT NULL,
  latitude       DOUBLE PRECISION,
  longitude      DOUBLE PRECISION,
  geom           GEOGRAPHY(POINT, 4326),  -- PostGIS spatial index
  pres           DOUBLE PRECISION,  -- pressure/depth dbar
  temp           DOUBLE PRECISION,
  temp_qc        SMALLINT,
  psal           DOUBLE PRECISION,
  psal_qc        SMALLINT,
  doxy           DOUBLE PRECISION,
  doxy_qc        SMALLINT,
  chla           DOUBLE PRECISION,
  nitrate        DOUBLE PRECISION,
  ph_in_situ_total DOUBLE PRECISION,
  cycle_number   INT4,
  data_mode      CHAR(1)  -- R=real-time, D=delayed-mode
) PARTITION BY RANGE (time);

-- Feedback
CREATE TABLE query_feedback (
  id           BIGSERIAL PRIMARY KEY,
  session_id   VARCHAR,
  query        TEXT,
  sql_generated TEXT,
  rating       SMALLINT,  -- 1-5
  correction   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- User personalization
CREATE TABLE user_preferences (
  user_id     VARCHAR PRIMARY KEY,
  regions     JSONB,   -- preferred ocean regions
  variables   JSONB,   -- preferred variables
  time_range  JSONB
);
```

---

## Query Types that MUST Work

| Category | Example | Handler |
|---|---|---|
| Nearest float | "Nearest ARGO float to Mumbai" | geo→PostGIS ST_DWithin |
| Depth profile | "Depth profile at 19.1, 72.85 on 2025-07-03" | SQL+Plotly |
| Time-window stat | "Max temp Arabian Sea past 30 days" | SQL CTE extrema |
| Multi-variable | "Temp vs Salinity near equator March 2023" | SQL multi-col + TS scatter |
| BGC variables | "Chlorophyll-a trends Bay of Bengal 6 months" | SQL + time series |
| Comparison | "Compare salinity Arabian Sea vs Bay of Bengal" | DuckDB dual query |
| Seasonal | "Monthly avg doxy last 12 months at equator" | SQL GROUP BY month |
| Trend analysis | "Temperature trend in 2022 Indian Ocean" | SQL + regression |
| Float trajectory | "Track float 1902367 over 90 days" | SQL trajectory + map |
| Complex multi-hop | "Compare BGC params in Arabian Sea last 6mo and find nearest floats" | Query decomposition |
| Semantic/fuzzy | "What ocean variables indicate upwelling?" | Qdrant RAG |
| Math | "2+2" | eval() |
| Smalltalk | "Hello" | direct handler |
| Export | "Give me the CSV of this result" | DuckDB COPY |

---

## Frontend Architecture (Next.js 14)

### Panels
```
┌──────────────────────────────────────────────────────┐
│  🌊 FloatChat AI                    [Mode: Research] │
├───────────────┬──────────────────────────────────────┤
│               │                                       │
│  Globe/Map    │        Scientific Charts Panel        │
│  (Three.js +  │  (DepthProfile | Hovmöller | TS-Plot │
│   Deck.gl)    │   | 3DSurface | Anomaly | WindRose)   │
│               │                                       │
├───────────────┴──────────────────────────────────────┤
│  Chat Interface (WebSocket streaming)                 │
│  [Query box] + [Dataset explorer] + [Float selector] │
├──────────────────────────────────────────────────────┤
│  RAG Debug Panel (collapsible)                       │
│  [Intent] [Rewritten Query] [Top-K chunks] [SQL]     │
│  [BM25 scores] [Vector scores] [Rerank scores]       │
└──────────────────────────────────────────────────────┘
```

### Chart Types to Merge from FINAL_MAIN
- `DepthProfilesByMonth.tsx` — classic oceanographic profiles
- `Hovmoller.tsx` — Hovmöller diagrams (depth vs time)
- `TSIsopycnals.tsx` — T-S diagrams with isopycnal overlays
- `Surface3D.tsx` — 3D surface plots of ocean variables
- `AnomalySeries.tsx` — anomaly detection time series
- `WindRose.tsx` — directional statistics
- `CorrelationO2Temp.tsx` — O₂ vs Temperature scatter
- `ChlaNitrateScatter.tsx` — BGC correlations
- `TimeSeries.tsx` — general time series
- `SeasonalBoxplots.tsx` — seasonal variability
- `ObsDensityMap.tsx` — float observation density

---

## Observability System

Every query produces a **structured pipeline trace** logged at each step:

```json
{
  "trace_id": "abc123",
  "query": "Compare salinity ...",
  "intent": "SQL_DATA",
  "rewritten_query": "...",
  "embedding_ms": 45,
  "bm25_results": [{"text": "...", "score": 0.82}],
  "vector_results": [{"id": "...", "score": 0.91}],
  "reranked_top5": [...],
  "sql_generated": "SELECT ...",
  "sql_exec_ms": 120,
  "rows_returned": 45,
  "context_chunks": 8,
  "llm_ms": 890,
  "final_answer_tokens": 312,
  "total_ms": 1200
}
```

Terminal output uses `structlog` with color-coded levels per pipeline stage.

---

## Implementation Roadmap

### Phase 1 — Foundation (Week 1–2)
- [ ] Set up Docker stack: PostgreSQL+PostGIS, Qdrant, Redis, Ollama
- [ ] Install Ollama models: qwen2.5:14b, llama3:8b, deepseek-coder:6.7b, nomic-embed-text
- [ ] Upgrade schema: add PostGIS `geom` column, partitioned tables 2022–2026
- [ ] Write NetCDF → Parquet ingestion pipeline (`services/ingestion/`)
- [ ] Load ARGO Indian Ocean data into PostgreSQL

### Phase 2 — RAG Pipeline (Week 2–3)
- [ ] Replace HuggingFace inference with Ollama HTTP client (`models/ollama_client.py`)
- [ ] Build hybrid retriever: BM25 (rank_bm25) + Qdrant vector search
- [ ] Add cross-encoder reranker (ms-marco-MiniLM via Ollama)
- [ ] Implement query rewriting + intent detection
- [ ] Implement multi-hop decomposition for complex queries
- [ ] Build context assembler with dedup + compression
- [ ] Wire full RAG chain with grounded generation
- [ ] Redis-backed conversation memory (replace in-memory deque)

### Phase 3 — Observability (Week 3)
- [ ] Add structlog colored pipeline logging to all RAG steps
- [ ] OpenTelemetry spans for each pipeline stage
- [ ] Build `/debug` endpoint returning full trace JSON
- [ ] Color-coded terminal output for all 14 pipeline steps

### Phase 4 — Frontend (Week 4)
- [ ] Merge FINAL_MAIN `Desktop/web/` into `apps/web/` as the real frontend
- [ ] Add Three.js interactive globe (`components/Globe/`)
- [ ] Add WebSocket streaming for chat responses
- [ ] Add RAG debug panel (collapsible sidebar)
- [ ] Wire all 15 chart types from DiagramGallery to live data
- [ ] Add float trajectory visualization
- [ ] Add dataset explorer with DuckDB-powered filtering

### Phase 5 — Knowledge Graph + Feedback (Week 5)
- [ ] Build float→region→variable KG using NetworkX
- [ ] User personalization (preferred regions/variables in PostgreSQL)
- [ ] Feedback endpoint: rating + corrections stored and used in retrieval ranking
- [ ] Temporal recency bias in retrieval

### Phase 6 — Polish (Week 6)
- [ ] ARGO data export: CSV / NetCDF / Parquet
- [ ] All edge-case query types tested
- [ ] Load testing
- [ ] Final UI polish (NASA/Palantir aesthetic)

---

## Verification Plan

### Automated Tests (after each phase)
1. **Phase 1**: `psql -c "SELECT COUNT(*) FROM marine_data"` — must be > 0
2. **Phase 2**: `pytest services/api/tests/test_rag.py` — 20 query types must all return valid responses
3. **Phase 3**: `python -m services.api.src.server.observe_test` — pipeline trace JSON must have all 14 fields
4. **Phase 4**: `npm test --prefix apps/web` — all chart components render without errors
5. **Phase 5**: POST `/feedback` endpoint must return 200 and persist to DB

### Manual Tests
- Navigate to `http://localhost:3000`, ask 10 test queries from the table above, verify:
  - SQL path gives table results + chart
  - Semantic path gives cited paragraphs
  - Complex multi-hop decomposes correctly
  - Globe highlights nearest floats
  - Debug panel shows all pipeline steps with scores

> [!IMPORTANT]
> The implementation will **reuse existing code** from all branches rather than rewriting from scratch:
> - Keep `serve.py` FastAPI structure (extend it)
> - Keep all chart components from `FINAL_MAIN` (merging to web/)
> - Keep geo utils from `main` branch
> - Upgrade SQL chain to use Ollama instead of HuggingFace
> - Upgrade vectorstore from Chroma (2 docs) → Qdrant (full corpus)

> [!WARNING]
> **Ollama must be running** before starting the backend. Models ~20GB total disk space required.
> `ollama pull qwen2.5:14b && ollama pull llama3:8b && ollama pull nomic-embed-text`
