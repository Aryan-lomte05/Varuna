// local_ingestion_service.js (Maximum Debug Version)
import cron from 'node-cron';
import axios from 'axios';
import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config();

// --- 1. LOCAL DATABASE CLIENT ---
const { Pool } = pg;
let localPgPool;
try {
  localPgPool = new Pool({
    host: process.env.PG_HOST,
    user: process.env.PG_USER,
    password: process.env.PG_PASSWORD,
    database: process.env.PG_DATABASE,
    port: process.env.PG_PORT,
  });
  console.log('--> Local PostgreSQL Connection Pool created.');
} catch (e) {
  console.error('--> FATAL: Could not create Local PostgreSQL Connection Pool. Check your .env variables.', e.message);
  process.exit(1); // Exit if we can't create the pool
}

// --- 2. HELPER FUNCTIONS ---
async function getLatestTimestampFromDB_Local() {
  console.log('STEP 1: Asking the local database for the newest record...');
  const query = `
    SELECT MAX(t) as latest_time FROM (
        SELECT "time" as t FROM marine_data_2022 UNION ALL
        SELECT "time" as t FROM marine_data_2023 UNION ALL
        SELECT "time" as t FROM marine_data_2024 UNION ALL
        SELECT "time" as t FROM marine_data_2025 UNION ALL
        SELECT "time" as t FROM marine_data_2026
    ) as all_times;
  `;
  try {
    const result = await localPgPool.query(query);
    const latestTimestamp = result.rows[0].latest_time;

    if (!latestTimestamp) {
      console.log('--> INFO: Database appears to be empty. Using default start date.');
      return new Date('2022-01-01T00:00:00Z');
    }
    const date = new Date(latestTimestamp);
    console.log(`--> SUCCESS: Database's latest record is from: ${date.toISOString()}`);
    return date;
  } catch (e) {
    console.error('--> ERROR: Could not get latest timestamp from local DB. Check if tables exist.', e.message);
    throw e;
  }
}

async function parseAndGroupData(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 3) return {};
  const headers = lines[0].split(',');
  const dataRows = lines.slice(2);
  const dataByYear = {};
  for (const row of dataRows) {
    const values = row.split(',');
    const entry = {};
    headers.forEach((header, i) => {
      const cleanHeader = header.trim();
      const value = values[i];
      entry[cleanHeader] = value === '' ? null : (isNaN(Number(value)) ? value : Number(value));
    });
    try {
      const year = new Date(entry.time).getFullYear();
      if (!isNaN(year)) {
        if (!dataByYear[year]) dataByYear[year] = [];
        dataByYear[year].push(entry);
      }
    } catch (e) { /* Ignore rows with invalid dates */ }
  }
  return dataByYear;
}

// --- 3. CORE INGESTION LOGIC ---
async function runDataIngestion() {
  console.log(`\n====================================================`);
  console.log(`[${new Date().toISOString()}] Starting Ingestion Run...`);
  console.log(`====================================================`);
  
  try {
    const lastDateInDB = await getLatestTimestampFromDB_Local();
    const startDate = new Date(lastDateInDB);
    startDate.setSeconds(startDate.getSeconds() + 1);
    const endDate = new Date();

    // The resilient check for the 404 error
    if (startDate > endDate) {
      console.log('--> INFO: Database is already up-to-date.');
      return;
    }

    const startTime = startDate.toISOString();
    const endTime = endDate.toISOString();
    const endpoint = `https://www.ifremer.fr/erddap/tabledap/ArgoFloats-synthetic-BGC.csv?platform_number,latitude,longitude,time,pres,temp,psal,doxy,chla,ph_in_situ_total,nitrate&latitude>=0&latitude<=30&longitude>=50&longitude<=100&time>=${startTime}&time<=${endTime}`;
    
    console.log(`\nSTEP 2: Fetching new data from the Argo API...`);
    console.log(`--> Requesting URL: ${endpoint}`);
    
    let csvData;
    try {
        const response = await axios.get(endpoint);
        csvData = response.data;
        console.log(`--> SUCCESS: Received a response from the API.`);
    } catch (e) {
        if (e.response && e.response.status === 404) {
            console.log(`--> INFO: API returned 404 Not Found. This means no new data is available on the server for this time range.`);
            console.log(`--> Server Message (for context): ${e.response.data.split('\n')[1]}`);
            return;
        }
        throw e;
    }
    
    if (!csvData || typeof csvData !== 'string' || csvData.trim().split('\n').length <= 2) {
        console.log('--> INFO: API returned an empty dataset. No new data to ingest.');
        return;
    }

    console.log(`\nSTEP 3: Parsing and grouping the new data...`);
    const dataByYear = await parseAndGroupData(csvData);
    if (Object.keys(dataByYear).length === 0) {
        console.log('--> INFO: Parsing resulted in zero valid data rows.');
        return;
    }
    console.log('--> SUCCESS: Data grouped for ingestion:');
    for (const year in dataByYear) console.log(`    - Year ${year}: ${dataByYear[year].length} new rows.`);

    console.log(`\nSTEP 4: Inserting data into Local PostgreSQL database...`);
    const BATCH_SIZE = 5000;

    for (const year in dataByYear) {
      const rows = dataByYear[year];
      const tableName = `marine_data_${year}`;
      const totalRows = rows.length;
      console.log(`\n--- Starting ingestion for ${totalRows} rows into ${tableName} ---`);

      for (let i = 0; i < totalRows; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const batchNumber = (i / BATCH_SIZE) + 1;
        const totalBatches = Math.ceil(totalRows / BATCH_SIZE);
        console.log(`  Processing Batch ${batchNumber} of ${totalBatches} (${batch.length} rows)...`);
        
        try {
          const columnNames = Object.keys(batch[0]);
          const values = batch.map(row => columnNames.map(col => row[col]));
          const valuePlaceholders = values.map((_, idx) => `(${columnNames.map((_, j) => `$${idx * columnNames.length + j + 1}`).join(',')})`).join(',');
          const query = `INSERT INTO ${tableName} (${columnNames.map(name => `"${name}"`).join(',')}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`;
          
          await localPgPool.query(query, values.flat());
          console.log(`    --> [Local PG] SUCCESS for batch ${batchNumber}.`);
        } catch (e) {
          console.error(`    --> [Local PG] FAILED for Batch ${batchNumber}. Error: ${e.message}`);
        }
      }
    }
  } catch (error) {
    console.error('--> FATAL ERROR during ingestion job:', error.message);
  } finally {
    console.log(`\n[${new Date().toISOString()}] Ingestion job finished.`);
  }
}

