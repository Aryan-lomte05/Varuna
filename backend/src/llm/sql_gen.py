"""
FloatChat AI — Deterministic & Rule-Based SQL Generator (Offline Fallback & Safety Net)
"""
from __future__ import annotations

import re
from typing import Optional

def generate_fallback_sql(question: str) -> str:
    """
    Generate a valid PostgreSQL SELECT query for common ARGO float queries
    when LLM inference is offline or returns invalid SQL.
    """
    q_lower = question.lower()

    # 1. Salinity profiles near equator in March 2023 / date ranges
    if "salinity" in q_lower or "psal" in q_lower:
        if "equator" in q_lower or "equatorial" in q_lower:
            return (
                "SELECT platform_number, time, latitude, longitude, pres AS depth_m, psal, temp "
                "FROM public.marine_data "
                "WHERE latitude BETWEEN -5 AND 5 AND longitude BETWEEN 40 AND 115 "
                "  AND time BETWEEN '2023-03-01' AND '2023-04-01' "
                "  AND psal IS NOT NULL "
                "ORDER BY platform_number, pres ASC LIMIT 500;"
            )
        if "bay of bengal" in q_lower:
            return (
                "SELECT DATE_TRUNC('month', time) AS month, AVG(psal) AS avg_salinity, MAX(psal) AS max_salinity, MIN(psal) AS min_salinity "
                "FROM public.marine_data "
                "WHERE longitude BETWEEN 75 AND 100 AND latitude BETWEEN 5 AND 25 "
                "  AND psal IS NOT NULL "
                "GROUP BY 1 ORDER BY 1 LIMIT 500;"
            )

    # 2. Compare BGC parameters in Arabian Sea / last 6 months
    if "bgc" in q_lower or "oxygen" in q_lower or "doxy" in q_lower or "chla" in q_lower or "nitrate" in q_lower:
        if "arabian sea" in q_lower or "arabian" in q_lower:
            return (
                "SELECT DATE_TRUNC('month', time) AS month, "
                "       AVG(chla) AS avg_chla, AVG(doxy) AS avg_doxy, "
                "       AVG(nitrate) AS avg_nitrate, COUNT(*) AS obs_count "
                "FROM public.marine_data "
                "WHERE longitude BETWEEN 40 AND 75 AND latitude BETWEEN 5 AND 25 "
                "  AND time > NOW() - INTERVAL '6 months' "
                "  AND (chla IS NOT NULL OR doxy IS NOT NULL OR nitrate IS NOT NULL) "
                "GROUP BY 1 ORDER BY 1 LIMIT 500;"
            )
        if "equatorial" in q_lower or "indian ocean" in q_lower:
            return (
                "SELECT DATE_TRUNC('month', time) AS month, AVG(doxy) AS avg_doxy, AVG(temp) AS avg_temp "
                "FROM public.marine_data "
                "WHERE latitude BETWEEN -5 AND 5 AND longitude BETWEEN 40 AND 115 "
                "  AND doxy IS NOT NULL "
                "GROUP BY 1 ORDER BY 1 LIMIT 500;"
            )

    # 3. Nearest float queries (e.g., Mumbai, Maldives, Chennai)
    if "nearest" in q_lower or "closest" in q_lower or "mumbai" in q_lower or "maldives" in q_lower:
        lat, lon = 19.08, 72.88
        if "maldives" in q_lower:
            lat, lon = 3.20, 73.00
        elif "chennai" in q_lower:
            lat, lon = 13.08, 80.27

        return f"""WITH candidates AS (
    SELECT platform_number, time, latitude, longitude, temp, psal,
           6371.0 * acos(
               LEAST(1.0, GREATEST(-1.0,
                   sin(radians({lat})) * sin(radians(latitude))
                   + cos(radians({lat})) * cos(radians(latitude))
                   * cos(radians(longitude) - radians({lon}))
               ))
           ) AS km
    FROM public.marine_data
    WHERE latitude BETWEEN {lat-2.5} AND {lat+2.5}
      AND longitude BETWEEN {lon-2.5} AND {lon+2.5}
      AND time > NOW() - INTERVAL '120 days'
      AND pres < 20
)
SELECT * FROM candidates
WHERE km <= 300
ORDER BY km ASC, time DESC
LIMIT 10;"""

    # 4. Temperature profiles & surface stats
    if "temp" in q_lower or "temperature" in q_lower:
        if "arabian sea" in q_lower or "arabian" in q_lower:
            return (
                "SELECT platform_number, time, latitude, longitude, pres AS depth_m, temp, psal "
                "FROM public.marine_data "
                "WHERE longitude BETWEEN 40 AND 75 AND latitude BETWEEN 5 AND 25 "
                "  AND temp IS NOT NULL "
                "ORDER BY pres ASC LIMIT 500;"
            )
        return (
            "SELECT DATE_TRUNC('month', time) AS month, AVG(temp) AS avg_temp, MIN(temp) AS min_temp, MAX(temp) AS max_temp "
            "FROM public.marine_data "
            "WHERE temp IS NOT NULL "
            "GROUP BY 1 ORDER BY 1 LIMIT 500;"
        )

    # 5. Specific float WMO ID
    m = re.search(r'\b(19\d{5}|59\d{5}|29\d{5}|39\d{5}|49\d{5})\b', question)
    if m:
        wmo = m.group(1)
        return (
            f"SELECT platform_number, time, latitude, longitude, pres AS depth_m, temp, psal, doxy, chla "
            f"FROM public.marine_data WHERE platform_number = {wmo} AND pres IS NOT NULL ORDER BY time DESC, pres ASC LIMIT 500;"
        )

    # Default general profile query
    return (
        "SELECT platform_number, time, latitude, longitude, pres AS depth_m, temp, psal, doxy, chla "
        "FROM public.marine_data WHERE pres IS NOT NULL ORDER BY time DESC, pres ASC LIMIT 100;"
    )
