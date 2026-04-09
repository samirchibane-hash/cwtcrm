#!/usr/bin/env node
/**
 * Enrich Haws Co contacts via Apollo people/match by known email,
 * then save to the Haws prospect in Supabase CRM.
 *
 * Emails are already confirmed (previously sent), so no Clearout needed.
 * Usage: node scripts/apollo-hawsco-contacts.mjs
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
const SUPABASE_URL = `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const PROSPECT_ID  = 'da4c12f1-4986-41c5-ba11-2be68f3dec5b'; // Haws

if (!APOLLO_KEY) { console.error('Missing APOLLO_API in .env'); process.exit(1); }

// Known contacts from Gmail outreach — emails confirmed by sending
const KNOWN_CONTACTS = [
  { email: 'dominicg@hawsco.com', firstName: 'Dominic' },
  { email: 'chuckg@hawsco.com',   firstName: 'Chuck' },
  { email: 'johnu@hawsco.com',    firstName: 'John' },
  { email: 'masonb@hawsco.com',   firstName: 'Mason' },
  { email: 'dylann@hawsco.com',   firstName: 'Dylan' },
  { email: 'johnavong@hawsco.com',firstName: 'Johnavon' },
  { email: 'josephp@hawsco.com',  firstName: 'Joseph' },
];

// --- Apollo people/match by email ---
async function apolloMatchByEmail(email) {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ email, reveal_personal_emails: false }),
  });
  if (!res.ok) throw new Error(`Apollo match ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.person || null;
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
console.log('\nStep 1: Enriching Haws Co contacts via Apollo people/match...\n');

const enriched = [];
for (const contact of KNOWN_CONTACTS) {
  process.stdout.write(`  ${contact.email.padEnd(30)} → `);
  try {
    const person = await apolloMatchByEmail(contact.email);
    if (person) {
      enriched.push({
        apolloId: person.id,
        name: person.name || `${person.first_name} ${person.last_name}`.trim(),
        title: person.title || '',
        email: contact.email, // use confirmed email, not Apollo's
        linkedIn: person.linkedin_url || '',
      });
      console.log(`${person.name} | ${person.title || 'no title'} | ${person.linkedin_url ? 'LinkedIn ✓' : 'no LinkedIn'}`);
    } else {
      // Apollo didn't find them — still add with what we know
      enriched.push({
        apolloId: null,
        name: contact.firstName,
        title: '',
        email: contact.email,
        linkedIn: '',
      });
      console.log('not found in Apollo — adding email only');
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
    enriched.push({ apolloId: null, name: contact.firstName, title: '', email: contact.email, linkedIn: '' });
  }
  await new Promise(r => setTimeout(r, 400));
}

console.log(`\nEnriched ${enriched.length} contacts\n`);

// Step 2: Merge into Supabase
console.log('Step 2: Saving to Supabase...\n');

const existing = await getExistingContacts();
const existingEmails = new Set(existing.map(c => c.email).filter(Boolean));

const toAdd = enriched
  .filter(r => !existingEmails.has(r.email))
  .map(r => ({
    id: r.apolloId ? `contact-apollo-${r.apolloId}` : `contact-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    name: r.name,
    role: r.title,
    email: r.email,
    phone: '',
    linkedIn: r.linkedIn,
    emailVerified: true, // confirmed by prior sending
  }));

const skipped = enriched.length - toAdd.length;
if (skipped > 0) console.log(`Skipping ${skipped} duplicate(s) already in DB.`);

if (toAdd.length === 0) {
  console.log('No new contacts to add.');
} else {
  const merged = [...existing, ...toAdd];
  const saved = await saveContacts(merged);

  if (saved) {
    console.log(`Added ${toAdd.length} contact(s) to Haws:\n`);
    toAdd.forEach(c => {
      console.log(`  + ${c.name} | ${c.role || '(no title)'}`);
      console.log(`    ${c.email}`);
      if (c.linkedIn) console.log(`    ${c.linkedIn}`);
    });
  } else {
    console.log('SUPABASE_SERVICE_ROLE_KEY not in .env — DB save skipped.');
    console.log('Run this SQL via Supabase MCP:\n');
    const merged = [...existing, ...toAdd];
    console.log(`UPDATE prospects SET contacts = '${JSON.stringify(merged)}'::jsonb, updated_at = NOW() WHERE id = '${PROSPECT_ID}';`);
  }
}

console.log('\n--- SUMMARY ---');
console.log(`  Total contacts processed: ${enriched.length}`);
console.log(`  Apollo matches: ${enriched.filter(e => e.apolloId).length}`);
console.log(`  With LinkedIn: ${enriched.filter(e => e.linkedIn).length}`);
console.log(`  With title: ${enriched.filter(e => e.title).length}`);
console.log('\nDone.');
