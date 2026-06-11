#!/usr/bin/env node
/**
 * check-replies.mjs
 *
 * Scans all open Gmail threads (from email_threads table) for replies.
 * Marks any thread where someone other than Samir replied as responded=true.
 *
 * Usage:
 *   node scripts/check-replies.mjs [--dry-run] [--update-stage]
 *
 *   --dry-run       Print what would change without writing to DB
 *   --update-stage  Set prospect stage to "Contact Made" if a reply is detected
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

const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CLIENT_ID     = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;
const FROM_EMAIL    = 'samir@canopuswatertechnologies.com';

const DRY_RUN      = process.argv.includes('--dry-run');
const UPDATE_STAGE = process.argv.includes('--update-stage');

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

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

async function getGmailThread(token, threadId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err?.error?.code === 404) return null; // thread deleted
    throw new Error(`Gmail thread ${threadId}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

function hasReply(thread) {
  if (!thread?.messages?.length) return false;
  // Skip the first message (our outbound). Look for any From that isn't us.
  return thread.messages.slice(1).some(msg => {
    const from = msg.payload?.headers?.find(h => h.name === 'From')?.value ?? '';
    return !from.toLowerCase().includes(FROM_EMAIL.toLowerCase());
  });
}

console.log(`\n🔍 Checking Gmail threads for replies${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

const threads = await sbGet('email_threads?responded=eq.false&skipped=eq.false&select=id,prospect_id,contact_email,contact_name,gmail_thread_id,subject&order=sent_at.asc');
console.log(`  ${threads.length} open thread(s) to check\n`);

const token = await getGmailToken();

let replied = 0;
let notFound = 0;
const repliedProspects = new Set();

for (const thread of threads) {
  let gmailThread;
  try {
    gmailThread = await getGmailThread(token, thread.gmail_thread_id);
  } catch (e) {
    console.error(`  ✗ ${thread.contact_email}: ${e.message}`);
    continue;
  }

  if (!gmailThread) {
    notFound++;
    continue;
  }

  if (hasReply(gmailThread)) {
    console.log(`  ✓ Reply found: ${thread.contact_name || thread.contact_email} — "${thread.subject}"`);
    replied++;
    repliedProspects.add(thread.prospect_id);

    if (!DRY_RUN) {
      await sbPatch(`email_threads?id=eq.${thread.id}`, {
        responded: true,
        responded_at: new Date().toISOString(),
      });
    }
  }

  await new Promise(r => setTimeout(r, 100)); // gentle rate limiting
}

if (UPDATE_STAGE && repliedProspects.size > 0 && !DRY_RUN) {
  for (const prospectId of repliedProspects) {
    await sbPatch(`prospects?id=eq.${prospectId}`, { stage: 'Contact Made' });
  }
  console.log(`\n  ✓ Updated stage to "Contact Made" for ${repliedProspects.size} prospect(s)`);
}

console.log(`\n--- Summary ---`);
console.log(`  ${replied} new reply(s) detected`);
console.log(`  ${threads.length - replied - notFound} thread(s) still silent`);
if (notFound > 0) console.log(`  ${notFound} thread(s) not found in Gmail (deleted?)`);
if (DRY_RUN) console.log('\n  [Dry run — no changes written]\n');
console.log();
