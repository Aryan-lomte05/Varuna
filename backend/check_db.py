import sys
import os
sys.path.append(os.getcwd())
from src.database.postgres import get_pool

def check_tables():
    pool = get_pool()
    if pool is None:
        print("Database pool is not configured or unavailable.")
        return
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = cur.fetchall()
            print("Tables in public schema:")
            for t in tables:
                table_name = t["table_name"] if isinstance(t, dict) else t[0]
                print(f"- {table_name}")

if __name__ == "__main__":
    check_tables()
