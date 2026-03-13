-- Tiny seed for local testing.
INSERT INTO floats (float_id, wmo_id, platform, deployment_date, last_seen, last_lat, last_lon, region) VALUES
('IND-ARGO-001','6901234','APEX','2023-01-10','2025-08-20',-2.3, 149.2,'Indian Ocean')
ON CONFLICT (float_id) DO NOTHING;


INSERT INTO profiles (float_id, time, lat, lon, cycle, qc) VALUES
('IND-ARGO-001','2025-03-01 10:00:00', -2.5, 149.1, 101, 1),
('IND-ARGO-001','2025-03-11 10:00:00', -2.6, 149.3, 102, 1);


INSERT INTO measurements (profile_id, depth_m, temperature_c, salinity_psu, oxygen_mmol_kg, chla_mg_m3) VALUES
(1, 5, 28.1, 34.7, 200.5, 0.05),
(1, 50, 24.3, 35.1, 210.0, 0.03),
(2, 10, 27.8, 34.6, 199.2, 0.04);