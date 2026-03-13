"""
FloatChat AI — Redis-Backed Conversation Memory

WHY Redis instead of in-memory deque?
  The old code used defaultdict(deque) — memory dies on every server restart,
  and can't be shared across multiple API processes (can't scale horizontally).

  Redis:
  - Persists across restarts (AOF or RDB snapshot)
  - Can be accessed by multiple API replicas (scale out)
  - TTL support: sessions auto-expire after N days (no manual cleanup)
  - RESP3 binary protocol: fast serialization

WHY 20-turn window?
  Most LLMs have 8K-128K context limits. Keeping the full history would
  eventually overflow and cause truncation bugs. 20 turns = enough for
  meaningful multi-turn oceanographic exploration sessions.
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

import redis  # type: ignore

from src.config import settings  # type: ignore

# ── Redis connection (lazy singleton) ─────────────────────────────────────────
_redis: Optional[redis.Redis] = None


def get_redis() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(
            settings.redis_url,
            decode_responses=True,
            socket_connect_timeout=5,
            health_check_interval=30,
        )
    return _redis


SESSION_PREFIX = "floatchat:session:"
SESSION_TTL    = 60 * 60 * 24 * 7  # 7 days TTL
MAX_TURNS      = 20                 # keep last 20 turns


def _key(session_id: str) -> str:
    return f"{SESSION_PREFIX}{session_id}"


def get_history(session_id: str) -> List[Dict[str, str]]:
    """Retrieve conversation history as list of {role, content} dicts."""
    try:
        raw = get_redis().get(_key(session_id))
        if not raw:
            return []
        data = json.loads(raw)
        return data.get("messages", [])
    except Exception:
        return []


def append_message(session_id: str, role: str, content: str) -> None:
    """Append a message and trim to MAX_TURNS. Refreshes TTL."""
    try:
        r = get_redis()
        raw = r.get(_key(session_id))
        
        parsed = json.loads(raw) if raw else None
        data: Dict[str, Any] = dict(parsed) if parsed else {
            "session_id": session_id,
            "created_at": datetime.utcnow().isoformat(),
            "messages": [],
        }
        data["messages"].append({"role": role, "content": content})
        
        # Keep last MAX_TURNS
        msgs = list(data["messages"])
        start_idx = max(0, len(msgs) - MAX_TURNS)
        data["messages"] = msgs[start_idx:]  # type: ignore
        
        data["updated_at"] = datetime.utcnow().isoformat()
        r.setex(_key(session_id), SESSION_TTL, json.dumps(data))
    except Exception:
        pass  # Gracefully degrade — don't crash on Redis failure


def clear_session(session_id: str) -> None:
    """Delete a session."""
    try:
        get_redis().delete(_key(session_id))
    except Exception:
        pass


def get_session_meta(session_id: str) -> Dict[str, Any]:
    """Get session metadata (created_at, updated_at, message count)."""
    try:
        raw = get_redis().get(_key(session_id))
        if not raw:
            return {"exists": False}
        data = json.loads(raw)
        return {
            "exists": True,
            "session_id": session_id,
            "created_at": data.get("created_at"),
            "updated_at": data.get("updated_at"),
            "message_count": len(data.get("messages", [])),
        }
    except Exception:
        return {"exists": False}


def build_history_prompt(session_id: str, last_n: int = 4) -> str:
    """
    Build a compact string of recent conversation turns for LLM context.
    Shows last_n turns only to keep tokens low.
    """
    hist = get_history(session_id)
    start_idx = max(0, len(hist) - last_n)
    history = hist[start_idx:]  # type: ignore
    if not history:
        return ""
    lines = []
    for msg in history:
        role = "User" if msg["role"] == "user" else "Assistant"
        content = str(msg["content"])[:300]  # type: ignore
        lines.append(f"{role}: {content}")
    return "\n".join(lines)
