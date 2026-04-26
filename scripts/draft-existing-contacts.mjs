#!/usr/bin/env node
/**
 * Create Gmail drafts for existing CRM contacts only — no Apollo enrichment.
 *
 * Usage:
 *   node scripts/draft-existing-contacts.mjs \
 *     --prospect-id <uuid> \
 *     --company "Company Name" \
 *     --market-type "Spas & Hot Tubs" \
 *     --contacts <base64-json>
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

const args = process.argv.slice(2);
const getFlag = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };

const PROSPECT_ID = getFlag('--prospect-id');
const COMPANY     = getFlag('--company');
const MARKET_TYPE = getFlag('--market-type');
const CONTACTS_B64 = getFlag('--contacts');

if (!PROSPECT_ID || !COMPANY || !CONTACTS_B64) {
  console.error('Usage: node scripts/draft-existing-contacts.mjs --prospect-id <uuid> --company "Name" --market-type "Type" --contacts <base64>');
  process.exit(1);
}

const contacts = JSON.parse(Buffer.from(CONTACTS_B64, 'base64').toString('utf8'));

const FROM       = 'samir@canopuswatertechnologies.com';
const DRIVE_LINK = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';

const HOOKS = {
  'Ice Machines':        `Several ice machine OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Water Coolers':       `Several water cooler OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Fountains':           `Several water fountain OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Beverage Dispensers': `Several beverage dispensing OEMs now prefer our LED based UV-C systems for keeping water lines clean since they're compact, long-lasting, and don't affect water temperatures.`,
  'Water Filtration':    `Several water filtration OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'Spas & Hot Tubs':     `Several spa and hot tub OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and easy to maintain.`,
  'Industrial':          `Several industrial water treatment OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'default':             `Several water treatment companies now prefer our LED based UV-C systems because they are compact, mercury-free, long-lasting, and the external maintenance only takes seconds.`,
};

const hook = HOOKS[MARKET_TYPE] || HOOKS['default'];

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img data-aii="CiExTVJyMFlBWUJMUFVUVnpJbXFpUjZSNWZWM1prcHRHdy0" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l" data-os="https://lh3.googleusercontent.com/d/1MRr0YAYBLPUTVzImqiR6R5fV3ZkptGw-"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font><a href="http://linkedin.com/company/canopus-water-tech" title="" style="color:rgb(17,85,204);font-family:ARIAL;font-size:13.3333px" target="_blank"><img src="https://ci3.googleusercontent.com/meips/ADKq_NbJ5G4vDTIjULf2Brm-nHPca2_m1oqvxln5IPslZieOOvuq9FdIqfiqRqWLkSKeaMlFn2jsgSv_rSpc2kKIAU4SPhLCkvif1CCc7QG2bQybLglFt84YRPTa8sXUn8pOBvvqOIQu5C5pAA=s0-d-e1-ft#https://media2.thegranitegroup.com/TGG_Email_Signatures/whitebackround/LinkedIn.png" border="0" alt="linkedin.com/company/canopus-water-tech"></a></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

function buildEmail(firstName) {
  return `<div dir="ltr">
Hey ${firstName},<br><br>
${hook}<br><br>
You can find our brochure and tech sheets here: <a href="${DRIVE_LINK}">${DRIVE_LINK}</a><br><br>
Let me know your availability this week or the next for a technical discussion on how we can best support your applications at ${COMPANY}.<br><br>
${SIGNATURE}
</div>`;
}

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
  if (!data.access_token) throw new Error('Failed to get Gmail token: ' + JSON.stringify(data));
  return data.access_token;
}

function makeMime(to, htmlBody) {
  const subject = `LED UVs for ${COMPANY}`;
  const raw = [`From: ${FROM}`, `To: ${to}`, `Subject: ${subject}`, `MIME-Version: 1.0`,
               `Content-Type: text/html; charset=UTF-8`, ``, htmlBody].join('\r\n');
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

// --- Main ---
console.log(`\nDrafting for ${COMPANY} — ${contacts.length} existing contact(s)`);
console.log(`Hook: "${hook.slice(0, 80)}..."\n`);

const token = await getGmailToken();
console.log('✓ Gmail token OK\n');

const pendingSQL = [];
let count = 0;

for (const contact of contacts) {
  if (!contact.email) { console.log(`  ⚠ ${contact.name} — no email, skipped`); continue; }
  const firstName = contact.name.split(' ')[0];
  const html = buildEmail(firstName);
  const raw = makeMime(contact.email, html);
  await createDraft(token, raw);
  console.log(`  ✓ ${firstName} <${contact.email}>`);
  count++;
}

const today = new Date().toISOString().slice(0, 10);
const engagement = {
  id: `eng-agent-${Date.now()}`,
  date: today,
  type: 'email',
  summary: `Sent standard intro email (LED UV-C) to ${count} contact${count !== 1 ? 's' : ''} at ${COMPANY}.`,
  activity: { emails: count },
  loggedBy: 'Samir Chibane',
};
const engJson = JSON.stringify([engagement]).replace(/'/g, "''");
pendingSQL.push(`UPDATE prospects SET engagements = '${engJson}'::jsonb, last_contact = '${today}', updated_at = NOW() WHERE id = '${PROSPECT_ID}';`);

console.log(`\n  ${count} draft(s) created\n`);
console.log('--- PENDING SQL (run via Supabase MCP) ---\n');
pendingSQL.forEach(s => console.log(s));
