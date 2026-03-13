# # from __future__ import annotations
# # from typing import Optional, Tuple

# # # Rough city anchors (lat, lon). Tweak as needed.
# # _CITIES = {
# #     "mumbai": (19.0760, 72.8777),
# #     "kochi": (9.9312, 76.2673),
# #     "kerala": (10.3529, 76.5120),
# #     "goa": (15.2993, 74.1240),
# #     "mangalore": (12.9141, 74.8560),
# #     "porbandar": (21.6417, 69.6293),
# #     "chennai": (13.0827, 80.2707),
# #     "visakhapatnam": (17.6868, 83.2185),
# #     "puducherry": (11.9416, 79.8083),
# #     "kolkata": (22.5726, 88.3639),
# #     "paradip": (20.3167, 86.6167),
# # }

# # def city_lookup(name: str) -> Optional[Tuple[float, float]]:
# #     k = (name or "").lower().strip()
# #     return _CITIES.get(k)

# # def infer_coast_from_name(name: str) -> Optional[str]:
# #     k = (name or "").lower()
# #     west = {"mumbai","kochi","kerala","goa","mangalore","porbandar","arabian sea"}
# #     east = {"chennai","visakhapatnam","puducherry","kolkata","paradip","bay of bengal"}
# #     if k in west:
# #         return "west"
# #     if k in east:
# #         return "east"
# #     return None

# # def prefer_longitude_band(west_east: Optional[str]) -> tuple[float, float]:
# #     """
# #     Returns (lo, hi) longitude range to loosely constrain search.
# #     west → Arabian Sea, east → Bay of Bengal. Defaults to global if None.
# #     """
# #     if west_east == "west":
# #         # Arabian Sea ~ 40E..76E
# #         return (40.0, 76.0)
# #     if west_east == "east":
# #         # Bay of Bengal ~ 76E..100E
# #         return (76.0, 100.0)
# #     return (-180.0, 180.0)
# # src/utils/geo.py
# from __future__ import annotations
# import json
# import os
# import time
# import re
# from typing import Optional, Dict

# import requests  # install if missing: pip install requests

# # -------------------------------
# # Small curated seed (extend any time)
# # (We keep this compact; the fallback geocoder covers ANY city.)
# # -------------------------------
# _CITY_SEED: Dict[str, Dict[str, float]] = {
#     # India – west coast
#     "mumbai": {"lat": 19.0760, "lon": 72.8777},
#     "goa": {"lat": 15.2993, "lon": 74.1240},
#     "mangalore": {"lat": 12.9141, "lon": 74.8560},
#     "kochi": {"lat": 9.9312, "lon": 76.2673},
#     "kozhikode": {"lat": 11.2588, "lon": 75.7804},
#     "porbandar": {"lat": 21.6417, "lon": 69.6293},
#     # India – east coast
#     "chennai": {"lat": 13.0827, "lon": 80.2707},
#     "visakhapatnam": {"lat": 17.6868, "lon": 83.2185},
#     "puducherry": {"lat": 11.9416, "lon": 79.8083},
#     "kolkata": {"lat": 22.5726, "lon": 88.3639},
#     "paradip": {"lat": 20.3167, "lon": 86.6167},
#     # Basins – use nominal anchors
#     "arabian sea": {"lat": 16.0, "lon": 64.0},  # broad, west is fine
#     "bay of bengal": {"lat": 16.0, "lon": 90.0},
#     "equator": {"lat": 0.0, "lon": 80.0},
#     "kerala": {"lat": 10.3529, "lon": 76.5120},
#     "goa state": {"lat": 15.2993, "lon": 74.1240},

#     # A few global majors (examples)
#     "tokyo": {"lat": 35.6762, "lon": 139.6503},
#     "new york": {"lat": 40.7128, "lon": -74.0060},
#     "london": {"lat": 51.5072, "lon": -0.1276},
#     "sydney": {"lat": -33.8688, "lon": 151.2093},
#     "cape town": {"lat": -33.9249, "lon": 18.4241},
# }

# # Cache on-disk to grow towards 200+ cities organically
# CACHE_DIR = os.path.join(os.getcwd(), "cache")
# CACHE_FILE = os.path.join(CACHE_DIR, "cities.json")
# os.makedirs(CACHE_DIR, exist_ok=True)

