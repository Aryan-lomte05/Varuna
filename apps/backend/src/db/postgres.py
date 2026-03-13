
# -*- coding: utf-8 -*-
from __future__ import annotations
import os
import psycopg2
import psycopg2.extras
from typing import Optional, List, Dict, Any

PG_DSN = os.getenv("PG_DSN", "postgresql://user:pass@localhost:5432/argo")

def run_sql(sql: str, limit: int = 200) -> List[Dict[str, Any]]:
    # safety: allow only SELECT; strip trailing semicolon
    s = sql.strip().rstrip(";")
    if not s.lower().lstrip().startswith("select"):
        raise ValueError("Only SELECT statements are allowed.")
    with psycopg2.connect(PG_DSN) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(s + f" LIMIT {int(limit)}")
            return [dict(r) for r in cur.fetchall()]

def nearest_floats(*, lat: float, lon: float,
                   when=None, limit: int = 5,
                   west_east: Optional[str] = None,
                   days_window: int = 120) -> List[Dict[str, Any]]:
    """
    Return the closest recent float *surface-ish* sample(s) near anchor.
    - De-duplicate per (platform_number, time) using DISTINCT ON, pick smallest pres (surface).
    - Constrain by days_window (NOW() - interval).
    - Optional west_east bias via longitude bounds.
    """
    # rough bounds for west/east coasts of India; tweak if you store a 'coast' flag
    lon_min, lon_max = (40, 77)
    if west_east == "east":
        lon_min, lon_max = (80, 100)
    elif west_east == "west":
        lon_min, lon_max = (40, 77)

    time_clause = ""
    if when is not None:
        time_clause = "AND time BETWEEN %(when)s - INTERVAL '3 days' AND %(when)s + INTERVAL '3 days'"
    else:
        time_clause = f"AND time > NOW() - INTERVAL '{int(days_window)} days'"

    sql = f"""
    WITH recent AS (
      SELECT
        platform_number, time, latitude, longitude, temp, psal, doxy, chla, pres,
        (6371 * acos(
          cos(radians(%(alat)s)) * cos(radians(latitude)) *
          cos(radians(longitude) - radians(%(alon)s)) +
          sin(radians(%(alat)s)) * sin(radians(latitude))
        )) AS km
      FROM public.marine_data
      WHERE longitude BETWEEN {lon_min} AND {lon_max}
        {time_clause}
    ),
    surface_pick AS (
      SELECT DISTINCT ON (platform_number, time)
        platform_number, time, latitude, longitude, temp, psal, doxy, chla, pres, km
      FROM recent
      ORDER BY platform_number, time, pres ASC   -- smallest pressure ≈ surface
    )
    SELECT *
    FROM surface_pick
    ORDER BY km ASC, time DESC
    LIMIT {int(limit)};
    """

    params = {"alat": float(lat), "alon": float(lon)}
    if when is not None:
        params["when"] = when

    with psycopg2.connect(PG_DSN) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            return [dict(r) for r in cur.fetchall()]
