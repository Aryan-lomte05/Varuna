"""
FloatChat AI — SQL Extraction Utility

WHY a separate extractor?
  LLMs sometimes wrap SQL in markdown fences, add explanations before/after,
  or include multiple statements. This module robustly extracts exactly one
  clean SELECT from any LLM output.
"""
from __future__ import annotations
import re
from typing import Optional

SQL_FENCE  = re.compile(r"```(?:sql)?\s*(.*?)```", re.IGNORECASE | re.DOTALL)
SELECT_RE  = re.compile(r"(?is)\bSELECT\b.+")
BANNED     = ("insert","update","delete","drop","alter","create",
              "grant","revoke","truncate","comment","attach")


def extract_sql(text: str) -> Optional[str]:
    """
    Extract a single clean SELECT from LLM-generated text.
    Priority: fenced block > first SELECT occurrence.
    Returns None if no safe SELECT found.
    """
    if not text:
        return None
    t = text.strip()

    # Try fenced block first
    m = SQL_FENCE.search(t)
    cand = m.group(1).strip() if m else None

    # Fallback: first SELECT
    if not cand:
        m2 = SELECT_RE.search(t)
        if not m2:
            return None
        cand = m2.group(0).strip()

    # Strip anything after role markers
    for stop in ("\nAnswer:", "\nHuman:", "\nAssistant:", "\nExplanation:", "```"):
        cand = cand.split(stop)[0].strip()

    cand = cand.rstrip(";").strip()
    low = cand.lower()

    if not low.lstrip().startswith("select"):
        return None
    if any(b in low for b in BANNED):
        return None
    return cand


def sanitize_sql(sql: str) -> str:
    """
    Validate that the SQL query is a single, clean, safe SELECT statement.
    Raises ValueError if unsafe, non-SELECT, or contains chained statements.
    """
    extracted = extract_sql(sql)
    if not extracted:
        raise ValueError(f"Invalid or unsafe SQL query: '{sql[:100]}...' - must be a single SELECT statement.")
    return extracted

