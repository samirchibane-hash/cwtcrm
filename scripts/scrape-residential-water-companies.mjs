#!/usr/bin/env node
/**
 * Scrape local residential water softener & filtration service businesses
 * via Apify Google Maps Scraper, then save results to prospect_suggestions
 * for CRM review. Results are ranked by Google review count.
 *
 * Usage:
 *   node scripts/scrape-residential-water-companies.mjs --state "Arizona" [--limit 80] [--dry-run]
 *
 *   --state <name>   US state to target (required)
 *   --limit N        Max companies to save (default: 80)
 *   --dry-run        Scrape and filter without saving to Supabase
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

const STATE   = getFlag('--state');
const LIMIT   = parseInt(getFlag('--limit') || '80', 10);
const DRY_RUN = hasFlag('--dry-run');

if (!STATE) { console.error('Error: --state is required (e.g. --state "Arizona")'); process.exit(1); }

const APIFY_TOKEN  = env.APIFY_TOKEN;
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!APIFY_TOKEN)  { console.error('Missing APIFY_TOKEN in .env');       process.exit(1); }
if (!SB_KEY)       { console.error('Missing Supabase key in .env');      process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Directories / portals to skip
// ---------------------------------------------------------------------------
const SKIP_DOMAINS = new Set([
  'yelp.com','angi.com','angieslist.com','homeadvisor.com','thumbtack.com',
  'houzz.com','homestars.com','bbb.org','manta.com','yellowpages.com',
  'mapquest.com','facebook.com','linkedin.com','instagram.com','twitter.com',
  'x.com','youtube.com','reddit.com','nextdoor.com','pinterest.com',
  'google.com','bing.com','yahoo.com','tripadvisor.com','foursquare.com',
  'porch.com','bark.com','fixr.com','improvenet.com','servicemagic.com',
  'amazon.com','homedepot.com','lowes.com','walmart.com','costco.com',
]);

const SKIP_PATTERNS = [
  '.gov','.edu','.mil',
  'waterdistrict','municipalwater','cityof','countyof','townof',
  'publicworks','sanitation','wastewater',
];

// ---------------------------------------------------------------------------
// Industrial / municipal exclusion
// ---------------------------------------------------------------------------
const INDUSTRIAL_KW = [
  'wastewater','waste water','sewage','effluent','municipal water',
  'water utility','water authority','water district','public works',
  'cooling tower','boiler water','produced water','oil and gas',
  'mining water','stormwater','desalination plant','water reclamation',
];

function isIndustrial(name, categories) {
  const text = [name, ...(categories || [])].join(' ').toLowerCase();
  return INDUSTRIAL_KW.some(kw => text.includes(kw));
}

// ---------------------------------------------------------------------------
// Relevance check — must be water filtration / softening / treatment related
// ---------------------------------------------------------------------------
const WATER_KW = [
  'water softener','water softening','water filter','water filtration',
  'water treatment','water purif','water condition','water quality',
  'reverse osmosis','water system','well water','drinking water',
  'water heater','water service','water solution','water technolog',
  'water specialist','h2o','aqua','culligan','kinetico','ecowater',
  'rainsoft','pelican water','water right','water care','pure water',
  'clean water','soft water',
];

// Google Maps category strings that indicate water treatment businesses
const WATER_CATEGORIES = [
  'water softening equipment supplier',
  'water treatment supplier',
  'water filter supplier',
  'water purification company',
  'water testing service',
  'well drilling contractor',
];

// ---------------------------------------------------------------------------
// Plumbing-first exclusion — skip companies whose primary business is plumbing
// ---------------------------------------------------------------------------
const PLUMBING_KW = [
  'plumbing','plumber','rooter','drain','sewer','heating','hvac',
  'mechanical','pipe','pipework','septic','excavat',
];

function isPlumbingFirst(name, categories) {
  const nameLower = name.toLowerCase();
  // If name leads with a plumbing keyword before any water keyword, skip it
  if (PLUMBING_KW.some(kw => nameLower.includes(kw))) return true;
  const catText = (categories || []).join(' ').toLowerCase();
  if (catText.includes('plumber') || catText.includes('plumbing')) return true;
  return false;
}

function isWaterRelated(name, categories) {
  const nameLower = name.toLowerCase();
  if (WATER_KW.some(kw => nameLower.includes(kw))) return true;
  const catText = (categories || []).join(' ').toLowerCase();
  if (WATER_CATEGORIES.some(c => catText.includes(c))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Normalize name for dedup
// ---------------------------------------------------------------------------
function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|co|company|the|and|of|water|systems|solutions|group|usa|services|supply|treatment|products)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Apify: run Google Maps Scraper
// ---------------------------------------------------------------------------
async function runGoogleMaps(stateName) {
  const queries = [
    `water softener service ${stateName}`,
    `water filtration installation ${stateName}`,
    `water treatment company residential ${stateName}`,
    `water purification dealer ${stateName}`,
  ];

  console.log(`\nStarting Apify Google Maps Scraper (${queries.length} queries)...`);

  const r = await fetch(
    `https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchStringsArray:        queries,
        maxCrawledPlacesPerSearch: 25,
        language:                  'en',
        countryCode:               'us',
        state:                     stateName,
      }),
    }
  );
  if (!r.ok) throw new Error(`Apify start failed ${r.status}: ${await r.text()}`);
  const { data } = await r.json();
  const runId = data.id;
  const dsId  = data.defaultDatasetId;
  console.log(`  Run ID: ${runId}`);

  // Poll for completion
  const start    = Date.now();
  const deadline = start + 10 * 60_000;
  while (true) {
    await sleep(8000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await s.json();
    process.stdout.write(`  ${status}  (${Math.round((Date.now() - start) / 1000)}s)\n`);
    if (status === 'SUCCEEDED') break;
    if (['FAILED','TIMED-OUT','ABORTED'].includes(status)) throw new Error(`Apify run ${status}`);
    if (Date.now() > deadline) throw new Error('Apify timed out after 10 minutes');
  }

  // Fetch dataset
  const d = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json&limit=1000`
  );
  if (!d.ok) throw new Error(`Dataset fetch failed: ${d.status}`);
  return d.json();
}

// ---------------------------------------------------------------------------
// Filter and deduplicate scraped places
// ---------------------------------------------------------------------------
function filterPlaces(places) {
  const seen    = new Set();
  const results = [];

  for (const p of places) {
    const name       = (p.title || p.name || '').trim();
    const website    = (p.website || '').trim();
    const phone      = (p.phone || p.phoneUnformatted || '').trim();
    const address    = (p.address || p.street || '').trim();
    const city       = (p.city || '').trim();
    const state      = (p.state || '').trim();
    const postalCode = (p.postalCode || p.zip || '').trim();
    const googleMapsUrl = (p.url || p.googleMapsUrl || '').trim();
    const placeId    = (p.placeId || '').trim();
    const categories = Array.isArray(p.categories) ? p.categories : (p.categoryName ? [p.categoryName] : []);
    const reviews    = parseInt(p.reviewsCount || p.totalReviewsCount || '0') || 0;
    const rating     = parseFloat(p.totalScore || p.rating || '0') || null;

    if (!name) continue;
    if (!phone && !website) continue;

    // Skip directories/portals via website domain
    if (website) {
      try {
        const host = new URL(website.startsWith('http') ? website : `https://${website}`).hostname.replace(/^www\./, '');
        const root = host.split('.').slice(-2).join('.');
        if (SKIP_DOMAINS.has(host) || SKIP_DOMAINS.has(root)) continue;
        if (SKIP_PATTERNS.some(pat => host.includes(pat))) continue;
      } catch { /* ignore bad URLs */ }
    }

    if (isIndustrial(name, categories)) continue;
    if (!isWaterRelated(name, categories)) continue;
    if (isPlumbingFirst(name, categories)) continue;

    // Dedup by normalized name
    const key = normalize(name);
    if (key.length < 3) continue;
    if (seen.has(key)) continue;
    seen.add(key);

    const id = placeId || `maps-${key.replace(/\s+/g, '-').slice(0, 40)}-${phone.replace(/\D/g, '').slice(-4) || Math.random().toString(36).slice(2, 6)}`;

    results.push({ id, name, website, phone, address, city, state, postalCode, googleMapsUrl, categories, reviews, rating });
  }

  // Sort by review count descending
  results.sort((a, b) => b.reviews - a.reviews);

  return results;
}

