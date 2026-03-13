"""
FloatChat AI — Ollama Multi-Model Client

Unified interface for all local LLM tasks:
  - SQL generation     → qwen2.5:14b
  - Scientific prose   → llama3:8b
  - Query rewriting    → qwen2.5:3b
  - Complex code/SQL   → deepseek-coder:6.7b
  - Embeddings         → nomic-embed-text (768-dim)
"""
from __future__ import annotations

import asyncio
import logging
from typing import AsyncIterator, List, Optional

import httpx
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import settings

log = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────────────────────
# Low-level HTTP helpers
# ──────────────────────────────────────────────────────────────────────────────
_client: Optional[httpx.AsyncClient] = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.ollama_url,
            timeout=httpx.Timeout(120.0, connect=10.0),
        )
    return _client


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def _generate(
    model: str,
    prompt: str,
    system: Optional[str] = None,
    temperature: float = 0.2,
    max_tokens: int = 2048,
) -> str:
    """Single-shot generation via Ollama /api/generate."""
    client = _get_client()
    payload: dict = {
        "model": model,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
            "repeat_penalty": 1.05,
        },
    }
    if system:
        payload["system"] = system

    resp = await client.post("/api/generate", json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data.get("response", "").strip()


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def _chat(
    model: str,
    messages: List[dict],
    temperature: float = 0.3,
    max_tokens: int = 2048,
) -> str:
    """Chat-style generation via Ollama /api/chat."""
    client = _get_client()
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {
            "temperature": temperature,
            "num_predict": max_tokens,
        },
    }
    resp = await client.post("/api/chat", json=payload)
    resp.raise_for_status()
    data = resp.json()
    return data.get("message", {}).get("content", "").strip()


async def _stream_chat(
    model: str,
    messages: List[dict],
    temperature: float = 0.4,
) -> AsyncIterator[str]:
    """Streaming chat for WebSocket delivery."""
    client = _get_client()
    payload = {
        "model": model,
        "messages": messages,
        "stream": True,
        "options": {"temperature": temperature},
    }
    async with client.stream("POST", "/api/chat", json=payload) as resp:
        resp.raise_for_status()
        async for line in resp.aiter_lines():
            if not line:
                continue
            import json
            try:
                chunk = json.loads(line)
                token = chunk.get("message", {}).get("content", "")
                if token:
                    yield token
                if chunk.get("done"):
                    break
            except Exception:
                continue


@retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
async def embed(texts: List[str]) -> List[List[float]]:
    """Generate embeddings via nomic-embed-text (768-dim)."""
    client = _get_client()
    results = []
    # Ollama processes one text at a time for embeddings
    for text in texts:
        resp = await client.post(
            "/api/embeddings",
            json={"model": settings.ollama_embed_model, "prompt": text},
        )
        resp.raise_for_status()
        results.append(resp.json()["embedding"])
    return results


# ──────────────────────────────────────────────────────────────────────────────
# Task-specific functions (each with its own model + prompt style)
# ──────────────────────────────────────────────────────────────────────────────

