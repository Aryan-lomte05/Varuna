"""
FloatChat AI — DuckDB Parquet Analytics Client

WHY DuckDB?
  DuckDB is an in-process OLAP engine — it queries Parquet files directly
  (no separate server needed) with full SQL support. For analytical queries
  (aggregations, window functions, multi-file joins), DuckDB is 10–100x faster
  than PostgreSQL because:
  - Columnar: reads only the columns you ask for
  - Vectorized: SIMD operations on batches of values
  - In-process: no network round-trip

  Use cases:
  - Export queries: "give me the CSV/Parquet of all Arabian Sea data"
  - Complex window functions that are slow in Postgres
  - Cross-file analysis of multiple NetCDF batches before they're in Postgres
  - Data validation during ingestion

WHY NOT use DuckDB as the primary store?
  DuckDB is single-writer — only one process can write at a time.
  We need concurrent writes from the ingestion service + reads from the API.
  PostgreSQL handles concurrent access correctly with ACID guarantees.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import duckdb

from src.config import settings

# ── Connection factory (one per thread — DuckDB connections aren't threadsafe) ─
def get_conn(read_only: bool = True) -> duckdb.DuckDBPyConnection:
    """Create a DuckDB connection over the processed Parquet directory."""
    conn = duckdb.connect(database=":memory:", read_only=False)
    # Register all parquet files in the processed dir as a virtual table
    parquet_glob = str(Path(settings.data_parquet_dir) / "*.parquet")
    if Path(settings.data_parquet_dir).exists():
        try:
            conn.execute(f"""
                CREATE OR REPLACE VIEW marine_data AS
                SELECT * FROM read_parquet('{parquet_glob}')
            """)
        except Exception:
            pass  # No parquet files yet — view will fail silently
    return conn


def query_parquet(sql: str, limit: int = 2000) -> List[Dict[str, Any]]:
    """
    Run a SELECT on Parquet files via DuckDB.
    Used for export and analytical queries.
    """
    conn = get_conn()
    try:
        result = conn.execute(sql).fetchdf()
        if limit:
            result = result.head(limit)
        return result.to_dict(orient="records")
    finally:
        conn.close()


def export_to_csv(sql: str, output_path: str) -> str:
    """Export query results to CSV file."""
    conn = get_conn()
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        conn.execute(f"COPY ({sql}) TO '{output_path}' (HEADER, DELIMITER ',')")
        return output_path
    finally:
        conn.close()


def export_to_parquet(sql: str, output_path: str) -> str:
    """Export query results to Parquet file (for download)."""
    conn = get_conn()
    try:
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        conn.execute(f"COPY ({sql}) TO '{output_path}' (FORMAT PARQUET)")
        return output_path
    finally:
        conn.close()


def parquet_stats() -> Dict[str, Any]:
    """Quick stats about the Parquet store."""
    try:
        conn = get_conn()
        row = conn.execute("""
            SELECT
                COUNT(*) AS total_rows,
                COUNT(DISTINCT platform_number) AS floats,
                MIN(time) AS earliest,
                MAX(time) AS latest,
                SUM(CASE WHEN doxy IS NOT NULL THEN 1 ELSE 0 END) AS bgc_oxygen_rows,
                SUM(CASE WHEN chla IS NOT NULL THEN 1 ELSE 0 END) AS bgc_chla_rows
            FROM marine_data
        """).fetchone()
        return {
            "total_rows": row[0], "unique_floats": row[1],
            "earliest": str(row[2]), "latest": str(row[3]),
            "bgc_oxygen_rows": row[4], "bgc_chla_rows": row[5],
        }
    except Exception as e:
        return {"error": str(e)}
