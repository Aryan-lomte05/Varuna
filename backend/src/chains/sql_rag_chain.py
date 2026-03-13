"""
FloatChat AI â€” Complete SQL RAG Chain

This is the primary data query pipeline:
  1. Query rewriting + intent fast-path
  2. NL â†’ SQL via Qwen2.5:14b (Ollama)
  3. SQL sanitization (SELECT-only enforced)
  4. Execute on PostgreSQL (connection pool)
  5. Build visualization specs
  6. Narrate with Llama3 (Ollama)
  7. Return structured result

WHY still keep this as a separate chain?
  The SQL path is very different from semantic RAG:
  - It needs schema context in the prompt
  - The output is structured rows (not text chunks)
  - Viz specs depend on column names, not chunk content
  - SQL path is 80% of all marine scientist queries
"""
from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
from itertools import islice

from src.config import settings  # type: ignore
from src.database.postgres import run_sql, nearest_floats  # type: ignore
from src.llm.ollama_client import generate_sql, narrate_results  # type: ignore
from src.utils.sql_extract import extract_sql  # type: ignore
from src.utils.viz_builder import build_viz_specs  # type: ignore
from src.utils.geo import city_lookup, infer_coast_from_name  # type: ignore
from src.observability.logger import PipelineTrace  # type: ignore


# â”€â”€ Relay widening (retry with relaxed constraints) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _relax_sql(sql: str) -> str:
    """Widen time/tolerance windows on retry."""
    import re
    out = re.sub(
        r"INTERVAL '(\d+) minutes'",
        lambda m: f"INTERVAL '{min(int(m.group(1))*4, 720)} minutes'",
        sql, flags=re.I
    )
    out = re.sub(
        r"NOW\(\)\s*-\s*INTERVAL '(\d+) days'",
        lambda m: f"NOW() - INTERVAL '{min(int(m.group(1))*3, 3650)} days'",
        out, flags=re.I
    )
    return out


# â”€â”€ Markdown table renderer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
def _mk_table(rows: List[Dict[str, Any]], max_rows: int = 10) -> str:
    if not rows:
        return "_No rows returned._"
    first_row = next(iter(rows))
    cols = list(islice(first_row.keys(), 8))
    hdr  = "|" + "|".join(f"**{c}**" for c in cols) + "|\n"
    hdr += "|" + "|".join(["---"] * len(cols)) + "|"
    body = []
    
    rows_list = rows if getattr(rows, "__class__", None) == list else list(rows)
    for r in islice(rows_list, max_rows):
        vals = []
        for c in cols:
            v = r.get(c, "")
            if isinstance(v, float):
                v = f"{v:.4f}"
            vals.append("".join(islice(str(v), 30)))
        body.append("|" + "|".join(vals) + "|")
    if len(rows) > max_rows:
        body.append(f"_â€¦and {len(rows) - max_rows} more rows._")
    return hdr + "\n" + "\n".join(body)


async def answer(
    question: str,
    history_str: str = "",
    prior_sql: Optional[str] = None,
    trace: Optional[PipelineTrace] = None,
    limit: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Main SQL RAG chain entrypoint.

    Args:
        question: user question
        history_str: conversation history for context
        prior_sql: if provided, re-run this SQL (retry path)
        trace: PipelineTrace for observability
        limit: row limit override

    Returns dict with: answer_markdown, sql, rows, viz_specs, float_ids
    """
    limit = limit or settings.sql_max_rows

    # â”€â”€ Retry/relax path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if prior_sql:
        sql = extract_sql(prior_sql) or prior_sql.strip()
        sql_relaxed = _relax_sql(sql)
        if trace:
            trace.log("SQL_EXEC", f"Re-running relaxed SQL", sql="".join(islice(sql_relaxed, 120)))
        rows = run_sql(sql_relaxed, limit=limit)
        viz = build_viz_specs(rows, question)
        prose = await narrate_results(question, sql_relaxed, _preview_json(rows))
        md = _format_response(prose, sql_relaxed, rows)
        return {"answer_markdown": md, "sql": sql_relaxed, "rows": rows,
                "viz_specs": viz, "float_ids": _float_ids(rows)}

    # â”€â”€ Step 1: Generate SQL â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if trace:
        trace.log("SQL_GEN", f"Generating SQL via {settings.ollama_sql_model}")
    raw_sql = await generate_sql(question, history=history_str)
    if trace:
        trace.log("SQL_GEN", f"Raw model output: {''.join(islice(raw_sql, 80))}...", model_output="".join(islice(raw_sql, 200)))

    sql = extract_sql(raw_sql)
    if not sql:
        raise ValueError(f"Model did not produce a valid SELECT. Raw: {''.join(islice(raw_sql, 200))}")
    if trace:
        trace.log("SQL_GEN", f"Extracted SQL: {''.join(islice(sql, 80))}...", sql=sql)

    # â”€â”€ Step 2: Execute â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if trace:
        trace.log("SQL_EXEC", "Executing on PostgreSQL")
    rows = run_sql(sql, limit=limit)
    if trace:
        trace.log("SQL_EXEC", f"{len(rows)} rows returned", row_count=len(rows))

    # â”€â”€ Step 3: Viz specs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    viz = build_viz_specs(rows, question)
    if trace:
        trace.log("RESPONSE", f"Chart type: {viz.get('chart_type')} | Map points: {len((viz.get('map_data') or {}).get('points', []))}")

    # â”€â”€ Step 4: Narrate â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if trace:
        trace.log("NARRATE", f"Narrating with {settings.ollama_narrate_model}")
    prose = await narrate_results(question, sql, _preview_json(rows))
    if trace:
        trace.log("NARRATE", f"Narration: {prose}")

    md = _format_response(prose, sql, rows)
    return {
        "answer_markdown": md,
        "sql": sql,
        "rows": rows,
        "viz_specs": viz,
        "float_ids": _float_ids(rows),
    }


def _preview_json(rows: List[Dict[str, Any]], n: int = 5) -> str:
    import json
    return json.dumps(list(islice(rows if getattr(rows, "__class__", None) == list else list(rows), n)), default=str, indent=2)


def _float_ids(rows: List[Dict[str, Any]]) -> List[str]:
    return sorted({str(r.get("platform_number")) for r in rows if r.get("platform_number")})


def _format_response(prose: str, sql: str, rows: List[Dict[str, Any]]) -> str:
    return (
        f"### ðŸŒŠ Summary\n{prose}\n\n"
        f"<details>\n<summary>SQL Query Used</summary>\n\n```sql\n{sql}\n```\n</details>\n\n"
        f"### Data Preview\n{_mk_table(rows)}"
    )