// --- 4. SCHEDULER ---
console.log('Smart ingestion service started for Local PostgreSQL. Job is scheduled to run automatically.');
cron.schedule(' 21 20 * * *', runDataIngestion); // Run at 1 AM every day

// Manually run it once to see the logs
runDataIngestion();


// // ingestion-service.js (Final Version with Batch Inserts and Max Debugging)
// import cron from 'node-cron';
// import axios from 'axios';
// import dotenv from 'dotenv';
// import { createClient } from '@supabase/supabase-js';
// import pg from 'pg';

// dotenv.config();

// // --- 1. DATABASE CLIENTS ---
// const supabase = createClient(
//   process.env.SUPABASE_URL,
//   process.env.SUPABASE_ANON_KEY
// );

// const { Pool } = pg;
// const localPgPool = new Pool({
//   host: process.env.PG_HOST,
//   user: process.env.PG_USER,
//   password: process.env.PG_PASSWORD,
//   database: process.env.PG_DATABASE,
//   port: process.env.PG_PORT,
// });

// // --- 2. HELPER FUNCTIONS ---
// async function getLatestTimestampFromDB() {
//   // This function is working correctly and remains the same.
//   console.log('STEP 1: Asking the database for the newest record...');
//   const { data, error } = await supabase.rpc('get_latest_timestamp');
//   if (error) {
//     console.error('--> ERROR: Could not get latest timestamp. Details:', error.message);
//     throw error;
//   }
//   if (!data) {
//     console.log('--> INFO: Database appears to be empty. Will fetch from a default start date.');
//     return new Date('2022-01-01T00:00:00Z');
//   }
//   console.log(`--> SUCCESS: Database's latest record is from: ${data}`);
//   return new Date(data);
// }

// async function parseAndGroupData(csvText) {
//   // This function is working correctly and remains the same.
//   const lines = csvText.trim().split('\n');
//   if (lines.length < 3) return {};
//   const headers = lines[0].split(',');
//   const dataRows = lines.slice(2);
//   const dataByYear = {};
//   for (const row of dataRows) {
//     const values = row.split(',');
//     const entry = {};
//     headers.forEach((header, i) => {
//       const cleanHeader = header.trim();
//       const value = values[i];
//       entry[cleanHeader] = value === '' ? null : (isNaN(Number(value)) ? value : Number(value));
//     });
//     const year = new Date(entry.time).getFullYear();
//     if (!dataByYear[year]) dataByYear[year] = [];
//     dataByYear[year].push(entry);
//   }
//   return dataByYear;
// }

// // --- 3. CORE INGESTION LOGIC ---
// async function runDataIngestion() {
//   console.log(`\n====================================================`);
//   console.log(`[${new Date().toISOString()}] Starting Ingestion Run...`);
//   console.log(`====================================================`);
  
