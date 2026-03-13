"""
FloatChat AI — Main FastAPI Application

WHY FastAPI?
  - Native async (ASGI) — no blocking I/O on Postgres/Redis/Ollama calls
  - Pydantic validation = free request/response type safety
  - Auto-generated OpenAPI docs at /docs
  - WebSocket support built-in (for streaming answers)
  - 3x faster than Flask for async workloads

App startup:
  1. Initialize PostgreSQL connection pool
  2. Ensure Qdrant collection exists
  3. Build BM25 index from existing Qdrant chunks
  4. Rebuild Knowledge Graph from Postgres kg_edges
  5. Start accepting requests
"""
from __future__ import annotations

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import ORJSONResponse

from src.config import settings
from src.rag.retriever import get_retriever, ensure_collection
from src.memory.knowledge_graph import rebuild_kg_from_db
from src.observability.logger import console
from src.db.qdrant import seed_argo_knowledge


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    console.rule("[bold cyan]🌊 FloatChat AI — Starting Up[/bold cyan]")

    # 1) Qdrant collection
    console.print("  [green]▸[/green] Ensuring Qdrant collection...")
    await ensure_collection(vector_size=768)

    # 2) Seed knowledge base if empty
    console.print("  [green]▸[/green] Seeding ARGO knowledge base...")
    await seed_argo_knowledge()

    # 3) BM25 index from Qdrant
    console.print("  [green]▸[/green] Building BM25 index...")
    await get_retriever()

    # 4) Knowledge Graph
    console.print("  [green]▸[/green] Rebuilding Knowledge Graph...")
    rebuild_kg_from_db()

    console.rule("[bold green]🌊 FloatChat AI — Ready[/bold green]")
    yield

    console.rule("[dim]FloatChat AI — Shutting Down[/dim]")


app = FastAPI(
    title="FloatChat AI 🌊",
    description=(
        "AI-powered ocean data system for INCOIS marine scientists. "
        "Natural language → oceanographic intelligence."
    ),
    version="2.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── GZip for large responses ───────────────────────────────────────────────
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ── Register routes ────────────────────────────────────────────────────────
from src.server.routes import router as api_router
from src.server.ws import router as ws_router

app.include_router(api_router, prefix="/api/v1")
app.include_router(ws_router)


@app.get("/health")
async def health():
    from src.models.ollama_client import health_check
    ollama = await health_check()
    return {
        "ok": True,
        "version": "2.0.0",
        "ollama": ollama,
    }
