
"""
SQL RAG chain for FloatchatAI:
- NL -> SQL via local LLM (Qwen 3B + LoRA) with strict SELECT-only extraction
- Executes SQL and returns rows + viz specs + float ids
- Adds a narration pass (2â€“4 friendly sentences) over {question, sql, top_rows_summary}
- Prompt includes strict min/max provenance bias + few-shots
"""

from __future__ import annotations

import os
import re
import json
from typing import Any, Dict, List, Optional, Tuple

# DB runner (must raise if non-SELECT)
from src.database.postgres import run_sql as execute_sql

# ---------------------------
# Environment / switches
# ---------------------------
BASE_MODEL = os.getenv("BASE_MODEL", "Qwen/Qwen2.5-3B-Instruct")
LORA_OUT   = os.getenv("LORA_OUT", "artifacts/lora-marine-qwen3b")

# Optional separate beautifier LoRA (leave empty to reuse main one)
NARRATOR_LORA_OUT = os.getenv("NARRATOR_LORA_OUT", "").strip()

USE_MODEL  = os.getenv("FLOATCHAT_USE_MODEL", "true").lower() != "false"
DEFAULT_LIMIT = int(os.getenv("FLOATCHAT_SQL_LIMIT", "300"))

# ---------------------------
# Lazy LLMs (SQL & Narrator)
# ---------------------------
_llm = None
_tok = None
_pipe = None

_narr_llm = None
_narr_tok = None
_narr_pipe = None

_generation_kwargs = {
    "max_new_tokens": 384,
    "do_sample": True,
    "temperature": 0.3,
    "top_p": 0.9,
    "repetition_penalty": 1.05,
}
_narration_kwargs = {
    "max_new_tokens": 120,
    "do_sample": True,
    "temperature": 0.4,
    "top_p": 0.9,
    "repetition_penalty": 1.03,
}

def _load_pipe(base_model: str, lora_path: str | None):
    """
    Internal: load a text-generation pipeline with optional LoRA.
    4-bit inference if bitsandbytes available; otherwise normal.
    """
    from transformers import AutoModelForCausalLM, AutoTokenizer, pipeline
    from peft import PeftModel
    import torch

    quant_kwargs = {}
    try:
        import bitsandbytes as _bnb  # noqa: F401
        quant_kwargs = dict(
            load_in_4bit=True,
            bnb_4bit_use_double_quant=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_compute_dtype=torch.bfloat16 if torch.cuda.is_available() else torch.float16,
        )
    except Exception:
        quant_kwargs = {}

    tok = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True, use_fast=True)
    if tok.pad_token is None:
        tok.pad_token = tok.eos_token
    tok.padding_side = "left"

    llm = AutoModelForCausalLM.from_pretrained(
        base_model,
        trust_remote_code=True,
        device_map="auto",
        **quant_kwargs
    )

    if lora_path and os.path.isdir(lora_path):
        try:
            llm = PeftModel.from_pretrained(llm, lora_path)
        except Exception:
            pass

    return pipeline("text-generation", model=llm, tokenizer=tok), llm, tok

def _load_llm():
    """SQL generator pipeline."""
    global _pipe, _llm, _tok
    if _pipe is not None or not USE_MODEL:
        return _pipe
    try:
        _pipe, _llm, _tok = _load_pipe(BASE_MODEL, LORA_OUT)
        return _pipe
    except Exception:
        _pipe = None
        return None

def _load_narrator():
    """Narration pipeline (can reuse main or load a separate LoRA)."""
    global _narr_pipe, _narr_llm, _narr_tok
    if _narr_pipe is not None or not USE_MODEL:
        return _narr_pipe
    try:
        # If user set NARRATOR_LORA_OUT, load a fresh pipe; else reuse main
        if NARRATOR_LORA_OUT:
            _narr_pipe, _narr_llm, _narr_tok = _load_pipe(BASE_MODEL, NARRATOR_LORA_OUT)
        else:
            # Reuse main model pipeline â€” keeps footprint tiny
            main = _load_llm()
            _narr_pipe = main
        return _narr_pipe
    except Exception:
        _narr_pipe = None
        return None

# ---------------------------
# SQL extraction / safety
# ---------------------------
SQL_FENCE_RE = re.compile(r"```(?:sql)?\s*(.*?)```", re.IGNORECASE | re.DOTALL)
FIRST_SELECT_RE = re.compile(r"(?is)\bselect\b.+")  # from first SELECT onwards

