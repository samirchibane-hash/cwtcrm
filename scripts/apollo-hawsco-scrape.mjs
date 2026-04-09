#!/usr/bin/env node
/**
 * Scrape Haws Co contacts from Apollo by domain, construct emails using
 * the confirmed pattern ({firstname}{last_initial}@hawsco.com), verify
 * with Clearout, and save new contacts to Supabase CRM.
 *
 * Usage: node scripts/apollo-hawsco-scrape.mjs
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
const PROSPECT_ID  = 'da4c12f1-4986-41c5-ba11-2be68f3dec5b'; // Haws
const DOMAIN       = 'hawsco.com';

if (!APOLLO_KEY)   { console.error('Missing APOLLO_API in .env'); process.exit(1); }
if (!CLEAROUT_KEY) { console.error('Missing CLEAROUT_API_KEY in .env'); process.exit(1); }

// Standard CWT role filters
const SENIORITIES     = ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'];
const TITLE_KEYWORDS  = [
  'engineer', 'engineering', 'product developer', 'product development',
  'purchasing', 'procurement', 'service manager',
];
const SKIP_TITLES = ['marketing', 'finance', 'accounting', 'warehouse', 'intern', 'co-op', 'operator', 'technician'];

// --- Apollo ---
async function apolloSearch(page = 1) {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({
      q_organization_domains: DOMAIN,
      person_seniorities: SENIORITIES,
      person_titles: TITLE_KEYWORDS,
      page,
      per_page: 25,
    }),
  });
  if (!res.ok) throw new Error(`Apollo search ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apolloMatchById(personId) {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
  });
  if (!res.ok) throw new Error(`Apollo match ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.person || null;
}

// Build email from confirmed pattern: {firstname}{last_initial}@hawsco.com
function buildEmail(firstName, lastName) {
  if (!firstName || !lastName) return null;
  const first = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const lastInitial = lastName.toLowerCase().replace(/[^a-z]/g, '')[0];
  if (!lastInitial) return null;
  return `${first}${lastInitial}@${DOMAIN}`;
}

// --- Clearout ---
async function verifyEmail(email) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer:${CLEAROUT_KEY}` },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { status: 'error', safe_to_send: false, catch_all: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    safe_to_send: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
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
console.log(`\nStep 1: Searching Apollo for ${DOMAIN} contacts...\n`);

let allPeople = [];
for (let page = 1; page <= 5; page++) {
  const data = await apolloSearch(page);
  if (data.error) { console.error('Apollo error:', data.error); break; }
  const people = data.people || [];
  allPeople = allPeople.concat(people);
  console.log(`  Page ${page}: ${people.length} results (total: ${allPeople.length})`);
  if (people.length < 25) break;
  await new Promise(r => setTimeout(r, 300));
}
console.log(`\nTotal from Apollo: ${allPeople.length} people`);

// Filter irrelevant roles
const relevant = allPeople.filter(p =>
  p.first_name &&
  !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s))
);
console.log(`After role filter: ${relevant.length} contacts\n`);

if (relevant.length === 0) { console.log('No contacts found. Exiting.'); process.exit(0); }

// Step 2: Enrich to get full last names + LinkedIn
console.log('Step 2: Enriching via Apollo people/match...\n');

const enriched = [];
for (const person of relevant) {
  process.stdout.write(`  ${person.first_name} ${person.last_name_obfuscated || '?'}... `);
  try {
    const full = await apolloMatchById(person.id);
    if (full) {
      const constructed = buildEmail(full.first_name, full.last_name);
      // Prefer constructed pattern email; only fall back to Apollo email if we can't build one
      const email = constructed || full.email || null;
      enriched.push({
        apolloId: person.id,
        name: full.name || `${full.first_name} ${full.last_name}`.trim(),
        firstName: full.first_name,
        lastName: full.last_name,
        title: full.title || person.title || '',
        email,
        linkedIn: full.linkedin_url || '',
      });
      console.log(`${full.name} | ${full.title || 'no title'} | email: ${email || 'none'}`);
    } else {
      console.log('no result');
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  await new Promise(r => setTimeout(r, 400));
}
console.log(`\nEnriched: ${enriched.length} contacts\n`);

// Step 3: Verify emails with Clearout
console.log('Step 3: Verifying emails with Clearout...\n');

const results = [];
for (const contact of enriched) {
  if (!contact.email) {
    results.push({ ...contact, emailStatus: 'no_email', safeToSend: false, catchAll: false });
    console.log(`  ${contact.name}: no email constructed`);
    continue;
  }
  process.stdout.write(`  ${contact.email.padEnd(35)} → `);
  const v = await verifyEmail(contact.email);
  results.push({ ...contact, emailStatus: v.status, safeToSend: v.safe_to_send, catchAll: v.catch_all });
  console.log(`${v.status}${v.catch_all ? ' (catch-all)' : ''}`);
  await new Promise(r => setTimeout(r, 200));
}

// Step 4: Save to Supabase
console.log('\nStep 4: Saving to Supabase...\n');

const existing = await getExistingContacts();
const existingEmails = new Set(existing.map(c => c.email).filter(Boolean));
const existingApolloIds = new Set(existing.map(c => c.id).filter(Boolean));

const toAdd = results
  // include valid OR catch-all (domain is confirmed catch-all; pattern is confirmed reliable)
  .filter(r => r.email && (r.safeToSend || r.catchAll || r.emailStatus === 'catch_all'))
  .filter(r => !existingEmails.has(r.email) && !existingApolloIds.has(`contact-apollo-${r.apolloId}`))
  .map(r => ({
    id: `contact-apollo-${r.apolloId}`,
    name: r.name,
    role: r.title,
    email: r.email,
    phone: '',
    linkedIn: r.linkedIn,
    emailVerified: r.safeToSend || false,
  }));

const skipped = results.filter(r => r.email).length - toAdd.length;
if (skipped > 0) console.log(`Skipping ${skipped} (duplicates or failed verification).`);

if (toAdd.length === 0) {
  console.log('No new contacts to add.');
} else {
  const merged = [...existing, ...toAdd];
  const saved = await saveContacts(merged);

  if (saved) {
    console.log(`\nAdded ${toAdd.length} new contact(s) to Haws:\n`);
    toAdd.forEach(c => {
      const tag = c.emailVerified ? '✅ valid' : '⚠️  catch-all';
      console.log(`  + ${c.name} | ${c.role || '(no title)'}`);
      console.log(`    ${c.email} [${tag}]`);
      if (c.linkedIn) console.log(`    ${c.linkedIn}`);
    });
  } else {
    const merged = [...existing, ...toAdd];
    console.log('\nSUPABASE_SERVICE_ROLE_KEY not in .env — run this SQL:\n');
    console.log(`UPDATE prospects SET contacts = '${JSON.stringify(merged)}'::jsonb, updated_at = NOW() WHERE id = '${PROSPECT_ID}';`);
  }
}

// Summary
console.log('\n--- SUMMARY ---');
const valid    = results.filter(r => r.safeToSend);
const catchAll = results.filter(r => (r.catchAll || r.emailStatus === 'catch_all') && !r.safeToSend);
const failed   = results.filter(r => !r.safeToSend && !r.catchAll && r.emailStatus !== 'catch_all' && r.email);
const noEmail  = results.filter(r => !r.email);
console.log(`  Total scraped:  ${results.length}`);
console.log(`  ✅ Valid:       ${valid.length}`);
console.log(`  ⚠️  Catch-all:  ${catchAll.length}`);
console.log(`  ❌ Failed:      ${failed.length}`);
console.log(`  ❌ No email:    ${noEmail.length}`);
console.log(`  Added to DB:    ${toAdd.length}`);
console.log('\nDone.');
