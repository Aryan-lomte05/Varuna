"""
FloatChat AI — Mock Data Seeder
Populates PostgreSQL with sample ARGO data near Mumbai and Maldives
so that the stress test and globe can be verified.
"""
import sys
import os
import random
from datetime import datetime, timedelta

# Add root to sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.db.postgres import get_pool

def seed():
    print("🌊 Seeding FloatChat AI with mock ARGO data...")
    pool = get_pool()
    
    # Sample data points
    # Mumbai: 19.076, 72.877
    # Maldives: 3.2, 73.0
    # Bay of Bengal: 15.0, 85.0
    
    locations = [
        {"name": "Mumbai Near", "lat": 19.1, "lon": 72.9, "count": 5},
        {"name": "Maldives Near", "lat": 3.4, "lon": 73.2, "count": 5},
        {"name": "Arabian Sea Central", "lat": 15.0, "lon": 65.0, "count": 8},
        {"name": "Bay of Bengal", "lat": 12.0, "lon": 88.0, "count": 7},
        {"name": "Equatorial IO", "lat": 0.0, "lon": 80.0, "count": 5},
    ]
    
    platforms = [1902301, 1902302, 1902303, 1902304, 1902305, 5906781, 5906782]
    
    all_rows = []
    now = datetime.now()
    
    for loc in locations:
        for i in range(loc["count"]):
            p_id = random.choice(platforms)
            # Jitter
            lat = loc["lat"] + random.uniform(-0.5, 0.5)
            lon = loc["lon"] + random.uniform(-0.5, 0.5)
            # Past 30 days
            time = now - timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
            
            all_rows.append((
                p_id, time, lat, lon,
                random.uniform(5.0, 10.0), 1, # surface pres
                random.uniform(25.0, 31.0), 1, # temp
                random.uniform(34.0, 36.5), 1, # psal
                random.uniform(180.0, 220.0), 1, # doxy
                random.uniform(0.1, 0.8),      # chla
                random.uniform(0.1, 5.0),      # nitrate
                8.1, 0.05 # ph, bbp
            ))

    with pool.connection() as conn:
        with conn.cursor() as cur:
            # 1. Clear existing (optional, but good for clean state)
            cur.execute("TRUNCATE TABLE public.marine_data CASCADE")
            cur.execute("TRUNCATE TABLE public.floats CASCADE")
            
            # 2. Insert marine_data
            sql = """
                INSERT INTO public.marine_data (
                    platform_number, time, latitude, longitude, geom,
                    pres, pres_qc, temp, temp_qc, psal, psal_qc,
                    doxy, doxy_qc, chla, nitrate, ph_in_situ_total, bbp700
                ) VALUES (
                    %(p_id)s, %(time)s, %(lat)s, %(lon)s, ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::GEOGRAPHY,
                    %(pres)s, %(pres_qc)s, %(temp)s, %(temp_qc)s, %(psal)s, %(psal_qc)s,
                    %(doxy)s, %(doxy_qc)s, %(chla)s, %(nitrate)s, %(ph)s, %(bbp)s
                )
            """
            for r in all_rows:
                params = {
                    "p_id": r[0], "time": r[1], "lat": r[2], "lon": r[3],
                    "pres": r[4], "pres_qc": r[5], "temp": r[6], "temp_qc": r[7],
                    "psal": r[8], "psal_qc": r[9], "doxy": r[10], "doxy_qc": r[11],
                    "chla": r[12], "nitrate": r[13], "ph": r[14], "bbp": r[15]
                }
                cur.execute(sql, params)
            
            # 3. Insert floats registry
            for p in platforms:
                # Find latest position for this platform in our seeded rows
                p_rows = [r for r in all_rows if r[0] == p]
                if not p_rows: continue
                latest = max(p_rows, key=lambda x: x[1])
                
                cur.execute("""
                    INSERT INTO public.floats (
                        wmo_id, platform_type, program, last_seen, 
                        last_lat, last_lon, geom, total_profiles
                    ) VALUES (%s, %s, %s, %s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326)::GEOGRAPHY, %s)
                """, (
                    str(p), "Argo", "Indian Ocean ARGO", 
                    latest[1], latest[2], latest[3], latest[3], latest[2], len(p_rows)
                ))
            
            conn.commit()
            
    print(f"✅ Successfully seeded {len(all_rows)} data points across {len(platforms)} floats.")

if __name__ == "__main__":
    seed()
