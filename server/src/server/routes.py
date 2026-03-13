"""
FloatChat AI — API Routes

All HTTP endpoints. Each route orchestrates the full pipeline:
  POST /api/v1/chat       — main Q&A endpoint (non-streaming)
  POST /api/v1/feedback   — user rates/corrects an answer
  GET  /api/v1/floats     — list floats (dataset explorer)
  GET  /api/v1/trajectory/{id} — float trajectory for map
  GET  /api/v1/profile/{id}    — depth profile for a float/cycle
  GET  /api/v1/debug/{trace_id} — pipeline trace debugger
  GET  /api/v1/stats       — regional dashboard stats
"""
from __future__ import annotations

import math
import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query  # type: ignore
from pydantic import BaseModel  # type: ignore

from src.config import settings  # type: ignore
from src.chains import sql_rag_chain, rag_chain  # type: ignore
from src.rag.query_rewriter import detect_intent_fast, expand_query  # type: ignore
from src.rag.decomposer import maybe_decompose, merge_multi_hop_answers  # type: ignore
from src.memory.conversation import append_message, build_history_prompt  # type: ignore
from src.memory.knowledge_graph import get_related_context  # type: ignore
from src.memory.personalization import get_user_preferences  # type: ignore
from src.db.postgres import (  # type: ignore
    run_sql, nearest_floats, float_trajectory,
    depth_profile, regional_stats, store_feedback,
)
from src.utils.geo import city_lookup, infer_coast_from_name  # type: ignore
from src.observability.logger import pipeline_span  # type: ignore
from src.observability.pipeline_log import store_trace, get_trace  # type: ignore

router = APIRouter()

# ── In-process trace store (most recent 500 per session) ─────────────────────
_LAST_SQL: Dict[str, str] = {}
_LAST_ROWS: Dict[str, list] = {}

OCEAN_GREETING = "🌊 "


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Request / Response models
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
class ChatIn(BaseModel):
    question: str
    session: str = "default"
    force_sql: Optional[bool] = None
    user_lat: Optional[float] = None
    user_lon: Optional[float] = None


class ChatOut(BaseModel):
    ok: bool
    answer_markdown: Optional[str] = None
    sql: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None
    viz_specs: Optional[Dict[str, Any]] = None
    float_ids: Optional[List[str]] = None
    intent: Optional[str] = None
    trace_id: Optional[str] = None
    error: Optional[str] = None


class FeedbackIn(BaseModel):
    session: str
    query: str
    sql_generated: Optional[str] = None
    answer: Optional[str] = None
    rating: int  # 1-5
    correction: Optional[str] = None
    trace_id: Optional[str] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helpers
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

# Math / smalltalk patterns
_MATH_RE  = re.compile(r"^[\d\s\+\-\*\/\%\^\(\)\.√]+$")
_TIME_RE  = re.compile(r"^\s*(time|current time|what.?s the time)\??\s*$", re.I)
_HELLO_RE = re.compile(r"^\s*(hi|hello|hey|namaste|yo|greetings)\s*$", re.I)

def _smalltalk(q: str) -> Optional[str]:
    if _HELLO_RE.match(q):
        return (f"{OCEAN_GREETING}Ahoy! I'm FloatChat AI — your ocean data copilot.\n"
                f"Ask me about salinity, temperature, oxygen, chlorophyll, float trajectories, "
                f"depth profiles, or any ocean phenomenon.")
    if _TIME_RE.match(q):
        return f"{OCEAN_GREETING}Current time: **{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}**"
    if _MATH_RE.match(q) and any(op in q for op in "+-*/%^"):
        try:
            val = float(eval(q, {"__builtins__": {}}, {}))
            return f"{OCEAN_GREETING}`{q}` = **{val}**"
        except Exception:
            pass
    return None

WINDOW_RE = re.compile(r"past\s+(\d+)\s+(day|month|year)s?", re.I)
COORD_RE  = re.compile(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)")
CITY_TOKENS = (
    "mumbai","kochi","kerala","goa","mangalore","chennai","visakhapatnam",
    "puducherry","kolkata","paradip","arabian sea","bay of bengal","equator",
)

def _extract_city(text: str) -> Optional[str]:
    tl = text.lower()
    for c in CITY_TOKENS:
        if c in tl:
            return c
    return None

