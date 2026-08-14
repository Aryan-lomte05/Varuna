# VARUNA — Development Rules & Local Setup

## 1. Local Development Setup

### Prerequisites
  Docker Desktop (for PostgreSQL, Qdrant, Redis)
  Python 3.11+
  Node.js 20+
  Git

### Step-by-Step

1. Clone the repo (or create new private repo varuna/ and push)

2. Start infrastructure:
   docker-compose up -d postgres qdrant redis

3. Backend setup:
   cd backend
   python -m venv venv
   venv\Scripts\activate          (Windows)
   source venv/bin/activate        (Mac/Linux)
   pip install -r requirements.txt

4. Create backend/.env from .env.example:
   Copy OPENROUTER_API_KEY from the team shared doc
   PG_DSN=postgresql://argo_admin:argo_password@localhost:5432/argo_data
   QDRANT_URL=http://localhost:6333
   REDIS_URL=redis://localhost:6379/0
   OPENROUTER_MODEL=nvidia/nemotron-ultra-550b-a55b:free

5. Seed initial data:
   cd backend && python -m src.ingestion.seed_biodiversity
   (Seeds 500+ Indian Ocean species occurrence records — takes ~10 seconds)

6. Start backend:
   uvicorn main:app --reload --port 8000
   API docs available at http://localhost:8000/docs

7. Frontend setup (new terminal):
   cd frontend
   npm install
   Create frontend/.env.local:
     NEXT_PUBLIC_API_URL=http://localhost:8000
     NEXT_PUBLIC_MAPBOX_TOKEN=<from team shared doc>
   npm run dev
   App available at http://localhost:3000

---

## 2. Backend Development Rules

### Never in Production Code
- No print() statements — use import logging; log = logging.getLogger(__name__)
- No blocking calls in async functions — use asyncio.to_thread() for CPU-bound
- No direct os.environ.get() — use settings.field_name from src/config.py
- No ollama_client.py in primary code path — only openrouter_client.py
- No SentenceTransformers imported at module level — blocks startup

### File Naming (Python)
  Modules: snake_case.py
  Classes: PascalCase
  Functions: snake_case
  Constants: UPPER_SNAKE_CASE