# def _load_cache() -> Dict[str, Dict[str, float]]:
#     if os.path.isfile(CACHE_FILE):
#         try:
#             with open(CACHE_FILE, "r", encoding="utf-8") as f:
#                 return json.load(f)
#         except Exception:
#             return {}
#     return {}

# def _save_cache(cache: Dict[str, Dict[str, float]]) -> None:
#     try:
#         with open(CACHE_FILE, "w", encoding="utf-8") as f:
#             json.dump(cache, f, ensure_ascii=False, indent=2)
#     except Exception:
#         pass

# _CITY_CACHE = _load_cache()

# def _norm(name: str) -> str:
#     return re.sub(r"\s+", " ", (name or "").strip().lower())

# # -------------------------------
# # Coast inference (west/east) for India basins/cities
# # -------------------------------
# def infer_coast_from_name(name: str) -> Optional[str]:
#     n = _norm(name)
#     west_hits = ("mumbai","goa","mangalore","porbandar","kochi","kerala","arabian sea")
#     east_hits = ("chennai","visakhapatnam","puducherry","kolkata","paradip","bay of bengal")
#     if any(h in n for h in west_hits):
#         return "west"
#     if any(h in n for h in east_hits):
#         return "east"
#     return None

# # -------------------------------
# # Nominatim (OpenStreetMap) lookup (polite rate limit, cached)
# # -------------------------------
# def _geocode_nominatim(q: str) -> Optional[Dict[str, float]]:
#     """
#     Returns {"lat": float, "lon": float} or None.
#     Keep rate low; Nominatim usage policy expects identifiable UA & throttle.
#     """
#     try:
#         time.sleep(1.0)  # be polite (and avoid HTTP 429)
#         r = requests.get(
#             "https://nominatim.openstreetmap.org/search",
#             params={"q": q, "format": "json", "limit": 1},
#             headers={"User-Agent": "FloatchatAI/1.0 (education; contact: support@example.com)"},
#             timeout=15,
#         )
#         r.raise_for_status()
#         data = r.json()
#         if isinstance(data, list) and data:
#             lat = float(data[0]["lat"])
#             lon = float(data[0]["lon"])
#             return {"lat": lat, "lon": lon}
#     except Exception:
#         return None
#     return None

# # -------------------------------
# # Public API: city_lookup
# # -------------------------------
# def city_lookup(name: str) -> Optional[Dict[str, float]]:
#     """
#     1) Try curated seed
#     2) Try cache
#     3) Try Nominatim and cache
#     """
#     if not name:
#         return None
#     key = _norm(name)
#     if key in _CITY_SEED:
#         return _CITY_SEED[key]
#     if key in _CITY_CACHE:
#         return _CITY_CACHE[key]

#     # fallback: geocode once and cache
#     loc = _geocode_nominatim(name)
#     if loc:
#         _CITY_CACHE[key] = loc
#         _save_cache(_CITY_CACHE)
#         return loc
#     return None
# src/utils/geo.py
from __future__ import annotations

import os
import re
import time
import json
import math
import sqlite3
import random
from typing import Optional, Dict, Any, Tuple, List

# Optional (nice-to-have) deps. We degrade gracefully if missing.
try:
    from unidecode import unidecode  # pip install Unidecode
except Exception:
    def unidecode(s: str) -> str:  # fallback
        return s

import requests  # pip install requests

# =========================
# Config
# =========================
GEO_DB_DIR = os.getenv("FLOATCHAT_CACHE_DIR", os.path.join(os.getcwd(), "cache"))
os.makedirs(GEO_DB_DIR, exist_ok=True)
GEO_DB_PATH = os.path.join(GEO_DB_DIR, "geocache.sqlite3")

# API polite settings
DEFAULT_UA = "FloatchatAI/1.0 (research; contact: support@example.com)"
NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
PHOTON_URL     = "https://photon.komoot.io/api/"

# Cache TTL (seconds) – 180 days default
CACHE_TTL = int(os.getenv("FLOATCHAT_GEO_TTL", "15552000"))

# Bias: country code (e.g., "IN" for India). Set "" for no bias.
COUNTRY_BIAS = os.getenv("FLOATCHAT_GEO_BIAS", "IN").strip().upper()

