# Hinglish: Lightweight SQL beautifier — whitespace normalize + basic keyword casing + single trailing semicolon.
# Notes:
# - Yeh simple formatter hai; koi SQL parser nahi. Intent: human-readability improve + duplicates/garbage avoid.
# - User-facing strings yahan generate nahi ho rahe; sirf SQL string mutate ho rahi.

from __future__ import annotations

import re

# Hinglish: common keywords ko uppercase kar do (naive matching).
# Order longest-first taaki "GROUP BY" jaise multi-word pehle match ho.
KEYWORDS = [
    "group by",
    "order by",
    "left join",
    "right join",
    "inner join",
    "outer join",
    "select",
    "from",
    "where",
    "limit",
    "and",
    "or",
    "as",
    "between",
    "date_trunc",
    "abs",
    "avg",
    "min",
    "max",
    "count",
    "percentile_cont",
    "having",
]

# Hinglish: optionally common SQL functions ko bhi normalize kar do (case-insensitive).
FUNC_WORDS = [
    "date_trunc",
    "avg",
    "min",
    "max",
    "count",
    "abs",
    "percentile_cont",
]


def _upper_keywords(sql: str) -> str:
    s = sql
    # Longest first
    for kw in sorted(KEYWORDS, key=lambda x: -len(x)):
        # word-boundary-ish match; multi-word ke liye bhi simple re chalega
        s = re.sub(rf"\b{re.escape(kw)}\b", kw.upper(), s, flags=re.IGNORECASE)
    # Functions ko uppercase mat karo (Postgres case-insensitive hota hai),
    # sirf consistency ke liye lower/upper kar sakte ho — abhi leave as-is.
    return s


def beautify(sql: str) -> str:
    """
    Hinglish: Do the bare minimum:
    - strip leading/trailing spaces
    - collapse multiple spaces
    - collapse multiple blank lines
    - uppercase common keywords
    - ensure exactly one trailing semicolon
    - never add a second LIMIT if already present (this function doesn’t add LIMIT)
    """
    if not sql:
        return sql

    # Normalize newlines
    s = sql.replace("\r\n", "\n").replace("\r", "\n")

    # Trim
    s = s.strip()

    # Collapse multiple spaces/tabs
    s = re.sub(r"[ \t]+", " ", s)

    # Collapse multiple blank lines
    s = re.sub(r"\n\s*\n+", "\n", s)

    # Uppercase common keywords
    s = _upper_keywords(s)

    # Single trailing semicolon
    s = s.rstrip()
    if not s.endswith(";"):
        s += ";"

    return s