def _extract_sql(generated: str) -> Optional[str]:
    """
    Accept model text and return a single clean SELECT statement or None.
    - Prefer fenced ```sql ...```.
    - Else pick text from first SELECT.
    - Enforce SELECT-only; reject multiple statements & DDL/DML.
    """
    if not generated or not isinstance(generated, str):
        return None
    txt = generated.strip()

    m = SQL_FENCE_RE.search(txt)
    if m:
        cand = m.group(1).strip()
    else:
        m2 = FIRST_SELECT_RE.search(txt)
        if not m2:
            return None
        cand = m2.group(0).strip()

    cand = cand.split("```")[0].strip()
    for stop in ("\nAnswer:", "\nHuman:", "\nAssistant:", "\nSQL Explanation:"):
        cand = cand.split(stop)[0].strip()
    cand = cand.rstrip(";").strip()

    low = cand.lower()
    if not low.startswith("select"):
        return None

    banned = ("insert","update","delete","drop","alter","create","grant","revoke","truncate","comment","attach")
    if any(b in low for b in banned):
        return None

    if ";" in cand:
        return None

    return cand

# ---------------------------
# Prompt (+ provenance bias & few-shots)
# ---------------------------
_PROVENANCE_HELP = """
When the user asks for an extreme (min or max) of a variable, you MUST include provenance columns with the extremum row(s).
Use this **pattern**:

WITH w AS (
  SELECT platform_number, time, latitude, longitude, temp, psal, doxy, chla, ph_in_situ_total, nitrate, pres
  FROM public.marine_data
  WHERE <region/time/filters> AND <variable> IS NOT NULL
),
m AS (
  SELECT MIN(<variable>) AS v FROM w   -- or MAX(...)
)
SELECT w.platform_number, w.time, w.latitude, w.longitude, w.<variable>
FROM w JOIN m ON w.<variable> = m.v
ORDER BY w.time DESC
LIMIT 50;

Always return those 4 provenance columns for extrema queries: platform_number, time, latitude, longitude.
"""

_FEWSHOTS = """
-- Few-shot 1 (min of temp in Arabian Sea, last 30 days)
WITH w AS (
  SELECT platform_number, time, latitude, longitude, temp
  FROM public.marine_data
  WHERE longitude BETWEEN 40 AND 75
    AND latitude BETWEEN 5 AND 25
    AND time > NOW() - INTERVAL '30 days'
    AND temp IS NOT NULL
),
m AS (
  SELECT MIN(temp) AS v FROM w
)
SELECT w.platform_number, w.time, w.latitude, w.longitude, w.temp
FROM w JOIN m ON w.temp = m.v
ORDER BY w.time DESC
LIMIT 50;

-- Few-shot 2 (max of psal in NE Arabian Sea, last 45 days)
WITH w AS (
  SELECT platform_number, time, latitude, longitude, psal
  FROM public.marine_data
  WHERE longitude BETWEEN 40 AND 75
    AND latitude BETWEEN 5 AND 25
    AND latitude >= 15 AND longitude >= 57
    AND time > NOW() - INTERVAL '45 days'
    AND psal IS NOT NULL
),
m AS (
  SELECT MAX(psal) AS v FROM w
)
SELECT w.platform_number, w.time, w.latitude, w.longitude, w.psal
FROM w JOIN m ON w.psal = m.v
ORDER BY w.time DESC
LIMIT 50;

-- Few-shot 3 (depth profile near a lat/lon at target time +/- 60 minutes)
SELECT platform_number, time, latitude, longitude,
       temp, psal, doxy, chla, pres AS depth_m
FROM public.marine_data
WHERE ABS(latitude - 19.1) < 0.02
  AND ABS(longitude - 72.85) < 0.02
  AND time BETWEEN TIMESTAMP '2025-07-03 10:05:00' - INTERVAL '60 minutes'
              AND TIMESTAMP '2025-07-03 10:05:00' + INTERVAL '60 minutes'
ORDER BY time ASC, pres ASC
LIMIT 500;
"""

