#!/usr/bin/env node
/**
 * Search Apollo for A.O. Smith contacts with water treatment/filtration titles
 * and import them into the Supabase prospects DB.
 *
 * Usage: node scripts/apollo-ao-smith-contacts.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
);

const APOLLO_API_KEY = env.APOLLO_API;
const SUPABASE_URL = `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

if (!APOLLO_API_KEY) { console.error('Missing APOLLO_API in .env'); process.exit(1); }
if (!SUPABASE_URL || !env.VITE_SUPABASE_PROJECT_ID) { console.error('Missing VITE_SUPABASE_PROJECT_ID in .env'); process.exit(1); }

// A.O. Smith Corporation Apollo org ID (confirmed via people/match lookup)
const AO_SMITH_ORG_ID = '5f48752d3b7b980001996887';

// Water treatment / filtration / product related title keywords
const TITLE_KEYWORDS = [
  'water treatment',
  'water filtration',
  'water quality',
  'water purification',
  'water solutions',
  'filtration',
  'purification',
  'water products',
  'water technology',
  'product manager',
  'product development',
  'engineer',
  'director',
  'sourcing',
  'procurement',
  'innovation',
  'R&D',
  'research',
];

async function searchApollo(page = 1) {
  const body = {
    organization_ids: [AO_SMITH_ORG_ID],
    person_titles: TITLE_KEYWORDS,
    page,
    per_page: 25,
  };

  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Apollo API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Fetch prospect from Supabase
async function getProspect() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?company_name=ilike.%25smith%25&select=id,company_name,contacts&limit=10`,
    { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows)) throw new Error('Supabase error: ' + JSON.stringify(rows));
  return rows.find(r => r.company_name.toLowerCase().includes('a.o. smith') || r.company_name.toLowerCase().includes('ao smith'));
}

async function updateContacts(prospectId, contacts) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}`,
    {
      method: 'PATCH',
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ contacts, updated_at: new Date().toISOString() }),
    }
  );
  return res.json();
}

// --- Main ---
console.log('Searching Apollo for A.O. Smith water treatment contacts...\n');

let allPeople = [];
let page = 1;
let totalPages = 1;

do {
  console.log(`Fetching page ${page}...`);
  const data = await searchApollo(page);

  if (data.error) {
    console.error('Apollo error:', data.error);
    break;
  }

  const people = data.people || [];
  allPeople = allPeople.concat(people);

  totalPages = data.pagination?.total_pages || 1;
  console.log(`  Got ${people.length} results (page ${page}/${totalPages})`);
  page++;

  // Limit to 3 pages (75 contacts max) to avoid burning credits
  if (page > 3) break;
} while (page <= totalPages);

console.log(`\nTotal Apollo results: ${allPeople.length}`);

if (allPeople.length === 0) {
  console.log('No contacts found. Exiting.');
  process.exit(0);
}

// Map to contact shape — last_name is obfuscated in search results (enrich later if needed)
const newContacts = allPeople
  .filter(p => p.first_name)
  .map(p => ({
    id: `contact-apollo-${p.id || Math.random().toString(36).slice(2, 9)}`,
    name: `${p.first_name} ${p.last_name_obfuscated || ''}`.trim(),
    role: p.title || '',
    email: p.email || '',
    phone: p.phone_numbers?.[0]?.raw_number || '',
    linkedIn: p.linkedin_url || '',
  }));

console.log(`\nMapped ${newContacts.length} contacts:`);
newContacts.forEach(c => console.log(`  - ${c.name} | ${c.role} | ${c.email || 'no email'}`));

// Get prospect from DB
const prospect = await getProspect();
if (!prospect) {
  console.error('\nCould not find A.O. Smith in prospects table.');
  process.exit(1);
}
console.log(`\nFound prospect: "${prospect.company_name}" (${prospect.id})`);

// Merge — deduplicate by LinkedIn URL or Apollo id
const existing = Array.isArray(prospect.contacts) ? prospect.contacts : [];
const existingKeys = new Set([
  ...existing.map(c => c.linkedIn).filter(Boolean),
  ...existing.map(c => c.id).filter(Boolean),
]);

const toAdd = newContacts.filter(c => !existingKeys.has(c.linkedIn) && !existingKeys.has(c.id));
const skipped = newContacts.length - toAdd.length;
if (skipped > 0) console.log(`Skipping ${skipped} duplicate(s).`);

if (toAdd.length === 0) {
  console.log('All contacts already exist. Nothing to add.');
  process.exit(0);
}

const merged = [...existing, ...toAdd];
await updateContacts(prospect.id, merged);

console.log(`\nAdded ${toAdd.length} contact(s) to "${prospect.company_name}":`);
toAdd.forEach(c => console.log(`  + ${c.name} — ${c.role}`));
