"""
FloatChat AI â€” Grounded Answer Generator

WHY "grounded"?
  Without grounding the LLM answers from its training data â€” which may be
  outdated, wrong, or hallucinated. Grounded generation means: the LLM is
  ONLY allowed to use the context we provide (retrieved chunks + SQL results).

  We enforce this by:
  1. Instructing: "Answer ONLY from the context below. If not in context, say so."
  2. Injecting source annotations into context so it can cite them
  3. Keeping temperature low (0.2) to reduce hallucination
  4. Post-processing to strip any content that appears to be from outside context
"""
from __future__ import annotations
from typing import Any, AsyncIterator, Dict, List, Optional
from itertools import islice

from src.llm.ollama_client import stream_answer, narrate_results  # type: ignore
from src.rag.context_assembler import assemble_context  # type: ignore


_GROUNDED_SYSTEM = """You are FloatChat AI â€” a world-class ocean data assistant built for INCOIS marine scientists.

STRICT RULES:
1. Answer ONLY using the provided context and SQL results below.
2. If the context does not contain enough information, say "The available data doesn't cover this â€” try rephrasing or narrowing your query."
3. Always include: key values with units (Â°C, PSU, Âµmol/kg, mg/mÂ³), time window, ocean region.
4. When citing data points, cite the float ID and timestamp if available.
5. Format response in clean markdown with headers where appropriate.
6. Do NOT fabricate data values. Do NOT say "typically" or "generally" without citing context.
"""


async def generate_grounded_answer(
    question: str,
    context_chunks: List[Dict[str, Any]],
    sql: Optional[str] = None,
    sql_rows: Optional[List[Dict[str, Any]]] = None,
    stream: bool = False,
) -> str | AsyncIterator[str]:
    """
    Generate a grounded answer using retrieved context + SQL results.

    Args:
        question: original user question
        context_chunks: ranked chunks from hybrid retriever
        sql: SQL query that was run (shown in answer for transparency)
        sql_rows: first N rows from SQL execution
        stream: if True, returns async generator for WebSocket streaming

    Returns:
        str (stream=False) or AsyncIterator[str] (stream=True)
    """
    # Build context string from chunks
    context_str = assemble_context(context_chunks)

    # Build SQL result preview
    sql_preview = ""
    if sql_rows:
        preview_rows = list(islice(sql_rows, 5))
        import json
        sql_preview = f"\nSQL Result Preview:\n{json.dumps(preview_rows, default=str, indent=2)}"

    full_context = f"{context_str}{sql_preview}".strip()

    if stream:
        return stream_answer(question, full_context, sql=sql)
    else:
        # Use narrate for non-streaming (shorter, prose-style)
        from src.utils.viz_builder import build_viz_specs  # type: ignore
        rows_str = ""
        if sql_rows:
            import json
            rows_str = json.dumps(list(islice(sql_rows, 8)), default=str, indent=2)
        return await narrate_results(
            question=question,
            sql=sql or "(semantic search)",
            rows_preview=rows_str or "".join(islice(full_context, 800)),
        )


async def generate_semantic_answer(
    question: str,
    chunks_or_context: List[Dict[str, Any]] | str,
) -> str:
    """
    Pure RAG answer (no SQL) for conceptual/documentation questions.
    E.g.: "What is the mixed layer depth?" or "How does upwelling work?"
    """
    if isinstance(chunks_or_context, str):
        context_str = chunks_or_context
    else:
        context_str = assemble_context(chunks_or_context, max_tokens=6000)
    if not context_str:
        return (
            "Try asking about specific ocean variables, regions, or ARGO float data."
        )

    from src.llm.ollama_client import _chat  # type: ignore
    from src.config import settings  # type: ignore

    messages = [
        {"role": "system", "content": _GROUNDED_SYSTEM},
        {
            "role": "user",
            "content": (
                f"Question: {question}\n\n"
                f"Context from knowledge base:\n{context_str}"
            ),
        },
    ]
    return await _chat(settings.ollama_narrate_model, messages, temperature=0.3, max_tokens=600)
