#!/usr/bin/env node
/**
 * Import approved companies from a prospect_suggestions row into GHL contacts.
 * Before importing, enriches each approved company with email + phone by running
 * a targeted Apify Google Maps scrape (scrapeContacts: true) on their place IDs.
 *
 * Usage:
 *   node scripts/import-ghl-leads.mjs --suggestion-id <uuid> [--dry-run]
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
);

const args    = process.argv.slice(2);
const getFlag = f => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const hasFlag = f => args.includes(f);

const SUGGESTION_ID = getFlag('--suggestion-id');
const DRY_RUN       = hasFlag('--dry-run');

if (!SUGGESTION_ID) { console.error('Error: --suggestion-id is required'); process.exit(1); }

const GHL_TOKEN    = env.GHL_ACCESS_TOKEN;
const GHL_LOCATION = env.GHL_LOCATION_ID;
const APIFY_TOKEN  = env.APIFY_TOKEN;
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!GHL_TOKEN)    { console.error('Missing GHL_ACCESS_TOKEN in .env');  process.exit(1); }
if (!GHL_LOCATION) { console.error('Missing GHL_LOCATION_ID in .env');   process.exit(1); }
if (!APIFY_TOKEN)  { console.error('Missing APIFY_TOKEN in .env');       process.exit(1); }
if (!SB_KEY)       { console.error('Missing Supabase key in .env');      process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Apify: enrich a batch of place IDs with scrapeContacts to get email/phone
// ---------------------------------------------------------------------------
async function enrichPlaceIds(placeIds) {
  if (!placeIds.length) return {};

  console.log(`\nEnriching ${placeIds.length} companies for email/phone via Apify...`);

  const r = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        placeIds,
        scrapeContacts: true,
        language:       'en',
        countryCode:    'us',
      }),
    }
  );
  if (!r.ok) {
    console.log(`  Apify enrichment failed (${r.status}) — importing without email`);
    return {};
  }
  const { data } = await r.json();
  const runId = data.id;
  const dsId  = data.defaultDatasetId;
  console.log(`  Run ID: ${runId}`);

  // Poll
  const start    = Date.now();
  const deadline = start + 8 * 60_000;
  while (true) {
    await sleep(8000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await s.json();
    process.stdout.write(`  ${status}  (${Math.round((Date.now() - start) / 1000)}s)\n`);
    if (status === 'SUCCEEDED') break;
    if (['FAILED','TIMED-OUT','ABORTED'].includes(status)) {
      console.log(`  Enrichment ${status} — importing without email`);
      return {};
    }
    if (Date.now() > deadline) {
      console.log('  Enrichment timed out — importing without email');
      return {};
    }
  }

  // Fetch results
  const d = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json&limit=500`
  );
  if (!d.ok) return {};
  const items = await d.json();

  // Build placeId → { email, phone } map
  const enriched = {};
  for (const item of items) {
    const pid = item.placeId;
    if (!pid) continue;
    const email = (item.emails?.[0] || item.email || '').trim() || null;
    const phone = (item.phone || item.phoneUnformatted || '').trim() || null;
    if (email || phone) enriched[pid] = { email, phone };
  }

  const found = Object.keys(enriched).length;
  console.log(`  Enriched: ${found}/${placeIds.length} companies with contact info\n`);
  return enriched;
}

// ---------------------------------------------------------------------------
// GHL: check if contact exists by phone or email
// ---------------------------------------------------------------------------
async function ghlContactExists(phone, email) {
  for (const [field, value] of [['phone', phone], ['email', email]]) {
    if (!value) continue;
    const r = await fetch(
      `https://services.leadconnectorhq.com/contacts/search?locationId=${GHL_LOCATION}&${field}=${encodeURIComponent(value)}`,
      { headers: { Authorization: `Bearer ${GHL_TOKEN}`, Version: '2021-07-28' } }
    );
    if (!r.ok) continue;
    const data = await r.json();
    if ((data.contacts || []).length > 0) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// GHL: create contact
// ---------------------------------------------------------------------------
async function ghlCreateContact(company, stateName, enrichment) {
  const stateTag = stateName.toLowerCase().replace(/\s+/g, '-');
  const body = {
    locationId: GHL_LOCATION,
    firstName:  company.name,
    email:      enrichment?.email  || undefined,
    phone:      enrichment?.phone  || company.phone || undefined,
    website:    company.website    || undefined,
    address1:   company.address    || undefined,
    city:       company.city       || undefined,
    state:      company.state      || stateName,
    postalCode: company.postalCode || undefined,
    tags:       ['residential-water', 'apify-discovery', stateTag],
    source:     'Apify Google Maps',
  };
  for (const k of Object.keys(body)) { if (body[k] === undefined) delete body[k]; }

  const r = await fetch('https://services.leadconnectorhq.com/contacts/', {
    method:  'POST',
    headers: {
      Authorization:  `Bearer ${GHL_TOKEN}`,
      'Content-Type': 'application/json',
      Version:        '2021-07-28',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`GHL ${r.status}: ${await r.text()}`);
  return (await r.json()).contact?.id;
}

// ===========================================================================
// MAIN
// ===========================================================================
console.log(`\n=== GHL Lead Import ===`);
console.log(`Suggestion: ${SUGGESTION_ID}`);
if (DRY_RUN) console.log('(dry run)\n');
else         console.log('');

// Step 1: Fetch suggestion
process.stdout.write('Fetching suggestion... ');
const res = await fetch(
  `${SUPABASE_URL}/rest/v1/prospect_suggestions?id=eq.${SUGGESTION_ID}&select=*`,
  { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
);
if (!res.ok) { console.log(`FAILED: ${await res.text()}`); process.exit(1); }
const [suggestion] = await res.json();
if (!suggestion) { console.log('not found'); process.exit(1); }
console.log('ok');

const { run_label, discovered_companies, approved_company_ids, declined_company_ids } = suggestion;
console.log(`Run: ${run_label}`);

const stateMatch = run_label?.match(/Residential Water — ([^—]+) —/);
const stateName  = stateMatch ? stateMatch[1].trim() : '';

// Step 2: Filter to approved only
const approved = discovered_companies.filter(c =>
  approved_company_ids?.includes(c.apolloId) ||
  (!declined_company_ids?.includes(c.apolloId) && (approved_company_ids?.length ?? 0) === 0)
);

console.log(`Approved: ${approved.length} companies`);

if (approved.length === 0) {
  console.log('No approved companies. Did you save the review in the CRM?');
  process.exit(0);
}

if (DRY_RUN) {
  approved.forEach((c, i) => console.log(`  ${i + 1}. ${c.name} | ${c.phone || '—'} | ${c.state || stateName}`));
  console.log('\nDry run — not writing to GHL.');
  process.exit(0);
}

// Step 3: Enrich approved companies with email/phone via Apify
const realPlaceIds = approved
  .map(c => c.apolloId)
  .filter(id => id && !id.startsWith('maps-'));

const enrichmentMap = await enrichPlaceIds(realPlaceIds);

// Step 4: Push to GHL
console.log('Importing to GHL...\n');
let added   = 0;
let skipped = 0;
let errors  = 0;
let enriched = 0;

for (let i = 0; i < approved.length; i++) {
  const c   = approved[i];
  const enr = enrichmentMap[c.apolloId] || null;
  if (enr) enriched++;

  const phone = enr?.phone || c.phone;
  const email = enr?.email || null;

  process.stdout.write(`  ${String(i + 1).padStart(3)}. ${c.name.padEnd(42)} `);
  process.stdout.write(email ? `📧 ` : `   `);
  process.stdout.write(phone ? `📞  → ` : `    → `);

  try {
    const exists = await ghlContactExists(phone, email);
    if (exists) {
      console.log('skip (already in GHL)');
      skipped++;
      await sleep(300);
      continue;
    }

    const id = await ghlCreateContact(c, stateName || c.state || '', enr);
    console.log(`added (${id})`);
    added++;
  } catch (e) {
    console.log(`error: ${e.message}`);
    errors++;
  }

  await sleep(300);
}

// Summary
console.log(`\n${'─'.repeat(50)}`);
console.log(`  Run:              ${run_label}`);
console.log(`  Approved:         ${approved.length}`);
console.log(`  With email/phone: ${enriched}`);
console.log(`  Added to GHL:     ${added}`);
console.log(`  Skipped (dupe):   ${skipped}`);
if (errors > 0) console.log(`  Errors:           ${errors}`);
console.log('─'.repeat(50));
console.log('');
