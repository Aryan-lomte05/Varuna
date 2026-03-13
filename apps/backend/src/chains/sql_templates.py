# -*- coding: utf-8 -*-
# Hinglish: Common SQL templates — min/max, monthly avg, latest, depth profile, etc.

from __future__ import annotations
from typing import Tuple

# Hinglish: region bbox helpers
REGIONS = {
    "arabian_sea": (40.0, 75.0, 5.0, 25.0),
    "ne_arabian_sea": (65.0, 75.0, 15.0, 25.0),
    "nw_arabian_sea": (55.0, 65.0, 15.0, 25.0),
    "bay_of_bengal": (80.0, 100.0, 5.0, 25.0),
    "equator": (40.0, 100.0, -5.0, 5.0),
}

def bbox_sql(b: Tuple[float,float,float,float]) -> str:
    # Hinglish: lon_min, lon_max, lat_min, lat_max
    return f"longitude BETWEEN {b[0]} AND {b[1]} AND latitude BETWEEN {b[2]} AND {b[3]}"

def sql_minmax(param: str, region_key: str, days: int, pick: str) -> str:
    # Hinglish: min/max with context columns; NULLs ko ignore; limit 1
    bbox = bbox_sql(REGIONS[region_key])
    order = "ASC" if pick.lower() == "min" else "DESC"
    return f"""\
SELECT platform_number, time, latitude, longitude, {param} AS value
FROM public.marine_data
WHERE {bbox}
  AND time > NOW() - INTERVAL '{int(days)} days'
  AND {param} IS NOT NULL
ORDER BY {param} {order} NULLS LAST, time DESC
LIMIT 1;"""

def sql_monthly_avg(param: str, region_key: str, months: int) -> str:
    bbox = bbox_sql(REGIONS[region_key])
    return f"""\
SELECT DATE_TRUNC('month', time) AS month, AVG({param}) AS avg_{param}
FROM public.marine_data
WHERE {bbox}
  AND time > NOW() - INTERVAL '{int(months)} months'
GROUP BY 1
ORDER BY 1
LIMIT 300;"""

def sql_latest_platform(region_key: str, platform: int, limit: int=50) -> str:
    bbox = bbox_sql(REGIONS[region_key])
    return f"""\
SELECT platform_number, time, latitude, longitude, temp, psal, doxy, chla, pres AS depth_m
FROM public.marine_data
WHERE {bbox}
  AND platform_number = {int(platform)}
ORDER BY time DESC
LIMIT {int(limit)};"""

def sql_depth_profile_near(lat: float, lon: float, when_iso: str|None, temp_exact: float|None,
                           lon_min: float, lon_max: float) -> str:
    # Hinglish: near-city profile — haversine for km, optional time ±60m, optional temp tight match
    time_clause = ""
    if when_iso:
        time_clause = f"AND time BETWEEN TIMESTAMP '{when_iso}' - INTERVAL '60 minutes' AND TIMESTAMP '{when_iso}' + INTERVAL '60 minutes'"
    temp_clause = ""
    if temp_exact is not None:
        temp_clause = f"AND ABS(temp - {temp_exact}) < 0.02"
    return f"""\
SELECT
  platform_number, time, latitude, longitude, temp, psal, doxy, chla, pres AS depth_m,
  (6371 * acos(
    cos(radians({lat})) * cos(radians(latitude)) * cos(radians(longitude) - radians({lon})) +
    sin(radians({lat})) * sin(radians(latitude))
  )) AS km
FROM public.marine_data
WHERE 1=1
  AND longitude BETWEEN {lon_min} AND {lon_max}
  {time_clause}
  {temp_clause}
ORDER BY km ASC, {"ABS(EXTRACT(EPOCH FROM (time - TIMESTAMP '"+when_iso+"'))) ASC," if when_iso else ""} pres ASC
LIMIT 200;"""