def _extract_latlon(text: str) -> Optional[tuple]:
    m = COORD_RE.search(text)
    if m:
        lat, lon = float(m.group(1)), float(m.group(2))
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return (lat, lon)
    return None

def _extract_days(text: str) -> int:
    m = WINDOW_RE.search(text)
    if not m:
        return 120
    n = int(m.group(1))
    unit = m.group(2).lower()
    return n if unit == "day" else n * 30 if unit == "month" else n * 365


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /chat
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.post("/chat", response_model=ChatOut)
async def chat(inp: ChatIn):
    q = inp.question.strip()
    if not q:
        return ChatOut(ok=False, error="Empty question")  # type: ignore

    trace_id = str(uuid.uuid4())
    session  = inp.session or "default"
    history  = build_history_prompt(session, last_n=4)

    with pipeline_span(trace_id, q) as trace:
        # ── Fetch User Preferences ───────────────────────────────────────────
        prefs = get_user_preferences(session)
        if prefs and trace:
            trace.log("USER_PREFS", f"Loaded preferences for {session}", prefs=prefs)

        # ── 0) Retry trigger ─────────────────────────────────────────────────
        if q.lower().startswith("retry"):
            prev_sql = _LAST_SQL.get(session)
            if not prev_sql:
                return ChatOut(ok=True, answer_markdown=f"{OCEAN_GREETING}No previous query to retry.")
            result = await sql_rag_chain.answer(q, prior_sql=prev_sql, trace=trace)
            _LAST_SQL[session] = result.get("sql") or prev_sql
            _LAST_ROWS[session] = result.get("rows") or []
            append_message(session, "assistant", result["answer_markdown"])
            return ChatOut(ok=True, **{k: result.get(k) for k in  # type: ignore
                           ["answer_markdown","sql","rows","viz_specs","float_ids"]},
                           intent="RETRY", trace_id=trace_id)

        # ── 1) Smalltalk fast path ─────────────────────────────────────────
        st = _smalltalk(q)
        if st:
            trace.log("INTENT", "SMALLTALK")
            append_message(session, "user", q)
            append_message(session, "assistant", st)
            return ChatOut(ok=True, answer_markdown=st, intent="SMALLTALK", trace_id=trace_id)

        # ── 2) Intent detection ────────────────────────────────────────────
        intent = detect_intent_fast(q)
        if not intent:
            from src.models.ollama_client import rewrite_query  # type: ignore
            q_rw, intent = await rewrite_query(q, history)
            # type: ignore to silence IDE confusion on string slicing
            trace.log("REWRITE", f"LLM rewrite: {str(q_rw)[:60]} | intent={intent}",
                      rewritten=q_rw, intent=intent)
            q = q_rw
        else:
            trace.log("INTENT", f"Fast-path intent: {intent}")

        append_message(session, "user", q)

        result: Dict[str, Any] = {}

        # ── 3) NEAREST_FLOAT path ─────────────────────────────────────────
        if intent == "NEAREST_FLOAT" and not inp.force_sql:
            anchor = _extract_latlon(q)
            if not anchor:
                city_name = _extract_city(q)
                if city_name:
                    info = city_lookup(city_name)
                    if info:
                        anchor = (info["lat"], info["lon"])
            if not anchor and inp.user_lat and inp.user_lon:
                anchor = (inp.user_lat, inp.user_lon)

            if anchor:
                trace.log("SQL_EXEC", f"PostGIS nearest-float query at {anchor[0]:.3f},{anchor[1]:.3f}")
                days = _extract_days(q)
                rows = nearest_floats(lat=anchor[0], lon=anchor[1], days_window=days, limit=10)
                trace.log("SQL_EXEC", f"{len(rows)} nearest floats found", row_count=len(rows))
                from src.utils.viz_builder import build_viz_specs  # type: ignore
                viz = build_viz_specs(rows, q)
                from src.models.ollama_client import narrate_results  # type: ignore
                import json
                prose = await narrate_results(q, "(spatial query)", json.dumps(rows[:5], default=str))
                md = f"### 🌊 Nearest ARGO Floats\n{prose}\n\n" + _fmt_float_table(rows)
                result = {"answer_markdown": md, "sql": None, "rows": rows,
                          "viz_specs": viz, "float_ids": [str(r.get("platform_number","")) for r in rows[:5]]}

        # ── 4) MULTI_HOP decomposition ────────────────────────────────────
        if not result and intent == "MULTI_HOP":
            trace.log("DECOMPOSE", "Decomposing multi-hop query")
            decomposed, subqs = await maybe_decompose(q)
            if decomposed:
                trace.log("DECOMPOSE", f"Split into {len(subqs)} sub-queries", subqueries=subqs)
                sub_answers = []
                for sq in subqs:
                    sq_intent = detect_intent_fast(sq)
                    if sq_intent == "NEAREST_FLOAT":
                        sub_r = await rag_chain.answer(sq, trace=trace)
                    else:
                        sub_r = await sql_rag_chain.answer(sq, history_str=history, trace=trace)
                    sub_answers.append(sub_r)
                result = merge_multi_hop_answers(sub_answers, q)

        # ── 5) SEMANTIC path ──────────────────────────────────────────────
        if not result and intent == "SEMANTIC":
            trace.log("VECTOR", "Routing to semantic RAG chain")
            result = await rag_chain.answer(q, trace=trace)

        # ── 6) SQL_DATA path (default) ────────────────────────────────────
        if not result:
            trace.log("SQL_GEN", "Routing to SQL RAG chain")
            result = await sql_rag_chain.answer(q, history_str=history, trace=trace)

        # ── 7) Store trace + session ──────────────────────────────────────
        _LAST_SQL[session]  = result.get("sql") or ""
        _LAST_ROWS[session] = result.get("rows") or []
        append_message(session, "assistant", result.get("answer_markdown",""))
        store_trace(trace_id, trace.to_dict())

        return ChatOut(  # type: ignore
            ok=True,
            answer_markdown=result.get("answer_markdown"),
            sql=result.get("sql"),
            rows=result.get("rows"),
            viz_specs=result.get("viz_specs"),
            float_ids=result.get("float_ids"),
            intent=intent,
            trace_id=trace_id,
        )


