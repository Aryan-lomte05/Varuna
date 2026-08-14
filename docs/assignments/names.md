# VARUNA — Team Assignments & Task Ownership
**Names.md** — Every task, every responsibility, every member. This is the ground truth.

---

## Team Members

| # | Name | Role | Expertise |
|---|---|---|---|
| M1 | Aryan Lomte (Lead) | AI, Backend, System Architecture | Agentic orchestrator, anomaly agent, API design |
| M2 | Aditya Yadav | Backend, Ingestion, Auth/Security | Ingestion pipeline, biodiversity seeding, DB schema |
| M3 | Sahil Shah | Backend AI, LLM/RAG Integration | OpenRouter client, NL->SQL chains, RAG pipeline, memory |
| M4 | Advay Chavan | Frontend Full-Stack | Dashboard, Chat UI, Agent Graph, Globe |
| M5 | Netal Gupta | Frontend, Maps, Visualization | Alert Map, Anomaly Feed, OceanMap species layer |
| M6 | Kanishka Sahal | Frontend, Charts, Presentation | CrossDomainExplorer, chart stubs, PPT, video |

---

## M1 — Aryan Lomte (Lead)

### Assigned Files
- backend/src/agents/orchestrator.py (CREATE)
- backend/src/agents/anomaly_agent.py (CREATE)
- backend/src/agents/synthesizer_agent.py (CREATE)
- backend/src/api/routes.py (EXTEND — add /agent/chat, /anomalies, /correlate)
- backend/src/api/app.py (MAINTAIN)
- backend/src/database/postgres.py (REVIEW schema changes from M2)
- docker-compose.yml (REMOVE Ollama service)
- VARUNA.md (MAINTAIN — update when architecture changes)

### Tasks

#### Phase 1 — Core Agent Architecture (Days 1-2)
- [ ] Create ackend/src/agents/ directory with __init__.py
- [ ] Implement orchestrator.py:
  - sync def plan_query(query: str, history: list) -> ExecutionPlan
  - Calls OpenRouter Nemotron with a task-decomposition prompt
  - Returns JSON ExecutionPlan (list of tasks with agent, params, deps)
  - Dispatches tasks in DAG order, respecting dependencies
  - Returns merged result dict from all sub-agent outputs
- [ ] Implement synthesizer_agent.py:
  - Receives results from SQL_GEN + BIODIVERSITY sub-agents
  - Calls OpenRouter to write a cohesive cited Markdown answer
  - Ensures every numeric claim has a traceable source
- [ ] Add /api/v1/agent/chat route in routes.py:
  - Accepts same ChatIn model as /chat
  - Calls orchestrator.plan_query() instead of single-shot chain
  - Returns ChatOut with additional gent_trace field (list of sub-agent steps)

#### Phase 2 — Anomaly Agent (Day 3)
- [ ] Implement nomaly_agent.py:
  - Background function sync def scan_for_anomalies() called on FastAPI startup
  - Queries marine_data for last 35 days of SST per 2x2 degree grid cell
  - Calculates rolling 30-day mean and std dev
  - Flags cells where current SST > mean + 2*std for 5+ consecutive days (MHW threshold)
  - Flags cells where doxy < 60 umol/kg (hypoxia threshold)
  - Writes alerts to anomaly_alerts table (INSERT ... ON CONFLICT DO UPDATE)
  - Runs every 6 hours via asyncio.sleep loop
- [ ] Add /api/v1/anomalies GET route:
  - Returns active anomaly_alerts records as JSON
  - Query params: basin (arabian_sea|bay_of_bengal|etc), severity, limit
- [ ] Wire anomaly scanner to FastAPI lifespan startup event in app.py

#### Phase 3 — Integration & Testing (Days 4-5)
- [ ] Integration test: POST /api/v1/agent/chat with compound query
  "Compare BGC parameters in Arabian Sea last 6 months vs equator, show affected species"
  Must return: answer_md, sql, agent_trace with 3+ sub-agent steps
- [ ] Test /api/v1/anomalies returns valid JSON with severity and ocean_basin fields
- [ ] Review all M2, M3 PRs for architectural boundary compliance

---

## M2 — Aditya Yadav

