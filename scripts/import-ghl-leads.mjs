#!/usr/bin/env node
/**
 * Import approved companies from a prospect_suggestions row into GHL and/or
 * the CWT CRM prospects table.
 *
 * Usage:
 *   node scripts/import-ghl-leads.mjs --suggestion-id <uuid> [--target ghl|crm|both] [--crm-min-reviews N] [--dry-run]
 *
 * --target defaults to "ghl". Use "crm" for VIP leads going into the prospects
 * table, or "both" to push to GHL and CRM simultaneously.
 *
 * --crm-min-reviews N  Route companies with >= N reviews to CRM and the rest
 *                      to GHL automatically (overrides --target per company).
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

const SUGGESTION_ID     = getFlag('--suggestion-id');
const TARGET            = getFlag('--target') || 'ghl';   // ghl | crm | both
const CRM_MIN_REVIEWS   = getFlag('--crm-min-reviews') ? parseInt(getFlag('--crm-min-reviews'), 10) : null;
const DRY_RUN           = hasFlag('--dry-run');

if (!SUGGESTION_ID) { console.error('Error: --suggestion-id is required'); process.exit(1); }
if (!CRM_MIN_REVIEWS && !['ghl', 'crm', 'both'].includes(TARGET)) {
  console.error(`Error: --target must be ghl, crm, or both (got "${TARGET}")`);
  process.exit(1);
}

const GHL_TOKEN    = env.GHL_ACCESS_TOKEN;
const GHL_LOCATION = env.GHL_LOCATION_ID;
const APIFY_TOKEN  = env.APIFY_TOKEN;
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

// When --crm-min-reviews is set both destinations are used (routing is per company)
const wantsGHL = CRM_MIN_REVIEWS != null ? true : (TARGET === 'ghl' || TARGET === 'both');
const wantsCRM = CRM_MIN_REVIEWS != null ? true : (TARGET === 'crm' || TARGET === 'both');

if (wantsGHL && !GHL_TOKEN)    { console.error('Missing GHL_ACCESS_TOKEN in .env');  process.exit(1); }
if (wantsGHL && !GHL_LOCATION) { console.error('Missing GHL_LOCATION_ID in .env');   process.exit(1); }
if (!APIFY_TOKEN)               { console.error('Missing APIFY_TOKEN in .env');       process.exit(1); }
if (!SB_KEY)                    { console.error('Missing Supabase key in .env');      process.exit(1); }

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

  const d = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json&limit=500`
  );
  if (!d.ok) return {};
  const items = await d.json();

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
// GHL helpers
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

async function ghlCreateContact(company, stateName, enrichment) {
  const stateTag = stateName.toLowerCase();
  const streetOnly = company.address && company.city
    ? company.address.split(', ' + company.city)[0].trim()
    : company.address || undefined;
  const body = {
    locationId:  GHL_LOCATION,
    companyName: company.name,
    firstName:   'N/a',
    email:       enrichment?.email  || undefined,
    phone:       enrichment?.phone  || company.phone || undefined,
    website:     company.website    || undefined,
    address1:    streetOnly         || undefined,
    city:        company.city       || undefined,
    state:       company.state      || stateName,
    postalCode:  company.postalCode || undefined,
    tags:        [stateTag],
    source:      'Apify Google Maps',
    customFields: [
      { id: 'evYmPQXtUDehCbb2q74C', value: company.googleMapsUrl || '' },
      { id: 'l6mNUjW1T7SGUTOr22qP', value: String(company.reviews || 0) },
    ],
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

// ---------------------------------------------------------------------------
// CRM (Supabase prospects table) helpers
// ---------------------------------------------------------------------------
function reviewsToTier(reviews) {
  if (!reviews) return 'C';
  if (reviews >= 200) return 'A';
  if (reviews >= 50)  return 'B';
  return 'C';
}

async function crmProspectExists(phone, companyName, state) {
  // Check by phone first (most reliable dedup)
  if (phone) {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/prospects?phone=eq.${encodeURIComponent(phone)}&select=id`,
      { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
    );
    if (r.ok) {
      const rows = await r.json();
      if (rows.length > 0) return true;
    }
  }
  // Fallback: name + state match
  const r = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?company_name=eq.${encodeURIComponent(companyName)}&state=eq.${encodeURIComponent(state)}&select=id`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  if (r.ok) {
    const rows = await r.json();
    if (rows.length > 0) return true;
  }
  return false;
}

async function crmCreateProspect(company, stateName, enrichment) {
  const streetOnly = company.address ? company.address.split(',')[0].trim() : '';
  const body = {
    company_name:    company.name,
    state:           company.state || stateName,
    city:            company.city            || '',
    street:          streetOnly,
    zip:             company.postalCode      || '',
    country:         'USA',
    phone:           enrichment?.phone || company.phone || '',
    website:         company.website         || '',
    google_maps_url: company.googleMapsUrl   || '',
    linkedin:        company.linkedin        || '',
    type:            'Residential Dealer',
    market_type:     'Residential',
    stage:           'New Lead',
    lead_tier:       reviewsToTier(company.reviews),
    contacts:        (enrichment?.email || company.email)
      ? [{ email: enrichment?.email || company.email, source: 'Apify' }]
      : [],
    engagements:     [],
    starred:         false,
  };

  const r = await fetch(`${SUPABASE_URL}/rest/v1/prospects`, {
    method:  'POST',
    headers: {
      apikey:          SB_KEY,
      Authorization:   `Bearer ${SB_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=representation',
    },
    body: JSON.stringify(body),
  });

  if (!r.ok) throw new Error(`CRM ${r.status}: ${await r.text()}`);
  const [row] = await r.json();
  return row?.id;
}

// ===========================================================================
// MAIN
// ===========================================================================
const modeLabel = CRM_MIN_REVIEWS != null
  ? `split (CRM ≥ ${CRM_MIN_REVIEWS} reviews, GHL < ${CRM_MIN_REVIEWS})`
  : TARGET;
console.log(`\n=== Lead Import (target: ${modeLabel}) ===`);
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
  approved.forEach((c, i) => {
    const dest = CRM_MIN_REVIEWS != null
      ? ((c.reviews || 0) >= CRM_MIN_REVIEWS ? 'CRM' : 'GHL')
      : TARGET.toUpperCase();
    console.log(`  ${i + 1}. ${c.name} | ${c.reviews || 0} reviews | tier ${reviewsToTier(c.reviews)} | → ${dest}`);
  });
  console.log(`\nDry run — not writing anywhere.`);
  process.exit(0);
}

// Step 3: Enrich approved companies with email/phone via Apify
const realPlaceIds = approved
  .map(c => c.apolloId)
  .filter(id => id && !id.startsWith('maps-'));

const enrichmentMap = await enrichPlaceIds(realPlaceIds);

// Step 4: Import
const stats = {
  ghl:  { added: 0, skipped: 0, errors: 0 },
  crm:  { added: 0, skipped: 0, errors: 0 },
  enriched: 0,
};

for (let i = 0; i < approved.length; i++) {
  const c   = approved[i];
  const enr = enrichmentMap[c.apolloId] || null;
  if (enr) stats.enriched++;

  const phone     = enr?.phone || c.phone;
  const email     = enr?.email || c.email || null;
  const nameLabel = c.name.padEnd(42);

  process.stdout.write(`  ${String(i + 1).padStart(3)}. ${nameLabel} `);
  process.stdout.write(email ? `📧 ` : `   `);
  process.stdout.write(phone ? `📞  → ` : `    → `);

  // Per-company destination: review threshold overrides global --target
  const reviews      = c.reviews || 0;
  const sendToGHL    = CRM_MIN_REVIEWS != null ? reviews < CRM_MIN_REVIEWS  : wantsGHL;
  const sendToCRM    = CRM_MIN_REVIEWS != null ? reviews >= CRM_MIN_REVIEWS : wantsCRM;

  const results = [];

  if (sendToGHL) {
    try {
      const exists = await ghlContactExists(phone, email);
      if (exists) {
        results.push('GHL:skip');
        stats.ghl.skipped++;
      } else {
        const id = await ghlCreateContact(c, stateName || c.state || '', enr);
        results.push(`GHL:added(${id})`);
        stats.ghl.added++;
      }
    } catch (e) {
      results.push(`GHL:error(${e.message})`);
      stats.ghl.errors++;
    }
    await sleep(300);
  }

  if (sendToCRM) {
    try {
      const exists = await crmProspectExists(phone, c.name, c.state || stateName);
      if (exists) {
        results.push('CRM:skip');
        stats.crm.skipped++;
      } else {
        const id = await crmCreateProspect(c, stateName || c.state || '', enr);
        results.push(`CRM:added(${id})`);
        stats.crm.added++;
      }
    } catch (e) {
      results.push(`CRM:error(${e.message})`);
      stats.crm.errors++;
    }
    await sleep(200);
  }

  console.log(results.join('  '));
}

// Summary
console.log(`\n${'─'.repeat(54)}`);
console.log(`  Run:              ${run_label}`);
console.log(`  Approved:         ${approved.length}`);
console.log(`  With email/phone: ${stats.enriched}`);
if (wantsGHL) {
  console.log(`  Added to GHL:     ${stats.ghl.added}`);
  console.log(`  GHL skipped:      ${stats.ghl.skipped}`);
  if (stats.ghl.errors > 0) console.log(`  GHL errors:       ${stats.ghl.errors}`);
}
if (wantsCRM) {
  console.log(`  Added to CRM:     ${stats.crm.added}`);
  console.log(`  CRM skipped:      ${stats.crm.skipped}`);
  if (stats.crm.errors > 0) console.log(`  CRM errors:       ${stats.crm.errors}`);
}
console.log('─'.repeat(54));
console.log('');
