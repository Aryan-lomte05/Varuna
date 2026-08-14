import psycopg

try:
    print("Attempting to connect to PostgreSQL at localhost:5432 with user aditya4...")
    conn = psycopg.connect("postgresql://aditya4@localhost:5432/postgres", connect_timeout=5)
    print("Connected successfully!")
    
    cur = conn.cursor()
    cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
    tables = cur.fetchall()
    print("Tables found:", tables)
    
    conn.close()
except Exception as e:
    print("Connection failed:", e)
