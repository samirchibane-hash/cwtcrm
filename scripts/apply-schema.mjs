/**
 * CWT CRM - Apply Schema Script
 *
 * Connects directly to your Supabase PostgreSQL database and runs
 * the consolidated schema SQL.
 *
 * Usage:
 *   node scripts/apply-schema.mjs <db-password>
 *
 * Find your DB password at:
 *   Supabase Dashboard → Settings → Database → Connection string
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
  console.error('Usage: node scripts/apply-schema.mjs <db-password>');
  console.error('\nFind your DB password at:');
  console.error('  Supabase Dashboard → Settings → Database → Connection string');
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

  const schemaPath = join(__dirname, '../supabase/schema.sql');
  const sql = readFileSync(schemaPath, 'utf8');

  console.log('Applying schema...');
  await client.query(sql);
  console.log('Schema applied successfully.');

  await client.end();
}

main().catch(async (err) => {
  console.error('\nFailed:', err.message);
  if (err.message.includes('password') || err.message.includes('authentication')) {
    console.error('\nHint: Check your database password in Supabase → Settings → Database');
  }
  if (err.message.includes('already exists')) {
    console.error('\nHint: Schema may have already been applied. Check your Supabase dashboard.');
  }
  process.exit(1);
});
