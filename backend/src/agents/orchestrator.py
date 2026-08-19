"""
VARUNA — Multi-Agent Task DAG Orchestrator Engine
Decomposes compound natural language prompts into topological task graphs,
executes sub-agents in parallel asynchronous stages, and records execution telemetry.
"""

from __future__ import annotations

import asyncio
import json
import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Set

from pydantic import BaseModel, Field

from src.agents.sql_gen_agent import execute_sql_task
from src.agents.retrieval_agent import execute_retrieval_task
from src.agents.synthesizer_agent import synthesize_answer
from src.llm.openrouter_client import chat_complete
from src.observability.tracer import pipeline_span

log = logging.getLogger("varuna.orchestrator")


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Task DAG Schemas
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

class TaskNode(BaseModel):
    task_id: str
    agent: str  # "SQL_GEN" | "BIODIVERSITY" | "RETRIEVAL" | "COMPARISON" | "SYNTHESIZER"
    params: Dict[str, Any] = Field(default_factory=dict)
    dependencies: List[str] = Field(default_factory=list)


class ExecutionPlan(BaseModel):
    plan_id: str = Field(default_factory=lambda: f"plan_{uuid.uuid4().hex[:8]}")
    tasks: List[TaskNode] = Field(default_factory=list)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Planner Prompt
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

PLANNER_SYSTEM_PROMPT = """You are the Lead Multi-Agent DAG Planner for the VARUNA Ocean Intelligence System.
Your job is to analyze the user's natural language question and decompose it into a JSON Execution Plan of sub-tasks.

AVAILABLE AGENTS:
1. SQL_GEN: Queries PostgreSQL public.marine_data for physical/chemical ocean float observations (temp, psal, doxy, chla, nitrate).
2. BIODIVERSITY: Queries CMLRE marine living resources (species taxonomy, thermal tolerances, occurrence records).
3. RETRIEVAL: Searches scientific oceanographic knowledge and literature.
4. SYNTHESIZER: Merges all upstream task results into a final grounded scientific answer.

OUTPUT FORMAT (Valid JSON only):
{
  "plan_id": "plan_unique_id",
  "tasks": [
    {
      "task_id": "task_01_sql",
      "agent": "SQL_GEN",
      "params": {"query_goal": "Query Arabian Sea temperature and dissolved oxygen last 6 months"},
      "dependencies": []
    },
    {
      "task_id": "task_02_bio",
      "agent": "BIODIVERSITY",
      "params": {"species": "Sardinella longiceps"},
      "dependencies": ["task_01_sql"]
    },
    {
      "task_id": "task_03_synth",
      "agent": "SYNTHESIZER",
      "params": {"format": "cited_markdown"},
      "dependencies": ["task_01_sql", "task_02_bio"]
    }
  ]
}
"""


async def plan_query(
    query: str,
    history: Optional[List[Dict[str, str]]] = None,
    trace: Optional[Any] = None,
) -> ExecutionPlan:
    """
    Prompts Nemotron-550B to compile a compound query into an ExecutionPlan DAG.
    """
    messages = [
        {"role": "system", "content": PLANNER_SYSTEM_PROMPT},
        {"role": "user", "content": f"Decompose this ocean query into an Execution Plan: {query}"},
    ]

    raw_plan = await chat_complete(messages, temperature=0.0, task_tag="planner", trace=trace)

    try:
        # Extract JSON from code blocks if present
        cleaned = raw_plan.strip()
        if "```json" in cleaned:
            cleaned = cleaned.split("```json")[1].split("```")[0].strip()
        elif "```" in cleaned:
            cleaned = cleaned.split("```")[1].split("```")[0].strip()

        data = json.loads(cleaned)
        return ExecutionPlan(**data)
    except Exception as e:
        log.warning("Plan parsing failed, building deterministic fallback DAG: %s", str(e))
        return _build_default_plan(query)


def _build_default_plan(query: str) -> ExecutionPlan:
    """Deterministic default plan fallback."""
    is_compound = "vs" in query.lower() or "compare" in query.lower() or "species" in query.lower() or "sardine" in query.lower()

    if is_compound:
        return ExecutionPlan(
            tasks=[
                TaskNode(
                    task_id="task_01_sql_arabian",
                    agent="SQL_GEN",
                    params={"query": "SELECT DATE_TRUNC('month', time) AS month, AVG(temp) AS avg_temp, AVG(doxy) AS avg_doxy FROM public.marine_data WHERE time >= NOW() - INTERVAL '6 months' AND latitude BETWEEN 8.0 AND 22.0 AND longitude BETWEEN 58.0 AND 74.0 GROUP BY 1 ORDER BY 1;"},
                    dependencies=[]
                ),
                TaskNode(
                    task_id="task_02_sql_equator",
                    agent="SQL_GEN",
                    params={"query": "SELECT DATE_TRUNC('month', time) AS month, AVG(temp) AS avg_temp, AVG(doxy) AS avg_doxy FROM public.marine_data WHERE time >= NOW() - INTERVAL '6 months' AND latitude BETWEEN -5.0 AND 5.0 AND longitude BETWEEN 60.0 AND 90.0 GROUP BY 1 ORDER BY 1;"},
                    dependencies=[]
                ),
                TaskNode(
                    task_id="task_03_bio",
                    agent="BIODIVERSITY",
                    params={"species": "Sardinella longiceps", "radius_km": 50},
                    dependencies=["task_01_sql_arabian"]
                ),
                TaskNode(
                    task_id="task_04_synthesize",
                    agent="SYNTHESIZER",
                    params={"goal": "Synthesize basin comparison and species stress"},
                    dependencies=["task_01_sql_arabian", "task_02_sql_equator", "task_03_bio"]
                ),
            ]
        )

    return ExecutionPlan(
        tasks=[
            TaskNode(
                task_id="task_01_sql",
                agent="SQL_GEN",
                params={"query_goal": query},
                dependencies=[]
            ),
            TaskNode(
                task_id="task_02_synthesize",
                agent="SYNTHESIZER",
                params={"goal": "Synthesize SQL rows into answer"},
                dependencies=["task_01_sql"]
            )
        ]
    )


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# Topological Execution Loop
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

