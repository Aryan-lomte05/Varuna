"""
FloatChat AI - API Routes

All HTTP endpoints. Each route orchestrates the full pipeline:
  POST /api/v1/chat       - main Q&A endpoint (non-streaming)
  POST /api/v1/feedback   - user rates/corrects an answer
  GET  /api/v1/floats     - list floats (dataset explorer)
  GET  /api/v1/trajectory/{id} - float trajectory for map
  GET  /api/v1/profile/{id}    - depth profile for a float/cycle
  GET  /api/v1/debug/{trace_id} - pipeline trace debugger
  GET  /api/v1/stats       - regional dashboard stats
"""
from __future__ import annotations

import re
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.chains import sql_rag_chain, rag_chain
from src.rag.query_rewriter import detect_intent_fast
from src.rag.decomposer import maybe_decompose, merge_multi_hop_answers
from src.memory.conversation import append_message, build_history_prompt
from src.memory.personalization import get_user_preferences
from src.database.postgres import (
    nearest_floats,
    float_trajectory,
    depth_profile,
    regional_stats,
)
from src.utils.geo import city_lookup
from src.observability.logger import pipeline_span
from src.observability.pipeline_log import store_trace, get_trace

router = APIRouter()

# ━━ In-process trace store ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
_LAST_SQL: Dict[str, str] = {}
_LAST_ROWS: Dict[str, List[Dict[str, Any]]] = {}

OCEAN_GREETING = "🌊 "

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Request / Response Models
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class ChatIn(BaseModel):
    question: Optional[str] = None
    query: Optional[str] = None
    session: Optional[str] = "default"
    session_id: Optional[str] = None
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
    rating: int
    correction: Optional[str] = None
    trace_id: Optional[str] = None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Smalltalk detection
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

_MATH_RE = re.compile(r"^[\d\s\+\-\*\/\%\^\(\)\.]+$")
_TIME_RE = re.compile(r"^\s*(time|current time|what.?s the time)\??\s*$", re.I)
_HELLO_RE = re.compile(r"^\s*(hi|hello|hey|namaste|yo|greetings)\s*$", re.I)


def _smalltalk(q: str) -> Optional[str]:
    if _HELLO_RE.match(q):
        return (
            f"{OCEAN_GREETING}Ahoy! I'm FloatChat AI — your ocean data copilot.\n"
            f"Ask me about salinity, temperature, oxygen, chlorophyll, "
            f"float trajectories, or depth profiles."
        )

    if _TIME_RE.match(q):
        return f"{OCEAN_GREETING}Current time: **{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}**"

    if _MATH_RE.match(q) and any(op in q for op in "+-*/%^"):
        try:
            val = float(eval(q, {"__builtins__": {}}, {}))
            return f"{OCEAN_GREETING}`{q}` = **{val}**"
        except Exception:
            pass

    return None


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Helper functions
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

COORD_RE = re.compile(r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)")

