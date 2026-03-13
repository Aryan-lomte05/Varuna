
from __future__ import annotations

import os
import re
import math
from datetime import datetime
from typing import Optional, Dict, Any, List, Tuple
from collections import defaultdict, deque
from fastapi.responses import ORJSONResponse
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from src.chains.sql_rag_chain import answer as sql_answer  # your LLM/RAG SQL router
from src.db.postgres import nearest_floats  # deterministic nearest-floats lookup
from src.utils.geo import city_lookup, infer_coast_from_name  # city → (lat,lon,coast)

# -------------------------------
# Env switches
# -------------------------------
APP_ENV = os.getenv("FLOATCHAT_APP_ENV", "dev")
CORS_ORIGINS = os.getenv(
    "FLOATCHAT_CORS_ORIGINS",
    "http://localhost:5173,http://127.0.0.1:5173",
)
FORCE_SQL_DEFAULT = os.getenv("FLOATCHAT_FORCE_SQL_DEFAULT", "false").lower() == "true"

# -------------------------------
# App + CORS
# -------------------------------
app = FastAPI(
    title="FLOATCHATAI 🌊",
    description="Ocean-data SQL RAG API (tiny-friendly, English output)",
    version="1.2.1",
    default_response_class=ORJSONResponse,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in CORS_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Optional static playground if folder exists
public_dir = os.path.join(os.getcwd(), "public")
if os.path.isdir(public_dir):
    app.mount("/play", StaticFiles(directory="public", html=True), name="play")

# -------------------------------
# Models (define BEFORE routes)
# -------------------------------
class ChatIn(BaseModel):
    question: str
    session: Optional[str] = "default"
    force_sql: Optional[bool] = None

class ChatOut(BaseModel):
    ok: bool
    answer_markdown: Optional[str] = None
    sql: Optional[str] = None
    rows: Optional[List[Dict[str, Any]]] = None
    viz_specs: Optional[Dict[str, Any]] = None
    float_ids: Optional[List[Any]] = None
    error: Optional[str] = None

# -------------------------------
# Inline /play (also works without public/)
# -------------------------------
PLAY_HTML = """
<!doctype html><html><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>FloatchatAI – /play</title>
<style>
body{font-family:system-ui,ui-sans-serif,Segoe UI,Helvetica,Arial,sans-serif;margin:2rem;max-width:980px}
textarea{width:100%;height:140px}pre{background:#0b1220;color:#d6e1ff;padding:12px;border-radius:8px;white-space:pre-wrap}
kbd{padding:.15rem .4rem;border:1px solid #ccc;border-bottom-width:3px;border-radius:6px;background:#f9f9f9}
small{color:#4a5568}
</style>
</head><body>
<h1>FloatchatAI – /play</h1>
<p><b>Backend:</b> <code>http://127.0.0.1:8001/chat</code> · <b>Vite dev (optional):</b> <code>http://127.0.0.1:5173</code></p>
<p><b>Examples:</b></p>
<ul>
  <li>Top 10 floats by average doxy in the NE Arabian Sea over the past 45 days.</li>
  <li>Show the max of temp near Kerala over the past 100 days. (windowed stat)</li>
  <li>Give me a depth profile at lat 19.1 and lon 72.85 at time 2025-07-03 10:05:00 where temperature is 28.5 °C</li>
  <li>Show the min of temp in the Arabian Sea over the past 30 days.</li>
</ul>
<textarea id="q" placeholder="Ask an ocean question..."></textarea>
<div style="margin:.5rem 0;display:flex;gap:.5rem;align-items:center">
  <label><input id="force" type="checkbox"/> force_sql</label>
  <button onclick="go()">Ask</button> <small>Tip: <kbd>Enter</kbd> submits · <kbd>Shift</kbd>+<kbd>Enter</kbd> newline</small>
</div>
<div id="out"></div>
<script>
async function go(){
  const out = document.getElementById('out');
  out.innerHTML = '⏳ querying...';
  const r = await fetch('/chat',{method:'POST',headers:{'Content-Type':'application/json'},
              body:JSON.stringify({question:document.getElementById('q').value, force_sql: document.getElementById('force').checked})});
  const j = await r.json();
  function block(t){ return '<pre>'+ (t||'') +'</pre>'; }
  out.innerHTML = '<h3>Answer</h3>'+block(j.answer_markdown)
                + '<h3>SQL</h3>'+block(j.sql)
                + '<h3>Rows</h3>'+block(JSON.stringify(j.rows||[],null,2))
                + '<h3>Viz</h3>'+block(JSON.stringify(j.viz_specs||{},null,2))
                + '<h3>Floats</h3>'+block(JSON.stringify(j.float_ids||[],null,2));
}
document.getElementById('q').addEventListener('keydown', (e)=>{
  if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); go(); }
});
</script>
</body></html>
"""

@app.get("/play", response_class=HTMLResponse)
def play_page():
    return HTMLResponse(PLAY_HTML)

# -------------------------------
# Memory + utilities
# -------------------------------
MEMORY: Dict[str, deque] = defaultdict(lambda: deque(maxlen=20))
LAST_SQL: Dict[str, str] = {}
LAST_ROWS: Dict[str, List[dict]] = {}
OCEAN_GREETING = "🌊 ahoy! "

TIME_FULL = re.compile(r"^\s*(?:what(?:'s| is)\s+the\s+time\??|current\s+time\??|time\??)\s*$", re.I)
HELLO_FULL = re.compile(r"^\s*(?:hi|hello|hey|namaste|yo)\s*$", re.I)
MATH_FULL  = re.compile(r"^\s*[-+/*()\d.\s%^\u221a]+\s*$")  # allow √

def _safe_eval(expr: str) -> Optional[float]:
    try:
        if not MATH_FULL.fullmatch(expr):
            return None
        return float(eval(expr, {"__builtins__": {}}, {"__name__": None, "math": math}))
    except Exception:
        return None

def smalltalk_or_tools(text: str) -> Optional[str]:
    t = text.strip()
    if MATH_FULL.fullmatch(t) and any(op in t for op in "+-*/%^"):
        val = _safe_eval(t)
        if val is not None:
            return f"{OCEAN_GREETING}quick calculation:\n\n**Expression:** `{t}` → **{val}**"
    if TIME_FULL.fullmatch(t):
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        return f"{OCEAN_GREETING}current time is **{now}**."
    if HELLO_FULL.fullmatch(t):
        return f"{OCEAN_GREETING}I can answer about salinity, oxygen, chlorophyll, depth profiles, and nearest floats."
    return None

# -------------------------------
# Near intent (city / “near me”) + window parsing
# -------------------------------
CITY_TOKENS = (
    # coastal India + basins (+ a few common misspellings)
    "mumbai","kochi","kerala","goa","mangalore","porbandar",
    "chennai","visakhapatnam","vishakhapatnam","puducherry","kolkata","paradip",
    "kozhikode","calicut","cochin","ernakulam",
    "arabian sea","bay of bengal","equator",
)

WINDOW_RE = re.compile(r"past\s+(\d+)\s+(day|days|month|months|year|years)", re.I)

def _extract_when(text: str) -> Optional[datetime]:
    m = re.search(r"\b(20\d{2}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}(?::\d{2})?))?\b", text)
    if not m:
        return None
    date_part = m.group(1)
    time_part = m.group(2) or "00:00:00"
    try:
        return datetime.fromisoformat(f"{date_part} {time_part}")
    except Exception:
        return None

def _extract_window_days(text: str) -> Optional[int]:
    m = WINDOW_RE.search(text)
    if not m:
        return None
    n = int(m.group(1))
    unit = m.group(2).lower()
    if unit.startswith("day"): return n
    if unit.startswith("month"): return n * 30
    if unit.startswith("year"): return n * 365
    return None

def _extract_city(text: str) -> Optional[str]:
    t = text.lower()
    for name in CITY_TOKENS:
        if name in t:
            return name
    return None

COORD_RE = re.compile(
    r"""
    (?P<lat>-?\d{1,2}(?:\.\d+)?)
    \s*,\s*
    (?P<lon>-?\d{1,3}(?:\.\d+)?)
    """,
    re.X,
)

def _extract_latlon(text: str) -> Optional[Tuple[float, float]]:
    """
    Parse 'near 19.1, 72.85' style coordinates anywhere in the string.
    """
    m = COORD_RE.search(text)
    if not m:
        return None
    try:
        lat = float(m.group("lat"))
        lon = float(m.group("lon"))
        # quick sanity for oceanic ranges
        if -90 <= lat <= 90 and -180 <= lon <= 180:
            return (lat, lon)
    except Exception:
        pass
    return None

def _near_me_requested(text: str) -> bool:
    t = text.lower()
    return "near me" in t or "around me" in t or "closest to me" in t

def _format_rows(rows: List[dict]) -> str:
    if not rows:
        return "_No nearby float rows found in the requested window._"
    header = (
        "| platform | time | lat | lon | temp | psal | doxy | chla |\n"
        "|---|---:|---:|---:|---:|---:|---:|---:|"
    )
    body = []
    for r in rows:
        body.append(
            f"| {r.get('platform_number','')} | {r.get('time','')} | "
            f"{round(float(r.get('latitude',0) or 0),4)} | {round(float(r.get('longitude',0) or 0),4)} | "
            f"{r.get('temp','')} | {r.get('psal','')} | {r.get('doxy','')} | {r.get('chla','')} |"
        )
    return header + "\n" + "\n".join(body)

def handle_near_query(user_text: str, user_latlon: Optional[Tuple[float,float]]=None) -> Optional[Dict[str, Any]]:
    """
    Deterministic nearest-floats lookup with optional recency window.
    Returns a dict: {"markdown": <md string>, "rows": <list[dict]>}
    Never raises on DB errors; returns a friendly markdown instead.
    """
    when = _extract_when(user_text)
    days = _extract_window_days(user_text) or 120  # default: past 120 days

    # Priority: explicit coordinates > city name > 'near me' (if provided)
    anchor: Optional[Tuple[float, float]] = None
    prefer_coast: Optional[str] = None
    city: Optional[str] = _extract_city(user_text)

    coord = _extract_latlon(user_text)
    if coord:
        anchor = coord
        prefer_coast = None  # explicit coords don't imply coast bias
        city = None          # explicit coordinates override city display
    elif city:
        info = city_lookup(city)  # returns dict with lat/lon or None
        if info:
            anchor = (float(info["lat"]), float(info["lon"]))
            prefer_coast = info.get("coast") or infer_coast_from_name(city)
    elif _near_me_requested(user_text) and user_latlon:
        anchor = user_latlon

    if not anchor:
        return None

    # Query DB, but don't crash if DB is down.
    rows: List[dict] = []
    db_error: Optional[str] = None
    try:
        rows = nearest_floats(
            lat=anchor[0], lon=anchor[1],
            when=when, limit=5,
            west_east=prefer_coast,
            days_window=days
        )
        if not rows and when is not None:
            rows = nearest_floats(
                lat=anchor[0], lon=anchor[1],
                when=None, limit=5,
                west_east=prefer_coast,
                days_window=days
            )
    except Exception as e:
        db_error = str(e)

    md_lines: List[str] = []
    md_lines.append("### Nearest float(s)")
    if city:
        md_lines.append(
            f"- Anchor: **{city.title()}** ({anchor[0]:.4f}, {anchor[1]:.4f})"
            + (f"  · coast: **{prefer_coast}**" if prefer_coast else "")
        )
    else:
        md_lines.append(f"- Anchor: **({anchor[0]:.4f}, {anchor[1]:.4f})**")

    md_lines.append(f"- Time window: **past {days} days**")
    if when:
        md_lines.append(f"- Target time: **{when.isoformat(sep=' ')}**")
    md_lines.append("")

    if db_error:
        md_lines.append("_Database is not reachable right now, so I couldn’t fetch nearby float rows._")
        md_lines.append(f"_Error:_ `{db_error}`")
        return {"markdown": "\n".join([p for p in md_lines if p]), "rows": []}

    md_lines.append(_format_rows(rows))
    return {"markdown": "\n".join([p for p in md_lines if p]), "rows": rows}

# -------------------------------
# Quick intent check — when to route to SQL
# -------------------------------
DATA_TOKENS = (
    "buoy","float","platform","platform_number",
    "lat","lon","latitude","longitude",
    "temp","temperature","psal","salinity","doxy","oxygen","chla",
    "ph","ph_in_situ_total","nitrate","pres","pressure","depth","profile",
    "month","week","day","year","last","past","window",
    "arabian sea","bay of bengal","equator","near","around",
    "kerala","kochi","goa","mumbai","mangalore","chennai","visakhapatnam","vishakhapatnam","puducherry","kolkata","paradip",
)

def should_route_to_sql(q: str, force_sql: bool) -> bool:
    if force_sql:
        return True
    t = q.lower()
    return any(tok in t for tok in DATA_TOKENS)

# -------------------------------
# Retry/relax helper for last SQL
# -------------------------------
def _relax_sql(sql: str) -> str:
    """Widen time/tolerance if user asks 'retry' after empty results."""
    out = sql
    # widen minute windows (e.g., 60 → up to 240)
    out = re.sub(r"INTERVAL\s+'(\d+)\s+minutes'", lambda m: f"INTERVAL '{min(int(m.group(1))*4, 720)} minutes'", out, flags=re.I)
    # widen day windows (NOW()-INTERVAL 'N days' → *3 up to ~10y)
    def inc_days(m):
        n = int(m.group(1))
        return f"NOW() - INTERVAL '{min(n*3, 3650)} days'"
    out = re.sub(r"NOW\(\)\s*-\s*INTERVAL\s+'(\d+)\s+days'", inc_days, out, flags=re.I)
    # widen ABS(temp - X) < tol (0.02 → ×5 with floor 0.1)
    out = re.sub(r"ABS\(\s*temp\s*-\s*([0-9]+(?:\.[0-9]+)?)\s*\)\s*<\s*([0-9]+(?:\.[0-9]+)?)",
                 lambda m: f"ABS(temp - {m.group(1)}) < {max(float(m.group(2))*5, 0.1)}", out, flags=re.I)
    return out

# -------------------------------
# API
# -------------------------------
@app.get("/health")
def health():
    return {"ok": True}

@app.post("/chat", response_model=ChatOut)
def chat(inp: ChatIn):
    q = inp.question.strip()
    force_sql = FORCE_SQL_DEFAULT if inp.force_sql is None else bool(inp.force_sql)

    # 0) retry/relax trigger
    if q.lower().startswith("retry"):
        prev_sql = LAST_SQL.get(inp.session)
        if not prev_sql:
            msg = f"{OCEAN_GREETING}no previous SQL to retry."
            return ChatOut(ok=True, answer_markdown=msg)
        relaxed = _relax_sql(prev_sql)
        try:
            result = sql_answer("__RE-RUN__", prior_sql=relaxed)
            md = result.get("answer_markdown") or ""
            if md and not md.lstrip().startswith("🌊"):
                md = f"{OCEAN_GREETING}{md}"
            LAST_SQL[inp.session] = result.get("sql") or relaxed
            LAST_ROWS[inp.session] = result.get("rows") or []
            MEMORY[inp.session].append({"role": "assistant", "content": md})
            return ChatOut(ok=True, answer_markdown=md,
                           sql=result.get("sql"), rows=result.get("rows"),
                           viz_specs=result.get("viz_specs"),
                           float_ids=result.get("float_ids"))
        except Exception as e:
            return ChatOut(ok=False, error=str(e))

    # 1) NEAR first (unless force_sql)
    if not force_sql:
        near = handle_near_query(q)
        if near:
            md = f"{OCEAN_GREETING}{near['markdown']}"
            rows = near.get("rows") or []
            # float_ids = unique platforms for quick highlighting
            float_ids = sorted({str(r.get("platform_number")) for r in rows if r.get("platform_number")})
            viz_specs = {
                "map": {
                    "center": [rows[0]["latitude"], rows[0]["longitude"]] if rows else [10.2, 76.4],
                    "zoom": 5,
                    "points": [
                        {
                            "id": str(r.get("platform_number")),
                            "lat": float(r["latitude"]),
                            "lon": float(r["longitude"]),
                            "label": f"{r.get('platform_number')} · {r.get('time')}"
                        }
                        for r in rows
                        if r.get("latitude") is not None and r.get("longitude") is not None
                    ]
                },
                "charts": []
            }
            MEMORY[inp.session].append({"role":"assistant","content":md})
            LAST_SQL[inp.session] = ""  # deterministic path
            LAST_ROWS[inp.session] = rows
            return ChatOut(ok=True, answer_markdown=md, rows=rows, viz_specs=viz_specs, float_ids=float_ids)

    # 2) Smalltalk strict
    if not force_sql:
        handled = smalltalk_or_tools(q)
        if handled is not None:
            MEMORY[inp.session].append({"role": "assistant", "content": handled})
            LAST_SQL[inp.session] = ""
            LAST_ROWS[inp.session] = []
            return ChatOut(ok=True, answer_markdown=handled)

    # 3) Data intent?
    if not should_route_to_sql(q, force_sql):
        msg = (f"{OCEAN_GREETING}that doesn’t look like an ocean-data question. "
               f"Try salinity/oxygen/chlorophyll trends, float profiles, or regional summaries.")
        MEMORY[inp.session].append({"role": "assistant", "content": msg})
        LAST_SQL[inp.session] = ""
        LAST_ROWS[inp.session] = []
        return ChatOut(ok=True, answer_markdown=msg)

    # 4) LLM/RAG SQL route
    try:
        result: Dict[str, Any] = sql_answer(q, history=list(MEMORY[inp.session])[-4:])
        md = result.get("answer_markdown") or ""
        if md and not md.lstrip().startswith("🌊"):
            md = f"{OCEAN_GREETING}{md}"

        MEMORY[inp.session].append({"role": "assistant", "content": md})
        LAST_SQL[inp.session] = result.get("sql") or ""
        LAST_ROWS[inp.session] = result.get("rows") or []

        return ChatOut(
            ok=True,
            answer_markdown=md,
            sql=result.get("sql"),
            rows=result.get("rows"),
            viz_specs=result.get("viz_specs"),
            float_ids=result.get("float_ids"),
        )
    except Exception as e:
        return ChatOut(ok=False, error=str(e))
