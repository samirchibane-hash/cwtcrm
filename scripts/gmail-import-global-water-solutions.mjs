#!/usr/bin/env node
/**
 * Scrape Gmail for all @globalwatersolutions.com contacts, enrich via Apollo,
 * verify with Clearout, then import into Supabase.
 *
 * Usage: node scripts/gmail-import-global-water-solutions.mjs [--dry-run]
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
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DOMAIN       = 'globalwatersolutions.com';
const PROSPECT_ID  = '3d7ba2aa-4e21-43fd-93bd-205017b88d6c';

const DRY_RUN = process.argv.includes('--dry-run');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- Gmail ---
async function getGmailToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.VITE_GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gmail token failed: ' + JSON.stringify(data));
  return data.access_token;
}

function extractDomainEmails(headerVal) {
  if (!headerVal) return [];
  const found = [];
  const re = /[\w.+%-]+@globalwatersolutions\.com/gi;
  let m;
  while ((m = re.exec(headerVal)) !== null) {
    found.push(m[0].toLowerCase());
  }
  return found;
}

function extractName(headerVal, email) {
  if (!headerVal) return '';
  const segments = headerVal.split(',').map(s => s.trim());
  for (const seg of segments) {
    if (seg.toLowerCase().includes(email.toLowerCase())) {
      const nameMatch = seg.match(/^(.+?)\s*<[^>]+>/);
      if (nameMatch) return nameMatch[1].trim().replace(/^["']|["']$/g, '');
    }
  }
  return '';
}

async function scrapeGmailContacts(token) {
  console.log(`\nSearching Gmail for @${DOMAIN} threads...`);
  const emailMap = new Map();

  let pageToken = null;
  let totalMessages = 0;

  do {
    const params = new URLSearchParams({ q: `@${DOMAIN}`, maxResults: '500' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const data = await res.json();
    if (!data.messages?.length) break;
    totalMessages += data.messages.length;
    console.log(`  Fetched ${totalMessages} message IDs so far...`);

    for (const { id } of data.messages) {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Cc`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const msg = await msgRes.json();
      const headers = Object.fromEntries(
        (msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value])
      );

      for (const field of ['from', 'to', 'cc']) {
        const emails = extractDomainEmails(headers[field] || '');
        for (const email of emails) {
          if (!emailMap.has(email)) {
            const name = extractName(headers[field] || '', email);
            emailMap.set(email, { name, internalDate: msg.internalDate });
          }
        }
      }
      await sleep(30);
    }

    pageToken = data.nextPageToken || null;
  } while (pageToken);

  console.log(`\nFound ${emailMap.size} unique @${DOMAIN} address(es) across ${totalMessages} messages.`);
  return emailMap;
}

// --- Apollo ---
async function apolloMatchByEmail(email, name) {
  const body = { email, reveal_personal_emails: false };
  if (name) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      body.first_name = parts[0];
      body.last_name = parts.slice(1).join(' ');
    }
  }
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify(body),
  });
  if (!res.ok) return null;
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
  if (!res.ok) return { status: 'error', verified: false, catchAll: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    verified: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
    catchAll: data.data?.is_catch_all === 'yes',
  };
}

// --- Supabase ---
async function getExistingContacts() {
  const key = env.SUPABASE_SERVICE_ROLE_KEY || SB_KEY;
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}&select=id,company_name,contacts`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } }
  );
  const rows = await res.json();
  if (!Array.isArray(rows) || !rows[0]) throw new Error('Global Water Solutions not found in Supabase');
  console.log(`  Found: ${rows[0].company_name} (${rows[0].id})`);
  return Array.isArray(rows[0].contacts) ? rows[0].contacts : [];
}

async function saveContacts(contacts) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    const json = JSON.stringify(contacts).replace(/'/g, "''");
    console.log('\n-- Run this SQL in Supabase:');
    console.log(`UPDATE prospects SET contacts = '${json}'::jsonb, updated_at = NOW() WHERE id = '${PROSPECT_ID}';`);
    return false;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}`, {
    method: 'PATCH',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ contacts, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase update failed ${res.status}: ${await res.text()}`);
  return true;
}

// --- Main ---
console.log(`\nGmail → Apollo → Clearout → Supabase import for @${DOMAIN}`);
if (DRY_RUN) console.log('DRY RUN — no writes');

const token = await getGmailToken();
const emailMap = await scrapeGmailContacts(token);

if (emailMap.size === 0) {
  console.log('No contacts found. Exiting.');
  process.exit(0);
}

console.log('\nEmails found:');
for (const [email, meta] of emailMap) {
  console.log(`  ${email}${meta.name ? ` (${meta.name})` : ''}`);
}

// Step 2: Apollo enrichment
console.log('\nStep 2: Enriching via Apollo people/match...');
const enriched = [];
for (const [email, meta] of emailMap) {
  process.stdout.write(`  ${email.padEnd(45)} → `);
  try {
    const person = await apolloMatchByEmail(email, meta.name);
    if (person) {
      enriched.push({
        apolloId: person.id,
        name: person.name || `${person.first_name} ${person.last_name}`.trim(),
        title: person.title || '',
        email: person.email || email,
        linkedIn: person.linkedin_url || '',
        _gmailName: meta.name,
      });
      console.log(`${person.name} | ${person.title || 'no title'}`);
    } else {
      const name = meta.name || email.split('@')[0];
      enriched.push({
        apolloId: null,
        name,
        title: '',
        email,
        linkedIn: '',
        _gmailName: meta.name,
        _apolloMiss: true,
      });
      console.log(`not found in Apollo — keeping Gmail record`);
    }
  } catch (e) {
    console.log(`error: ${e.message}`);
  }
  await sleep(400);
}

// Step 3: Clearout verification
console.log('\nStep 3: Verifying emails with Clearout...');
const verified = [];
for (const contact of enriched) {
  process.stdout.write(`  ${contact.email.padEnd(45)} → `);
  const v = await verifyEmail(contact.email);
  verified.push({ ...contact, emailStatus: v.status, emailVerified: v.verified, catchAll: v.catchAll });
  console.log(`${v.status}${v.catchAll ? ' (catch-all)' : ''}`);
  await sleep(250);
}

// Step 4: Load existing contacts & dedup
console.log('\nStep 4: Looking up Global Water Solutions in Supabase...');
const existing = await getExistingContacts();
console.log(`  Existing contacts: ${existing.length}`);

const existingKeys = new Set([
  ...existing.map(c => c.email?.toLowerCase()).filter(Boolean),
  ...existing.map(c => c.linkedIn).filter(Boolean),
  ...existing.map(c => c.id).filter(Boolean),
]);

const toAdd = verified
  .filter(c => !existingKeys.has(c.email?.toLowerCase()) &&
               !existingKeys.has(c.linkedIn) &&
               !(c.apolloId && existingKeys.has(`contact-apollo-${c.apolloId}`)))
  .map(c => ({
    id: c.apolloId ? `contact-apollo-${c.apolloId}` : `contact-gmail-${c.email.replace(/[@.]/g, '-')}`,
    name: c.name,
    role: c.title,
    email: c.email,
    phone: '',
    linkedIn: c.linkedIn,
    ...(c.emailVerified ? { emailVerified: true } : {}),
    ...(c.catchAll ? { catchAll: true } : {}),
  }));

const dupes = verified.length - toAdd.length;
console.log(`\n  New to add: ${toAdd.length} | Already in CRM: ${dupes}`);

if (toAdd.length === 0) {
  console.log('\nAll contacts already in CRM. Nothing to import.');
  process.exit(0);
}

console.log('\nContacts to import:');
toAdd.forEach(c => {
  const tag = c.emailVerified ? '✅ valid' : c.catchAll ? '⚠️  catch-all' : '❓ unverified';
  console.log(`  + ${c.name.padEnd(30)} | ${(c.role || 'no title').padEnd(30)} | ${c.email} [${tag}]`);
});

if (DRY_RUN) {
  console.log('\nDRY RUN — skipping Supabase write.');
  process.exit(0);
}

// Step 5: Save
console.log('\nStep 5: Saving to Supabase...');
const merged = [...existing, ...toAdd];
const saved = await saveContacts(merged);
if (saved) {
  console.log(`  Saved ${toAdd.length} contact(s) to Global Water Solutions.`);
}
console.log('\nDone.');