# =========================
# Seed (compact; we rely on online resolvers + prewarm CSV for scale)
# =========================
SEED: Dict[str, Dict[str, Any]] = {
    # India west coast
    "mumbai": {"lat": 19.0760, "lon": 72.8777, "country_code": "IN", "display_name": "Mumbai, Maharashtra, IN"},
    "goa": {"lat": 15.2993, "lon": 74.1240, "country_code": "IN", "display_name": "Goa, IN"},
    "mangalore": {"lat": 12.9141, "lon": 74.8560, "country_code": "IN", "display_name": "Mangaluru, Karnataka, IN"},
    "kochi": {"lat": 9.9312, "lon": 76.2673, "country_code": "IN", "display_name": "Kochi, Kerala, IN"},
    "kozhikode": {"lat": 11.2588, "lon": 75.7804, "country_code": "IN", "display_name": "Kozhikode, Kerala, IN"},
    "porbandar": {"lat": 21.6417, "lon": 69.6293, "country_code": "IN", "display_name": "Porbandar, Gujarat, IN"},
    # India east coast
    "chennai": {"lat": 13.0827, "lon": 80.2707, "country_code": "IN", "display_name": "Chennai, Tamil Nadu, IN"},
    "visakhapatnam": {"lat": 17.6868, "lon": 83.2185, "country_code": "IN", "display_name": "Visakhapatnam, Andhra Pradesh, IN"},
    "puducherry": {"lat": 11.9416, "lon": 79.8083, "country_code": "IN", "display_name": "Puducherry, IN"},
    "kolkata": {"lat": 22.5726, "lon": 88.3639, "country_code": "IN", "display_name": "Kolkata, West Bengal, IN"},
    "paradip": {"lat": 20.3167, "lon": 86.6167, "country_code": "IN", "display_name": "Paradip, Odisha, IN"},
    # Basins / nominal anchors
    "arabian sea": {"lat": 16.0, "lon": 64.0, "country_code": "", "display_name": "Arabian Sea"},
    "bay of bengal": {"lat": 16.0, "lon": 90.0, "country_code": "", "display_name": "Bay of Bengal"},
    "equator": {"lat": 0.0, "lon": 80.0, "country_code": "", "display_name": "Equatorial Indian Ocean"},
    "kerala": {"lat": 10.3529, "lon": 76.5120, "country_code": "IN", "display_name": "Kerala, IN"},
}

ALIASES: Dict[str, str] = {
    # Hinglish/typos/common variants → canonical
    "bombay": "mumbai",
    "manglore": "mangalore",
    "calicut": "kozhikode",
    "pondicherry": "puducherry",
    "vizag": "visakhapatnam",
    "vishakhapatnam": "visakhapatnam",
    "madras": "chennai",
    # basins
    "bob": "bay of bengal",
    "as": "arabian sea",
}

WEST_COAST_KEYS = ("mumbai","goa","mangalore","porbandar","kochi","kozhikode","kerala","arabian sea")
EAST_COAST_KEYS = ("chennai","visakhapatnam","puducherry","kolkata","paradip","bay of bengal")

# =========================
# Utils
# =========================
def _norm(s: str) -> str:
    s = (s or "").strip()
    s = unidecode(s)
    s = re.sub(r"[^\w\s\-\,]", "", s, flags=re.I).lower()
    s = re.sub(r"\s+", " ", s)
    return s

def _km_between(lat1, lon1, lat2, lon2) -> float:
    # Haversine
    R = 6371.0
    p = math.pi / 180.0
    a = 0.5 - math.cos((lat2-lat1)*p)/2 + math.cos(lat1*p)*math.cos(lat2*p)*(1-math.cos((lon2-lon1)*p))/2
    return 2*R*math.asin(math.sqrt(a))

def basin_and_coast(lat: float, lon: float) -> Tuple[str, Optional[str]]:
    """
    Very light, rule-based assignment for Indian Ocean contexts.
    - West of ~77E → Arabian Sea (west coast)
    - East of ~80E → Bay of Bengal (east coast)
    - Near equator band (|lat| < 2.5) → Equator (no strict coast)
    """
    if abs(lat) < 2.5:
        return "equator", None
    if lon <= 77:
        return "arabian sea", "west"
    if lon >= 80:
        return "bay of bengal", "east"
    # gap in between — pick nearest
    if abs(lon-77) < abs(lon-80):
        return "arabian sea", "west"
    return "bay of bengal", "east"