_SQL_SCHEMA = """
PostgreSQL table `public.marine_data` with PostGIS. Columns:
  platform_number INT4     — float WMO identifier
  time            TIMESTAMPTZ
  latitude        DOUBLE PRECISION
  longitude       DOUBLE PRECISION
  geom            GEOGRAPHY(POINT,4326)  — use ST_DWithin for spatial queries
  pres            DOUBLE PRECISION  — pressure dbar ≈ depth m
  temp            DOUBLE PRECISION  — temperature °C
  temp_qc         SMALLINT          — quality flag 0=unknown 1=good 4=bad
  psal            DOUBLE PRECISION  — salinity PSU
  psal_qc         SMALLINT
  doxy            DOUBLE PRECISION  — dissolved oxygen µmol/kg
  doxy_qc         SMALLINT
  chla            DOUBLE PRECISION  — chlorophyll-a mg/m³
  nitrate         DOUBLE PRECISION  — nitrate µmol/kg
  ph_in_situ_total DOUBLE PRECISION
  bbp700          DOUBLE PRECISION  — backscattering at 700nm
  cycle_number    INT4
  data_mode       CHAR(1)           — R=realtime D=delayed

Ocean regions (use these exact bounds):
  Arabian Sea:    longitude BETWEEN 40 AND 75  AND latitude BETWEEN 5 AND 25
  NE Arabian Sea: longitude BETWEEN 57 AND 75  AND latitude BETWEEN 15 AND 25
  NW Arabian Sea: longitude BETWEEN 40 AND 57  AND latitude BETWEEN 15 AND 25
  Bay of Bengal:  longitude BETWEEN 75 AND 100 AND latitude BETWEEN 5 AND 25
  Equatorial IO:  latitude BETWEEN -5 AND 5 AND longitude BETWEEN 40 AND 115
  Indian Ocean:   longitude BETWEEN 20 AND 145 AND latitude BETWEEN -60 AND 30

Time windows:
  "past N days"    → time > NOW() - INTERVAL 'N days'
  "past N months"  → time > NOW() - INTERVAL 'N months'
  "in 2023"        → time BETWEEN '2023-01-01' AND '2024-01-01'
  "March 2023"     → time BETWEEN '2023-03-01' AND '2023-04-01'

Spatial queries:
  Nearest float to (lat,lon):  ST_DWithin(geom, ST_MakePoint(lon,lat)::GEOGRAPHY, radius_m)
  Near a coordinate:            ST_Distance(geom, ST_MakePoint(lon,lat)::GEOGRAPHY) < dist_m

Depth profiles:
  Use pres AS depth_m, ORDER BY pres ASC
  For a target location: ABS(latitude-{lat})<0.05 AND ABS(longitude-{lon})<0.05

Extrema pattern (min/max):
  WITH w AS (SELECT ... WHERE <filters> AND <var> IS NOT NULL),
  m AS (SELECT MIN(<var>) AS v FROM w)
  SELECT w.platform_number, w.time, w.latitude, w.longitude, w.<var>
  FROM w JOIN m ON w.<var>=m.v ORDER BY time DESC LIMIT 50

Always include platform_number, time, latitude, longitude in SELECT.
Always add WHERE qc flag checks (e.g. AND temp_qc NOT IN (4,9)) for quality.
Output ONLY one valid PostgreSQL SELECT. No markdown, no explanation.
"""

_SQL_FEWSHOTS = """
-- Example 1: Salinity profiles near equator March 2023
SELECT platform_number, time, latitude, longitude, pres AS depth_m, psal, temp
FROM public.marine_data
WHERE latitude BETWEEN -5 AND 5
  AND longitude BETWEEN 40 AND 115
  AND time BETWEEN '2023-03-01' AND '2023-04-01'
  AND psal IS NOT NULL AND psal_qc NOT IN (4,9)
ORDER BY platform_number, pres ASC
LIMIT 500;

-- Example 2: Compare BGC in Arabian Sea last 6 months
SELECT DATE_TRUNC('month', time) AS month,
       AVG(chla) AS avg_chla, AVG(doxy) AS avg_doxy,
       AVG(nitrate) AS avg_nitrate, COUNT(*) AS obs
FROM public.marine_data
WHERE longitude BETWEEN 40 AND 75 AND latitude BETWEEN 5 AND 25
  AND time > NOW() - INTERVAL '6 months'
  AND (chla IS NOT NULL OR doxy IS NOT NULL OR nitrate IS NOT NULL)
GROUP BY 1 ORDER BY 1;

-- Example 3: Nearest floats to Mumbai (19.08, 72.88) past 90 days
SELECT platform_number, time, latitude, longitude, temp, psal,
       ST_Distance(geom, ST_MakePoint(72.88, 19.08)::GEOGRAPHY)/1000 AS km
FROM public.marine_data
WHERE ST_DWithin(geom, ST_MakePoint(72.88, 19.08)::GEOGRAPHY, 500000)
  AND time > NOW() - INTERVAL '90 days'
  AND pres < 20
ORDER BY km ASC, time DESC
LIMIT 10;

-- Example 4: Temperature trend 2022 in Indian Ocean
SELECT DATE_TRUNC('month', time) AS month,
       AVG(temp) AS avg_temp, STDDEV(temp) AS std_temp,
       MIN(temp) AS min_temp, MAX(temp) AS max_temp
FROM public.marine_data
WHERE longitude BETWEEN 20 AND 145 AND latitude BETWEEN -60 AND 30
  AND time BETWEEN '2022-01-01' AND '2023-01-01'
  AND temp IS NOT NULL AND temp_qc NOT IN (4,9)
GROUP BY 1 ORDER BY 1;
"""


