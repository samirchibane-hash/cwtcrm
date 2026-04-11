#!/usr/bin/env node
/**
 * Find companies similar to our Customer/VIP accounts using Apollo.
 * Strategy:
 *   1. Use industry tag IDs (wholesale + mechanical engineering) + water-specific
 *      keywords to find targeted companies in the USA.
 *   2. Filter out anything already in our Supabase database (exact + fuzzy match).
 *   3. Score and rank by relevance to UV water treatment.
 *   4. Output top 10.
 *
 * Usage: node scripts/apollo-similar-companies.mjs
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
// Industry tag IDs discovered from seed customer enrichment
// ---------------------------------------------------------------------------
const TAG_WHOLESALE              = '5567d01e73696457ee100000';
const TAG_MECH_IND_ENGINEERING   = '5567ce2673696453d95c0000';
const TAG_CONSUMER_SERVICES      = '5567d1127261697f2b1d0000';

// ---------------------------------------------------------------------------
// All existing company names — normalized for fuzzy dedup
// ---------------------------------------------------------------------------
const EXISTING_COMPANIES = [
  "AO Smith","AAA Water","ADK Water Solutions","Advanced Aqua Systems","Advanced Water Solutions",
  "Advanced Water Systems","Advanced Water Treatment","Agua Vida Premium","Air Water Quality",
  "Akvo","All American Purification","All Florida Soft Water","Allini Water Filters","Altitude Water",
  "American Air Water","American Water Products","AmeriFlow","Antunes","Applied Membranes",
  "Aqua Clear Water Systems","Aqua Nine Plus","Aqua Science","Aqua Systems","Aqua Water Tech","Aquacorp",
  "Aquaflow Pump Supply","Aquamor","Aquaria","Aquatherma","Aquathin","Aquatic","AquaTru",
  "AquaZona","Atlantic Filter","Austin Water Solutions","Authentic Water USA","Automatic Water Conditioning",
  "Avalon Water Coolers","Avoda Water Solutions","Axeon Water Technologies","Besco Water Treatment",
  "Best Water Solutions","Big Valley Pure Water","Blacks Water Conditioning","Blake Equipment",
  "Blu Technologies","Blue Heron Water","Blue Water Desalination","Blupura","Borg Overstrom",
  "Brio Water Technology","Cal Spas","Camco","Canadian Water Warehouse","Canature WaterGroup",
  "Captain Filtration","Casa Blui","Chandler Systems","Chanson Water","UltraWater","Charger Water",
  "Chester Paul","Clean H2O Pros","Clean Valley Water","Clean Water Store","Clear Water Concepts",
  "Clear Water Filtration","Clear Water Systems","Clearsource RV","Coast Pump","ColiMinder",
  "Complete Water","Cornelius","Corrigan Mist","Coster Water","De Fontein","Diamond Spas",
  "Dimm","Duff Company","Dutco Tennant","Duxura Health","E Garrity Water","Easy Ice","EcoWater",
  "Eden Water","ELGA LabWater","Elite Water Systems","Elkay","ENGLOSOL","ERE Environmental Remediation",
  "Everest Ice Water Systems","Farris Enterprises","FCI Watermakers","Filpumps",
  "Florida Energy Water Air","Florida Water Analysis","Follett","Foxx Equipment","Franklin Water",
  "Fresh Water Systems","FreshPure","National Water Service","Futuramic Omaha Water","GE Appliances",
  "Genaq","Genesis Water Systems","Gilbert Water Softeners","Glacier Fresh","WaterH",
  "Global Water Solutions","Good Water Warehouse","Grande Ice","Granite Group",
  "H2O Care","H2O Distributors","H2O Equipment","H2O International","Halo Water","Hastings Water Service",
  "Haws","Hem Water","Hempy Water","Honest Water Filter Company","HOPE Hydration","Hoshizaki America",
  "Hydration Nation","Hydronix","Ice House America","Ice Rebus","Ice-O-Matic","Icetro","Impact Water",
  "iSpring","Jensen","Kinetico","Kold Draft","Kooler Ice","Leaf Home","LeverEdge","Liberty Infinity",
  "Liberty Pure","Lifesource Water Systems","Lifewater Solutions","Long Island Clean Water",
  "Manitowoc Ice","Mar Cor Purification","Marco Beverage Systems","Marlo Incorporated",
  "Martin Water Conditioning","Master Spas","McCowin Water","Med Water Systems","Micro Matic",
  "Mid America Water","Miller Leaman","Miridon Water Treatment","Moen","Multiplex Beverage",
  "Murdock Mfg","My Pure Water","Pure Secure","Natura Water","Negleys Water","Nelsen Corporation",
  "NextGen Septic","NH WaterCare","NuvoH2O","Oasis International","OffGridBox","Onnwater",
  "PACE Supply","Parker","Pentair","Performance Water Products","Permatech","PH Prescription",
  "Polar Station","Preferred Pump","Premier Pump","Primo Brands","Pureteck","Quench",
  "RE Prescott","Rainman","Rayne Water","Reddrok","Regional Refrigeration Distributors",
  "Retego Labs","Rideau Supply","RiTech Water Systems","RV Water Filter Store","Safeway Water",
  "Schenker","Scotsman Ice Systems","Seawater Pro","Secondwind Water","Sensible Water Solutions",
  "Skywell","SLCE Watermakers","SoCal Water Solutions","Soft H2O","Soul Water","Special T Water",
  "Steelhead","The Middleby Corp","The Outreach Program","The Water Clinic","The Watershop",
  "True Manufacturing","U-Line Corp","Ultra Soft Water Softeners","United Water USA","US Water Systems",
  "US Watermaker","UV Water Treatment","UVO3","Vita Nova Water Solutions","Water Business USA",
  "Water Chef","Water Safety Corporation","Water Doctors","Water Purification Supplies","Water Superstore",
  "Water Technologies","Watergen","Waterlogic","Culligan","Watermakers Inc","Weco Filters",
  "Wisolab","Wood Bros","WOW Water Systems","Xelera","O Land Station","Silver Corner Trading",
];

function normalize(name) {
  return (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(inc|llc|ltd|corp|co|company|the|and|of|water|systems|solutions|group|usa|america|international|services|supply|equipment|treatment|products)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const existingNorm = new Set(EXISTING_COMPANIES.map(normalize).filter(s => s.length >= 2));

function isAlreadyInDB(name) {
  const n = normalize(name);
  if (!n || n.length < 2) return true;
  if (existingNorm.has(n)) return true;
  for (const ex of existingNorm) {
    if (ex.length >= 4 && n.length >= 4) {
      if (ex.includes(n) || n.includes(ex)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Apollo helpers
// ---------------------------------------------------------------------------
async function searchOrgs({ tagIds, keywords, page = 1, perPage = 25 }) {
  const body = {
    organization_locations: ['United States'],
    q_organization_industry_tag_ids: tagIds,
    num_employees_ranges: ['1,20', '21,50', '51,200'],
    page,
    per_page: perPage,
  };
  if (keywords) body.q_keywords = keywords;

  const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Apollo org search ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Search strategy: run multiple focused queries, collect unique candidates
// ---------------------------------------------------------------------------
const SEARCH_RUNS = [
  // Wholesale distributors selling water treatment products
  { tagIds: [TAG_WHOLESALE],            keywords: 'water treatment UV filtration',      label: 'Wholesale + water UV'       },
  { tagIds: [TAG_WHOLESALE],            keywords: 'water purification systems dealer',  label: 'Wholesale + water purification' },
  { tagIds: [TAG_WHOLESALE],            keywords: 'UV disinfection water',              label: 'Wholesale + UV disinfection' },
  // Industrial engineering / OEM manufacturers of water systems
  { tagIds: [TAG_MECH_IND_ENGINEERING], keywords: 'water treatment UV disinfection',    label: 'Mech Eng + UV water'        },
  { tagIds: [TAG_MECH_IND_ENGINEERING], keywords: 'water filtration systems OEM',       label: 'Mech Eng + water OEM'       },
  { tagIds: [TAG_MECH_IND_ENGINEERING], keywords: 'water purification manufacturer',    label: 'Mech Eng + water mfr'       },
  // Consumer services water treatment installers
  { tagIds: [TAG_CONSUMER_SERVICES],    keywords: 'water treatment filtration residential', label: 'Consumer + residential water' },
];

console.log('\n=== Apollo Similar Company Finder ===');
console.log('Targeting: water treatment distributors, OEMs, and installers in the USA\n');

const seen    = new Set();
const candidates = [];

for (const run of SEARCH_RUNS) {
  process.stdout.write(`  [${run.label}] page 1 ... `);
  try {
    const data  = await searchOrgs({ tagIds: run.tagIds, keywords: run.keywords, page: 1, perPage: 25 });
    const orgs  = data.organizations || [];
    let added   = 0;

    for (const org of orgs) {
      if (!org.name || seen.has(org.id)) continue;
      seen.add(org.id);

      // Skip non-USA
      const country = (org.country || '').toLowerCase();
      if (country && country !== 'united states') continue;

      // Skip already in DB
      if (isAlreadyInDB(org.name)) continue;

      candidates.push({
        name:             org.name,
        website:          org.website_url || org.primary_domain || '',
        industry:         org.industry || '',
        employees:        org.num_employees || '',
        city:             org.city || '',
        state:            org.state || '',
        linkedin:         org.linkedin_url || '',
        apolloId:         org.id,
        shortDescription: org.short_description || '',
        keywords:         (org.keywords || []).join(', '),
        matchLabel:       run.label,
      });
      added++;
    }
    console.log(`${orgs.length} results, ${added} new (total: ${candidates.length})`);
  } catch (e) {
    console.log(`ERROR: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\nTotal unique candidates not in DB: ${candidates.length}\n`);

if (candidates.length === 0) {
  console.log('No results. The Apollo plan may not support keyword+tag combination search.');
  process.exit(0);
}

// ---------------------------------------------------------------------------
// Score and rank by relevance to UV water treatment
// ---------------------------------------------------------------------------
function score(c) {
  let s = 0;
  const name = (c.name || '').toLowerCase();
  const ind  = (c.industry || '').toLowerCase();
  const desc = (c.shortDescription || '').toLowerCase();
  const kw   = (c.keywords || '').toLowerCase();
  const all  = `${name} ${ind} ${desc} ${kw}`;

  // UV / disinfection — highest priority (our core product)
  if (all.includes('uv ') || all.includes('ultraviolet') || all.includes('disinfection')) s += 6;
  if (all.includes('uv system') || all.includes('uv light') || all.includes('uv steriliz')) s += 3;

  // Water treatment relevance
  if (all.includes('water treatment')) s += 4;
  if (all.includes('water purif')) s += 3;
  if (all.includes('water filtrat')) s += 3;
  if (all.includes('water soft')) s += 2;
  if (name.includes('water') || all.includes('reverse osmosis') || all.includes(' ro ')) s += 2;

  // Business type alignment (distributor/OEM/installer)
  if (all.includes('distributor') || all.includes('wholesale') || all.includes('supply')) s += 2;
  if (all.includes('manufacturer') || all.includes('oem') || all.includes('equipment')) s += 2;
  if (all.includes('installer') || all.includes('residential') || all.includes('commercial')) s += 1;

  // Profile completeness bonus
  if (c.website)   s += 1;
  if (c.linkedin)  s += 1;
  if (c.employees && parseInt(c.employees) > 5) s += 1;

  return s;
}

const top10 = candidates
  .map(c => ({ ...c, _score: score(c) }))
  .sort((a, b) => b._score - a._score)
  .slice(0, 10);

console.log('=== TOP 10 RECOMMENDED COMPANIES ===\n');
top10.forEach((c, i) => {
  console.log(`${i + 1}. ${c.name}  [score: ${c._score}]`);
  if (c.website)          console.log(`   Website:     ${c.website}`);
  if (c.linkedin)         console.log(`   LinkedIn:    ${c.linkedin}`);
  if (c.city || c.state)  console.log(`   Location:    ${[c.city, c.state].filter(Boolean).join(', ')}`);
  if (c.industry)         console.log(`   Industry:    ${c.industry}`);
  if (c.employees)        console.log(`   Employees:   ${c.employees}`);
  if (c.shortDescription) console.log(`   About:       ${c.shortDescription.slice(0, 160)}`);
  if (c.keywords)         console.log(`   Keywords:    ${c.keywords.split(',').slice(0, 5).join(', ')}`);
  console.log(`   Match via:   ${c.matchLabel}`);
  console.log('');
});
