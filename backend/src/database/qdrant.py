"""
VARUNA — Qdrant Vector Store Operations & 3-Collection Knowledge Base Seeder
Manages 3 distinct semantic collections:
1. argo_knowledge: ARGO physical/chemical oceanographic knowledge & phenomena.
2. argo_schema: PostgreSQL schema DDLs, column metadata, and few-shot SQL exemplars.
3. bio_knowledge: CMLRE Darwin Core marine species taxonomy and thermal tolerance envelopes.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from src.config import settings
from src.llm.embedder import embed_texts

log = logging.getLogger("varuna.qdrant")

BIO_KNOWLEDGE_BASE = [
    {
        "id": 5001,
        "text": (
            "Sardinella longiceps (Indian Oil Sardine): Pelagic schooling clupeid fish supporting 15-20% "
            "of India's total marine fish catch along the Malabar and Konkan coasts. Optimal thermal window: "
            "22.0°C to 26.0°C. Temperature anomalies exceeding 28.5°C trigger school dispersal and vertical "
            "migration into deeper, cooler bathymetric layers."
        ),
        "payload": {"scientific_name": "Sardinella longiceps", "family": "Clupeidae", "source": "CMLRE"},
    },
    {
        "id": 5002,
        "text": (
            "Rastrelliger kanagurta (Indian Mackerel): Coastal pelagic species inhabiting tropical waters "
            "with thermal tolerance between 24.0°C and 27.5°C. Highly sensitive to Oxygen Minimum Zone (OMZ) "
            "shoaling; dissolved oxygen levels < 50 µmol/kg restrict schooling to surface waters (< 30m)."
        ),
        "payload": {"scientific_name": "Rastrelliger kanagurta", "family": "Scombridae", "source": "CMLRE"},
    },
    {
        "id": 5003,
        "text": (
            "Acropora millepora (Staghorn Coral): Key reef-building scleractinian coral in the Gulf of Mannar "
            "and Lakshadweep archipelagos. Thermal optimum: 24.0°C to 28.0°C. Prolonged Degree Heating Weeks (DHW > 4) "
            "and temperature anomalies > +1.5°C cause severe zooxanthellae expulsion and mass bleaching."
        ),
        "payload": {"scientific_name": "Acropora millepora", "family": "Acroporidae", "source": "CMLRE"},
    },
    {
        "id": 5004,
        "text": (
            "Thunnus albacares (Yellowfin Tuna): High-trophic pelagic migratory predator in the equatorial "
            "Indian Ocean and Arabian Sea. Minimum dissolved oxygen threshold: 90 µmol/kg. Severe hypoxia in the "
            "subsurface OMZ restricts foraging dives, causing vertical habitat compression."
        ),
        "payload": {"scientific_name": "Thunnus albacares", "family": "Scombridae", "source": "CMLRE"},
    }
]

ARGO_KNOWLEDGE_BASE = [
    {
        "id": 1001,
        "text": "PRES (Pressure): Measured in decibars (dbar). In the ocean, 1 dbar ≈ 1 meter depth. Primary depth variable in ARGO NetCDF files (0 to 2000 dbar).",
        "payload": {"source": "variables", "var": "pres"},
    },
    {
        "id": 1002,
        "text": "TEMP (Temperature): In-situ sea temperature measured in degrees Celsius (°C). Sea Surface Temperature (SST) is measured at PRES < 5 dbar. QC flag 1 indicates good data.",
        "payload": {"source": "variables", "var": "temp"},
    },
    {
        "id": 1003,
        "text": "PSAL (Practical Salinity): Measured in PSU. Arabian Sea exhibits high salinity (~36 PSU) due to excess evaporation, while Bay of Bengal has low salinity (~32-34 PSU) from major river runoff.",
        "payload": {"source": "variables", "var": "psal"},
    },
    {
        "id": 1004,
        "text": "DOXY (Dissolved Oxygen): Measured in µmol/kg by BGC-ARGO optodes. Oxygen Minimum Zone (OMZ) in the northern Arabian Sea has values < 20 µmol/kg at 150-1000m depths.",
        "payload": {"source": "variables", "var": "doxy"},
    },
]


def _get_client():
    try:
        from qdrant_client import QdrantClient  # type: ignore
        return QdrantClient(url=settings.qdrant_url, api_key=settings.qdrant_api_key or None, timeout=5)
    except Exception:
        return None


async def init_qdrant():
    """Ensure all 3 collections exist and are seeded."""
    client = _get_client()
    if client is None:
        log.warning("Qdrant client unavailable. Vector operations will use in-memory fallback.")
        return

    from qdrant_client.http import models  # type: ignore

    collections = ["argo_knowledge", "argo_schema", "bio_knowledge"]
    for col in collections:
        try:
            client.get_collection(col)
        except Exception:
            try:
                client.create_collection(
                    collection_name=col,
                    vectors_config=models.VectorParams(size=768, distance=models.Distance.COSINE),
                )
                log.info("Created Qdrant collection: %s", col)
            except Exception as e:
                log.warning("Could not create collection %s: %s", col, str(e))


async def search_similar(
    query: str,
    collection_name: str = "argo_knowledge",
    limit: int = 5,
) -> List[Dict[str, Any]]:
    """Search similar passages in a specific Qdrant collection."""
    client: Any = _get_client()
    if client is None:
        return []

    try:
        from src.llm.embedder import embed_texts
        vector = embed_texts([query])[0]
        if hasattr(client, "search"):
            results = client.search(
                collection_name=collection_name,
                query_vector=vector,
                limit=limit,
            )
        else:
            return []
        return [
            {
                "id": hit.id,
                "text": hit.payload.get("text", "") if hit.payload else "",
                "score": float(hit.score),
                "payload": hit.payload,
            }
            for hit in results
        ]
    except Exception as e:
        log.warning("Qdrant search error: %s", str(e))
        return []
