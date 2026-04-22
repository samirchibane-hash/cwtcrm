#!/usr/bin/env node
/**
 * Enrich Installer prospects with data from Google Maps (Apify).
 *
 * Searches Google Maps for each company by name + state, takes the top result,
 * then outputs SQL UPDATE statements (or prints a summary with --dry-run).
 *
 * Usage:
 *   node scripts/enrich-installers.mjs --companies <base64-json> [--dry-run] [--limit N]
 *
 *   --companies <base64>  Base64-encoded JSON array of prospect objects
 *                         Each: { id, company_name, state, website, phone, linkedin, google_maps_url }
 *   --dry-run             Print updates without outputting SQL
 *   --limit N             Only process the first N companies (default: all)
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

const DRY_RUN     = hasFlag('--dry-run');
const LIMIT       = parseInt(getFlag('--limit') || '9999', 10);
const COMPANIES_B64 = getFlag('--companies');

if (!COMPANIES_B64) {
  console.error('Missing --companies <base64-json>');
  console.error('Fetch via Supabase MCP:');
  console.error('  SELECT id, company_name, state, website, phone, linkedin, google_maps_url FROM prospects WHERE type = \'Installer\'');
  process.exit(1);
}

const APIFY_TOKEN = env.APIFY_TOKEN;
if (!APIFY_TOKEN) { console.error('Missing APIFY_TOKEN in .env'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

const STATE_NAMES = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',
  CO:'Colorado',CT:'Connecticut',DE:'Delaware',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',
  KS:'Kansas',KY:'Kentucky',LA:'Louisiana',ME:'Maine',MD:'Maryland',
  MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',MS:'Mississippi',MO:'Missouri',
  MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',NJ:'New Jersey',
  NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',OH:'Ohio',
  OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',
  VA:'Virginia',WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

function buildSearchString(name, state) {
  const stateName = STATE_NAMES[state?.toUpperCase()] || state || '';
  return stateName ? `${name} water ${stateName}` : `${name} water`;
}

async function runGoogleMaps(searchStrings) {
  console.error(`Starting Apify Google Maps Scraper (${searchStrings.length} queries)...`);
  const r = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray: searchStrings,
        maxCrawledPlacesPerSearch: 1,
        language: 'en',
        countryCode: 'us',
        scrapeContacts: false,
      }),
    }
  );
  if (!r.ok) throw new Error(`Apify start failed ${r.status}: ${await r.text()}`);
  const { data } = await r.json();
  const runId = data.id;
  const dsId  = data.defaultDatasetId;
  console.error(`  Run ID: ${runId}`);

  const start    = Date.now();
  const deadline = Date.now() + 15 * 60_000;
  while (true) {
    await sleep(10_000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await s.json();
    console.error(`  [${Math.round((Date.now() - start) / 1000)}s] ${status}`);
    if (status === 'SUCCEEDED') break;
    if (['FAILED', 'TIMED-OUT', 'ABORTED'].includes(status)) throw new Error(`Apify run ${status}`);
    if (Date.now() > deadline) throw new Error('Apify timed out after 15 minutes');
  }

  const d = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json&limit=500`
  );
  if (!d.ok) throw new Error(`Dataset fetch failed: ${d.status}`);
  return d.json();
}

function norm(s) {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isMatch(resultTitle, companyName) {
  const rt = norm(resultTitle);
  const cn = norm(companyName);
  return rt.includes(cn) || cn.includes(rt) || rt.startsWith(cn.slice(0, 6));
}

function extractLinkedIn(contacts) {
  if (!contacts) return null;
  const lns = contacts.linkedIns || contacts.linkedins || [];
  if (Array.isArray(lns) && lns.length > 0) return lns[0];
  if (contacts.social?.linkedin) return contacts.social.linkedin;
  return null;
}

function esc(s) {
  return (s || '').replace(/'/g, "''");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const allCompanies = JSON.parse(Buffer.from(COMPANIES_B64, 'base64').toString('utf8'));
const companies = allCompanies.slice(0, LIMIT);
console.error(`Loaded ${companies.length} companies.`);

const toEnrich = companies.filter(c =>
  !c.website || !c.phone || !c.linkedin || !c.google_maps_url
);
console.error(`${toEnrich.length} need enrichment.`);

if (toEnrich.length === 0) {
  console.error('Nothing to do.');
  process.exit(0);
}

const searchStrings = toEnrich.map(c => buildSearchString(c.company_name, c.state));

const items = await runGoogleMaps(searchStrings);
console.error(`Got ${items.length} results from Google Maps.\n`);

const resultBySearch = new Map();
for (const item of items) {
  const key = norm(item.searchString || '');
  if (!resultBySearch.has(key)) resultBySearch.set(key, item);
}

const sqlStatements = [];
let updated = 0;
let skipped = 0;

for (const company of toEnrich) {
  const searchStr = buildSearchString(company.company_name, company.state);
  const item      = resultBySearch.get(norm(searchStr));

  if (!item) {
    console.error(`  [NO RESULT]  ${company.company_name}`);
    skipped++;
    continue;
  }

  if (!isMatch(item.title, company.company_name)) {
    console.error(`  [MISMATCH]   ${company.company_name}  ←→  "${item.title}"`);
    skipped++;
    continue;
  }

  const linkedin = extractLinkedIn(item.contacts);

  const setParts = [];
  if (!company.website      && item.website)  setParts.push(`website = '${esc(item.website)}'`);
  if (!company.phone        && item.phone)    setParts.push(`phone = '${esc(item.phone)}'`);
  const placeId = item.placeId || (item.url && new URL(item.url).searchParams?.get('query_place_id'));
  const mapsUrl = placeId ? `https://www.google.com/maps/place/?q=place_id:${placeId}` : item.url;
  if (!company.google_maps_url && mapsUrl)    setParts.push(`google_maps_url = '${esc(mapsUrl)}'`);
  if (!company.linkedin     && linkedin)      setParts.push(`linkedin = '${esc(linkedin)}'`);

  if (setParts.length === 0) {
    console.error(`  [NO NEW DATA] ${company.company_name}`);
    skipped++;
    continue;
  }

  const fields = setParts.map(p => p.split(' = ')[0]).join(', ');
  console.error(`  [UPDATE]     ${company.company_name}  →  ${fields}`);

  if (!DRY_RUN) {
    const sql = `UPDATE prospects SET ${setParts.join(', ')}, updated_at = NOW() WHERE id = '${company.id}';`;
    sqlStatements.push(sql);
  }
  updated++;
}

console.error(`\n${'─'.repeat(60)}`);
console.error(`Updated: ${updated}  |  Skipped/No match: ${skipped}`);

if (sqlStatements.length > 0) {
  console.log('\n-- Enrich Installer prospects from Google Maps');
  console.log(`-- Generated: ${new Date().toISOString()}`);
  console.log('');
  for (const sql of sqlStatements) {
    console.log(sql);
  }
}