def _fmt_float_table(rows: list) -> str:
    if not rows:
        return "_No floats found in range._"
    hdr  = "| Float | Time | Lat | Lon | Dist (km) | Temp °C | Salinity PSU |\n"
    hdr += "|---|---|---:|---:|---:|---:|---:|\n"
    body = []
    for r in rows[:8]:
        body.append(
            f"| {r.get('platform_number','')} | {str(r.get('time',''))[:16]} | "
            f"{float(r.get('latitude',0)):.3f} | {float(r.get('longitude',0)):.3f} | "
            f"{float(r.get('km',0)):.1f} | {r.get('temp','-')} | {r.get('psal','-')} |"
        )
    return hdr + "\n".join(body)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /feedback
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.post("/feedback")
async def submit_feedback(fb: FeedbackIn):
    from src.memory.feedback import process_user_feedback
    trace = get_trace(fb.trace_id) if fb.trace_id else None
    fid = await process_user_feedback(
        session_id=fb.session, query=fb.query, sql_generated=fb.sql_generated,
        answer=fb.answer, rating=fb.rating, correction=fb.correction,
        trace=trace,
    )
    return {"ok": True, "feedback_id": fid}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /trajectory/{platform_number}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/trajectory/{platform_number}")
async def get_trajectory(
    platform_number: int,
    days: int = Query(default=365, ge=1, le=3650),
):
    rows = float_trajectory(platform_number, days=days)
    if not rows:
        raise HTTPException(404, f"No trajectory data for float {platform_number}")
    return {"platform_number": platform_number, "days": days, "points": rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /profile/{platform_number}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/profile/{platform_number}")
async def get_profile(
    platform_number: int,
    cycle: Optional[int] = None,
):
    rows = depth_profile(platform_number=platform_number, cycle_number=cycle)
    if not rows:
        raise HTTPException(404, f"No profile data for float {platform_number}")
    return {"platform_number": platform_number, "cycle": cycle, "measurements": rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /stats
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/stats")
async def get_stats(
    region: str = Query(default="arabian_sea"),
    variable: str = Query(default="temp"),
    days: int = Query(default=30),
):
    stats = regional_stats(region=region, variable=variable, days=days)
    return {"region": region, "variable": variable, "days": days, "stats": stats}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /debug/{trace_id}
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
@router.get("/debug/{trace_id}")
async def get_debug_trace(trace_id: str):
    trace = get_trace(trace_id)
    if not trace:
        raise HTTPException(404, f"Trace {trace_id} not found")
    return trace
