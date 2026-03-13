import sys
import os
sys.path.append(os.getcwd())
from src.db.postgres import get_pool

def check_tables():
    pool = get_pool()
    with pool.connection() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'")
            tables = cur.fetchall()
            print("Tables in public schema:")
            for t in tables:
                print(f"- {t['table_name']}")

if __name__ == "__main__":
    check_tables()
