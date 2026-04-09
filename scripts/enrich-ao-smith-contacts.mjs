#!/usr/bin/env node
/**
 * Enrich A.O. Smith contacts:
 * 1. Re-search Apollo to get all contacts with real IDs
 * 2. Enrich each via people/match to reveal full name + email
 * 3. Verify emails with Clearout
 * 4. Update Supabase DB
 *
 * Usage: node scripts/enrich-ao-smith-contacts.mjs
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

const APOLLO_KEY    = env.APOLLO_API;
const CLEAROUT_KEY  = env.CLEAROUT_API_KEY;
const PROSPECT_ID   = 'b8b1e560-9ab8-48c6-9eaf-94109c501c31';
const AO_SMITH_ORG  = '5f48752d3b7b980001996887';

const TITLE_KEYWORDS = [
  'water treatment','water filtration','water quality','water purification',
  'water solutions','filtration','purification','water products','water technology',
  'product manager','product development','engineer','director','sourcing',
  'procurement','innovation','R&D','research',
];

// --- Apollo helpers ---
async function apolloSearch(page = 1) {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({
      organization_ids: [AO_SMITH_ORG],
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

// --- Clearout email verification ---
async function verifyEmail(email) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer:${CLEAROUT_KEY}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { status: 'unknown', safe_to_send: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    safe_to_send: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
    catch_all: data.data?.is_catch_all === 'yes',
  };
}

// --- Supabase helpers ---
async function getExistingContacts() {
  const { createClient } = await import('@supabase/supabase-js').catch(() => null) || {};
  // Fall back to MCP — just return null and we'll use execute_sql path
  return null;
}

// --- Main ---
console.log('Step 1: Searching Apollo for A.O. Smith water/filtration contacts...\n');

let allPeople = [];
for (let page = 1; page <= 3; page++) {
  const data = await apolloSearch(page);
  const people = data.people || [];
  allPeople = allPeople.concat(people);
  console.log(`  Page ${page}: ${people.length} results`);
  if (people.length < 25) break;
}
console.log(`Total: ${allPeople.length} people found\n`);

// Filter: skip India/lab-tech/co-op/operator roles for now
const SKIP_TITLES = ['operator','technician','co-op','intern','india pvt'];
const relevant = allPeople.filter(p =>
  p.first_name &&
  !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s))
);
console.log(`After filtering noise: ${relevant.length} contacts to enrich\n`);

// Step 2: Enrich each person via people/match
console.log('Step 2: Enriching via Apollo people/match to get full names + emails...\n');

const enriched = [];
for (const person of relevant) {
  process.stdout.write(`  Enriching ${person.first_name} ${person.last_name_obfuscated}... `);
  try {
    const full = await apolloEnrich(person.id);
    if (full) {
      enriched.push({
        apolloId: person.id,
        name: full.name || `${full.first_name} ${full.last_name}`.trim(),
        title: full.title || person.title || '',
        email: full.email || '',
        linkedin: full.linkedin_url || '',
      });
      console.log(`✓ ${full.name} | ${full.email || 'no email'}`);
    } else {
      console.log('no result');
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  // Small delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 300));
}

console.log(`\nEnriched ${enriched.length} contacts\n`);

// Step 3: Verify emails with Clearout
console.log('Step 3: Verifying emails with Clearout...\n');

const results = [];
for (const contact of enriched) {
  if (!contact.email) {
    results.push({ ...contact, emailStatus: 'no_email', safeToSend: false });
    console.log(`  ${contact.name}: no email to verify`);
    continue;
  }
  process.stdout.write(`  Verifying ${contact.email}... `);
  const verification = await verifyEmail(contact.email);
  results.push({ ...contact, emailStatus: verification.status, safeToSend: verification.safe_to_send, catchAll: verification.catch_all });
  console.log(`${verification.status}${verification.catch_all ? ' (catch-all)' : ''}`);
  await new Promise(r => setTimeout(r, 200));
}

console.log('\n--- Results ---');
results.forEach(r => {
  const emailInfo = r.email ? `${r.email} [${r.emailStatus}${r.catchAll ? ', catch-all' : ''}]` : 'no email';
  console.log(`  ${r.name} | ${r.title} | ${emailInfo}`);
});

// Step 4: Build contact objects and update DB via SQL
console.log('\nStep 4: Updating Supabase...\n');

// Keep contacts with valid/catch-all emails, or those with no email (still valuable for outreach planning)
const contacts = results.map(r => ({
  id: `contact-apollo-${r.apolloId}`,
  name: r.name,
  role: r.title,
  email: r.email || '',
  phone: '',
  linkedIn: r.linkedin || '',
  emailVerified: r.safeToSend ? 'valid' : r.emailStatus === 'no_email' ? '' : r.emailStatus,
}));

// Print SQL for manual execution via MCP if needed
console.log('\nContacts to upsert:');
contacts.forEach(c => console.log(`  ${c.name} | ${c.role} | ${c.email} | verified: ${c.emailVerified}`));

// Output JSON for MCP upsert
console.log('\n--- CONTACTS JSON (for DB update) ---');
console.log(JSON.stringify(contacts, null, 2));
