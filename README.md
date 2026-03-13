# 🌊 FloatChat AI — Global Oceanic Intelligence (Final Edition)

## Quick Start (Windows friendly)
1. Backend
   - cd apps/backend
   - python -m venv .venv && . .venv/Scripts/activate
   - pip install -r requirements.txt
   - copy .env.example -> .env and set DATABASE_URL, HF_TOKEN
   - python -m src.embeddings.build_vectorstore
   - uvicorn src.server.serve:app --reload --host 0.0.0.0 --port 8000

2. Frontend (Next 14)
   - cd apps/web
   - npm i
   - copy .env.local.example -> .env.local and set NEXT_PUBLIC_BACKEND_URL
   - npm run dev (http://localhost:3000)

3. Test
   - Ask: "Show me psal vs pres near the equator in March 2023 including temp and coords"

## Structure
- apps/backend: FastAPI, LoRA LLaMA → SQL, RAG (Chroma), Supabase Postgres.
- apps/web: Next.js App Router UI with chat, charts (Plotly), and map (Leaflet).

# FLOATCHATAI 🌊
Your ocean-data copilot: ask natural language, get **Postgres SQL** + results + tidy summaries.  
- Ocean-themed greetings, small talk, time, quick math  
- Year-partitioned table (`public.marine_data_*`) with a parent `public.marine_data`  
- Coast-aware “nearest float” (e.g., “near Mumbai” → west coast)  
- Finetuned LoRA for robust SQL generation (TinyLlama base)

## Quickstart

### 0) Prereqs
- Python 3.11+
- (Optional) Docker (for local Postgres)
- Git, curl/Postman/VS Code

### 1) Clone
```bash
git clone https://github.com/<your-org>/floatchatai.git
cd floatchatai/apps/backend
2) Virtualenv & deps
bash
Copy code
python -m venv .venv
# Linux/Mac:
source .venv/bin/activate
# Windows PowerShell:
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
3) Configure
Copy env and fill secrets:

bash
Copy code
cp .env.example .env
Key vars:

DATABASE_URL – your Postgres/Supabase connection string

BASE_MODEL / LORA_OUT – base and LoRA paths (TinyLlama + your finetune)

4) Create schema (optional if DB already has it)
bash
Copy code
psql "$DATABASE_URL" -f src/db/schema.sql
5) Run
bash
Copy code
# Linux/Mac:
bash uvicorn_local.sh
# Windows:
.\uvicorn_local.ps1
Server runs at: http://127.0.0.1:8001

6) Try it
Health:

bash
Copy code
curl http://127.0.0.1:8001/health
Ask SQL task:

bash
Copy code
curl -s -X POST http://127.0.0.1:8001/chat \
  -H "Content-Type: application/json" \
  -d '{ "question": "Monthly avg doxy and chla for Arabian Sea for last 6 months" }' | jq
Exact float/time/depth (pressure) test:

bash
Copy code
curl -s -X POST http://127.0.0.1:8001/chat \
  -H "Content-Type: application/json" \
  -d '{ "question": "Give me the pressure (depth) of buoy 1902367 at latitude 4.08365 and longitude 88.98723 at time 2025-06-30 21:41:29 where temperature is 11.489 °C" }' | jq
Browser playground:

arduino
Copy code
http://127.0.0.1:8001/play
API
GET /health → { ok: true }

POST /chat { question: string, session?: string }
→ { ok, answer_markdown, sql, rows, viz_specs, float_ids, error }

Dev Notes
Small talk, time, math handled directly in serve.py

SQL generation & validation in src/chains/sql_rag_chain.py

Nearest-float logic uses src/utils/geo.py and src/db/postgres.py

Partitions by year for public.marine_data_* (see schema.sql)

yaml
Copy code

---

# 4) `apps/backend/.env.example`

```env
# FastAPI
FLOATCHAT_APP_ENV=dev
FLOATCHAT_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FLOATCHAT_TRUSTED_HOSTS=localhost,127.0.0.1

# Database
DATABASE_URL=postgresql+psycopg2://USER:PASSWORD@HOST:5432/DBNAME?sslmode=require

# Embeddings / Chroma (if used)
EMBED_MODEL=sentence-transformers/all-MiniLM-L6-v2
CHROMA_DIR=./chroma

# Model
BASE_MODEL=TinyLlama/TinyLlama-1.1B-Chat-v1.0
LORA_OUT=artifacts/lora-marine-v1
HF_TOKEN=
5) apps/backend/requirements.txt
txt
Copy code
fastapi==0.112.2
uvicorn[standard]==0.30.6
pydantic==2.9.2
pydantic-settings==2.6.1
httpx==0.27.2

sqlalchemy==2.0.35
psycopg2-binary==2.9.9

transformers==4.44.2
accelerate==0.34.2
peft==0.13.2
datasets==2.21.0
torch>=2.3.0

langchain==0.2.16
langchain-chroma==0.1.4
langchain-huggingface==0.0.3
chromadb==0.5.5

python-dotenv==1.0.1
(If you already have working versions, keep them.)

6) apps/backend/src/db/schema.sql (seed + partitions)
sql
Copy code
CREATE TABLE IF NOT EXISTS public.marine_data (
    platform_number INT4,
    latitude NUMERIC,
    longitude NUMERIC,
    time TIMESTAMP NOT NULL,
    pres NUMERIC,               -- depth in meters from your note
    temp NUMERIC,
    psal NUMERIC,
    doxy NUMERIC,
    chla NUMERIC,
    ph_in_situ_total NUMERIC,
    nitrate NUMERIC
) PARTITION BY RANGE (time);

