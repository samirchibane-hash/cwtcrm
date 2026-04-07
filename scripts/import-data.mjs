/**
 * CWT CRM - Import Data Script
 *
 * Reads data_export.sql and runs it against your Supabase PostgreSQL database.
 *
 * Usage:
 *   node scripts/import-data.mjs <db-password>
 */

import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

let pg;
try {
  pg = require('pg');
} catch {
  console.error('Missing dependency. Run: npm install pg');
  process.exit(1);
}

const { Client } = pg;

const DB_PASSWORD = process.argv[2];

if (!DB_PASSWORD) {
  console.error('Usage: node scripts/import-data.mjs <db-password>');
  process.exit(1);
}

const connectionString =
  `postgresql://postgres:${encodeURIComponent(DB_PASSWORD)}` +
  `@db.eephssopftcicfsbggql.supabase.co:5432/postgres`;

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });

  console.log('Connecting to database...');
  await client.connect();
  console.log('Connected.\n');

  const sqlPath = join(__dirname, 'data_export.sql');
  const sql = readFileSync(sqlPath, 'utf8');

  console.log('Importing data...');
  await client.query(sql);
  console.log('Data imported successfully.');

  await client.end();
}

main().catch(async (err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});