async def generate_sql(question: str, history: Optional[str] = None) -> str:
    """NL → PostgreSQL SELECT via qwen2.5:14b."""
    system = (
        "You are a precise PostgreSQL SQL generator for oceanographic data. "
        "Output ONLY one valid SELECT statement. No markdown, no explanation, no semicolons."
    )
    prompt = f"{_SQL_SCHEMA}\n\n{_SQL_FEWSHOTS}\n\nQuestion: {question}"
    if history:
        prompt += f"\n\nConversation context: {history}"
    prompt += "\n\nSQL:"
    return await _generate(
        settings.ollama_sql_model, prompt, system=system,
        temperature=0.05, max_tokens=512,
    )


async def rewrite_query(question: str, context: str = "") -> tuple[str, str]:
    """
    Query rewriting + intent detection via qwen2.5:3b.
    Returns (rewritten_query, intent) where intent is one of:
      SQL_DATA | SEMANTIC_SEARCH | SMALLTALK | MATH | NEAREST_FLOAT
    """
    system = (
        "You are a query understanding assistant for an ocean data system. "
        "Given a user question, output JSON with exactly two fields: "
        '"rewritten" (improved, specific version of the query) and '
        '"intent" (one of: SQL_DATA, SEMANTIC_SEARCH, SMALLTALK, MATH, NEAREST_FLOAT). '
        "No explanation, just valid JSON."
    )
    prompt = f"Question: {question}"
    if context:
        prompt += f"\nContext: {context}"
    raw = await _generate(
        settings.ollama_rewrite_model, prompt, system=system,
        temperature=0.1, max_tokens=200,
    )
    import json, re
    try:
        m = re.search(r'\{.*\}', raw, re.DOTALL)
        if m:
            data = json.loads(m.group())
            return data.get("rewritten", question), data.get("intent", "SQL_DATA")
    except Exception:
        pass
    return question, "SQL_DATA"


async def narrate_results(
    question: str, sql: str, rows_preview: str, region: str = ""
) -> str:
    """Scientific narration via llama3:8b."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are a concise oceanographic data analyst. Given a user question, "
                "the SQL query executed, and a preview of results, write 2-4 engaging "
                "sentences summarizing the key findings. Mention: the region/time window, "
                "key values (with units), and any notable pattern. No code blocks."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n"
                f"SQL: {sql}\n"
                f"Results preview:\n{rows_preview}\n"
                + (f"Ocean region: {region}" if region else "")
            ),
        },
    ]
    return await _chat(
        settings.ollama_narrate_model, messages,
        temperature=0.4, max_tokens=300,
    )


async def decompose_query(question: str) -> List[str]:
    """
    Break complex multi-hop queries into atomic sub-queries.
    Returns list of sub-questions.
    """
    system = (
        "You are an expert at decomposing complex oceanographic queries into atomic sub-questions. "
        "Output a JSON array of strings — each string is a simple, answerable sub-question. "
        "Maximum 4 sub-questions. If the question is already simple, return array with the original. "
        "No explanation, just valid JSON array."
    )
    raw = await _generate(
        settings.ollama_rewrite_model,
        f"Complex question: {question}",
        system=system,
        temperature=0.15,
        max_tokens=300,
    )
    import json, re
    try:
        m = re.search(r'\[.*\]', raw, re.DOTALL)
        if m:
            parts = json.loads(m.group())
            if isinstance(parts, list) and all(isinstance(p, str) for p in parts):
                return parts[:4]
    except Exception:
        pass
    return [question]


async def stream_answer(
    question: str, context: str, sql: Optional[str] = None
) -> AsyncIterator[str]:
    """Stream final grounded answer via llama3:8b."""
    messages = [
        {
            "role": "system",
            "content": (
                "You are FloatChat AI — an expert ocean data assistant. "
                "Answer ONLY using the provided context. Cite data values with units. "
                "If the context doesn't contain enough information, say so clearly. "
                "Format your response in clean markdown."
            ),
        },
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\n"
                f"Context:\n{context}\n"
                + (f"\nSQL Query used:\n```sql\n{sql}\n```" if sql else "")
            ),
        },
    ]
    async for token in _stream_chat(settings.ollama_narrate_model, messages):
        yield token


async def health_check() -> dict:
    """Check Ollama is up and models are available."""
    client = _get_client()
    try:
        resp = await client.get("/api/tags")
        resp.raise_for_status()
        models = [m["name"] for m in resp.json().get("models", [])]
        return {"ok": True, "models": models}
    except Exception as e:
        return {"ok": False, "error": str(e)}
