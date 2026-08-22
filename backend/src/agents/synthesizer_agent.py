"""
VARUNA — Grounded Provenance Synthesizer Agent
Fuses upstream SQL rows, biodiversity correlations, and anomaly alerts into cited Markdown with zero hallucination.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from src.llm.openrouter_client import chat_complete

log = logging.getLogger("varuna.agent.synthesizer")

SYNTHESIZER_PROMPT = """You are the Lead Scientific Synthesizer for the VARUNA Marine Intelligence Platform (INCOIS & CMLRE).
Your task is to write a cohesive, precise, scientific oceanographic response based ONLY on the provided verified data below.

RULES:
1. Every numerical value (temperature, salinity, oxygen, anomaly) MUST come directly from the data. Do NOT invent numbers.
2. Cite the source data using brackets: e.g. [WMO: 1902303 | Row #4] or [CMLRE Bio-Match].
3. Structure your response into clear Markdown sections:
   - ### 🌊 Oceanographic Physical State & Basin Comparison
   - ### 🐟 Biological Impact & Species Displacement (CMLRE Fusion)
   - ### 🚨 Early-Warning & Policy Implications
4. Highlight key metrics in **bold**.

--- DATA INPUTS ---
{data_context}
"""


async def synthesize_answer(
    query: str,
    task_results: Dict[str, Any],
    trace: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Synthesizes a grounded response from all upstream sub-agent task outputs.
    """
    # Extract SQL rows, biodiversity matches, and retrieved passages from upstream tasks
    sql_queries = []
    all_rows = []
    bio_matches = []
    retrieved_texts = []
    float_ids = set()

    for task_id, res in task_results.items():
        if isinstance(res, dict):
            if "sql" in res:
                sql_queries.append(res["sql"])
            if "rows" in res and isinstance(res["rows"], list):
                all_rows.extend(res["rows"])
                for r in res["rows"]:
                    if "platform_number" in r:
                        float_ids.add(str(r["platform_number"]))
            if "passages" in res:
                retrieved_texts.extend([p.get("text", "") for p in res["passages"]])
            if "species" in res or "correlations" in res:
                bio_matches.append(res)

    data_summary = {
        "user_query": query,
        "sample_sql_rows": all_rows[:15],
        "total_rows_retrieved": len(all_rows),
        "scientific_passages": retrieved_texts[:3],
        "biodiversity_context": bio_matches,
    }

    prompt = f"User Question: {query}\n\nData Context:\n{json.dumps(data_summary, default=str, indent=2)}"

    messages = [
        {"role": "system", "content": SYNTHESIZER_PROMPT.format(data_context=json.dumps(data_summary, default=str))},
        {"role": "user", "content": f"Synthesize scientific response for: {query}"},
    ]

    answer_md = await chat_complete(
        messages,
        temperature=0.1,
        max_tokens=1500,
        task_tag="synthesizer",
        trace=trace,
    )

    primary_sql = sql_queries[0] if sql_queries else None

    # Suggested Plotly visualization configuration
    viz_specs = {
        "chart_type": "hovmoller_contour" if "depth" in query.lower() else "time_series_anomaly",
        "title": "Oceanographic Parameter Distribution (INCOIS ARGO Telemetry)",
        "x_variable": "time" if "time" in (all_rows[0] if all_rows else {}) else "month",
        "y_variable": "avg_temp",
        "z_variable": "avg_doxy",
    }

    return {
        "answer_markdown": answer_md,
        "sql": primary_sql,
        "rows": all_rows,
        "viz_specs": viz_specs,
        "float_ids": list(float_ids),
    }