_SCHEMAS = f"""
You are a SQL generator for a PostgreSQL table `public.marine_data` with relevant columns:

- platform_number (int)
- time (timestamp)
- latitude (double)
- longitude (double)
- temp (double)            -- sea temperature (Â°C)
- psal (double)            -- practical salinity (PSU)
- doxy (double)            -- dissolved oxygen
- chla (double)            -- chlorophyll-a
- ph_in_situ_total (double)
- nitrate (double)
- pres (double)            -- pressure (dbar) â‰ˆ depth (m)

Regions:
- "Equator": latitude BETWEEN -5 AND 5.
- "Arabian Sea": longitude BETWEEN 40 AND 75 AND latitude BETWEEN 5 AND 25.
  - NE Arabian Sea: lat >= 15 AND lon >= 57 (inside Arabian Sea)
  - NW Arabian Sea: lat >= 15 AND lon  < 57 (inside Arabian Sea)
- "Bay of Bengal": longitude BETWEEN 75 AND 100 AND latitude BETWEEN 5 AND 25.

Time windows like â€œpast 30 daysâ€: time > NOW() - INTERVAL '30 days'.

Depth profile:
- Use `pres AS depth_m` and ORDER BY pres ASC.
- Tight windows: ABS(latitude - <lat>) < 0.02 AND ABS(longitude - <lon>) < 0.02
- For a target time, use BETWEEN target-interval AND target+interval, typically Â±60 minutes.

{_PROVENANCE_HELP}

Return exactly ONE clean SELECT (no markdown/fences). No explanations.
Here are a few examples to emulate:

{_FEWSHOTS}
"""

def _build_prompt(question: str, history: Optional[List[Dict[str, str]]] = None) -> str:
    sys = (
        "You are a precise SQL generator. Output ONLY one PostgreSQL SELECT query. "
        "No markdown, no backticks, no explanationâ€”just SQL."
    )
    content = [sys, _SCHEMAS.strip(), f"User question: {question.strip()}", "Return a single SELECT."]
    if history:
        last_user = next((m.get("content","").strip() for m in reversed(history) if (m.get("role") or "").lower()=="user"), "")
        if last_user:
            content.append(f"Previous context: {last_user}")
    return "\n\n".join(content)

# ---------------------------
# Friendly rendering
# ---------------------------
def _mk_table(rows: List[dict], max_cols: int = 7, max_rows: int = 10) -> str:
    if not rows:
        return "_No rows returned._"
    cols = list(rows[0].keys())[:max_cols]
    hdr = "|" + "|".join(cols) + "|\n|" + "|".join(["---"] * len(cols)) + "|"
    body = []
    for r in rows[:max_rows]:
        body.append("|" + "|".join(str(r.get(c, "")) for c in cols) + "|")
    if len(rows) > max_rows:
        body.append(f"\n_â€¦and {len(rows) - max_rows} more rows not shown._")
    return hdr + "\n" + "\n".join(body)

def _build_viz(rows: List[dict]) -> Dict[str, Any]:
    points = []
    for r in rows[:200]:
        lat = r.get("latitude")
        lon = r.get("longitude")
        if lat is None or lon is None:
            continue
        points.append({
            "id": str(r.get("platform_number", "")),
            "lat": float(lat),
            "lon": float(lon),
            "label": f"{r.get('platform_number')} Â· {r.get('time')}"
        })
    center = [points[0]["lat"], points[0]["lon"]] if points else [15.0, 70.0]
    return {"map": {"center": center, "zoom": 4, "points": points}, "charts": []}

def _float_ids_from_rows(rows: List[dict]) -> List[str]:
    return sorted({str(r.get("platform_number")) for r in rows if r.get("platform_number") is not None})

def _top_rows_summary(rows: List[dict], max_rows: int = 5) -> str:
    """Compact JSON-ish preview used as narrator input."""
    return json.dumps(rows[:max_rows], ensure_ascii=False, default=str)

def _narrate(question: str, sql: str, rows: List[dict]) -> str:
    """
    Short markdown: summary + fenced SQL + compact table.
    (We still do a model narration *in addition* via narrate_result() below.)
    """
    n = len(rows)
    lead = f"### Result Summary\n- Rows returned: **{n}**\n"
    return f"{lead}\n```sql\n{sql}\n```\n\n**Top rows:**\n{_mk_table(rows)}"

# ---------------------------
# Tiny narration pass (LLM â†’ 2â€“4 friendly sentences)
# ---------------------------
_NARR_SYS = (
    "You are a concise ocean-data narrator. Given a user question, the SQL used, and a short top-row preview, "
    "write a friendly 2â€“4 sentence English paragraph. Avoid restating the entire table; mention the region/time window if obvious. "
    "No markdown code fences."
)

