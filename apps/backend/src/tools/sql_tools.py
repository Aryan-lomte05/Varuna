# """Hinglish: LangChain-style tools for SQL + semantic search."""
# from typing import List, Tuple
# from langchain_community.vectorstores import Chroma
# from langchain_community.embeddings import HuggingFaceEmbeddings
# from src.config import settings
# from src.db.postgres import run_sql


# _embed = HuggingFaceEmbeddings(model_name=settings.embed_model)
# _store = Chroma(persist_directory=settings.chroma_dir, embedding_function=_embed)


# def semantic_search(q: str, k: int = 4) -> List[Tuple[str, float]]:
#  # returns list of (text, score)
#  docs = _store.similarity_search_with_score(q, k=k)
#  return [(d.page_content, float(s)) for d, s in docs]


# def execute_sql(sql: str, limit: int = 200):
#  return run_sql(sql, limit=limit)
# Hinglish: SQL tools — Chroma semantic search (graceful fallback) + safe SQL execute wrapper.
# Goals:
# - Agar Chroma/embeddings init fail ho, to app crash na ho — bas empty context return karo.
# - execute_sql() LIMIT ko double-append na kare; rely on run_sql() ka smart behavior.
# - User-facing koi string nahi; sirf comments Hinglish me.

from __future__ import annotations

from typing import List, Tuple, Optional

from src.db.postgres import run_sql
from src.config import settings

# Optional deps — init guarded (first-run me vector store ho ya na ho, app chalna chahiye)
_store = None
try:
    from langchain_community.vectorstores import Chroma
    from langchain_community.embeddings import HuggingFaceEmbeddings

    # Hinglish: Embeddings + Chroma lazy-ish init; agar directory empty ho tab bhi object ban jayega,
    # lekin search me zero results mil sakte hain — that’s fine.
    _embed = HuggingFaceEmbeddings(model_name=settings.embed_model)
    _store = Chroma(
        persist_directory=settings.chroma_dir,
        embedding_function=_embed,
    )
except Exception as _e:
    # Hinglish: Logging optional; hard print avoid — upstream logger agar hai to use kar sakte ho.
    _store = None


def semantic_search(q: str, k: int = 4) -> List[Tuple[str, float]]:
    """
    Hinglish: Vector search (graceful). Agar store unavailable ho, empty list return.
    Return shape: List[(page_content, score)]
    """
    if not q or not isinstance(q, str):
        return []
    if _store is None:
        return []
    try:
        docs = _store.similarity_search_with_score(q, k=max(1, int(k)))
        return [(d.page_content, float(s)) for d, s in docs]
    except Exception:
        # Hinglish: Vector store corrupt/empty ho to yahan se bhi empty context bhej do.
        return []


def execute_sql(sql: str, limit: Optional[int] = 200):
    """
    Hinglish: Safe SQL executor.
    - Only SELECT allowed (enforced inside run_sql()).
    - LIMIT: run_sql() sirf tab append karega jab SQL me LIMIT missing ho.
    - limit=None pass karoge to run_sql() ko append karne do ya SQL ke LIMIT ko respect karo.
    """
    return run_sql(sql, limit=limit)
