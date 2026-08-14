"""
FloatChat AI — Text Embedder Engine (768-dim Vectors)
"""
from __future__ import annotations

import math
import hashlib
from typing import List

def _hash_vector(text: str, dim: int = 768) -> List[float]:
    """Fallback deterministic hash vector representation when no neural embedder is loaded."""
    vec = [0.0] * dim
    words = text.lower().split()
    for w in words:
        h = int(hashlib.md5(w.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        val = ((h >> 8) % 1000) / 500.0 - 1.0
        vec[idx] += val
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [round(v / norm, 6) for v in vec]


def embed_texts(texts: List[str]) -> List[List[float]]:
    """
    Generate 768-dimensional embeddings for a batch of texts.
    Tries sentence-transformers first, falls back to deterministic hash vectors.
    """
    try:
        from sentence_transformers import SentenceTransformer  # type: ignore
        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode(texts, convert_to_numpy=True)
        # Pad or slice to 768-dim if needed
        res = []
        for e in embeddings:
            lst = e.tolist()
            if len(lst) < 768:
                lst = lst + [0.0] * (768 - len(lst))
            elif len(lst) > 768:
                lst = lst[:768]
            res.append(lst)
        return res
    except Exception:
        return [_hash_vector(t) for t in texts]
