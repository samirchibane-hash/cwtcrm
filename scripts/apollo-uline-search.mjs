#!/usr/bin/env node
/**
 * Search Apollo for U-Line Corp contacts by role/seniority filters,
 * enrich via people/match, verify emails with Clearout,
 * and save to the U-Line prospect in Supabase CRM.
 *
 * Usage: node scripts/apollo-uline-search.mjs
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

const APOLLO_KEY   = env.APOLLO_API;
const CLEAROUT_KEY = env.CLEAROUT_API_KEY;
const SUPABASE_URL = `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const PROSPECT_ID  = 'fe68b9fe-6388-4e12-9d74-8c930124ebea'; // U-Line Corp
const ULINE_ORG_ID = '54a264047468693cdd514f1f';

if (!APOLLO_KEY)   { console.error('Missing APOLLO_API in .env'); process.exit(1); }
if (!CLEAROUT_KEY) { console.error('Missing CLEAROUT_API_KEY in .env'); process.exit(1); }

const SENIORITIES    = ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'];
const TITLE_KEYWORDS = [
  'engineer', 'engineering', 'product developer', 'product development',
  'purchasing', 'procurement', 'service manager', 'operations',
  'quality', 'manufacturing', 'supply chain', 'r&d', 'research',
];
const SKIP_TITLES = ['marketing', 'finance', 'accounting', 'warehouse', 'intern', 'co-op', 'operator', 'technician', 'sales'];

// --- Apollo ---
async function apolloSearch(page = 1) {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({
      organization_ids: [ULINE_ORG_ID],
      person_seniorities: SENIORITIES,
      person_titles: TITLE_KEYWORDS,
      page,
      per_page: 25,
    }),
  });
  if (!res.ok) throw new Error(`Apollo search ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apolloEnrich(personId) {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
  });
  if (!res.ok) throw new Error(`Apollo enrich ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.person || null;
}

// --- Clearout ---
async function verifyEmail(email) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer:${CLEAROUT_KEY}` },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { status: 'error', safe_to_send: false, catch_all: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    safe_to_send: data.data?.safe_to_send === 'yes',
    catch_all: data.data?.is_catch_all === 'yes',
  };
}

// --- Supabase ---
async function getExistingContacts() {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return [];
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}&select=contacts`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0]) return [];
  return Array.isArray(rows[0].contacts) ? rows[0].contacts : [];
}

async function saveContacts(contacts) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}`,
    {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      body: JSON.stringify({ contacts, updated_at: new Date().toISOString() }),
    }
  );
  if (!res.ok) throw new Error(`Supabase update failed ${res.status}: ${await res.text()}`);
  return res.json();
}

// --- Main ---
console.log('\nStep 1: Searching Apollo for U-Line Corp contacts...\n');

let allPeople = [];
for (let page = 1; page <= 4; page++) {
  const data = await apolloSearch(page);
  if (data.error) { console.error('Apollo error:', data.error); break; }
  const people = data.people || [];
  allPeople = allPeople.concat(people);
  console.log(`  Page ${page}: ${people.length} results`);
  if (people.length < 25) break;
  await new Promise(r => setTimeout(r, 300));
}
console.log(`Total from Apollo: ${allPeople.length} people\n`);

if (allPeople.length === 0) { console.log('No contacts found. Exiting.'); process.exit(0); }

// Filter out irrelevant roles
const relevant = allPeople.filter(p =>
  p.first_name &&
  !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s))
);
console.log(`After role filter: ${relevant.length} contacts to enrich\n`);

// Step 2: Enrich
console.log('Step 2: Enriching via Apollo people/match...\n');

const enriched = [];
for (const person of relevant) {
  process.stdout.write(`  ${(person.first_name + ' ' + (person.last_name_obfuscated || '')).padEnd(25)} `);
  try {
    const full = await apolloEnrich(person.id);
    if (full) {
      enriched.push({
        apolloId: person.id,
        name: full.name || `${full.first_name} ${full.last_name}`.trim(),
        title: full.title || person.title || '',
        email: full.email || '',
        linkedIn: full.linkedin_url || '',
      });
      console.log(`→ ${full.name} | ${full.title || 'no title'} | ${full.email || 'no email'}`);
    } else {
      console.log('→ no result');
    }
  } catch (e) {
    console.log(`→ error: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 300));
}
console.log(`\nEnriched ${enriched.length} contacts\n`);

// Step 3: Verify emails
console.log('Step 3: Verifying emails with Clearout...\n');

const results = [];
for (const contact of enriched) {
  if (!contact.email) {
    results.push({ ...contact, emailStatus: 'no_email', safeToSend: false, catchAll: false });
    console.log(`  ${contact.name}: no email`);
    continue;
  }
  process.stdout.write(`  ${contact.email.padEnd(40)} → `);
  const v = await verifyEmail(contact.email);
  results.push({ ...contact, emailStatus: v.status, safeToSend: v.safe_to_send, catchAll: v.catch_all });
  console.log(`${v.status}${v.catch_all ? ' (catch-all)' : ''}`);
  await new Promise(r => setTimeout(r, 200));
}

// Step 4: Save
console.log('\nStep 4: Saving to Supabase...\n');

const existing = await getExistingContacts();
const existingKeys = new Set([
  ...existing.map(c => c.linkedIn).filter(Boolean),
  ...existing.map(c => c.id).filter(Boolean),
]);

const toAdd = results
  .filter(r => r.email)
  .filter(r => !existingKeys.has(r.linkedIn) && !existingKeys.has(`contact-apollo-${r.apolloId}`))
  .map(r => ({
    id: `contact-apollo-${r.apolloId}`,
    name: r.name,
    role: r.title,
    email: r.email,
    phone: '',
    linkedIn: r.linkedIn,
    ...(r.safeToSend ? { emailVerified: true } : {}),
  }));

const skipped = results.filter(r => r.email).length - toAdd.length;
if (skipped > 0) console.log(`Skipping ${skipped} duplicate(s).`);

if (toAdd.length === 0) {
  console.log('No new contacts to add.');
} else {
  const merged = [...existing, ...toAdd];
  const saved = await saveContacts(merged);

  if (saved) {
    console.log(`Added ${toAdd.length} contact(s) to U-Line Corp:\n`);
    toAdd.forEach(c => {
      const tag = c.emailVerified ? '✅ valid' : '⚠️  catch-all/unverified';
      console.log(`  + ${c.name} | ${c.role}`);
      console.log(`    ${c.email} [${tag}]`);
      if (c.linkedIn) console.log(`    ${c.linkedIn}`);
    });
  } else {
    const merged2 = [...existing, ...toAdd];
    console.log('SUPABASE_SERVICE_ROLE_KEY not in .env — outputting SQL for MCP:\n');
    console.log(`UPDATE prospects SET contacts = '${JSON.stringify(merged2)}'::jsonb, updated_at = NOW() WHERE id = '${PROSPECT_ID}';`);
  }
}

console.log('\n--- SUMMARY ---');
const valid    = results.filter(r => r.safeToSend);
const catchAll = results.filter(r => r.catchAll && !r.safeToSend);
const noEmail  = results.filter(r => !r.email);
console.log(`  ✅ Valid emails:  ${valid.length}`);
console.log(`  ⚠️  Catch-all:    ${catchAll.length}`);
console.log(`  ❌ No email:     ${noEmail.length}`);
console.log('\nDone.');
