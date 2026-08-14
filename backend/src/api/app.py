"""
FloatChat AI â€” Main FastAPI Application

WHY FastAPI?
  - Native async (ASGI) â€” no blocking I/O on Postgres/Redis/Ollama calls
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
from src.database.qdrant import seed_argo_knowledge

import logging
logging.getLogger("psycopg.pool").setLevel(logging.ERROR)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown lifecycle."""
    console.rule("[bold cyan]ðŸŒŠ FloatChat AI â€” Starting Up[/bold cyan]")

    # Try to initialize all backend services, but don't crash if they're unavailable locally
    try:
        # 1) Qdrant collection
        console.print("  [green]â–¸[/green] Ensuring Qdrant collection...")
        await ensure_collection(vector_size=768)
        
        # 2) Seed knowledge base if empty
        console.print("  [green]â–¸[/green] Seeding ARGO knowledge base...")
        await seed_argo_knowledge()

        # 3) BM25 index from Qdrant
        console.print("  [green]â–¸[/green] Building BM25 index...")
        await get_retriever()

        # 4) Knowledge Graph
        console.print("  [green]â–¸[/green] Rebuilding Knowledge Graph...")
        rebuild_kg_from_db()

        console.print("  [green]✓[/green] Backend services initialized (or partially bypassed)")
    except Exception as e:
        console.print(f"  [yellow]⚠[/yellow] Backend startup partial failure: {e}")
        console.print("  [dim]Proceeding in limited mode (offline/no-docker).[/dim]")

    console.rule("[bold green]ðŸŒŠ FloatChat AI â€” Ready[/bold green]")
    yield

    console.rule("[dim]FloatChat AI â€” Shutting Down[/dim]")


app = FastAPI(
    title="FloatChat AI ðŸŒŠ",
    description=(
        "AI-powered ocean data system for INCOIS marine scientists. "
        "Natural language â†’ oceanographic intelligence."
    ),
    version="2.0.0",
    default_response_class=ORJSONResponse,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# ━━ CORS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ━━ GZip for large responses ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
app.add_middleware(GZipMiddleware, minimum_size=1000)

# ━━ Register routes ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
from src.api.routes import router as api_router
from src.api.ws import router as ws_router

app.include_router(api_router, prefix="/api/v1")
app.include_router(api_router, prefix="/api")
app.include_router(ws_router)

from src.api.ws import ws_chat
app.add_api_websocket_route("/ws/chat", ws_chat)
app.add_api_websocket_route("/api/ws/chat", ws_chat)


@app.get("/health")
async def health():
    from src.llm.ollama_client import health_check
    ollama = await health_check()
    return {
        "ok": True,
        "version": "2.0.0",
        "ollama": ollama,
    }
