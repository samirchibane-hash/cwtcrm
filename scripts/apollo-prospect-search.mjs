#!/usr/bin/env node
/**
 * Apollo Prospect Search Agent
 *
 * Discovers new water industry prospect companies not yet in our CRM.
 *
 * Strategy:
 *   1. Search Apollo people by water/UV-specific job title keywords → extract unique company names.
 *   2. Deduplicate against our existing prospect snapshot.
 *   3. For each new company name, search Apollo by org name → get domain + LinkedIn.
 *   4. Filter out municipalities, government, and unrelated entities.
 *   5. Output: company name, domain, LinkedIn URL.
 *
 * Usage:
 *   node scripts/apollo-prospect-search.mjs
 *   node scripts/apollo-prospect-search.mjs --pages 5      # pages per title search (default 3)
 *   node scripts/apollo-prospect-search.mjs --max 50       # cap company lookups (default 75)
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

const APOLLO_KEY = env.APOLLO_API;
if (!APOLLO_KEY) { console.error('Missing APOLLO_API in .env'); process.exit(1); }

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args     = process.argv.slice(2);
const pagesIdx = args.indexOf('--pages');
const maxIdx   = args.indexOf('--max');
const PAGES_PER_QUERY = pagesIdx >= 0 ? (parseInt(args[pagesIdx + 1]) || 3) : 3;
const MAX_LOOKUPS     = maxIdx   >= 0 ? (parseInt(args[maxIdx   + 1]) || 75) : 75;

// ---------------------------------------------------------------------------
// Existing prospect snapshot — used for deduplication (generated 2026-04-12)
// ---------------------------------------------------------------------------
const EXISTING_PROSPECTS = [
  'A.O. Smith','Allini Water Filters','Altitude Water','American Air & Water','Antunes',
  'Applied Membranes','Aqua Nine Plus','Aquaflow Pump & Supply','Aquamor','Aquaria',
  'Aquathin','AquaTru','Arctic Spas','Atlantic Filter','Avalon Water Coolers',
  'Axeon Water Technologies','Besco Water Treatment','Blake Equipment','Blu Technologies',
  'Blupura','Borg & Overström','Brio Water Technology','Bullfrog Spas','Cal Spas',
  'Camco','Canadian Water Warehouse','Canature WaterGroup','Chandler Systems',
  'Chester Paul','Clean Water Store','Clearsource RV','Coast Pump','Complete Water',
  'Cornelius','Coster Water','Duff Company','Dutco Tennant','Easy Ice',
  'ELGA LabWater','Elite Water Systems','Elkay','ENGLOSOL','ERE',
  'Everest Ice and Water Systems','F.W. Webb Company','Follett','Foxx Equipment',
  'Franklin Water','Fresh Water Systems','FreshPure','National Water Service',
  'Genaq','Glacier Fresh','WaterH','Global Water Solutions','Good Water Warehouse',
  'Granite Group','H2O Distributors','Hague Quality Water International','Haws',
  'Hellenbrand','Honest Water Filter Company','HOPE Hydration','Hoshizaki America',
  'Hydration Nation','Hydronix','Ice House America','Ice Rebus','Ice-O-Matic','Icetro',
  'iSpring','Jacuzzi Group','Jensen','Kinetico','Kold Draft','Kooler Ice','Leaf Home',
  'LeverEdge','Liberty Infinity','Liberty Pure','Lifesource Water Systems','Manitowoc Ice',
  'Mar Cor Purification','Marco Beverage Systems','Marlo','Martin Water Conditioning',
  'Master Spas','McCowin Water','Med Water Systems','Micro Matic','Mid America Water',
  'Miller Leaman','Moen','Multiplex Beverage','Murdock Mfg','My Pure Water','Pure & Secure',
  'Nelsen Corporation','NextGen Septic','NuvoH2O','Oasis International','OffGridBox',
  'Orenco Systems','PACE Supply','Parker','Pentair','Performance Water Products',
  'Polar Station','Preferred Pump','Primo Brands','Quench','Rayne Water',
  'Regional Refrigeration Distributors','United Refrigeration','Rideau Supply',
  'RV Water Filter Store','Safeway Water','Scotsman Ice Systems','Skywell',
  'SLCE Watermakers','The Middleby Corp','The Water Clinic','True Manufacturing',
  'U-Line Corp','Ultra Soft Water Softeners','UVO3','Water Chef','Water Safety Corporation',
  'Water Doctors','Water Superstore','Water Technologies De Mexico','Watergen',
  'Waterlogic','Culligan','WaterProfessionals','Watkins Wellness','Wood Bros.',
  'AquaZona','AmeriFlow','Aqua Clear Water Systems','Aqua Science','Aqua Systems',
  'Aqua Water Tech','Aquacorp','Aquatherma','Aquatic','AquaTru','Atlantic Filter',
  'Austin Water Solutions','Authentic Water USA','Automatic Water Conditioning',
  'Avoda Water Solutions','Big Valley Pure Water','Blacks Water Conditioning',
  'Blue Heron Water','Blue Water Desalination','Camco','Captain Filtration',
  'Casa Blui','Chanson Water','UltraWater','Charger Water','Clean H2O Pros',
  'Clean Valley Water','Clear Water Concepts','Clear Water Filtration',
  'Clear Water Systems','ColiMinder','Diamond Spas','Dimm','De Fontein',
  'Duxura Health','E Garrity Water','EcoWater','Eden Water','ERE Environmental Remediation',
  'Farris Enterprises','FCI Watermakers','Filpumps','Florida Energy Water Air',
  'Florida Water Analysis','Futuramic Omaha Water','GE Appliances','Genesis Water Systems',
  'Gilbert Water Softeners','H2O Care','H2O Equipment','H2O International',
  'Halo Water','Hastings Water Service','Hem Water','Hempy Water','Ice House America',
  'Impact Water','Lifewater Solutions','Long Island Clean Water','Miridon Water Treatment',
  'Natura Water','Negleys Water','NH WaterCare','Onnwater','PH Prescription',
  'Permatech','Premier Pump','Pureteck','RE Prescott','Rainman','Reddrok',
  'Retego Labs','RiTech Water Systems','Schenker','Seawater Pro','Secondwind Water',
  'Sensible Water Solutions','SLCE Watermakers','SoCal Water Solutions','Soft H2O',
  'Soul Water','Special T Water','Steelhead','The Outreach Program','The Watershop',
  'US Water Systems','US Watermaker','UV Water Treatment','Vita Nova Water Solutions',
  'Water Business USA','Water Purification Supplies','Watermakers Inc','Weco Filters',
  'Wisolab','WOW Water Systems','Xelera','O Land Station','Silver Corner Trading',
];

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|co|company|the|and|of|water|systems|solutions|group|usa|america|international|services|supply|equipment|treatment|products|corporation)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const existingNorm = new Set(EXISTING_PROSPECTS.map(normalize).filter(n => n.length >= 2));

function isExisting(name) {
  const n = normalize(name);
  if (!n || n.length < 2) return true;
  if (existingNorm.has(n)) return true;
  for (const ex of existingNorm) {
    if (ex.length >= 4 && n.length >= 4 && (ex.includes(n) || n.includes(ex))) return true;
  }
  return false;
}

// Skip municipalities, government, utilities, research labs, healthcare — not our market
const SKIP_PATTERNS = [
  /\bcity of\b/i, /\btown of\b/i, /\bcounty\b/i, /\bmunicip/i,
  /\bwater district\b/i, /\bwater authority\b/i, /\bwater board\b/i,
  /\bdevelopment board\b/i, /\bwater resources\b/i, /\bwater agency\b/i,
  /\breclamation district\b/i, /\bsanitation district\b/i, /\bsewer\b/i,
  /\butility\b/i, /\butilities\b/i, /\bpublic water\b/i,
  /\bgovernment\b/i, /\bus army\b/i, /\bmilitary\b/i,
  /\bdepartment of\b/i, /\bdept\. of\b/i,
  /\bfederal\b/i, /\bnasa\b/i, /\bjet propulsion\b/i, /\bnational lab/i,
  /\bhealthcare\b/i, /\bhospital\b/i, /\bmedical center\b/i,
  /\buniversity\b/i, /\bcollege\b/i, /\bschool district\b/i,
  /\bpublic works\b/i, /\bpublic service\b/i, /\bwater reclamation\b/i,
  /\bwastewater\b/i, /\bwaste water\b/i,
  /\bmetro water\b/i, /\bwater services\b/i, /\bwater company\b/i,   // regulated utilities
  /\bwater authority\b/i, /\bwater supply\b/i,
  /water\.org\b/i,                                                     // NGO
];

function isSkippable(name) {
  return SKIP_PATTERNS.some(re => re.test(name));
}

// Score water relevance of a company name (higher = more likely to be a prospect)
const WATER_SIGNALS = [
  /\bwater\b/i, /\baqua\b/i, /\bhydro\b/i, /\bh2o\b/i, /\bpure\b/i,
  /\bfilt(?:er|ration)\b/i, /\bpurif/i, /\bsoften/i, /\bcondition/i,
  /\buv\b/i, /\bultraviolet\b/i, /\bdisinfect/i, /\bsteriliz/i,
  /\breverse osmosis\b/i, /\bmembrane\b/i, /\bdesalin/i,
  /\bice\b/i, /\bbeverage\b/i, /\bdispens/i,
  /\bspa\b/i, /\bpool\b/i, /\bhot tub\b/i,
  /\bpump\b/i, /\bfluid\b/i,
];
// Known water industry companies without "water" in name
const KNOWN_WATER_COMPANIES = new Set([
  'veolia', 'xylem', 'evoqua', 'pentair', 'pall', 'hach', 'ecolab',
  'nalco', 'suez', 'enerco', 'westech', 'trojan', 'sterilight',
  'viqua', 'luminor', 'puronics', 'kinetico', 'enpress', 'omnipure',
  'watts', 'grundfos', 'xylem', 'idexx', 'hanna', 'yokogawa',
  'endress', 'hauser', 'prominent', 'dulcometer', 'lakos',
]);

function hasWaterRelevance(name) {
  if (WATER_SIGNALS.some(re => re.test(name))) return true;
  const lower = name.toLowerCase();
  return KNOWN_WATER_COMPANIES.has(lower.split(/[\s,&]+/)[0]);
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// People title searches — water / UV / filtration industry roles
// ---------------------------------------------------------------------------
const TITLE_SEARCHES = [
  // Broad water treatment — highest yield
  { label: 'Water treatment',       titles: ['water treatment specialist', 'water treatment manager', 'water treatment engineer', 'water treatment technician'] },
  { label: 'Water systems sales',   titles: ['water systems sales', 'water treatment sales', 'water filtration sales', 'water purification sales'] },
  { label: 'Water quality',         titles: ['water quality specialist', 'water quality manager', 'water quality engineer', 'water quality analyst'] },
  // UV / disinfection
  { label: 'UV & disinfection',     titles: ['uv systems', 'uv disinfection', 'uv water', 'ultraviolet disinfection', 'water disinfection'] },
  // Filtration / RO / membranes
  { label: 'Filtration engineer',   titles: ['filtration engineer', 'filtration specialist', 'filtration systems', 'water filtration'] },
  { label: 'RO & membranes',        titles: ['reverse osmosis', 'membrane filtration', 'membrane systems', 'water desalination', 'ro systems'] },
  // Softener / conditioning
  { label: 'Water conditioning',    titles: ['water softener', 'water conditioning', 'water conditioner', 'ion exchange'] },
  // Adjacent: ice / beverage / point-of-use
  { label: 'Ice & dispenser',       titles: ['ice machine', 'ice equipment', 'beverage dispenser', 'water dispenser', 'point of use water'] },
  // Spa / pool / recreational water
  { label: 'Spa & pool water',      titles: ['spa water', 'hot tub water', 'pool water treatment', 'recreational water'] },
];

// ---------------------------------------------------------------------------
// Phase 1: People searches → collect unique company names
// ---------------------------------------------------------------------------
console.log('\n=== Apollo Prospect Search Agent ===');
console.log(`People title searches: ${TITLE_SEARCHES.length} queries × ${PAGES_PER_QUERY} pages\n`);

console.log('--- Phase 1: People title searches → company names ---\n');

const companyCandidates = new Map(); // name → { label }

for (const search of TITLE_SEARCHES) {
  let totalPeople = 0;
  let newCompanies = 0;

  for (let page = 1; page <= PAGES_PER_QUERY; page++) {
    try {
      const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
        body: JSON.stringify({
          person_titles:           search.titles,
          organization_locations:  ['United States'],
          per_page:                25,
          page,
        }),
      });
      if (!res.ok) { console.log(`  [${search.label}] p${page} HTTP ${res.status}`); break; }
      const data = await res.json();
      if (data.error) { console.log(`  [${search.label}] p${page} error: ${data.error}`); break; }

      const people = data.people || [];
      totalPeople += people.length;

      for (const person of people) {
        const orgName = person.organization?.name;
        if (!orgName)                           continue;
        if (companyCandidates.has(orgName))     continue;
        if (isSkippable(orgName))               continue;
        if (isExisting(orgName))                continue;
        if (!hasWaterRelevance(orgName))        continue; // name must suggest water industry
        companyCandidates.set(orgName, { label: search.label });
        newCompanies++;
      }

      if (people.length < 25) break; // last page
      await sleep(350);
    } catch (e) {
      console.log(`  [${search.label}] p${page} error: ${e.message}`);
      break;
    }
  }

  console.log(`  [${search.label}]: ${totalPeople} people → ${newCompanies} new companies (total: ${companyCandidates.size})`);
  await sleep(400);
}

console.log(`\nUnique new company candidates: ${companyCandidates.size}`);

if (companyCandidates.size === 0) {
  console.log('No candidates found.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Phase 2: For each candidate, search by org name → get domain + LinkedIn
// ---------------------------------------------------------------------------
console.log(`\n--- Phase 2: Enriching company names (up to ${MAX_LOOKUPS}) ---\n`);

const candidateList = [...companyCandidates.entries()].slice(0, MAX_LOOKUPS);
const results = [];
const seenDomains = new Set();

for (const [orgName, { label }] of candidateList) {
  process.stdout.write(`  ${orgName.padEnd(50)} → `);
  try {
    const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify({ q_organization_name: orgName, per_page: 1, page: 1 }),
    });
    if (!res.ok) { console.log(`HTTP ${res.status}`); await sleep(400); continue; }
    const data  = await res.json();
    const org   = (data.organizations || [])[0];

    if (!org) { console.log('not found'); await sleep(350); continue; }

    const domain   = org.primary_domain || '';
    const linkedin = org.linkedin_url   || '';

    if (domain && seenDomains.has(domain)) { console.log(`dup domain ${domain}`); await sleep(350); continue; }
    if (domain) seenDomains.add(domain);

    // Skip government (.gov) and nonprofit (.org) domains — not commercial prospects
    if (domain.endsWith('.gov') || domain.endsWith('.org')) {
      console.log(`skip domain ${domain}`);
      await sleep(350);
      continue;
    }

    // Skip companies Apollo categorizes as entirely off-target
    const industry = (org.industry || '').toLowerCase();
    const SKIP_INDUSTRIES = ['information technology', 'software', 'financial services',
      'insurance', 'accounting', 'legal services', 'staffing', 'real estate',
      'advertising', 'marketing', 'media', 'publishing', 'entertainment',
      'government administration', 'civic & social organization'];
    if (SKIP_INDUSTRIES.some(si => industry.includes(si))) {
      console.log(`skip industry: ${org.industry}`);
      await sleep(350);
      continue;
    }

    results.push({
      name:      org.name || orgName,
      domain,
      linkedin,
      industry:  org.industry || '',
      employees: org.num_employees ? String(org.num_employees) : '',
      city:      org.city  || '',
      state:     org.state || '',
      foundVia:  label,
    });
    console.log(`✓  ${domain || '(no domain)'}  ${linkedin ? '[LI]' : ''}`);
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  await sleep(400);
}

// ---------------------------------------------------------------------------
// Filter: require at least a domain OR a LinkedIn URL to be useful
// ---------------------------------------------------------------------------
const useful = results.filter(r => r.domain || r.linkedin);

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------
console.log(`\n\n${'='.repeat(60)}`);
console.log(`  ${useful.length} similar companies with domain or LinkedIn`);
console.log('='.repeat(60));

if (useful.length === 0) {
  console.log('\nNo results with domain or LinkedIn.');
  process.exit(0);
}

// Group by foundVia label
const byLabel = {};
for (const r of useful) {
  (byLabel[r.foundVia] = byLabel[r.foundVia] || []).push(r);
}

for (const [label, companies] of Object.entries(byLabel)) {
  console.log(`\n── ${label} (${companies.length})\n`);
  for (const c of companies) {
    console.log(`   ${c.name}`);
    if (c.domain)    console.log(`     Domain:    ${c.domain}`);
    if (c.linkedin)  console.log(`     LinkedIn:  ${c.linkedin}`);
    if (c.industry)  console.log(`     Industry:  ${c.industry}`);
    const loc = [c.city, c.state].filter(Boolean).join(', ');
    if (loc)         console.log(`     Location:  ${loc}`);
    if (c.employees) console.log(`     Employees: ${c.employees}`);
  }
}

// ---------------------------------------------------------------------------
// TSV export
// ---------------------------------------------------------------------------
console.log('\n\n=== TSV EXPORT ===\n');
console.log('Name\tDomain\tLinkedIn\tIndustry\tEmployees\tCity\tState\tFound Via');
for (const r of useful) {
  console.log(`${r.name}\t${r.domain}\t${r.linkedin}\t${r.industry}\t${r.employees}\t${r.city}\t${r.state}\t${r.foundVia}`);
}

console.log('\nDone.');
