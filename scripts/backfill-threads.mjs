#!/usr/bin/env node
/**
 * backfill-threads.mjs
 *
 * One-time utility to retroactively populate email_threads from Gmail sent history.
 * For each prospect's contacts, searches Gmail for sent emails and logs the thread IDs.
 * Run this once so your existing sent emails are tracked by check-replies.mjs.
 *
 * Usage:
 *   node scripts/backfill-threads.mjs --all                    ← all prospects with contacts
 *   node scripts/backfill-threads.mjs --prospect-id <uuid>     ← single prospect
 *   node scripts/backfill-threads.mjs --dry-run                ← preview without writing
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

const SUPABASE_URL   = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY         = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CLIENT_ID      = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET  = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN  = env.GOOGLE_REFRESH_TOKEN;

const args           = process.argv.slice(2);
const getFlag        = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const PROSPECT_ID    = getFlag('--prospect-id');
const ALL            = args.includes('--all');
const DRY_RUN        = args.includes('--dry-run');

if (!PROSPECT_ID && !ALL) {
  console.error('Usage: node scripts/backfill-threads.mjs --all | --prospect-id <uuid> [--dry-run]');
  process.exit(1);
}

async function getGmailToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gmail token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
  return res.json();
}

async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${await res.text()}`);
}

async function searchGmailSent(token, toEmail, maxResults = 3) {
  const q = encodeURIComponent(`in:sent to:${toEmail}`);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${q}&maxResults=${maxResults}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.messages || [];
}

async function getMessageMeta(token, msgId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Subject&metadataHeaders=Message-ID&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  return res.json();
}

console.log(`\n🔄 Backfilling email threads${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

// Fetch prospects
let prospectsQuery = `prospects?select=id,company_name,contacts`;
if (PROSPECT_ID) prospectsQuery += `&id=eq.${PROSPECT_ID}`;
const prospects = await sbGet(prospectsQuery);
console.log(`  ${prospects.length} prospect(s) to process\n`);

// Get already-tracked thread contact emails to avoid duplicates
const existingRows = await sbGet('email_threads?select=contact_email');
const alreadyTracked = new Set(existingRows.map(r => r.contact_email));

const token = await getGmailToken();
let totalFound = 0;
let totalInserted = 0;

for (const prospect of prospects) {
  const contacts = (prospect.contacts || []).filter(c => c.email && !alreadyTracked.has(c.email));
  if (contacts.length === 0) continue;

  console.log(`  ${prospect.company_name} (${contacts.length} new contact(s))`);

  for (const contact of contacts) {
    const messages = await searchGmailSent(token, contact.email);
    if (messages.length === 0) continue;

    // Use the most recent sent message
    const msg = messages[0];
    const meta = await getMessageMeta(token, msg.id);
    if (!meta) continue;

    const subject = meta.payload?.headers?.find(h => h.name === 'Subject')?.value || '';
    const rfcId   = meta.payload?.headers?.find(h => h.name === 'Message-ID')?.value || '';

    totalFound++;
    console.log(`    ✓ ${contact.name || contact.email} — "${subject}"`);

    if (!DRY_RUN) {
      await sbPost('email_threads', {
        prospect_id: prospect.id,
        contact_email: contact.email,
        contact_name: contact.name || null,
        gmail_thread_id: meta.threadId,
        gmail_message_id: rfcId || meta.id,
        subject,
        sequence_number: 1,
        sent_at: meta.internalDate ? new Date(parseInt(meta.internalDate)).toISOString() : new Date().toISOString(),
      });
      alreadyTracked.add(contact.email);
      totalInserted++;
    }

    await new Promise(r => setTimeout(r, 150));
  }
}

console.log(`\n--- Summary ---`);
console.log(`  ${totalFound} sent email(s) found in Gmail`);
if (!DRY_RUN) console.log(`  ${totalInserted} email_thread row(s) inserted`);
else console.log('  [Dry run — nothing inserted]');
console.log();
