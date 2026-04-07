/**
 * Fetches LinkedIn contacts from an Apify dataset and inserts them
 * into the matching prospect's contacts array in Supabase via direct DB connection.
 *
 * Usage:
 *   node --env-file=.env scripts/import-linkedin-contacts.mjs \
 *     --dataset <APIFY_DATASET_ID> \
 *     --company "Manitowoc" \
 *     --db-password <YOUR_DB_PASSWORD>
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);

let pg;
try {
  pg = require('pg');
} catch {
  console.error('Missing dependency. Run: npm install pg');
  process.exit(1);
}
const { Client } = pg;

const args = process.argv.slice(2);
const datasetId     = args[args.indexOf('--dataset') + 1];
const companySearch = args[args.indexOf('--company') + 1];

if (!datasetId || !companySearch) {
  console.error('Usage: node --env-file=.env scripts/import-linkedin-contacts.mjs --dataset <ID> --company "<name>"');
  process.exit(1);
}

const APIFY_TOKEN  = process.env.APIFY_TOKEN;
const PROJECT_ID   = process.env.VITE_SUPABASE_PROJECT_ID;
const dbPassword   = process.env.SUPABASE_DB_PASSWORD;

if (!APIFY_TOKEN || !PROJECT_ID || !dbPassword) {
  console.error('Missing env vars: APIFY_TOKEN, VITE_SUPABASE_PROJECT_ID, SUPABASE_DB_PASSWORD');
  process.exit(1);
}

// 1. Fetch all results from Apify dataset
console.log(`Fetching dataset ${datasetId} from Apify...`);
const apifyRes = await fetch(
  `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_TOKEN}&format=json`
);
if (!apifyRes.ok) throw new Error(`Apify fetch failed: ${apifyRes.status}`);
const items = await apifyRes.json();
console.log(`Got ${items.length} items from Apify.`);

// 2. Map to Contact shape — filter out clearly non-relevant results
const newContacts = items
  .filter(item => item.fullName && item.fullName !== 'null')
  .map(item => ({
    id: `contact-linkedin-${item.publicIdentifier || Math.random().toString(36).slice(2, 9)}`,
    name: item.fullName,
    role: item.headline || undefined,
    linkedIn: item.profileUrl || undefined,
  }));

console.log(`\nMapped ${newContacts.length} contacts:`);
newContacts.forEach(c => console.log(`  - ${c.name} (${c.role})`));

// 3. Connect to Supabase via direct Postgres
const client = new Client({
  host: `aws-0-us-east-1.pooler.supabase.com`,
  port: 5432,
  database: 'postgres',
  user: `postgres.${PROJECT_ID}`,
  password: dbPassword,
  ssl: { rejectUnauthorized: false },
});

await client.connect();
console.log(`\nConnected to database.`);

// 4. Find matching prospect
const { rows } = await client.query(
  `SELECT id, company_name, contacts FROM prospects WHERE company_name ILIKE $1 LIMIT 5`,
  [`%${companySearch}%`]
);

if (rows.length === 0) {
  console.error(`No prospect found matching "${companySearch}".`);
  await client.end();
  process.exit(1);
}

// If multiple matches, list them
if (rows.length > 1) {
  console.log(`Multiple matches found:`);
  rows.forEach((r, i) => console.log(`  [${i}] ${r.company_name} (${r.id})`));
}

const prospect = rows[0];
console.log(`Using: "${prospect.company_name}" (id: ${prospect.id})`);

// 5. Merge contacts — skip duplicates by LinkedIn URL
const existing = Array.isArray(prospect.contacts) ? prospect.contacts : [];
const existingLinkedIns = new Set(existing.map(c => c.linkedIn).filter(Boolean));

const toAdd = newContacts.filter(c => !c.linkedIn || !existingLinkedIns.has(c.linkedIn));
const skipped = newContacts.length - toAdd.length;

if (skipped > 0) console.log(`Skipping ${skipped} already-existing contact(s).`);
if (toAdd.length === 0) {
  console.log('All contacts already exist. Nothing to do.');
  await client.end();
  process.exit(0);
}

const merged = [...existing, ...toAdd];

// 6. Update the prospect
await client.query(
  `UPDATE prospects SET contacts = $1, updated_at = now() WHERE id = $2`,
  [JSON.stringify(merged), prospect.id]
);

await client.end();

console.log(`\nAdded ${toAdd.length} contact(s) to "${prospect.company_name}":`);
toAdd.forEach(c => console.log(`  + ${c.name} — ${c.role}`));
