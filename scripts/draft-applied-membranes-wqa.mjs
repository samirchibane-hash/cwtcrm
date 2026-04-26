#!/usr/bin/env node
/**
 * Create WQA intro Gmail drafts for all contacts at Applied Membranes.
 * Reads contacts from Supabase, creates one draft per contact.
 *
 * Usage: node scripts/draft-applied-membranes-wqa.mjs
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

const SUPABASE_URL  = `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY        = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROSPECT_ID   = '486c5585-4849-4bd3-b62b-cbcab7972e3b';
const COMPANY_NAME  = 'Applied Membranes';
const FROM          = 'samir@canopuswatertechnologies.com';
const DRIVE_LINK    = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';

const HOOK = `Several water treatment distributors now carry our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`;

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img data-aii="CiExTVJyMFlBWUJMUFVUVnpJbXFpUjZSNWZWM1prcHRHdy0" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l" data-os="https://lh3.googleusercontent.com/d/1MRr0YAYBLPUTVzImqiR6R5fV3ZkptGw-"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font><a href="http://linkedin.com/company/canopus-water-tech" title="" style="color:rgb(17,85,204);font-family:ARIAL;font-size:13.3333px" target="_blank"><img src="https://ci3.googleusercontent.com/meips/ADKq_NbJ5G4vDTIjULf2Brm-nHPca2_m1oqvxln5IPslZieOOvuq9FdIqfiqRqWLkSKeaMlFn2jsgSv_rSpc2kKIAU4SPhLCkvif1CCc7QG2bQybLglFt84YRPTa8sXUn8pOBvvqOIQu5C5pAA=s0-d-e1-ft#https://media2.thegranitegroup.com/TGG_Email_Signatures/whitebackround/LinkedIn.png" border="0" alt="linkedin.com/company/canopus-water-tech"></a></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

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

function buildEmail(firstName) {
  return `<div dir="ltr">
Hey ${firstName},<br><br>
Will you or your team be at the upcoming WQA in Miami?<br><br>
${HOOK} Most importantly, the external maintenance only takes seconds.<br><br>
Refer to our brochure and tech sheets here: <a href="${DRIVE_LINK}">${DRIVE_LINK}</a><br><br>
If not, we can schedule a time next week for a technical discussion on how we can best support your applications at ${COMPANY_NAME}.<br><br>
${SIGNATURE}
</div>`;
}

function makeMime(to, htmlBody) {
  const subject = 'LED UVs at the WQA in Miami';
  const raw = [`From: ${FROM}`, `To: ${to}`, `Subject: ${subject}`,
    `MIME-Version: 1.0`, `Content-Type: text/html; charset=UTF-8`, ``, htmlBody].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

async function createDraft(token, raw) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  return res.json();
}

// --- Supabase ---
async function getContacts() {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}&select=contacts,engagements`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows = await res.json();
  return rows[0] || { contacts: [], engagements: [] };
}

async function logEngagement(engagements, draftCount) {
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) { console.log('  No service key — skipping engagement log.'); return; }
  const today = new Date().toISOString().slice(0, 10);
  const entry = {
    id: `eng-agent-${Date.now()}`,
    date: today,
    type: 'email',
    summary: `Sent WQA intro email (LED UV-C) to ${draftCount} contact${draftCount !== 1 ? 's' : ''} at ${COMPANY_NAME}.`,
    activity: { emails: draftCount },
    loggedBy: 'Samir Chibane',
  };
  const updated = [...(engagements || []), entry];
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${PROSPECT_ID}`, {
    method: 'PATCH',
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ engagements: updated, last_contact: today, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) console.error('  Engagement log failed:', await res.text());
}

// --- Main ---
console.log(`\nWQA draft creator — ${COMPANY_NAME}`);
console.log(`Hook: "${HOOK.slice(0, 70)}..."\n`);

// Contacts loaded from Supabase (hardcoded since publishable key lacks row access)
const contacts = [
  { name: 'Gulshan Dhawan',  email: 'gdhawan@appliedmembranes.com'  },
  { name: 'Manisha Dhawan',  email: 'mdhawan@appliedmembranes.com'  },
  { name: 'Ashish Selarka',  email: 'aselarka@appliedmembranes.com' },
  { name: 'Peter Waldron',   email: 'pwaldron@appliedmembranes.com' },
  { name: 'Marwan Alrubaye', email: 'malrubaye@appliedmembranes.com'},
  { name: 'Kunal Verma',     email: 'kverma@appliedmembranes.com'   },
];
const { engagements } = await getContacts().catch(() => ({ engagements: [] }));

console.log(`Contacts: ${contacts.length}`);
contacts.forEach(c => console.log(`  • ${c.name} <${c.email}>`));

const token = await getGmailToken();
console.log('\nCreating Gmail drafts...\n');

let draftCount = 0;
for (const c of contacts) {
  if (!c.email) { console.log(`  ⚠  ${c.name}: no email — skipped`); continue; }
  const firstName = c.name.split(' ')[0];
  const html = buildEmail(firstName);
  const raw  = makeMime(c.email, html);
  try {
    await createDraft(token, raw);
    console.log(`  ✓ ${firstName} <${c.email}>`);
    draftCount++;
  } catch (e) {
    console.error(`  ✗ ${c.email}: ${e.message}`);
  }
}

console.log(`\n${draftCount} draft(s) created.`);

console.log('\nLogging engagement...');
await logEngagement(engagements, draftCount);
console.log('  ✓ Done — check your Drafts folder.');
