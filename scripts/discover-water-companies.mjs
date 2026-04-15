#!/usr/bin/env node
/**
 * Discover residential and commercial water treatment companies not in the CRM.
 *
 * 1. Runs Apify Google Search Scraper with targeted queries to surface domains.
 * 2. Enriches each domain via Apollo /organizations/enrich.
 * 3. Filters: 20+ employees, non-industrial/non-municipal, not already in CRM.
 * 4. Outputs a ranked list of { name, linkedin, domain, employees, industry }.
 * 5. Saves results to prospect_suggestions for CRM review.
 *
 * Usage:
 *   node scripts/discover-water-companies.mjs --all-names <base64> [--limit 80] [--top 30] [--dry-run]
 *
 *   --all-names <base64>   JSON string array of existing CRM names (for dedup).
 *                          Fetch via Supabase MCP: SELECT company_name FROM prospects
 *   --limit N              Max Apollo enrichment calls (default: 80)
 *   --top N                Max companies to save (default: 30)
 *   --dry-run              Print results without saving
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

const NAMES_B64 = getFlag('--all-names');
const LIMIT     = parseInt(getFlag('--limit') || '80', 10);
const TOP       = parseInt(getFlag('--top')   || '30', 10);
const DRY_RUN   = hasFlag('--dry-run');

const APOLLO_KEY   = env.APOLLO_API;
const APIFY_TOKEN  = env.APIFY_TOKEN;
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!APOLLO_KEY)  { console.error('Missing APOLLO_API in .env');  process.exit(1); }
if (!APIFY_TOKEN) { console.error('Missing APIFY_TOKEN in .env'); process.exit(1); }
if (!SB_KEY)      { console.error('Missing SUPABASE key in .env'); process.exit(1); }

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Google queries — commercial/residential framing avoids municipal results
// ---------------------------------------------------------------------------
const QUERIES = [
  'water softener manufacturer USA commercial residential site:.com',
  '"WQA member" water treatment manufacturer distributor',
  'UV water disinfection system manufacturer dealer USA',
  'reverse osmosis filtration system manufacturer commercial',
  'hot tub spa water treatment equipment manufacturer USA',
  'ice machine manufacturer commercial USA',
  'point of use water filtration manufacturer dealer USA',
  'water conditioning dealer franchise USA',
  'whole home water filter manufacturer residential',
  'NSF certified drinking water treatment manufacturer USA',
  'water purification equipment OEM manufacturer USA',
  'commercial water softener equipment supplier USA',
];

// ---------------------------------------------------------------------------
// Domains to skip — portals, marketplaces, social, directories, gov
// ---------------------------------------------------------------------------
const SKIP_DOMAINS = new Set([
  'amazon.com','amazon.ca','ebay.com','walmart.com','homedepot.com','lowes.com',
  'costco.com','target.com','wayfair.com','overstock.com',
  'alibaba.com','aliexpress.com','made-in-china.com',
  'youtube.com','linkedin.com','facebook.com','twitter.com','x.com',
  'instagram.com','pinterest.com','tiktok.com','reddit.com','quora.com',
  'wikipedia.org','wikimedia.org','soundcloud.com',
  'yelp.com','angi.com','angieslist.com','homeadvisor.com',
  'thumbtack.com','houzz.com','homestars.com','bbb.org','manta.com',
  'thomasnet.com','dnb.com','zoominfo.com','crunchbase.com','bloomberg.com',
  'wqa.org','nsf.org','epa.gov','energystar.gov','awwa.org','iapmo.org',
  'wateronline.com','waterworld.com','waterworldmagazine.com',
  'grainger.com','mcmaster.com','uline.com','globalindustrial.com',
  'leadiq.com','apollo.io','birdeye.com','trustpilot.com',
  'webstaurantstore.com','katom.com','restaurantequippers.com',
  'google.com','bing.com','yahoo.com','duckduckgo.com',
]);

const SKIP_PATTERNS = [
  '.gov','.edu','.mil',
  'waterdistrict','municipalwater','cityof','countyof','townof',
  'publicworks','municipalutility','sanitation',
];

// ---------------------------------------------------------------------------
// Industrial / municipal exclusion (checked after Apollo enrichment)
// ---------------------------------------------------------------------------
const INDUSTRIAL_KW = [
  'wastewater','waste water','sewage','effluent',
  'municipal water','municipal utility','water utility','water authority',
  'water district','city of ','town of ','county of ',
  'public works','water department',
  'cooling tower','boiler water','boiler treatment',
  'produced water','oil and gas water','mining water',
  'stormwater','storm water','desalination plant',
  'water reclamation','water reuse','brine treatment','zero liquid discharge',
];

function isIndustrial(org) {
  const text = [org.name, org.industry, org.short_description, ...(org.keywords || [])]
    .filter(Boolean).join(' ').toLowerCase();
  return INDUSTRIAL_KW.some(kw => text.includes(kw));
}

// ---------------------------------------------------------------------------
// Name normalization for CRM dedup
// ---------------------------------------------------------------------------
function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|co|company|the|and|of|water|systems|solutions|group|usa|america|international|services|supply|equipment|treatment|products)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------
// Domain extraction
// ---------------------------------------------------------------------------
function extractDomain(url) {
  if (!url) return null;
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`);
    return u.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return (url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] || '').toLowerCase() || null;
  }
}

// ---------------------------------------------------------------------------
// Relevance scoring
// ---------------------------------------------------------------------------
function score(org) {
  let s = 0;
  const all = [org.name, org.industry, org.short_description, ...(org.keywords || [])]
    .filter(Boolean).join(' ').toLowerCase();

  if (all.includes('uv ') || all.includes('ultraviolet') || all.includes('disinfection')) s += 6;
  if (all.includes('water treatment'))  s += 4;
  if (all.includes('water purif'))      s += 3;
  if (all.includes('water filtrat'))    s += 3;
  if (all.includes('water soft'))       s += 2;
  if ((org.name || '').toLowerCase().includes('water') ||
      all.includes('reverse osmosis'))  s += 2;
  if (all.includes('distributor') || all.includes('wholesale') || all.includes('supply')) s += 2;
  if (all.includes('manufacturer') || all.includes('oem') || all.includes('equipment'))   s += 2;
  if (all.includes('residential') || all.includes('commercial')) s += 1;
  if (org.linkedin_url) s += 1;
  return s;
}

// ---------------------------------------------------------------------------
// Apify: run Google Search Scraper
// ---------------------------------------------------------------------------
async function runGoogleSearch(queries) {
  console.log(`Starting Apify Google Search Scraper (${queries.length} queries)...`);
  const r = await fetch(
    `https://api.apify.com/v2/acts/apify~google-search-scraper/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        queries:          queries.join('\n'),
        maxPagesPerQuery: 2,
        resultsPerPage:   10,
        countryCode:      'us',
        languageCode:     'en',
      }),
    }
  );
  if (!r.ok) throw new Error(`Apify start failed ${r.status}: ${await r.text()}`);
  const { data } = await r.json();
  const runId    = data.id;
  const dsId     = data.defaultDatasetId;
  console.log(`  Run ID: ${runId}`);

  // Poll
  const deadline = Date.now() + 5 * 60_000;
  while (true) {
    await sleep(6000);
    const s = await fetch(`https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`);
    const { data: { status } } = await s.json();
    process.stdout.write(`  ${status}  (${Math.round((Date.now() - (deadline - 5*60_000))/1000)}s)\n`);
    if (status === 'SUCCEEDED') break;
    if (['FAILED','TIMED-OUT','ABORTED'].includes(status)) throw new Error(`Apify run ${status}`);
    if (Date.now() > deadline) throw new Error('Apify timed out');
  }

  // Fetch dataset
  const d = await fetch(
    `https://api.apify.com/v2/datasets/${dsId}/items?token=${APIFY_TOKEN}&format=json`
  );
  if (!d.ok) throw new Error(`Dataset fetch failed: ${d.status}`);
  return d.json();
}

// ---------------------------------------------------------------------------
// Extract unique domains from Google results
// ---------------------------------------------------------------------------
function extractDomains(pages) {
  const seen    = new Set();
  const results = [];
  for (const page of pages) {
    for (const r of (page.organicResults || [])) {
      const domain = extractDomain(r.url || r.link || '');
      if (!domain || domain.length < 4) continue;
      const root = domain.split('.').slice(-2).join('.');
      if (SKIP_DOMAINS.has(domain) || SKIP_DOMAINS.has(root)) continue;
      if (SKIP_PATTERNS.some(p => domain.includes(p))) continue;
      if (seen.has(domain)) continue;
      seen.add(domain);
      results.push({ domain, label: (r.title || '').slice(0, 80) });
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// Apollo: enrich by domain
// ---------------------------------------------------------------------------
async function apolloEnrich(domain) {
  const r = await fetch(
    `https://api.apollo.io/v1/organizations/enrich?domain=${encodeURIComponent(domain)}`,
    { headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY } }
  );
  if (!r.ok) return null;
  const data = await r.json();
  return data.organization || null;
}

// ===========================================================================
// MAIN
// ===========================================================================
console.log('\n=== Water Company Discovery ===');
if (DRY_RUN) console.log('(dry run — results will not be saved)\n');
else         console.log('');

// Step 1: CRM names for dedup
const allNames = NAMES_B64
  ? JSON.parse(Buffer.from(NAMES_B64, 'base64').toString('utf8'))
  : [];

if (allNames.length === 0) {
  console.log('WARNING: No --all-names provided. CRM dedup disabled.\n');
} else {
  console.log(`CRM dedup: ${allNames.length} existing companies loaded.\n`);
}

const existingNorm = new Set(allNames.map(normalize).filter(s => s.length >= 2));

function inCRM(name) {
  const n = normalize(name);
  if (!n || n.length < 2) return false;
  if (existingNorm.has(n)) return true;
  for (const ex of existingNorm) {
    if (ex.length >= 5 && n.length >= 5 && (ex.includes(n) || n.includes(ex))) return true;
  }
  return false;
}

// Step 2: Apify → domains
let domainQueue;
try {
  const pages = await runGoogleSearch(QUERIES);
  domainQueue = extractDomains(pages);
  console.log(`\nUnique domains to enrich: ${domainQueue.length}`);
} catch (e) {
  console.error(`\nApify error: ${e.message}`);
  process.exit(1);
}

// Step 3: Apollo enrichment + filtering
const cap       = Math.min(domainQueue.length, LIMIT);
const passed    = [];
console.log(`\nEnriching up to ${cap} domains...\n`);

for (let i = 0; i < cap; i++) {
  const { domain, label } = domainQueue[i];
  process.stdout.write(`  ${String(i + 1).padStart(3)}. ${domain.padEnd(42)} → `);

  const org = await apolloEnrich(domain);
  if (!org) { console.log('not found'); await sleep(280); continue; }

  const emp = parseInt(org.estimated_num_employees || org.num_employees || '0') || 0;
  if (emp > 0 && emp < 20) { console.log(`skip (${emp} emp)`); await sleep(280); continue; }
  if (isIndustrial(org))   { console.log(`skip (industrial)`);  await sleep(280); continue; }
  if (inCRM(org.name || domain)) { console.log(`skip (in CRM)`); await sleep(280); continue; }

  const MIN_SCORE = 5;
  const s = score(org);
  if (s < MIN_SCORE) { console.log(`skip (score ${s})`); await sleep(280); continue; }

  passed.push({
    name:      org.name || domain,
    domain:    org.website_url || org.primary_domain || `https://${domain}`,
    linkedin:  org.linkedin_url || '',
    employees: emp || '?',
    industry:  org.industry || '',
    city:      org.city || '',
    state:     org.state || '',
    apolloId:  org.id || `domain-${domain}`,
    shortDesc: (org.short_description || '').slice(0, 120),
    score:     s,
  });
  console.log(`✓ ${org.name} | ${org.industry || '—'} | ${emp || '?'} emp | score ${s}`);
  await sleep(320);
}

// Step 4: Rank and display
const top = passed.sort((a, b) => b.score - a.score).slice(0, TOP);

console.log(`\n\n${'─'.repeat(70)}`);
console.log(`  RESULTS: ${top.length} companies (${passed.length} passed filters)`);
console.log('─'.repeat(70));
top.forEach((c, i) => {
  console.log(`\n${String(i + 1).padStart(2)}. ${c.name}  [${c.employees} emp, score ${c.score}]`);
  console.log(`    Domain:   ${c.domain}`);
  if (c.linkedin)  console.log(`    LinkedIn: ${c.linkedin}`);
  if (c.city || c.state) console.log(`    Location: ${[c.city, c.state].filter(Boolean).join(', ')}`);
  if (c.industry)  console.log(`    Industry: ${c.industry}`);
  if (c.shortDesc) console.log(`    About:    ${c.shortDesc}`);
});
console.log('');

if (DRY_RUN || top.length === 0) {
  if (DRY_RUN) console.log('Dry run — not saving.');
  process.exit(0);
}

// Step 5: Save to prospect_suggestions
const runLabel = `Water Co Discovery — ${new Date().toLocaleDateString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit',
})}`;

const payload = top.map(({ score: _s, shortDesc: _d, apolloId, name, domain, linkedin, employees, industry, city, state }) => ({
  apolloId, name, website: domain, linkedin, employees: String(employees),
  industry, city, state, score: _s, shortDescription: _d || '',
}));

process.stdout.write(`Saving to prospect_suggestions... `);
const res = await fetch(`${SUPABASE_URL}/rest/v1/prospect_suggestions`, {
  method: 'POST',
  headers: {
    apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json', Prefer: 'return=representation',
  },
  body: JSON.stringify({
    status: 'pending_review', run_label: runLabel,
    discovered_companies: payload, approved_company_ids: [],
  }),
});

if (!res.ok) { console.log(`FAILED: ${await res.text()}`); process.exit(1); }
const [saved] = await res.json();
console.log(`saved (id: ${saved?.id})`);
console.log('\nOpen CRM → Claude Agent → Company Suggestions to review.\n');