// ===========================================================================
// MAIN
// ===========================================================================
console.log(`\n=== Residential Water Company Scraper ===`);
console.log(`State: ${STATE}`);
if (DRY_RUN) console.log('(dry run — results will not be saved)\n');
else         console.log('');

// Step 1: Scrape Google Maps
let rawPlaces;
try {
  rawPlaces = await runGoogleMaps(STATE);
  console.log(`\nRaw results: ${rawPlaces.length}`);
} catch (e) {
  console.error(`\nApify error: ${e.message}`);
  process.exit(1);
}

// Step 2: Filter + sort
const filtered = filterPlaces(rawPlaces);
const capped   = filtered.slice(0, LIMIT);
console.log(`After filtering: ${filtered.length} (saving top ${capped.length} by review count)`);

if (filtered.length === 0) {
  console.log('No companies passed filters. Exiting.');
  process.exit(0);
}

// Preview
console.log('\nTop 5 by reviews:');
capped.slice(0, 5).forEach((c, i) => {
  const stars = c.rating ? `${c.rating}★` : '—';
  console.log(`  ${i + 1}. ${c.name.padEnd(45)} ${String(c.reviews).padStart(4)} reviews  ${stars}`);
  if (c.website) console.log(`     ${c.website}`);
});
if (capped.length > 5) console.log(`  ... and ${capped.length - 5} more`);

if (DRY_RUN) {
  console.log('\nDry run — not saving to Supabase.');
  process.exit(0);
}

// Step 3: Save to prospect_suggestions
const runLabel = `Residential Water — ${STATE} — ${new Date().toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric',
})}`;

const payload = capped.map(c => ({
  apolloId:    c.id,
  name:        c.name,
  website:     c.website,
  googleMapsUrl: c.googleMapsUrl,
  phone:       c.phone,
  address:     c.address,
  city:        c.city,
  state:       c.state,
  postalCode:  c.postalCode,
  reviews:     c.reviews,
  rating:      c.rating,
  industry:    c.categories.slice(0, 2).join(', '),
  // Keep Apollo fields blank so UI can detect source
  linkedin:    '',
  employees:   '',
  shortDescription: '',
  score:       c.reviews,
}));

process.stdout.write(`\nSaving to prospect_suggestions... `);
const res = await fetch(`${SUPABASE_URL}/rest/v1/prospect_suggestions`, {
  method: 'POST',
  headers: {
    apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json', Prefer: 'return=representation',
  },
  body: JSON.stringify({
    status: 'pending_review',
    run_label: runLabel,
    discovered_companies: payload,
    approved_company_ids: [],
  }),
});

if (!res.ok) { console.log(`FAILED: ${await res.text()}`); process.exit(1); }
const [saved] = await res.json();
console.log(`saved (id: ${saved?.id})`);
console.log('\nOpen CRM → Claude Agent → Company Suggestions to review.\n');