//   // --- Pre-run connection checks ---
//   console.log('PRE-RUN CHECK: Verifying database connections...');
//   try {
//     await supabase.rpc('get_latest_timestamp'); // A simple call to check Supabase
//     console.log('--> Supabase connection: OK');
//     await localPgPool.query('SELECT NOW()'); // A simple query to check local PG
//     console.log('--> Local PostgreSQL connection: OK');
//   } catch (e) {
//     console.error('--> FATAL: Database connection failed. Please check your .env credentials.', e.message);
//     return;
//   }
  
//   try {
//     // STEPS 1 & 2: Fetching data (logic is correct)
//     const lastDateInDB = await getLatestTimestampFromDB();
//     const startDate = new Date(lastDateInDB);
//     startDate.setSeconds(startDate.getSeconds() + 1);
//     const endDate = new Date();
//     endDate.setDate(endDate.getDate() - 15);

//     if (startDate > endDate) {
//       console.log('--> INFO: Database is already up-to-date with available data.');
//       return;
//     }

//     const startTime = startDate.toISOString();
//     const endTime = endDate.toISOString();
//     const endpoint = `https://www.ifremer.fr/erddap/tabledap/ArgoFloats-synthetic-BGC.csv?platform_number,latitude,longitude,time,pres,temp,psal,doxy,chla,ph_in_situ_total,nitrate&latitude>=0&latitude<=30&longitude>=50&longitude<=100&time>2025-07-01T22:00:51.000Z&time<=2025-09-25T10:03:14.040`;
    
//     console.log(`\nSTEP 2: Fetching new data from the Argo API...`);
//     const response = await axios.get(endpoint);
//     const csvData = response.data;
    
//     if (!csvData || typeof csvData !== 'string' || csvData.trim().split('\n').length <= 2) {
//         console.log('--> INFO: API returned an empty dataset.');
//         return;
//     }
//     console.log(`--> SUCCESS: Received a non-empty response.`);

//     // STEP 3: Parsing (logic is correct)
//     console.log(`\nSTEP 3: Parsing and grouping the new data...`);
//     const dataByYear = await parseAndGroupData(csvData);
//     if (Object.keys(dataByYear).length === 0) {
//         console.log('--> INFO: Parsing resulted in zero valid data rows.');
//         return;
//     }
//     console.log('--> SUCCESS: Data grouped for ingestion:');
//     for (const year in dataByYear) console.log(`    - Year ${year}: ${dataByYear[year].length} new rows.`);

//     // --- STEPS 4 & 5: BATCH INSERTION INTO DATABASES ---
//     const BATCH_SIZE = 5000;

//     for (const year in dataByYear) {
//       const rows = dataByYear[year];
//       const tableName = `marine_data_${year}`;
//       const totalRows = rows.length;

//       console.log(`\n--- Starting ingestion for ${totalRows} rows into ${tableName} ---`);

//       for (let i = 0; i < totalRows; i += BATCH_SIZE) {
//         const batch = rows.slice(i, i + BATCH_SIZE);
//         const batchNumber = (i / BATCH_SIZE) + 1;
//         const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

//         console.log(`  Processing Batch ${batchNumber} of ${totalBatches} (${batch.length} rows)...`);
        
//         // A. Ingest into Supabase
//         try {
//           console.log(`    --> [Supabase] Attempting to insert batch...`);
//           const { error: supabaseError } = await supabase.from(tableName).insert(batch);
//           if (supabaseError) throw supabaseError;
//           console.log(`    --> [Supabase] SUCCESS.`);
//         } catch (e) {
//           console.error(`    --> [Supabase] FAILED for Batch ${batchNumber}. Error: ${e.message}`);
//         }
        
//         // B. Ingest into Local PostgreSQL
//         // try {
//         //   console.log(`    --> [Local PG] Attempting to insert batch...`);
//         //   const columnNames = Object.keys(batch[0]);
//         //   const values = batch.map(row => columnNames.map(col => row[col]));
//         //   const valuePlaceholders = values.map((_, idx) => `(${columnNames.map((_, j) => `$${idx * columnNames.length + j + 1}`).join(',')})`).join(',');
//         //   const query = `INSERT INTO ${tableName} (${columnNames.join(',')}) VALUES ${valuePlaceholders} ON CONFLICT DO NOTHING`;
//         //   await localPgPool.query(query, values.flat());
//         //   console.log(`    --> [Local PG] SUCCESS.`);
//         // } catch (e) {
//         //   console.error(`    --> [Local PG] FAILED for Batch ${batchNumber}. Error: ${e.message}`);
//         // }
//       }
//     }
//   } catch (error) {
//     console.error('--> FATAL ERROR during ingestion job:', error.message);
//   } finally {
//     console.log(`\n[${new Date().toISOString()}] Ingestion job finished.`);
//   }
// }

// // --- 4. SCHEDULER ---
// console.log('Smart ingestion service started. The job is scheduled to run automatically.');
// cron.schedule('0 1 * * *', runDataIngestion);

// // Manually run it once to see the new logs
// runDataIngestion();