def narrate_result(question: str, sql: str, top_rows_summary: str) -> str:
    """
    Calls local narrator model (reuse main by default) to produce 2â€“4 sentences.
    Falls back gracefully to a templated sentence if model unavailable.
    """
    pipe = _load_narrator()
    prompt = (
        f"[SYSTEM]\n{_NARR_SYS}\n\n"
        f"[USER]\nQuestion: {question}\n\nSQL: {sql}\n\nTop rows (preview): {top_rows_summary}\n\n"
        f"[ASSISTANT]\n"
    )
    try:
        if pipe is None:
            raise RuntimeError("narrator off")
        out = pipe(prompt, **_narration_kwargs)
        text = out[0]["generated_text"]
        # strip any extra role tags
        for tag in ("[SYSTEM]","[USER]","[ASSISTANT]"):
            text = text.replace(tag, "")
        # keep 2â€“4 sentences heuristic
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        sentences = [s.strip() for s in sentences if s.strip()]
        if not sentences:
            raise RuntimeError("empty narration")
        if len(sentences) > 4:
            sentences = sentences[:4]
        return " ".join(sentences)
    except Exception:
        # simple fallback
        return ("Hereâ€™s a concise summary of your request. I generated an appropriate SQL query, "
                "ran it on the marine dataset, and show a compact table of top results below.")

# ---------------------------
# Fallback SQL templates (if model missing)
# ---------------------------
def _template_sql(question: str) -> Optional[str]:
    q = question.lower()
    if "monthly average" in q and "psal" in q and "equator" in q:
        return (
            "SELECT DATE_TRUNC('month', time) AS month,\n"
            "       AVG(psal) AS avg_psal,\n"
            "       MIN(latitude) AS min_lat,\n"
            "       MAX(latitude) AS max_lat,\n"
            "       MIN(longitude) AS min_lon,\n"
            "       MAX(longitude) AS max_lon\n"
            "FROM public.marine_data\n"
            "WHERE latitude BETWEEN -5 AND 5\n"
            "  AND time > NOW() - INTERVAL '12 months'\n"
            "GROUP BY 1\n"
            "ORDER BY 1"
        )
    if "min of temp" in q and "arabian sea" in q:
        return (
            "WITH w AS (\n"
            "  SELECT platform_number, time, latitude, longitude, temp\n"
            "  FROM public.marine_data\n"
            "  WHERE longitude BETWEEN 40 AND 75 AND latitude BETWEEN 5 AND 25\n"
            "    AND time > NOW() - INTERVAL '365 days' AND temp IS NOT NULL\n"
            "), m AS (\n"
            "  SELECT MIN(temp) AS v FROM w\n"
            ")\n"
            "SELECT w.platform_number, w.time, w.latitude, w.longitude, w.temp\n"
            "FROM w JOIN m ON w.temp = m.v\n"
            "ORDER BY w.time DESC"
        )
    return None

# ---------------------------
# Public entrypoint
# ---------------------------
def answer(question: str,
           history: Optional[List[Dict[str, str]]] = None,
           prior_sql: Optional[str] = None,
           limit: int = DEFAULT_LIMIT) -> Dict[str, Any]:
    """
    Main entry:
    - If prior_sql provided â†’ sanitize & run.
    - Else build prompt, call model (or template), sanitize, run.
    - Attach narration via narrate_result().
    - Return dict with markdown, sql, rows, viz_specs, float_ids.
    """
    # 1) Prior SQL (retry/relax path)
    if prior_sql:
        sql = _extract_sql(prior_sql) or prior_sql.strip()
        rows = execute_sql(sql, limit=limit)
        viz = _build_viz(rows)
        floats = _float_ids_from_rows(rows)

        top_preview = _top_rows_summary(rows)
        prose = narrate_result(question or "Re-run", sql, top_preview)

        md = f"### Summary\n{prose}\n\n```sql\n{sql}\n```\n\n**Top rows:**\n{_mk_table(rows)}"
        return {
            "answer_markdown": md,
            "sql": sql,
            "rows": rows,
            "viz_specs": viz,
            "float_ids": floats,
        }

    # 2) NL -> SQL via model or template
    sql: Optional[str] = None
    model_text: Optional[str] = None

    pipe = _load_llm()
    if pipe is not None:
        prompt = _build_prompt(question, history=history)
        out = pipe(prompt, **_generation_kwargs)
        model_text = out[0]["generated_text"]
        sql = _extract_sql(model_text)
    else:
        sql = _template_sql(question)

    if not sql:
        raise ValueError("Model did not return a single SELECT statement.")

    # 3) Execute
    rows = execute_sql(sql, limit=limit)

    # 4) Build viz + floats + narration
    viz = _build_viz(rows)
    floats = _float_ids_from_rows(rows)
    top_preview = _top_rows_summary(rows)
    prose = narrate_result(question, sql, top_preview)

    md = f"### Summary\n{prose}\n\n```sql\n{sql}\n```\n\n**Top rows:**\n{_mk_table(rows)}"

    return {
        "answer_markdown": md,
        "sql": sql,
        "rows": rows,
        "viz_specs": viz,
        "float_ids": floats,
        "raw_model_text": model_text,  # keep for debugging if needed
    }