def infer_coast_from_name(name: str) -> Optional[str]:
    n = _norm(name)
    if any(k in n for k in WEST_COAST_KEYS): return "west"
    if any(k in n for k in EAST_COAST_KEYS): return "east"
    return None

# =========================
# SQLite cache
# =========================
def _db():
    con = sqlite3.connect(GEO_DB_PATH)
    con.execute("""CREATE TABLE IF NOT EXISTS geocache(
        q TEXT PRIMARY KEY,
        ts INTEGER NOT NULL,
        payload TEXT NOT NULL
    )""")
    return con

def _cache_get(q: str) -> Optional[Dict[str, Any]]:
    try:
        con = _db()
        row = con.execute("SELECT ts, payload FROM geocache WHERE q=?", (q,)).fetchone()
        con.close()
        if not row:
            return None
        ts, payload = int(row[0]), row[1]
        if int(time.time()) - ts > CACHE_TTL:
            return None
        return json.loads(payload)
    except Exception:
        return None

def _cache_set(q: str, payload: Dict[str, Any]) -> None:
    try:
        con = _db()
        con.execute("INSERT OR REPLACE INTO geocache(q, ts, payload) VALUES (?,?,?)",
                    (q, int(time.time()), json.dumps(payload, ensure_ascii=False)))
        con.commit()
        con.close()
    except Exception:
        pass