def _get_topological_stages(plan: ExecutionPlan) -> List[List[TaskNode]]:
    """
    Partitions tasks into parallel execution stages using topological dependency levels.
    """
    task_map = {t.task_id: t for t in plan.tasks}
    in_degree = {t.task_id: len(t.dependencies) for t in plan.tasks}
    dependents: Dict[str, List[str]] = {t.task_id: [] for t in plan.tasks}

    for t in plan.tasks:
        for dep in t.dependencies:
            if dep in dependents:
                dependents[dep].append(t.task_id)

    stages: List[List[TaskNode]] = []
    ready = [task_map[tid] for tid, deg in in_degree.items() if deg == 0]

    visited_count = 0
    while ready:
        stages.append(ready)
        next_ready = []
        for node in ready:
            visited_count += 1
            for child_id in dependents[node.task_id]:
                in_degree[child_id] -= 1
                if in_degree[child_id] == 0:
                    next_ready.append(task_map[child_id])
        ready = next_ready

    if visited_count < len(plan.tasks):
        log.warning("Cycle detected in ExecutionPlan DAG! Falling back to sequential execution.")
        return [[t] for t in plan.tasks]

    return stages


async def plan_and_execute(
    query: str,
    session_id: str = "default",
    user_lat: Optional[float] = None,
    user_lon: Optional[float] = None,
) -> Dict[str, Any]:
    """
    End-to-end execution of compound query via Multi-Agent Task DAG.
    """
    trace_id = str(uuid.uuid4())
    start_total = time.perf_counter()

    with pipeline_span(trace_id, query) as trace:
        # Step 1: Decompose query into Task DAG
        plan = await plan_query(query, trace=trace)
        stages = _get_topological_stages(plan)

        task_results: Dict[str, Any] = {}
        execution_steps = []

        # Step 2: Execute stages topologically (parallel level execution)
        for stage_idx, stage_nodes in enumerate(stages):
            trace.log("DAG_STAGE", f"Executing Stage {stage_idx + 1} ({len(stage_nodes)} parallel tasks)")

            async def _run_single_task(node: TaskNode) -> tuple[str, Dict[str, Any], float]:
                t0 = time.perf_counter()
                res: Dict[str, Any] = {}

                try:
                    if node.agent == "SQL_GEN":
                        res = await execute_sql_task(node.params.get("query_goal", query), params=node.params, trace=trace)
                    elif node.agent == "RETRIEVAL":
                        res = await execute_retrieval_task(node.params.get("query", query), params=node.params, trace=trace)
                    elif node.agent == "BIODIVERSITY":
                        from src.api.routes import correlate_species
                        correlations = await correlate_species(species=node.params.get("species", "Sardinella longiceps"))
                        res = {"correlations": [c.dict() for c in correlations], "species": node.params.get("species")}
                    elif node.agent == "SYNTHESIZER":
                        res = await synthesize_answer(query, task_results=task_results, trace=trace)
                    else:
                        res = {"status": "SKIPPED", "agent": node.agent}
                except Exception as e:
                    log.error("Task failed: %s", node.task_id, exc_info=True)
                    res = {"error": str(e), "status": "FAILED"}

                dur_ms = (time.perf_counter() - t0) * 1000.0
                return node.task_id, res, dur_ms

            # Run all tasks in current stage concurrently
            results = await asyncio.gather(*[_run_single_task(n) for n in stage_nodes])

            for tid, result_data, duration_ms in results:
                task_results[tid] = result_data
                execution_steps.append({
                    "task_id": tid,
                    "agent_type": next((n.agent for n in stage_nodes if n.task_id == tid), "UNKNOWN"),
                    "description": f"Executed {tid}",
                    "status": "COMPLETED" if "error" not in result_data else "FAILED",
                    "duration_ms": float(round(duration_ms, 1)),
                    "result_summary": f"Returned {result_data.get('row_count', len(result_data))} items",
                })

        total_ms = (time.perf_counter() - start_total) * 1000.0

        # Step 3: Extract final synthesized result
        final_synth = None
        for tid, res in task_results.items():
            if isinstance(res, dict) and "answer_markdown" in res:
                final_synth = res
                break

        if not final_synth:
            final_synth = await synthesize_answer(query, task_results=task_results, trace=trace)

        agent_trace_payload = {
            "plan_id": plan.plan_id,
            "total_latency_ms": float(round(total_ms, 1)),
            "planner_model": "nvidia/nemotron-ultra-550b-a55b:free",
            "tasks": execution_steps,
            "topological_order": [t["task_id"] for t in execution_steps],
        }

        from src.api.routes import ChatOut
        return ChatOut(
            ok=True,
            answer_markdown=final_synth.get("answer_markdown"),
            sql=final_synth.get("sql"),
            rows=final_synth.get("rows"),
            viz_specs=final_synth.get("viz_specs"),
            float_ids=final_synth.get("float_ids"),
            agent_trace=agent_trace_payload,
            intent="MULTI_AGENT_DAG",
            trace_id=trace_id,
        )
