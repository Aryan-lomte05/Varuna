# -*- coding: utf-8 -*-
# Hinglish: Aggregation queries (min/max/avg) ke baad context rows laane ka helper.
# Hinglish: User ko viz ke liye platform_number, time, lat, lon chahiye hota hai.

from __future__ import annotations
import re
from typing import Optional, Tuple

# Hinglish: detect karein ki user ne min ya max manga hai aur kis column par
_AGG_RE = re.compile(
    r"\b(?P<fn>MIN|MAX)\s*\(\s*(?P<col>[a-zA-Z_][a-zA-Z0-9_]*)\s*\)",
    re.IGNORECASE
)

def detect_extreme(sql: str) -> Optional[Tuple[str, str]]:
    """
    Hinglish: SQL me agar MIN(col)/MAX(col) dikhe to (fn, col) return karo.
    Example: "SELECT MIN(temp) AS min_temp FROM ...": returns ("MIN", "temp").
    """
    m = _AGG_RE.search(sql)
    if not m:
        return None
    fn = m.group("fn").upper()
    col = m.group("col")
    return fn, col

def build_context_sql(base_where: str, time_order_hint: Optional[str], col: str, fn: str) -> str:
    """
    Hinglish: Aggregation ka 'winner' row laane ke liye ORDER BY col ASC/DESC + fetch extra fields.
    - base_where: FROM ... WHERE ... (including region/time filters). Caller ensures safety.
    - time_order_hint: e.g., "ORDER BY time DESC" ya None.
    - col: min/max jis par hai.
    - fn: "MIN" ya "MAX".
    """
    # Hinglish: order direction choose karo
    direction = "ASC" if fn == "MIN" else "DESC"

    # Hinglish: ORDER priority — pehle metric, tie me latest time (optional), fir pres for profile stability
    # Note: yahan depth/profile ki zarurat nahi hoti; zero or shallow pres row usually enough for “surface” viz.
    time_tie = ", time DESC" if time_order_hint else ""
    order_by = f"ORDER BY {col} {direction}{time_tie}"

    # Hinglish: SELECT me viz-friendly columns fetch karo
    context_sql = f"""
    SELECT
      platform_number,
      time,
      latitude,
      longitude,
      temp,
      psal,
      doxy,
      chla,
      ph_in_situ_total,
      nitrate
    {base_where}
    {order_by}
    LIMIT 5;
    """.strip()
    return context_sql