### Assigned Files
- backend/src/database/postgres.py (EXTEND)
- backend/src/ingestion/seed_biodiversity.py (CREATE)
- backend/src/ingestion/pipeline.py (MAINTAIN)
- backend/src/ingestion/netcdf_reader.py (MAINTAIN)
- docker-compose.yml (MAINTAIN database services)
- backend/requirements.txt (ADD new deps as needed)
- backend/main.py (MAINTAIN startup)

### Tasks

#### Phase 1 — marine_biodiversity Schema (Day 1-2)
- [ ] Add init_biodiversity_schema() function to postgres.py:
  - Creates marine_biodiversity table (Darwin Core schema — see VARUNA.md section 2.3)
  - Creates PostGIS geometry column + spatial index (GIST on geom)
  - Creates B-tree index on (scientific_name, event_date, ocean_basin)
  - Called from main.py startup init_db()
- [ ] Add get_species_near_float(lat, lon, radius_km, date, days_window) to postgres.py:
  - PostGIS ST_DWithin spatial query on marine_biodiversity
  - Returns species name, individual_count, event_date, distance_km
- [ ] Add correlate_species_with_ocean(species_name, days=90) to postgres.py:
  - Finds all occurrences of the species in marine_biodiversity
  - For each occurrence, finds nearest ARGO float profiles within 50km and 7 days
  - Returns correlated rows: [occurrence_id, scientific_name, lat, lon, date, float_platform_number, temp, psal, doxy, chla]

#### Phase 2 — Seed Biodiversity Data (Day 2-3)
- [ ] Create ackend/src/ingestion/seed_biodiversity.py:
  - Seeds 500+ realistic Indian Ocean marine species occurrence records
  - Species to include:
    - Sardinella longiceps (Indian Oil Sardine) — Arabian Sea + Malabar Coast
    - Rastrelliger kanagurta (Indian Mackerel) — Bay of Bengal + Lakshadweep
    - Acropora millepora (Staghorn Coral) — Gulf of Mannar + Andaman Islands
    - Thunnus albacares (Yellowfin Tuna) — Indian Ocean wide
    - Trichodesmium erythraeum (phytoplankton) — surface blooms
    - Noctiluca scintillans (bioluminescent dinoflagellate)
    - Penaeus monodon (Giant Tiger Prawn) — coastal
    - Dugong dugon (Dugong) — Gulf of Mannar seagrass beds
    - Chelonia mydas (Green Sea Turtle) — Lakshadweep + Andaman
    - Physeter macrocephalus (Sperm Whale) — deep Arabian Sea
  - Occurrences should span 2020-2025 with realistic lat/lon ranges
  - Assign ocean_basin based on location:
    arabian_sea: lon 45-77, lat 5-25
    bay_of_bengal: lon 75-100, lat 5-25
    gulf_of_mannar: lon 78-82, lat 8-12
    andaman_sea: lon 92-100, lat 8-16
  - Uses UPSERT (ON CONFLICT on occurrence_id DO UPDATE)
  - Prints progress: "Seeded N/total records..."

#### Phase 3 — Auth & Security (Day 4-5)
- [ ] Add simple API key authentication to routes.py:
  - Header X-VARUNA-Key validated against settings.api_key
  - Only on non-health-check routes (skip /health, /docs)
  - Return 401 if missing or wrong
- [ ] Add rate limiting in app.py using slowapi or simple per-IP counter
- [ ] Ensure docker-compose.yml has Ollama service removed and all other services healthy

---

## M3 — Sahil Shah

