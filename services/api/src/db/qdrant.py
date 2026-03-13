"""
FloatChat AI — Qdrant Vector Store Operations + Knowledge Base Seeder

This module handles:
1. Upsert operations (during ingestion)
2. Seeding the ARGO knowledge base on startup (if empty)

The knowledge base contains:
  - ARGO variable descriptions and units
  - Ocean region summaries
  - BGC parameter guides
  - Float measurement cycle descriptions
  - QC flag explanations
  - Indian Ocean oceanography summaries

This is the "retrieval corpus" — what the semantic RAG chain searches over.
WHY seed on startup? If Qdrant is empty, semantic queries return nothing.
We pre-load a curated set of domain documents so the system works
out-of-the-box, even before user data is fully ingested.
"""
from __future__ import annotations

from src.config import settings
from src.rag.retriever import get_qdrant, ensure_collection, upsert_chunks

ARGO_KNOWLEDGE_BASE = [
    # ── Variable descriptions ─────────────────────────────────────────────
    {
        "text": (
            "PRES (Pressure): Measured in decibars (dbar). In the ocean, 1 dbar ≈ 1 meter depth. "
            "Argo floats measure pressure at each level, from surface (0 dbar) to deep profiles (2000 dbar). "
            "Pressure is the primary depth variable in all Argo NetCDF files."
        ),
        "id": 1001,
        "payload": {"source": "variables", "var": "pres", "type": "definition"},
    },
    {
        "text": (
            "TEMP (Temperature): In-situ sea temperature measured in degrees Celsius (°C). "
            "Typical range: -2°C (near freezing) to 30°C (tropical surface). "
            "Sea Surface Temperature (SST) is TEMP at PRES < 5 dbar. "
            "QC flag: TEMP_QC = 1 (good), 2 (probably good), 4 (bad), 9 (missing)."
        ),
        "id": 1002,
        "payload": {"source": "variables", "var": "temp", "type": "definition"},
    },
    {
        "text": (
            "PSAL (Practical Salinity): Measured in Practical Salinity Units (PSU), dimensionless. "
            "Typical ocean salinity: 32–37 PSU. Arabian Sea: ~36 PSU (high, evaporation dominates). "
            "Bay of Bengal: ~32–34 PSU (low, river runoff from Ganges/Brahmaputra dilutes it). "
            "Salinity is critical for density calculations (thermohaline circulation)."
        ),
        "id": 1003,
        "payload": {"source": "variables", "var": "psal", "type": "definition"},
    },
    {
        "text": (
            "DOXY (Dissolved Oxygen): In Argo BGC floats, dissolved oxygen is measured in µmol/kg. "
            "Well-oxygenated surface: ~200–250 µmol/kg. Oxygen Minimum Zone (OMZ): < 20 µmol/kg. "
            "The Arabian Sea has one of the world's most intense OMZs at 150–1000m depth. "
            "Higher temperature reduces oxygen solubility (inverse relationship: T↑ → O₂↓)."
        ),
        "id": 1004,
        "payload": {"source": "variables", "var": "doxy", "type": "definition"},
    },
    {
        "text": (
            "CHLA (Chlorophyll-a): Measured in mg/m³. Indicator of phytoplankton biomass and primary productivity. "
            "Typical surface values: 0.05 mg/m³ (oligotrophic gyre) to >5 mg/m³ (upwelling zones). "
            "Arabian Sea: high CHLA during SW monsoon upwelling (June–September). "
            "Bay of Bengal: stratified, lower CHLA. Deep chlorophyll maximum (DCM) at 50–100m."
        ),
        "id": 1005,
        "payload": {"source": "variables", "var": "chla", "type": "definition"},
    },
    {
        "text": (
            "NITRATE: Measured in µmol/kg. Macronutrient for phytoplankton. "
            "Surface nitrate is typically depleted (<1 µmol/kg) in stratified warm water. "
            "Upwelling brings nitrate-rich deep water to the surface, driving blooms. "
            "Arabian Sea upwelling regions show nitrate > 20 µmol/kg during monsoon."
        ),
        "id": 1006,
        "payload": {"source": "variables", "var": "nitrate", "type": "definition"},
    },
    # ── Ocean regions ─────────────────────────────────────────────────────
    {
        "text": (
            "Arabian Sea: Northwest arm of the Indian Ocean between India (east), Arabia (northwest), Somalia (west). "
            "Bounding box: 40–77°E, 5–25°N. Characterized by: intense SW monsoon upwelling (Jun–Sep) along "
            "Oman and Somalia coasts, one of the world's most intense Oxygen Minimum Zones (OMZ) at 150–1000m, "
            "high evaporation → high salinity (~36 PSU), warm SST (26–30°C)."
        ),
        "id": 2001,
        "payload": {"source": "primer", "region": "arabian_sea", "type": "region_summary"},
    },
    {
        "text": (
            "Bay of Bengal: Northeast arm of Indian Ocean, bounded by India (west), Bangladesh/Myanmar (north), "
            "Andaman-Nicobar (east). Bounding box: 75–100°E, 5–25°N. "
            "Key characteristics: freshwater influx from Ganges, Brahmaputra, Mahanadi rivers → low salinity (32–34 PSU), "
            "strong salinity stratification suppresses deep mixing, warm SST year-round, "
            "frequent cyclogenesis (warm pool + moisture)."
        ),
        "id": 2002,
        "payload": {"source": "primer", "region": "bay_of_bengal", "type": "region_summary"},
    },
    # ── ARGO Float mechanics ──────────────────────────────────────────────
    {
        "text": (
            "Argo Float Measurement Cycle: Each Argo float follows a 10-day duty cycle. "
            "1) Float drifts at park depth (~1000m) for ~9 days. "
            "2) Descends to profile depth (usually 2000m). "
            "3) Ascends slowly collecting PRES, TEMP, PSAL (and BGC variables if equipped). "
            "4) Surfaces, transmits data via Argos/Iridium satellite to GDACs. "
            "5) Descends again. Typical float lifetime: 3–5 years (~150–180 profiles)."
        ),
        "id": 3001,
        "payload": {"source": "argo_paper", "type": "float_mechanics"},
    },
    {
        "text": (
            "Argo Data Modes: R (Real-Time): transmitted within 24h, no correction. "
            "D (Delayed-Mode): quality-controlled by expert PIs, usually 6 months after collection. "
            "A (Adjusted): real-time with real-time adjustment applied. "
            "For scientific analysis, prefer D-mode data. QC flags: 1=good, 2=probably good, "
            "3=probably bad, 4=bad, 8=interpolated, 9=missing."
        ),
        "id": 3002,
        "payload": {"source": "argo_paper", "type": "data_quality"},
    },
    {
        "text": (
            "Indian Ocean ARGO Coverage: The Indian Ocean has ~1200–1500 active Argo floats as of 2024. "
            "Indian Argo Program (INCOIS/MoES): deploys floats in Arabian Sea, Bay of Bengal, and Indian Ocean. "
            "Data available from: ftp.ifremer.fr/ifremer/argo/geo/indian_ocean "
            "and https://incois.gov.in/OON. "
            "BGC-Argo floats additionally measure O₂, CHLA, NO₃, pH, backscattering."
        ),
        "id": 3003,
        "payload": {"source": "argo_paper", "type": "argo_program"},
    },
    # ── Upwelling / Oceanography ──────────────────────────────────────────
    {
        "text": (
            "Upwelling in the Arabian Sea: During the Southwest (Summer) Monsoon (June–September), "
            "strong southwesterly winds drive Ekman transport away from the coasts of Oman and Somalia. "
            "This causes coastal upwelling: cold, nutrient-rich deep water rises to the surface. "
            "Observable signals: SST drops 4–6°C, nitrate increases dramatically, CHLA blooms, "
            "doxy decreases. These are detectable in Argo float data near the Omani/Somali coast."
        ),
        "id": 4001,
        "payload": {"source": "documentation", "type": "oceanography", "process": "upwelling"},
    },
    {
        "text": (
            "Thermocline: The layer of rapid temperature decrease with depth, typically between 100–500m "
            "in the Indian Ocean. Above: warm mixed layer (20–30°C). Below: cold deep water (<10°C). "
            "Thermocline depth varies seasonally with monsoon winds and solar heating. "
            "In Argo profiles, identified as the depth of maximum dT/dz (steepest temperature gradient)."
        ),
        "id": 4002,
        "payload": {"source": "documentation", "type": "oceanography", "process": "thermocline"},
    },
]


async def seed_argo_knowledge():
    """
    Upload curated ARGO knowledge base to Qdrant if collection is empty.
    Called on server startup.
    """
    client = get_qdrant()
    try:
        info = client.get_collection(settings.qdrant_collection)
        count = info.points_count or 0
        if count > 0:
            return  # Already seeded
    except Exception:
        pass  # Collection doesn't exist yet — ensure_collection handles it

    await upsert_chunks(ARGO_KNOWLEDGE_BASE)
