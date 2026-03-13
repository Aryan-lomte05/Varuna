# -*- coding: utf-8 -*-
# Hinglish: Compact SQL chain â€” deterministic SQL + extreme context + relax window + narration.

from __future__ import annotations
import re
from typing import List, Dict, Any, Optional

from src.database.postgres import run_sql as execute_sql
from src.config import settings
from src.chains.sql_extremes import detect_extreme, build_context_sql
from src.chains.narrate import load_narrator, narrate

OCEAN_GREETING = "ðŸŒŠ ahoy!"
MAX_ROWS_RETURN = 300

def _extract_base_where(sql: str) -> tuple[str, Optional[str]]:
    """
    Hinglish: FROM ... WHERE ... slice nikaal lo; aur ORDER BY time hint pakad lo.
    """
    low = sql.lower()
    if " from " not in low:
        return "", None
    from_idx = low.index(" from ")
    tail = sql[from_idx:]

    where_idx = tail.lower().find(" where ")
    group_idx = tail.lower().find(" group by ")
    order_idx = tail.lower().find(" order by ")
    limit_idx = tail.lower().rfind(" limit ")

    cut_end = len(tail)
    for idx in [group_idx, order_idx, limit_idx]:
        if idx != -1:
            cut_end = min(cut_end, idx)

    base_where = tail[:cut_end].strip()
    time_order_hint = None
    if order_idx != -1:
        ob = tail[order_idx: limit_idx if limit_idx != -1 else None]
        if "time" in ob.lower():
            time_order_hint = ob
    return base_where, time_order_hint

def _relax_time(sql: str) -> str:
    """
    Hinglish: 'INTERVAL N days' ko 3x karo (cap 3650).
    """
    def _rep(m):
        n = int(m.group(1))
        return f"INTERVAL '{min(n*3, 3650)} days'"
    return re.sub(r"INTERVAL\s+'(\d+)\s+days'", _rep, sql, flags=re.I)

def _mk_table(rows: List[Dict[str, Any]]) -> List[str]:
    if not rows:
        return ["_No rows._"]
    head = "| platform | time (UTC) | lat | lon | temp | psal | doxy | chla |\n|---|---:|---:|---:|---:|---:|---:|---:|"
    body = []
    for r in rows[:5]:
        body.append(
            f"| {r.get('platform_number','')} | {r.get('time','')} | "
            f"{round(float(r.get('latitude',0) or 0),4)} | {round(float(r.get('longitude',0) or 0),4)} | "
            f"{r.get('temp','')} | {r.get('psal','')} | {r.get('doxy','')} | {r.get('chla','')} |"
        )
    return [head, *body]

def answer(question: str, sql: str, history: Optional[List[Dict[str, str]]] = None) -> Dict[str, Any]:
    """
    Hinglish: deterministic path â€” aap pehle se SQL bana rahe ho (NLâ†’SQL model/template se).
    Is function ka kaam: execute + extremes context + relax retry + narration + markdown.
    """
    md: List[str] = [f"{OCEAN_GREETING} ### Result Summary"]
    viz: Dict[str, Any] = {"charts": [], "map": None, "float_ids": []}

    # 1) primary execution
    rows = execute_sql(sql, limit=MAX_ROWS_RETURN) or []
    md.append(f"- Rows returned: **{len(rows)}**")

    # 2) extremes context (MIN/MAX) + optional relax-once
    ext = detect_extreme(sql)
    context_rows: List[Dict[str, Any]] = []
    relaxed_once = False

    def try_context(_sql: str):
        nonlocal context_rows
        base_where, t_hint = _extract_base_where(_sql)
        if not base_where or not ext:
            return
        fn, col = ext
        ctx_sql = build_context_sql(base_where, t_hint, col, fn)
        context_rows = execute_sql(ctx_sql, limit=5) or []

    if ext:
        try_context(sql)

    if (len(rows) == 0 or (ext and len(context_rows) == 0)) and not relaxed_once:
        relaxed_once = True
        rsql = _relax_time(sql)
        rows = execute_sql(rsql, limit=MAX_ROWS_RETURN) or []
        if ext:
            try_context(rsql)
        md.append("\n_Note: initial window returned no/insufficient rows. I tried a relaxed time window once._")

    # 3) float ids for viz from context
    if context_rows:
        viz["float_ids"] = sorted({str(r.get("platform_number")) for r in context_rows if r.get("platform_number")})
        if not viz.get("map"):
            viz["map"] = {"lat": "latitude", "lon": "longitude", "path_by": None}

    # 4) narration (English) from your LoRA model
    try:
        load_narrator(settings.base_model, getattr(settings, "lora_out", None))
        summary = narrate(sql, rows, prompt_hint=question)
        if summary:
            md.insert(1, summary)
    except Exception:
        pass  # Hinglish: narration me error hua to ignore

    # 5) show SQL + table
    md.extend([
        "\n**SQL**:",
        "```sql",
        sql.strip(),
        "```",
        "\n**Top rows:**"
    ])
    if rows:
        md.extend(_mk_table(rows))
    else:
        md.append("_No rows._")

    # 6) context table (for min/max)
    if ext and context_rows:
        md.extend(["\n**Context rows (for viz):**", *_mk_table(context_rows)])

    return {
        "ok": True,
        "answer_markdown": "\n".join(md),
        "sql": sql,
        "rows": rows,
        "viz_specs": viz,
        "float_ids": viz.get("float_ids", []),
    }