CITY_TOKENS = (
    "mumbai","kochi","goa","chennai","kolkata",
    "arabian sea","bay of bengal","equator"
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
        return (lat, lon)
    return None

def _extract_days(text: str) -> int:
    m = re.search(r"(\d+)\s*(day|month|year)", text.lower())
    if not m:
        return 365
    n = int(m.group(1))
    unit = m.group(2)
    return n if unit == "day" else n * 30 if unit == "month" else n * 365


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /chat
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/chat", response_model=ChatOut)
async def chat(inp: ChatIn):

    q = (inp.question or inp.query or "").strip()
    if not q:
        return ChatOut(ok=False, error="Empty question")

    trace_id = str(uuid.uuid4())
    session = inp.session or inp.session_id or "default"

    history = build_history_prompt(session, last_n=4)

    with pipeline_span(trace_id, q) as trace:

        prefs = get_user_preferences(session)
        if prefs and trace:
            trace.log("USER_PREFS", "Loaded preferences", prefs=prefs)

        st = _smalltalk(q)
        if st:
            append_message(session, "user", q)
            append_message(session, "assistant", st)

            return ChatOut( # type: ignore
                ok=True,
                answer_markdown=st,
                intent="SMALLTALK",
                trace_id=trace_id,
            )

        intent = detect_intent_fast(q)
        append_message(session, "user", q)

        result: Dict[str, Any] = {}

        if intent == "NEAREST_FLOAT":

            anchor = _extract_latlon(q)

            if not anchor:
                city_name = _extract_city(q)
                if city_name:
                    info = city_lookup(city_name)
                    if info:
                        anchor = (info["lat"], info["lon"])

            if anchor:
                rows = nearest_floats(
                    lat=anchor[0],
                    lon=anchor[1],
                    days_window=120,
                    limit=10,
                )

                md = f"### 🌊 Nearest ARGO Floats\n\n" + _fmt_float_table(rows)

                result = {
                    "answer_markdown": md,
                    "rows": rows,
                    "float_ids": [str(r.get("platform_number")) for r in rows[:5]],
                }

        if not result and intent == "SEMANTIC":
            result = await rag_chain.answer(q, trace=trace)

        if not result:
            result = await sql_rag_chain.answer(q, history_str=history, trace=trace)

        _LAST_SQL[session] = result.get("sql", "")
        _LAST_ROWS[session] = result.get("rows", [])

        append_message(session, "assistant", result.get("answer_markdown", ""))

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


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Table formatting
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _fmt_float_table(rows: List[Dict[str, Any]]) -> str:

    if not rows:
        return "_No floats found._"

    hdr = "| Float | Time | Lat | Lon | Dist (km) |\n"
    hdr += "|---|---|---:|---:|---:|\n"

    body = []

    chunk = rows[:8] if isinstance(rows, list) else list(rows)[:8]

    for r in chunk:
        t_str = str(r.get("time", ""))[:16]

        body.append(
            f"| {r.get('platform_number','')} "
            f"| {t_str} "
            f"| {float(r.get('latitude',0)):.3f} "
            f"| {float(r.get('longitude',0)):.3f} "
            f"| {float(r.get('km',0)):.1f} |"
        )

    return hdr + "\n".join(body)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# POST /feedback
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.post("/feedback")
async def submit_feedback(fb: FeedbackIn):

    from src.memory.feedback import process_user_feedback

    trace = get_trace(fb.trace_id) if fb.trace_id else None

    fid = await process_user_feedback(
        session_id=fb.session,
        query=fb.query,
        sql_generated=fb.sql_generated,
        answer=fb.answer,
        rating=fb.rating,
        correction=fb.correction,
        trace=trace,
    )

    return {"status": "ok", "feedback_id": fid}


# -------------------------------------------------------------------------------
# GET /floats
# -------------------------------------------------------------------------------

@router.get("/floats")
async def list_floats(limit: int = 50):

    from src.database.postgres import get_active_floats

    return get_active_floats(limit=limit)


# -------------------------------------------------------------------------------
# GET /trajectory
# -------------------------------------------------------------------------------

@router.get("/trajectory/{platform_number}")
async def get_trajectory(platform_number: int, days: int = Query(default=365)):

    rows = float_trajectory(platform_number, days=days)

    if not rows:
        raise HTTPException(404, "No trajectory data")

    return {"platform_number": platform_number, "points": rows}


# -------------------------------------------------------------------------------
# GET /profile
# -------------------------------------------------------------------------------

@router.get("/profile/{platform_number}")
async def get_profile(platform_number: int, cycle: Optional[int] = None):

    rows = depth_profile(platform_number=platform_number, cycle_number=cycle)

    if not rows:
        raise HTTPException(404, "No profile data")

    return {"platform_number": platform_number, "cycle": cycle, "measurements": rows}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /stats
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/stats")
async def get_stats(
    region: str = Query(default="arabian_sea"),
    variable: str = Query(default="temp"),
    days: int = Query(default=30),
):

    stats = regional_stats(region=region, variable=variable, days=days)

    return {"region": region, "variable": variable, "days": days, "stats": stats}


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /debug
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/debug/{trace_id}")
async def get_debug_trace(trace_id: str):

    trace = get_trace(trace_id)

    if not trace:
        raise HTTPException(404, f"Trace {trace_id} not found")

    return trace


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# GET /export
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@router.get("/export")
async def export_data(
    sql: str = Query(default="SELECT * FROM public.marine_data LIMIT 100"),
    format: str = Query(default="csv"),
):
    from fastapi.responses import Response
    from src.database.postgres import run_sql
    from src.utils.export_service import format_export

    rows = run_sql(sql, limit=1000)
    content, media_type, filename = format_export(rows, format)

    return Response(
        content=content if isinstance(content, bytes) else content.encode("utf-8"),
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# MCP Endpoints
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class MCPCallIn(BaseModel):
    name: str
    arguments: Dict[str, Any] = {}


@router.get("/mcp/tools")
async def mcp_list_tools():
    from src.mcp.mcp_server import list_mcp_tools
    return {"tools": list_mcp_tools()}


@router.post("/mcp/call")
async def mcp_call_tool(call: MCPCallIn):
    from src.mcp.mcp_server import call_mcp_tool
    try:
        res = call_mcp_tool(call.name, call.arguments)
        return {"status": "ok", "result": res}
    except Exception as e:
        raise HTTPException(400, str(e))