### New Backend File Checklist
  - [ ] First line: from __future__ import annotations
  - [ ] Module-level docstring explaining purpose
  - [ ] Type hints on all public functions (-> return type required)
  - [ ] logger = logging.getLogger(__name__) at top
  - [ ] No hardcoded credentials or API keys
  - [ ] All I/O is async
  - [ ] Graceful fallback on external service failure (don't crash the API server)

### SQL Safety Rules
  - All SQL passed to run_sql() must first go through extract_sql() + sanitize_sql()
  - SELECT-only enforcement in postgres.py must never be removed
  - User input must never be f-stringed directly into SQL — use parameterized queries

---

## 3. Frontend Development Rules

### Must-Haves for Every Component
  - TypeScript strict mode. No any. No @ts-ignore.
  - "use client" only when needed (hooks, browser APIs). Default: Server Component.
  - All API calls through lib/api.ts — never raw fetch() in components.
  - Framer Motion for all enter/exit animations.

### Chart Components (Plotly)
  - Always: config={{ displayModeBar: false, responsive: true }}
  - Always: layout={{ paper_bgcolor: 'transparent', plot_bgcolor: 'transparent' }}
  - Always: color palette uses CSS vars: var(--accent), var(--accent-secondary), var(--coral)
  - Never: default Plotly blue. Never: grey background. Never: modebar visible.

### Map Components (Deck.gl / Mapbox)
  - ARGO float ScatterplotLayer: fill color [46, 230, 198] (--accent), radius 6000m
  - Species occurrence ScatterplotLayer: distinct color per species group, radius 4000-20000m
  - Trajectory PathLayer: getColor [46, 230, 198, 180], widthMinPixels 2
  - Mapbox style: mapbox://styles/mapbox/dark-v11 (dark, matches theme)

### CSS Rules
  - Never override CSS custom properties (--bg, --accent, etc.) inline — use className
  - Use .glass for floating panels, .glass-strong for modals/overlays
  - No Tailwind bg-blue-*, bg-green-*, text-green-* — use var(--accent) or bg-[var(--accent)]
  - Micro-animations: skeleton shimmer for loading, spring physics for nav, stagger for lists

### Component File Checklist
  - [ ] TypeScript interface for props defined above the component
  - [ ] Loading state with skeleton shimmer (not a spinner)
  - [ ] Error state handled gracefully (not a blank screen)
  - [ ] Responsive: works on 1280px+ (laptop) minimum
  - [ ] No hardcoded backend URLs — use process.env.NEXT_PUBLIC_API_URL

---

## 4. Git Workflow

### Branch Strategy
  main        — always buildable, frontend npm run build must pass
  dev/M1-*    — Aryan's feature branches
  dev/M2-*    — Aditya's feature branches
  dev/M3-*    — Sahil's feature branches
  dev/M4-*    — Advay's feature branches
  dev/M5-*    — Netal's feature branches
  dev/M6-*    — Kanishka's feature branches

### Commit Message Format
  feat(scope): description of new capability
  fix(scope): what was broken and how it was fixed
  chore(scope): non-feature housekeeping
  docs(scope): documentation only

  Scope examples: api, agents, frontend, ingestion, charts, map, db, config

  Examples:
    feat(agents): implement orchestrator multi-agent task DAG planner
    feat(api): add /anomalies route with severity filtering
    feat(frontend): build AnomalyAlerts component with species impact cards
    fix(chains): replace ollama_client with openrouter_client in sql_rag_chain
    chore(docker): remove ollama service from docker-compose

### PR Rules
  1. Title: [M1/M2/M3/M4/M5/M6] short description
  2. Description: what changed, why, what to test
  3. Checklist before merge:
     - [ ] Backend: uvicorn starts without errors
     - [ ] Frontend: npm run build passes
     - [ ] No .env or secret files committed
     - [ ] No console.log() left in production code
     - [ ] All import of ollama_client.py removed from primary paths

---

## 5. Testing Strategy

### Backend Tests
  # Run all tests (once written)
  cd backend && python -m pytest

  # Test key API endpoints manually:
  curl -X POST http://localhost:8000/api/v1/chat \
    -H "Content-Type: application/json" \
    -d '{"question":"nearest float to Mumbai"}'

  curl -X POST http://localhost:8000/api/v1/agent/chat \
    -H "Content-Type: application/json" \
    -d '{"question":"Compare salinity Arabian Sea vs Bay of Bengal last 3 months and show affected species"}'

  curl http://localhost:8000/api/v1/anomalies?basin=arabian_sea

  curl http://localhost:8000/api/v1/correlate?species=Sardinella+longiceps

### Frontend Tests
  cd frontend && npm run build   # Must exit 0 with no type errors
  # Manual: open http://localhost:3000, test all 4 tabs

### End-to-End Integration Test (run before any major demo)
  1. POST /api/v1/agent/chat: compound cross-domain query
     Expected: answer_md contains species reference, sql shown, agent_trace has 3+ steps
  2. GET /api/v1/anomalies
     Expected: at least 1 seeded or detected alert
  3. GET /api/v1/correlate?species=Sardinella+longiceps
     Expected: rows with scientific_name + temp + psal
  4. Frontend: all 4 tabs render without blank screens

---

## 6. Environment Variables Reference

Backend (backend/.env):
  FLOATCHAT_APP_ENV=dev
  PG_DSN=postgresql://argo_admin:argo_password@localhost:5432/argo_data
  QDRANT_URL=http://localhost:6333
  QDRANT_COLLECTION=argo_knowledge
  REDIS_URL=redis://localhost:6379/0
  OPENROUTER_API_KEY=sk-or-v1-...
  OPENROUTER_MODEL=nvidia/nemotron-ultra-550b-a55b:free
  OPENROUTER_EMBED_MODEL=nomic-ai/nomic-embed-text-v1.5:free
  RAG_TOP_K=12
  FLOATCHAT_SQL_LIMIT=500

Frontend (frontend/.env.local):
  NEXT_PUBLIC_API_URL=http://localhost:8000
  NEXT_PUBLIC_MAPBOX_TOKEN=pk.eyJ1...

---

## 7. Frequently Encountered Issues

Issue: uvicorn crashes on startup
  Likely cause: SentenceTransformers being imported at module level in embedder.py
  Fix: Ensure embedder.py primary path uses openrouter_client.embed_text(), not SentenceTransformer()

Issue: PostgreSQL connection refused
  Likely cause: docker-compose services not running
  Fix: docker-compose up -d postgres qdrant redis && sleep 5

Issue: Qdrant empty results on RAG queries
  Likely cause: Qdrant collections not populated (no ingestion run)
  Fix: Run ingestion or use the rule-based SQL fallback (it should kick in automatically)

Issue: OpenRouter 429 rate limit errors
  Likely cause: Too many rapid test queries
  Fix: openrouter_client.py has tenacity retry with exponential backoff — it will auto-retry

Issue: npm run build fails with TypeScript errors
  Likely cause: Missing types for new component props or any usage
  Fix: Define proper TypeScript interfaces, remove any types