-- Partitions (adjust years to your data)
CREATE TABLE IF NOT EXISTS public.marine_data_2022 PARTITION OF public.marine_data
    FOR VALUES FROM ('2022-01-01 00:00:00') TO ('2023-01-01 00:00:00');

CREATE TABLE IF NOT EXISTS public.marine_data_2023 PARTITION OF public.marine_data
    FOR VALUES FROM ('2023-01-01 00:00:00') TO ('2024-01-01 00:00:00');

CREATE TABLE IF NOT EXISTS public.marine_data_2024 PARTITION OF public.marine_data
    FOR VALUES FROM ('2024-01-01 00:00:00') TO ('2025-01-01 00:00:00');

CREATE TABLE IF NOT EXISTS public.marine_data_2025 PARTITION OF public.marine_data
    FOR VALUES FROM ('2025-01-01 00:00:00') TO ('2026-01-01 00:00:00');

-- Helpful indexes (per partition for pruning)
CREATE INDEX IF NOT EXISTS md_2025_platform_time_idx ON public.marine_data_2025 (platform_number, time);
CREATE INDEX IF NOT EXISTS md_2025_lat_lon_idx       ON public.marine_data_2025 (latitude, longitude);
7) apps/backend/uvicorn_local.sh
bash
Copy code
#!/usr/bin/env bash
set -euo pipefail
export FLOATCHAT_APP_ENV="${FLOATCHAT_APP_ENV:-dev}"
export FLOATCHAT_CORS_ORIGINS="${FLOATCHAT_CORS_ORIGINS:-http://localhost:5173,http://127.0.0.1:5173}"
export FLOATCHAT_TRUSTED_HOSTS="${FLOATCHAT_TRUSTED_HOSTS:-localhost,127.0.0.1}"
uvicorn src.server.serve:app --host 127.0.0.1 --port 8001 --reload --proxy-headers --forwarded-allow-ips="*"
8) apps/backend/uvicorn_local.ps1
powershell
Copy code
$env:FLOATCHAT_APP_ENV = $env:FLOATCHAT_APP_ENV -ne $null ? $env:FLOATCHAT_APP_ENV : "dev"
$env:FLOATCHAT_CORS_ORIGINS = "http://localhost:5173,http://127.0.0.1:5173"
$env:FLOATCHAT_TRUSTED_HOSTS = "localhost,127.0.0.1"
uvicorn src.server.serve:app --host 127.0.0.1 --port 8001 --reload --proxy-headers --forwarded-allow-ips="*"
9) apps/backend/public/play.html (tiny “Try it live”)
html
Copy code
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>FLOATCHATAI – Try it</title>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <style>
    body{font-family:system-ui,Segoe UI,Arial,sans-serif;max-width:960px;margin:2rem auto;padding:0 1rem}
    textarea{width:100%;height:120px}
    pre{background:#0b1220;color:#d6e1ff;padding:12px;border-radius:10px;overflow:auto}
    .row{display:flex;gap:8px}
    .row>*{flex:1}
    button{padding:10px 14px;border-radius:10px;border:0;background:#2b5fff;color:#fff;cursor:pointer}
    .ok{color:#0a7f22;margin-left:8px}
  </style>
</head>
<body>
  <h1>🌊 FLOATCHATAI – Try it live</h1>
  <p>Backend endpoint: <code>http://127.0.0.1:8001/chat</code></p>
  <div class="row">
    <textarea id="q">Give me the pressure (depth) of buoy 1902367 at latitude 4.08365 and longitude 88.98723 at time 2025-06-30 21:41:29 where temperature is 11.489 °C</textarea>
    <div>
      <button id="ask">Ask</button>
      <span id="ok" class=""></span>
    </div>
  </div>
  <h3>Answer</h3>
  <div id="md"></div>
  <h3>SQL</h3>
  <pre id="sql"></pre>
  <h3>Rows</h3>
  <pre id="rows"></pre>
<script>
const ask = document.getElementById('ask');
ask.onclick = async () => {
  document.getElementById('ok').textContent = '…';
  const q = document.getElementById('q').value;
  const r = await fetch('/play/chat', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({question:q})
  });
  const j = await r.json();
  document.getElementById('ok').textContent = j.ok ? '✓ ok' : 'error';
  document.getElementById('ok').className = j.ok ? 'ok' : '';
  document.getElementById('md').innerText = j.answer_markdown || '';
  document.getElementById('sql').innerText = j.sql || '';
  document.getElementById('rows').innerText = JSON.stringify(j.rows, null, 2) || '';
};
</script>
</body>
</html>
You’ll reach it at: http://127.0.0.1:8001/play

10) apps/backend/.github/workflows/ci.yml (basic CI)
yaml
Copy code
name: backend-ci

on:
  push:
    paths:
      - 'apps/backend/**'
  pull_request:
    paths:
      - 'apps/backend/**'

jobs:
  test:
    runs-on: ubuntu-latest
    defaults:
      run:
        working-directory: apps/backend
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'
      - run: python -m venv .venv
      - run: . .venv/bin/activate && pip install -r requirements.txt
      - name: Lint import
        run: . .venv/bin/activate && python -c "import fastapi, sqlalchemy, transformers; print('ok'