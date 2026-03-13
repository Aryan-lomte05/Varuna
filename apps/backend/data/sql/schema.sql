-- Hinglish: Yeh minimal schema hai PoC ke liye. Aap apni Argo/ BGC schema se map kar lena.
CREATE TABLE IF NOT EXISTS floats (
 float_id VARCHAR PRIMARY KEY,
 wmo_id VARCHAR,
 platform VARCHAR,
 deployment_date TIMESTAMP,
 last_seen TIMESTAMP,
 last_lat DOUBLE PRECISION,
 last_lon DOUBLE PRECISION,
 region VARCHAR
);


CREATE TABLE IF NOT EXISTS profiles (
 profile_id SERIAL PRIMARY KEY,
 float_id VARCHAR REFERENCES floats(float_id),
 time TIMESTAMP,
 lat DOUBLE PRECISION,
 lon DOUBLE PRECISION,
 cycle INTEGER,
 qc INTEGER
);


CREATE TABLE IF NOT EXISTS measurements (
 id SERIAL PRIMARY KEY,
 profile_id INTEGER REFERENCES profiles(profile_id),
 depth_m DOUBLE PRECISION,
 temperature_c DOUBLE PRECISION,
 salinity_psu DOUBLE PRECISION,
 oxygen_mmol_kg DOUBLE PRECISION,
 chla_mg_m3 DOUBLE PRECISION
);


CREATE INDEX IF NOT EXISTS idx_profiles_float_time ON profiles(float_id, time);
CREATE INDEX IF NOT EXISTS idx_measurements_profile_depth ON measurements(profile_id, depth_m);