### Assigned Files
- backend/src/llm/openrouter_client.py (CREATE — PRIORITY #1)
- backend/src/llm/embedder.py (UPDATE)
- backend/src/chains/sql_rag_chain.py (UPDATE)
- backend/src/chains/rag_chain.py (UPDATE)
- backend/src/rag/ (MAINTAIN all files)
- backend/src/memory/ (MAINTAIN all files)
- backend/src/config.py (UPDATE model name)

### Tasks

#### Phase 1 — OpenRouter Client (Day 1 — BLOCKS EVERYTHING ELSE)
- [ ] Create ackend/src/llm/openrouter_client.py:
  - Async HTTP client using httpx to OpenRouter API
  - sync def chat_complete(messages: list[dict], temperature: float = 0.2, max_tokens: int = 4096, task_tag: str = "general") -> str
  - Uses settings.openrouter_api_key and settings.openrouter_model
  - Sets HTTP-Referer: https://varuna.incois.gov.in (or localhost for dev)
  - Sets X-Title: VARUNA Marine Intelligence
  - Handles rate limit errors (429) with exponential backoff via tenacity
  - Logs every call with task_tag, tokens used, latency_ms
  - sync def embed_text(texts: list[str]) -> list[list[float]]
  - Uses settings.openrouter_embed_model for embeddings
- [ ] Update ackend/src/config.py:
  - Change openrouter_model default to nvidia/nemotron-ultra-550b-a55b:free
  - Add openrouter_embed_model field (default: nomic-ai/nomic-embed-text-v1.5:free)
  - Rename: ollama_* fields stay but add prefix comment "OFFLINE FALLBACK ONLY"

#### Phase 2 — Update Chains (Day 2)
- [ ] Update ackend/src/chains/sql_rag_chain.py:
  - Replace rom src.llm.ollama_client import generate_sql, narrate_results
  - With rom src.llm.openrouter_client import chat_complete
  - Rewrite generate_sql as: chat_complete(messages=[system+user], task_tag="sql_gen")
  - Rewrite narrate_results as: chat_complete(messages=[system+user], task_tag="narrate")
- [ ] Update ackend/src/chains/rag_chain.py:
  - Same Ollama -> OpenRouter swap
- [ ] Update ackend/src/llm/embedder.py:
  - Primary: call openrouter_client.embed_text()
  - Fallback: MD5 hash vectors (keep as emergency only)

#### Phase 3 — RAG & Memory (Days 3-5)
- [ ] Ensure src/rag/retriever.py uses the updated embedder
- [ ] Ensure src/memory/conversation.py Redis fallback is robust
  - On Redis connection failure, use an in-process dict keyed by session_id
  - Log a WARNING (not error) when falling back to in-memory
- [ ] Implement src/agents/sql_gen_agent.py (sub-agent for orchestrator):
  - Takes: query, schema_context, history
  - Calls openrouter_client for SQL generation
  - Runs through SQL sanitizer + PostgreSQL executor
  - Returns: {sql, rows, viz_specs}
- [ ] Implement src/agents/retrieval_agent.py (sub-agent for orchestrator):
  - Takes: query
  - Calls hybrid retriever (BM25 + Qdrant)
  - Returns: {chunks, sources}
- [ ] Implement src/agents/biodiversity_agent.py (sub-agent for orchestrator):
  - Takes: query, lat, lon (extracted from SQL result or query)
  - Calls postgres.get_species_near_float() and postgres.correlate_species_with_ocean()
  - Returns: {species, correlated_ocean_params}

---

## M4 — Advay Chavan

### Assigned Files
- frontend/app/page.tsx (EXTEND — VARUNA rebrand + tabs)
- frontend/components/ChatPanel.tsx (EXTEND — agent mode)
- frontend/components/AgentGraph.tsx (CREATE)
- frontend/components/Globe/OceanGlobe.tsx (MAINTAIN)
- frontend/components/DebugPanel/ (MAINTAIN)
- frontend/app/layout.tsx (MAINTAIN)

### Tasks

#### Phase 1 — VARUNA Rebrand + Navigation (Day 1)
- [ ] Update pp/page.tsx:
  - Change branding: FLOAT_CHAT.v2 -> VARUNA | INCOIS x CMLRE
  - Change subtitle: "Ocean Intelligence Core" -> "Marine Ecosystem Intelligence"
  - Add 2 new tab items to DockNav: "ALERTS" (bell icon) and "BIODIVERSITY" (leaf icon)
  - Add tab state handling for ALERTS and BIODIVERSITY views
  - Render AnomalyAlerts component when activeView === "ALERTS"
  - Render CrossDomainExplorer component when activeView === "BIODIVERSITY"

#### Phase 2 — Agent Graph Component (Days 2-3)
- [ ] Create rontend/components/AgentGraph.tsx:
  - Props: gentTrace: AgentStep[] where AgentStep = { agent: string, status: "pending"|"running"|"done"|"error", duration_ms?: number, result_preview?: string }
  - Renders a horizontal or vertical DAG visualization:
    - Planner node (top) -> child nodes (SQL_GEN, RETRIEVAL, BIODIVERSITY) -> Synthesizer node (bottom)
    - Each node has a color-coded status ring: pending=gray, running=accent pulse, done=accent, error=coral
    - Running nodes show a spinning accent ring animation
    - Done nodes show a checkmark
    - Duration shown below done nodes (e.g. "142ms")
  - Animates with Framer Motion stagger (each node appears 100ms apart)
  - Hidden when agentTrace is empty

#### Phase 3 — ChatPanel Agent Mode (Days 3-4)
- [ ] Extend ChatPanel.tsx to handle agent responses:
  - Add agentMode toggle (icon button near input: "Standard" vs "Agent" mode)
  - In Agent mode: POST to /api/v1/agent/chat instead of /api/v1/chat
  - When response comes back with agent_trace, render AgentGraph component below the message
  - Show agent step summary inline (e.g. "3 agents | SQL + Biodiversity | 1.2s total")
  - Agent responses have a distinct message style: accent-colored left border + "VARUNA Agent" badge
  - Keep all existing single-shot mode functionality unchanged

---

## M5 — Netal Gupta

### Assigned Files
- frontend/components/OceanMap.tsx (EXTEND — species layer)
- frontend/components/AnomalyAlerts.tsx (CREATE)
- frontend/components/Map/FloatMap.tsx (MAINTAIN)
- frontend/components/Map/TrajectoryLayer.tsx (MAINTAIN)

### Tasks

#### Phase 1 — AnomalyAlerts Component (Days 1-3)
- [ ] Create rontend/components/AnomalyAlerts.tsx:
  - Fetches from GET /api/v1/anomalies on mount and every 5 minutes
  - Renders a scrollable card feed, one card per alert
  - Card structure:
    - Top row: severity badge (CRITICAL=coral, HIGH=orange, MODERATE=yellow, LOW=blue-gray) + pulsing dot if active
    - Alert type label (MARINE HEATWAVE / HYPOXIA / ALGAL BLOOM)
    - Ocean basin name (Arabian Sea, Bay of Bengal, etc.)
    - Key metric: e.g. "SST anomaly: +3.2°C above 30-yr baseline"
    - Detected timestamp
    - "Affected Species" section if the alert overlaps with known species habitats:
      e.g. "Sardinella longiceps habitat at risk — warming exceeds thermal tolerance"
    - Small mini-map snippet showing the affected lat/lon bounding box (Leaflet or static SVG)
  - Empty state: "No active marine anomalies detected — all basins nominal" with a calm ocean wave icon
  - Loading skeleton: 3 card-shaped skeleton loaders
  - Uses .glass-strong class for cards

#### Phase 2 — Species Occurrence Layer on OceanMap (Days 3-5)
- [ ] Extend OceanMap.tsx to add a toggle for biodiversity layer:
  - Add a small floating toggle button: "Species" with a fish icon
  - When toggled on: fetch GET /api/v1/biodiversity?basin=all&limit=500
  - Render a Deck.gl ScatterplotLayer for species occurrences:
    - Different color per species group (coral=pink, fish=teal, marine mammal=blue, phytoplankton=green)
    - Radius scaled by individual_count (min 4, max 20 pixels)
    - Tooltip on hover: scientific_name, individual_count, event_date, ocean_basin
  - Layer sits above the ARGO float layer with slight transparency
- [ ] Ensure existing ARGO float ScatterplotLayer still works correctly

---

## M6 — Kanishka Sahal

### Assigned Files
- frontend/components/CrossDomainExplorer.tsx (CREATE)
- frontend/components/Charts/ (FILL STUBS + MAINTAIN)
- docs/ (MAINTAIN all docs)
- PPT deck (CREATE)
- Video narration (CREATE)

### Tasks

#### Phase 1 — CrossDomainExplorer (Days 1-3)
- [ ] Create rontend/components/CrossDomainExplorer.tsx:
  - Header: "INCOIS x CMLRE — National Marine Data Backbone"
  - Left panel: Species selector (dropdown of key Indian Ocean species)
    When a species is selected, fetch GET /api/v1/correlate?species=Sardinella+longiceps
  - Right panel: Split view:
    - Top: Plotly time series of ocean parameters (temp, doxy) at correlated float positions
    - Bottom: Data table of correlated records (species occurrence + nearest float data)
  - Bottom: Contextual insight (OpenRouter-generated, 2-3 sentences): e.g.
    "Sardine observations cluster in 22-26°C water. The April 2026 marine heatwave pushed surface
    temperatures above 29°C in their core habitat, consistent with documented range shifts."
  - Data source badges: "OBIS (CMLRE stand-in)" and "INCOIS ARGO"
  - Honest PoC note: small footnote "Demonstrating with OBIS/GBIF public records.
    Architected for CMLRE production data schema."

#### Phase 2 — Fill Empty Chart Stubs (Days 3-4)
- [ ] Fill CrossCorrelogram.tsx:
  - Plotly heatmap (z=correlation matrix of temp, psal, doxy, chla, nitrate)
  - Data from SQL query correlating variable pairs
- [ ] Fill ObsDensityMap.tsx:
  - Plotly density_mapbox of observation count per 1x1 degree grid cell
- [ ] Fill ProfileCount.tsx:
  - Plotly bar chart of profiles per month
- [ ] Fill QCHistogram.tsx:
  - Plotly histogram of QC flag distribution (0-9) per variable

#### Phase 3 — PPT Deck (Days 4-5, concurrent)
Follow the exact narrative from VARUNA_Final_PS_Master_Guide.md Section 10.
  - Slide 1: PS title, Team Ctrl Alt Defeat, PS IDs 25040+25041
  - Slide 2: Problem — open with governance-gap quote, marine heatwave stats, 30M livelihoods
  - Slide 3: Literature — OceanIQ (respectful, specific gaps), OBIS/GBIF, Darwin Core
  - Slide 4: Idea — architecture diagram (Planner -> sub-agents -> Synthesizer + Anomaly Agent)
  - Slide 5: Tech Stack — grouped by layer (data, agents, frontend)
  - Slide 6: Innovation — lead with Anomaly Agent, then agentic planning, then cross-domain fusion
  - Slide 7: Feasibility — explicit PoC scope (what built vs roadmapped), datasets used
  - Slide 8: References — all 11 sources from Master Guide Section 9
  - Slide 9: Team — Member 1-6 only, no names, role + contribution per member

Video (5-7 min) — follow Master Guide Section 11 narrative beats exactly.
NO: faces, names, college/mentor mentions.
YES: screen recording demo, architecture diagram walkthrough, anomaly alert demo.

---

## Shared Responsibilities

- All members: review each other's PRs before merge (1 review minimum)
- M1 Aryan: overall integration, daily standup lead, architecture sign-off
- M2+M3: backend integration tests (compound query must work E2E)
- M4+M5+M6: frontend integration (all new components must work in prod build, npm run build must pass)

---

## Milestone Checklist (Day-by-Day, 15-24 Aug)

Day 1 (Aug 15):  M3: openrouter_client.py done. M1: agents/ dir + orchestrator skeleton. M2: marine_biodiversity schema.
Day 2 (Aug 16):  M3: chains updated. M2: seed_biodiversity.py. M4: VARUNA rebrand + new tabs.
Day 3 (Aug 17):  M1: anomaly_agent.py done. M5: AnomalyAlerts.tsx skeleton. M3: sub-agents (sql_gen, retrieval, biodiversity).
Day 4 (Aug 18):  M4: AgentGraph.tsx done. M5: species layer on map. M6: CrossDomainExplorer.tsx.
Day 5 (Aug 19):  Full backend integration test. Frontend npm run build must pass.
Day 6 (Aug 20):  Bug fixes. M6: fill chart stubs.
Day 7 (Aug 21):  End-to-end demo: compound cross-domain query working.
Day 8 (Aug 22):  M6: PPT deck complete. M1: review all code for quality.
Day 9 (Aug 23):  M6: video recording. Final polish. All tests pass.
Day 10 (Aug 24): HACKATHON STARTS. Present VARUNA.
