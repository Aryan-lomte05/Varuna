"""
FloatChat AI — PostgreSQL + PostGIS Database Layer

WHY PostGIS?
  The old code computed haversine distance in pure SQL arithmetic on every query
  (6371 * acos(cos(...)...)). PostGIS uses native C spatial indexes (GIST) to do
  ST_DWithin in microseconds — 100x faster for nearest-float queries.

WHY asyncpg + psycopg3?
  asyncpg is the fastest Postgres driver for Python (binary protocol, no GIL blocking).
  psycopg3 with pool is used for sync paths. Together they allow the FastAPI async
  endpoints to never block the event loop on DB queries.

WHY connection pooling?
  Opening a new TCP connection to Postgres for each request takes ~10ms.
  A pool keeps N connections warm — requests grab one in microseconds.
"""
from __future__ import annotations

import os
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import psycopg  # type: ignore
import psycopg.rows  # type: ignore
from psycopg_pool import ConnectionPool  # type: ignore

from src.config import settings  # type: ignore

# ── Connection pool (10 connections, grows to 20) ─────────────────────────────
_pool: Optional[ConnectionPool] = None

def get_pool() -> ConnectionPool:
    global _pool
    if _pool is None:
        _pool = ConnectionPool(
            settings.pg_dsn,
            min_size=5,
            max_size=20,
            kwargs={"row_factory": psycopg.rows.dict_row},
        )
    return _pool


def _conn():
    return get_pool().connection()


# ── Safe SELECT-only executor ──────────────────────────────────────────────────
def run_sql(sql: str, params: Optional[dict] = None, limit: int = 500) -> List[Dict[str, Any]]:
    """
    Execute a SELECT. Enforces SELECT-only.
    Appends LIMIT if not present. Returns list of dicts.
    """
    s = sql.strip().rstrip(";")
    if not s.lower().lstrip().startswith("select"):
        raise ValueError("Only SELECT statements are allowed.")
    # Append LIMIT if missing
    if "limit" not in s.lower():
        s = f"{s} LIMIT {int(limit)}"

    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(s, params or {})
            rows = cur.fetchall()
            return [dict(r) for r in rows]


# ── Nearest floats via PostGIS ST_DWithin ─────────────────────────────────────
def nearest_floats(
    lat: float, lon: float,
    radius_km: float = 300.0,
    days_window: int = 120,
    limit: int = 10,
    when: Optional[datetime] = None,
) -> List[Dict[str, Any]]:
    """
    Find nearest ARGO float surface observations using PostGIS spatial index.
    Much faster than the old haversine arithmetic — uses GIST index.

    Args:
        lat, lon: anchor point
        radius_km: search radius in kilometres
        days_window: look back this many days
        limit: max rows
        when: target datetime (±3 days window if provided)
    """
    radius_m = radius_km * 1000.0

    time_clause = (
        "AND time BETWEEN %(when)s - INTERVAL '3 days' AND %(when)s + INTERVAL '3 days'"
        if when is not None
        else f"AND time > NOW() - INTERVAL '{int(days_window)} days'"
    )

    sql = f"""
    WITH surface AS (
        SELECT DISTINCT ON (platform_number, DATE_TRUNC('day', time))
            platform_number, time, latitude, longitude,
            temp, psal, doxy, chla, nitrate, pres,
            ST_Distance(geom, ST_MakePoint(%(lon)s, %(lat)s)::GEOGRAPHY) / 1000.0 AS km
        FROM public.marine_data
        WHERE ST_DWithin(
            geom,
            ST_MakePoint(%(lon)s, %(lat)s)::GEOGRAPHY,
            %(radius_m)s
        )
        {time_clause}
        AND pres < 15   -- surface-ish (< 15 dbar depth)
        ORDER BY platform_number, DATE_TRUNC('day', time), pres ASC
    )
    SELECT * FROM surface
    ORDER BY km ASC, time DESC
    LIMIT %(limit)s
    """
    params: dict = {"lat": lat, "lon": lon, "radius_m": radius_m, "limit": limit}
    if when is not None:
        params["when"] = when

    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


