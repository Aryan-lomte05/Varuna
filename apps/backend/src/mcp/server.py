"""Hinglish: Minimal MCP server exposing 3 tools. Advanced users only.
Run: python -m src.mcp.server
"""
from model_context_protocol import MCPServer
from src.tools.sql_tools import execute_sql, semantic_search
from src.db.postgres import run_sql

srv = MCPServer("floatchat-mcp")

@srv.tool()
def mcp_run_sql(sql: str) -> list[dict]:
    """Run a SQL SELECT safely (LIMIT enforced by server)."""
    return execute_sql(sql, limit=10000)

@srv.tool()
def mcp_get_schema() -> str:
    rows = run_sql("SELECT table_name FROM information_schema.tables WHERE table_schema='public' ORDER BY 1;")
    return "\n".join([r['table_name'] for r in rows])

@srv.tool()
def mcp_semantic_search(query: str) -> list[tuple[str,float]]:
    return semantic_search(query, k=5)

if __name__ == "__main__":
    srv.run()
