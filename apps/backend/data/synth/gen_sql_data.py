"""
Hinglish: Yeh script synthetic NL↔SQL training pairs banata hai aapke schema ke hisaab se,
so that LoRA ko thoda domain feel mil jaaye. Production mein isse Argo/BGC real
examples se replace karo.
"""
import json, random, argparse


TEMPLATES = [
 ("Show me salinity profiles near the equator in {month} {year}",
 "SELECT p.profile_id, p.time, p.lat, p.lon, m.depth_m, m.salinity_psu\n"
 "FROM profiles p JOIN measurements m ON p.profile_id=m.profile_id\n"
 "WHERE p.lat BETWEEN -5 AND 5 AND DATE_PART('month', p.time)={mnum} AND DATE_PART('year', p.time)={year}\n"
 "ORDER BY p.time, m.depth_m LIMIT 200;"),
 ("Compare BGC parameters in the Arabian Sea for the last {n} months",
 "SELECT DATE_TRUNC('month', p.time) AS month,\n"
 " AVG(m.oxygen_mmol_kg) AS avg_o2, AVG(m.chla_mg_m3) AS avg_chla\n"
 "FROM profiles p JOIN measurements m ON p.profile_id=m.profile_id\n"
 "WHERE p.lon BETWEEN 40 AND 75 AND p.lat BETWEEN 5 AND 25 AND p.time > NOW() - INTERVAL '{n} months'\n"
 "GROUP BY 1 ORDER BY 1;"),
 ("What are the nearest ARGO floats to lat {lat} lon {lon}?",
 "SELECT float_id, last_lat, last_lon,\n"
 " (\n"
 " 6371 * acos( cos(radians({lat})) * cos(radians(last_lat)) * cos(radians(last_lon) - radians({lon})) +\n"
 " sin(radians({lat})) * sin(radians(last_lat)) )\n"
 " ) AS km\n"
 "FROM floats ORDER BY km ASC LIMIT 5;")
]


MONTHS = [("January",1),("March",3),("June",6),("September",9)]


def main(out, rows):
 data = []
 for _ in range(rows):
  t = random.choice(TEMPLATES)
  if "equator" in t[0]:
   month, mnum = random.choice(MONTHS)
   year = random.choice([2023, 2024, 2025])
   nl = t[0].format(month=month, year=year)
   sql = t[1].format(mnum=mnum, year=year)
  elif "Arabian Sea" in t[0]:
   n = random.choice([3,6,9,12])
   nl = t[0].format(n=n)
   sql = t[1].format(n=n)
  else:
   lat = round(random.uniform(-20, 20), 2)
   lon = round(random.uniform(40, 85), 2)
   nl = t[0].format(lat=lat, lon=lon)
   sql = t[1].format(lat=lat, lon=lon)
  data.append({"instruction": nl, "output": sql})
 with open(out, "w", encoding="utf-8") as f:
  for row in data:
   f.write(json.dumps(row) + "\n")
 print(f"Wrote {len(data)} pairs to {out}")


if __name__ == "__main__":
 ap = argparse.ArgumentParser()
 ap.add_argument("--out", default="data/synth/train.jsonl")
 ap.add_argument("--rows", type=int, default=500)
 args = ap.parse_args()
 main(args.out, args.rows)