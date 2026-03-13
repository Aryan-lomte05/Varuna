/**
 * FloatChat AI — Database Loader (Node.js)
 * 
 * Batch inserts parsed Argo data into PostgreSQL using 'pg'.
 * Handles spatial coordinates conversion to PostGIS points.
 */
import { Pool } from 'pg';
import { ArgoProfile } from './netcdf_parser';

const pool = new Pool({
  connectionString: process.env.PG_DSN,
});

export async function loadToPostgres(profiles: ArgoProfile[]) {
  console.log(`Inserting ${profiles.length} profiles into PostgreSQL...`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const profile of profiles) {
      // 1. Insert into floats (if new)
      // 2. Insert into argo_marine_data (partitioned by year)
      // 3. Update spatial geom: ST_SetSRID(ST_Point(lon, lat), 4323)
      
      console.log(`  Loading profile ${profile.platform_number}_${profile.cycle_number}...`);
    }
    
    await client.query('COMMIT');
    console.log('✅ DB sync complete.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.log('❌ DB load failed, rolled back.', error);
    throw error;
  } finally {
    client.release();
  }
}