# =========================
# HTTP helpers
# =========================
def _http_get(url: str, params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    try:
        # polite delay & jitter to avoid 429 on free endpoints
        time.sleep(0.6 + random.random()*0.4)
        r = requests.get(url, params=params, headers={"User-Agent": DEFAULT_UA}, timeout=15)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None

# =========================
# Providers
# =========================
def _provider_nominatim(q: str) -> Optional[Dict[str, Any]]:
    params = {"q": q, "format": "json", "limit": 1}
    if COUNTRY_BIAS:
        params["countrycodes"] = COUNTRY_BIAS.lower()
    res = _http_get(NOMINATIM_URL, params)
    if not res or not isinstance(res, list) or not res:
        return None
    hit = res[0]
    try:
        lat = float(hit["lat"]); lon = float(hit["lon"])
    except Exception:
        return None
    out = {
        "lat": lat,
        "lon": lon,
        "display_name": hit.get("display_name") or q,
        "country_code": (hit.get("address") or {}).get("country_code", "").upper(),
        "source": "nominatim",
        "confidence": 0.85,
    }
    return out

def _provider_photon(q: str) -> Optional[Dict[str, Any]]:
    res = _http_get(PHOTON_URL, {"q": q, "limit": 1, "lang": "en"})
    if not res or "features" not in res or not res["features"]:
        return None
    hit = res["features"][0]
    props = hit.get("properties") or {}
    coords = hit.get("geometry", {}).get("coordinates") or []
    if len(coords) != 2:
        return None
    lat = float(coords[1]); lon = float(coords[0])
    out = {
        "lat": lat,
        "lon": lon,
        "display_name": props.get("name") or props.get("city") or props.get("country") or q,
        "country_code": (props.get("countrycode") or "").upper(),
        "source": "photon",
        "confidence": 0.75,
    }
    if COUNTRY_BIAS and out["country_code"] and out["country_code"] != COUNTRY_BIAS:
        out["confidence"] -= 0.15
    return out

# =========================
# Fuzzy (offline) using seed + aliases
# =========================
def _fuzzy_seed(q: str) -> Optional[Dict[str, Any]]:
    """
    Very light fuzzy: normalize tokens & choose closest by token overlap / prefix distance.
    If you want super-robust fuzzy, you can plug rapidfuzz here.
    """
    nq = _norm(q)
    cand_key = ALIASES.get(nq, nq)
    if cand_key in SEED:
        rec = SEED[cand_key].copy()
        rec.update({"source": "seed", "confidence": 0.70, "display_name": rec.get("display_name", cand_key)})
        return rec

    # token overlap heuristic
    toks = set(nq.split())
    best_key, best_score = None, 0.0
    for k in SEED.keys():
        s = len(toks.intersection(set(k.split()))) / max(1.0, len(set(k.split())))
        if s > best_score:
            best_score = s
            best_key = k
    if best_key and best_score >= 0.5:
        rec = SEED[best_key].copy()
        rec.update({"source": "seed-fuzzy", "confidence": 0.55, "display_name": rec.get("display_name", best_key)})
        return rec
    return None

# =========================
# Public API
# =========================
def city_lookup(name: str) -> Optional[Dict[str, Any]]:
    """
    GODLEVEL resolver:
    1) Normalize + alias → seed (O(1))
    2) Cache hit (SQLite)
    3) Providers: Nominatim → Photon (with bias + throttling)
    4) Fuzzy seed (offline fallback)
    Returns: {lat, lon, display_name, country_code, source, confidence, basin, coast}
    """
    if not name:
        return None

    raw = name.strip()
    normq = _norm(raw)
    # Lat,lon direct? (e.g., "19.1, 72.85")
    m = re.match(r"^\s*(-?\d+(?:\.\d+)?)\s*[, ]\s*(-?\d+(?:\.\d+)?)\s*$", raw)
    if m:
        lat = float(m.group(1)); lon = float(m.group(2))
        bsn, cst = basin_and_coast(lat, lon)
        return {
            "lat": lat, "lon": lon, "display_name": f"{lat:.4f}, {lon:.4f}",
            "country_code": "", "source": "direct-latlon", "confidence": 1.0,
            "basin": bsn, "coast": cst
        }

    # Alias first
    if normq in ALIASES:
        normq = ALIASES[normq]

    # Seed direct
    if normq in SEED:
        rec = SEED[normq].copy()
        bsn, cst = basin_and_coast(rec["lat"], rec["lon"])
        rec.update({"source": "seed", "confidence": 0.9, "basin": bsn, "coast": cst})
        return rec

    # Cache
    cached = _cache_get(normq)
    if cached:
        # refresh derived fields
        bsn, cst = basin_and_coast(cached["lat"], cached["lon"])
        cached.update({"basin": bsn, "coast": cst})
        return cached

    # Providers
    providers = [_provider_nominatim, _provider_photon]
    for prov in providers:
        rec = prov(raw if not COUNTRY_BIAS else f"{raw}, {COUNTRY_BIAS}")
        if rec:
            bsn, cst = basin_and_coast(rec["lat"], rec["lon"])
            rec.update({"basin": bsn, "coast": cst})
            _cache_set(normq, rec)
            return rec

    # Fallback: fuzzy seed
    rec = _fuzzy_seed(raw)
    if rec:
        bsn, cst = basin_and_coast(rec["lat"], rec["lon"])
        rec.update({"basin": bsn, "coast": cst})
        _cache_set(normq, rec)
        return rec

    return None

# Reverse geocoding (optional; uses Nominatim)
def reverse_geocode(lat: float, lon: float) -> Optional[Dict[str, Any]]:
    try:
        time.sleep(0.6)
        r = requests.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": lat, "lon": lon, "format": "json", "zoom": 10},
            headers={"User-Agent": DEFAULT_UA},
            timeout=15,
        )
        r.raise_for_status()
        data = r.json()
        disp = data.get("display_name") or f"{lat:.4f},{lon:.4f}"
        cc = (data.get("address") or {}).get("country_code", "").upper()
        bsn, cst = basin_and_coast(lat, lon)
        out = {"lat": lat, "lon": lon, "display_name": disp, "country_code": cc,
               "source": "reverse-nominatim", "confidence": 0.8,
               "basin": bsn, "coast": cst}
        # cache by display name norm to speed future lookups
        _cache_set(_norm(disp), out)
        return out
    except Exception:
        return None

# Batch prewarmer: load CSV seeds (optional)
def prewarm_from_csv(paths: List[str]) -> int:
    """
    CSV columns: name,lat,lon[,country_code]
    Caches each row once. Returns count warmed.
    """
    import csv
    count = 0
    for p in paths:
        if not os.path.isfile(p):
            continue
        with open(p, "r", encoding="utf-8") as f:
            r = csv.DictReader(f)
            for row in r:
                try:
                    name = row["name"]
                    lat = float(row["lat"]); lon = float(row["lon"])
                    cc = (row.get("country_code") or "").upper()
                except Exception:
                    continue
                normq = _norm(name)
                bsn, cst = basin_and_coast(lat, lon)
                payload = {
                    "lat": lat, "lon": lon, "display_name": name,
                    "country_code": cc, "source": "csv-prewarm", "confidence": 0.9,
                    "basin": bsn, "coast": cst
                }
                _cache_set(normq, payload)
                count += 1
    return count
