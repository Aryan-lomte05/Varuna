"""
FloatChat AI â€” WebSocket Server for Streaming Answers

WHY WebSocket for streaming?
  HTTP request-response makes you wait for the entire LLM answer before
  anything arrives. With WebSocket + streaming, tokens arrive word-by-word
  â€” the user sees the answer forming in real-time (like ChatGPT).

  WebSocket protocol:
  - Client sends: {"question": "...", "session": "..."}
  - Server sends: {"type": "token", "data": "word..."}  (repeated)
  - Server sends: {"type": "sql",   "data": "SELECT..."}
  - Server sends: {"type": "rows",  "data": [...]}
  - Server sends: {"type": "viz",   "data": {...}}
  - Server sends: {"type": "done",  "trace_id": "..."}
  - Server sends: {"type": "error", "data": "..."} on failure
"""
from __future__ import annotations

import json
import uuid
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from src.config import settings
from src.chains import sql_rag_chain, rag_chain
from src.rag.query_rewriter import detect_intent_fast
from src.rag.decomposer import maybe_decompose, merge_multi_hop_answers
from src.memory.conversation import append_message, build_history_prompt
from src.llm.ollama_client import rewrite_query, stream_answer
from src.observability.logger import pipeline_span
from src.observability.pipeline_log import store_trace
from src.server.routes import _smalltalk, _extract_latlon, _extract_city, _extract_days
from src.database.postgres import nearest_floats
from src.utils.geo import city_lookup
from src.utils.viz_builder import build_viz_specs

router = APIRouter()


async def _send(ws: WebSocket, msg_type: str, data):
    await ws.send_text(json.dumps({"type": msg_type, "data": data}, default=str))


@router.websocket("/ws/chat")
async def ws_chat(websocket: WebSocket):
    """
    WebSocket endpoint for streaming chat responses.
    Supports the same intent routing as POST /api/v1/chat.
    """
    await websocket.accept()
    try:
        while True:
            raw = await websocket.receive_text()
            inp = json.loads(raw)
            q = inp.get("question", "").strip()
            session = inp.get("session", "default")
            trace_id = str(uuid.uuid4())

            if not q:
                await _send(websocket, "error", "Empty question")
                continue

            history = build_history_prompt(session, last_n=4)
            append_message(session, "user", q)

            with pipeline_span(trace_id, q) as trace:
                # â”€â”€ Smalltalk fast path â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                st = _smalltalk(q)
                if st:
                    await _send(websocket, "token", st)
                    await _send(websocket, "done", {"trace_id": trace_id, "intent": "SMALLTALK"})
                    continue

                # â”€â”€ Intent detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                intent = detect_intent_fast(q)
                if not intent:
                    q_rw, intent = await rewrite_query(q, history)
                    trace.log("REWRITE", f"LLM: {q_rw[:60]} | {intent}")
                    q = q_rw
                await _send(websocket, "intent", intent)

                # â”€â”€ Pipeline trace step events to frontend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                await _send(websocket, "pipeline_step", {
                    "stage": "INTENT", "message": f"Intent: {intent}"
                })

                # â”€â”€ SQL / Data path with streaming â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                if intent in ("SQL_DATA", "NEAREST_FLOAT", "MULTI_HOP") or not intent:
                    try:
                        # Run SQL chain (non-streaming for rows), then stream narration
                        result = await sql_rag_chain.answer(q, history_str=history, trace=trace)
                        rows = result.get("rows", [])
                        sql  = result.get("sql")

                        # Send SQL + rows first
                        if sql:
                            await _send(websocket, "sql", sql)
                        if rows:
                            await _send(websocket, "rows", rows[:50])

                        # Stream the narration
                        await _send(websocket, "pipeline_step", {
                            "stage": "NARRATE", "message": "Streaming narration..."
                        })
                        import json as _json
                        rows_preview = _json.dumps(rows[:5], default=str)
                        async for token in await stream_answer(q, rows_preview, sql=sql):
                            await _send(websocket, "token", token)

                        # Send viz specs
                        viz = build_viz_specs(rows, q)
                        await _send(websocket, "viz", viz)

                        store_trace(trace_id, trace.to_dict())
                        await _send(websocket, "done", {
                            "trace_id": trace_id,
                            "intent": intent,
                            "row_count": len(rows),
                        })

                    except Exception as e:
                        await _send(websocket, "error", str(e))

                # â”€â”€ Semantic path with streaming â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
                else:
                    try:
                        from src.rag.retriever import get_retriever
                        from src.rag.context_assembler import assemble_context
                        from src.rag.query_rewriter import expand_query

                        retriever = await get_retriever()
                        chunks = await retriever.retrieve(expand_query(q), top_k=8)

                        await _send(websocket, "pipeline_step", {
                            "stage": "RERANK",
                            "message": f"{len(chunks)} chunks retrieved",
                            "scores": [{"text": c.get("text","")[:60], "score": round(c.get("rerank_score",0),3)} for c in chunks[:5]]
                        })

                        context = assemble_context(chunks)

                        async for token in stream_answer(q, context):
                            await _send(websocket, "token", token)

                        store_trace(trace_id, trace.to_dict())
                        await _send(websocket, "done", {
                            "trace_id": trace_id,
                            "intent": "SEMANTIC",
                            "chunks_used": len(chunks),
                        })
                    except Exception as e:
                        await _send(websocket, "error", str(e))

    except WebSocketDisconnect:
        pass