# ── Float trajectory ───────────────────────────────────────────────────────────
def float_trajectory(
    platform_number: int,
    days: int = 365,
) -> List[Dict[str, Any]]:
    """Get surface positions of a float for trajectory visualization."""
    sql = """
    SELECT DISTINCT ON (DATE_TRUNC('day', time))
        platform_number, time, latitude, longitude, temp, psal, doxy
    FROM public.marine_data
    WHERE platform_number = %(pnum)s
      AND time > NOW() - INTERVAL %(days)s
      AND pres < 20
    ORDER BY DATE_TRUNC('day', time), pres ASC, time DESC
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"pnum": platform_number, "days": f"{days} days"})
            return [dict(r) for r in cur.fetchall()]


# ── Depth profile ─────────────────────────────────────────────────────────────
def depth_profile(
    platform_number: int,
    cycle_number: Optional[int] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    target_time: Optional[datetime] = None,
    radius_deg: float = 0.05,
) -> List[Dict[str, Any]]:
    """Get full depth profile (all pressure levels) for a float/cycle."""
    conditions = []
    params: dict = {}

    if platform_number:
        conditions.append("platform_number = %(pnum)s")
        params["pnum"] = platform_number
    if cycle_number:
        conditions.append("cycle_number = %(cycle)s")
        params["cycle"] = cycle_number
    if lat is not None and lon is not None:
        conditions.append("ABS(latitude - %(lat)s) < %(deg)s AND ABS(longitude - %(lon)s) < %(deg)s")
        params.update({"lat": lat, "lon": lon, "deg": radius_deg})
    if target_time:
        conditions.append("time BETWEEN %(t1)s AND %(t2)s")
        from datetime import timedelta
        params["t1"] = target_time - timedelta(hours=2)
        params["t2"] = target_time + timedelta(hours=2)

    where = " AND ".join(conditions) if conditions else "TRUE"
    sql = f"""
    SELECT platform_number, cycle_number, time, latitude, longitude,
           pres AS depth_m, temp, psal, doxy, chla, nitrate, ph_in_situ_total, bbp700
    FROM public.marine_data
    WHERE {where}
      AND pres IS NOT NULL
    ORDER BY pres ASC
    LIMIT 1000
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]


# ── Stats summary ─────────────────────────────────────────────────────────────
def regional_stats(
    region: str,
    variable: str,
    days: int = 30,
) -> Dict[str, Any]:
    """Quick stats for a region+variable for dashboard widgets."""
    REGION_BOUNDS = {
        "arabian_sea":   "longitude BETWEEN 40 AND 75  AND latitude BETWEEN 5 AND 25",
        "bay_of_bengal": "longitude BETWEEN 75 AND 100 AND latitude BETWEEN 5 AND 25",
        "equatorial_io": "latitude BETWEEN -5 AND 5 AND longitude BETWEEN 40 AND 115",
        "indian_ocean":  "longitude BETWEEN 20 AND 145 AND latitude BETWEEN -60 AND 30",
    }
    bounds = REGION_BOUNDS.get(region, REGION_BOUNDS["indian_ocean"])
    safe_var = variable if variable in ("temp","psal","doxy","chla","nitrate","ph_in_situ_total") else "temp"
    sql = f"""
    SELECT
        COUNT(*) AS obs_count,
        AVG({safe_var}) AS mean,
        MIN({safe_var}) AS min,
        MAX({safe_var}) AS max,
        STDDEV({safe_var}) AS std
    FROM public.marine_data
    WHERE {bounds}
      AND time > NOW() - INTERVAL %(days)s
      AND {safe_var} IS NOT NULL
    """
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(sql, {"days": f"{days} days"})
            row = cur.fetchone()
            return dict(row) if row else {}


# ── Feedback store ────────────────────────────────────────────────────────────
def store_feedback(
    session_id: str, query: str, sql_generated: Optional[str],
    answer: Optional[str], rating: Optional[int], correction: Optional[str],
    pipeline_trace: Optional[dict],
) -> int:
    """Persist user feedback for retrieval quality improvement."""
    with _conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                INSERT INTO public.query_feedback
                    (session_id, query, sql_generated, answer, rating, correction, pipeline_trace)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (session_id, query, sql_generated, answer, rating, correction,
                 json.dumps(pipeline_trace) if pipeline_trace else None),
            )
            conn.commit()
            return cur.fetchone()["id"]
