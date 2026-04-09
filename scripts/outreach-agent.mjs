#!/usr/bin/env node
/**
 * Unified outreach agent — Apollo search → Clearout verify → Supabase import → Gmail drafts → engagement log
 *
 * Usage:
 *   node scripts/outreach-agent.mjs "Company Name" [--auto] [--dry-run] [--limit N]
 *
 *   --auto      Skip confirmation prompt (fully hands-free)
 *   --dry-run   Phase 1 only — discover contacts, print table, write nothing
 *   --limit N   Cap enrichment at N contacts (default 50, 0 = unlimited)
 */

import { readFileSync } from 'fs';
import { createInterface } from 'readline';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
);

// --- CLI args ---
const args = process.argv.slice(2);
const companyArg = args.find(a => !a.startsWith('--'));
const AUTO      = args.includes('--auto');
const DRY_RUN   = args.includes('--dry-run');
const limitIdx  = args.indexOf('--limit');
const LIMIT     = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 50;

// Optional flags to bypass CRM lookup (used when service role key is unavailable)
const getFlag = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const PROSPECT_ID_FLAG  = getFlag('--prospect-id');
const MARKET_TYPE_FLAG  = getFlag('--market-type');
const COMPANY_TYPE_FLAG = getFlag('--type');

if (!companyArg) {
  console.error('Usage: node scripts/outreach-agent.mjs "Company Name" [--auto] [--dry-run] [--limit N]');
  process.exit(1);
}

// --- Validate env ---
const REQUIRED = ['APOLLO_API', 'CLEAROUT_API_KEY', 'VITE_SUPABASE_PROJECT_ID',
                  'VITE_GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
for (const k of REQUIRED) {
  if (!env[k]) { console.error(`Missing ${k} in .env`); process.exit(1); }
}

const APOLLO_KEY   = env.APOLLO_API;
const CLEAROUT_KEY = env.CLEAROUT_API_KEY;
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const FROM         = 'samir@canopuswatertechnologies.com';
const SUBJECT      = 'LED UVs at the WQA in Miami';
const DRIVE_LINK   = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';

// Pass 1: catch all leadership (president, VP, C-suite, director) regardless of function
const LEADERSHIP_SENIORITIES = ['owner', 'founder', 'c_suite', 'vp', 'director'];

// Pass 2: catch specific roles at any seniority level
const ROLE_TITLES = [
  'engineer', 'engineering',
  'product manager', 'product management', 'product development', 'product director',
  'operations', 'supply chain',
  'procurement', 'purchasing',
  'business development',
  'r&d', 'research and development',
  'general manager', 'branch manager',
];

// Post-filter: remove roles that are never relevant to CWT outreach
const SKIP_TITLES = [
  'sales representative', 'sales rep', 'account executive', 'account manager',
  'regional sales manager', 'territory manager', 'territory sales',
  'inside sales', 'outside sales', 'sales associate',
  'warehouse', 'driver', 'delivery', 'forklift',
  'receptionist', 'administrator', 'administrative', 'dispatcher',
  'human resources', 'recruiter', 'talent acquisition',
  'finance manager', 'accounting', 'payroll', 'bookkeeper',
  'marketing coordinator', 'marketing specialist',
  'intern', 'co-op',
];

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img data-aii="CiExTVJyMFlBWUJMUFVUVnpJbXFpUjZSNWZWM1prcHRHdy0" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l" data-os="https://lh3.googleusercontent.com/d/1MRr0YAYBLPUTVzImqiR6R5fV3ZkptGw-"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font><a href="http://linkedin.com/company/canopus-water-tech" title="" style="color:rgb(17,85,204);font-family:ARIAL;font-size:13.3333px" target="_blank"><img src="https://ci3.googleusercontent.com/meips/ADKq_NbJ5G4vDTIjULf2Brm-nHPca2_m1oqvxln5IPslZieOOvuq9FdIqfiqRqWLkSKeaMlFn2jsgSv_rSpc2kKIAU4SPhLCkvif1CCc7QG2bQybLglFt84YRPTa8sXUn8pOBvvqOIQu5C5pAA=s0-d-e1-ft#https://media2.thegranitegroup.com/TGG_Email_Signatures/whitebackround/LinkedIn.png" border="0" alt="linkedin.com/company/canopus-water-tech"></a></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

// --- Hook lookup ---
const HOOKS = {
  'Ice Machines':        `Several ice machine OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Water Coolers':       `Several water cooler OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Fountains':           `Several water fountain OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures.`,
  'Beverage Dispensers': `Several beverage dispensing OEMs now prefer our LED based UV-C systems for keeping water lines clean since they're compact, long-lasting, and don't affect water temperatures.`,
  'Water Filtration':    `Several water filtration OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'Spas & Hot Tubs':     `Several spa and hot tub OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and easy to maintain.`,
  'Industrial':          `Several industrial water treatment OEMs now prefer our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'Distributor':         `Several water treatment distributors now carry our LED based UV-C systems because they are compact, mercury-free, and long-lasting.`,
  'default':             `Several water treatment companies now prefer our LED based UV-C systems because they are compact, mercury-free, long-lasting, and the external maintenance only takes seconds.`,
};

function selectHook(prospect) {
  if (prospect.market_type && HOOKS[prospect.market_type]) return HOOKS[prospect.market_type];
  if (prospect.type === 'Distributor') return HOOKS['Distributor'];
  console.warn(`  WARNING: no hook match for market_type="${prospect.market_type}" type="${prospect.type}" — using default`);
  return HOOKS['default'];
}

// --- Apollo ---
async function apolloFindOrg(name) {
  const res = await fetch('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ q_organization_name: name, page: 1, per_page: 5 }),
  });
  if (!res.ok) throw new Error(`Apollo org search ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return (data.organizations || [])[0] || null;
}

async function apolloSearchPass(orgId, filters, label) {
  const seen = new Map();
  for (let page = 1; page <= 20; page++) {
    const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
      body: JSON.stringify({ organization_ids: [orgId], ...filters, page, per_page: 25 }),
    });
    if (!res.ok) throw new Error(`Apollo search ${res.status}: ${await res.text()}`);
    const data = await res.json();
    if (data.error) { console.error(`  Apollo error (${label}):`, data.error); break; }
    const people = data.people || [];
    people.forEach(p => seen.set(p.id, p));
    process.stdout.write(`  [${label}] page ${page}: ${people.length} results\n`);
    if (people.length < 25) break;
    await new Promise(r => setTimeout(r, 300));
  }
  return [...seen.values()];
}

async function apolloSearchAll(orgId) {
  // Pass 1: all leadership — presidents, VPs, C-suite, directors (any function)
  const leadership = await apolloSearchPass(orgId, { person_seniorities: LEADERSHIP_SENIORITIES }, 'leadership');
  await new Promise(r => setTimeout(r, 400));
  // Pass 2: specific roles at any level — engineers, product, ops, procurement, biz dev
  const roles = await apolloSearchPass(orgId, { person_titles: ROLE_TITLES }, 'roles');
  // Merge and dedup by Apollo person ID
  const merged = new Map();
  [...leadership, ...roles].forEach(p => merged.set(p.id, p));
  return [...merged.values()];
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
  if (!res.ok) return { status: 'error', verified: false, catchAll: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    verified: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
    catchAll: data.data?.is_catch_all === 'yes',
  };
}

// --- Supabase ---
async function getProspect(name) {
  const encoded = encodeURIComponent(`*${name}*`);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?company_name=ilike.${encoded}&select=id,company_name,market_type,type,contacts,engagements`,
    { headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` } }
  );
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] || null : null;
}

const HAS_SERVICE_KEY = !!env.SUPABASE_SERVICE_ROLE_KEY;
const pendingSQL = [];

async function saveContacts(prospectId, contacts) {
  if (!HAS_SERVICE_KEY) {
    const json = JSON.stringify(contacts).replace(/'/g, "''");
    pendingSQL.push(`UPDATE prospects SET contacts = '${json}'::jsonb, updated_at = NOW() WHERE id = '${prospectId}';`);
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ contacts, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase contacts update failed ${res.status}: ${await res.text()}`);
  return res.json();
}

async function logEngagement(prospectId, existing, companyName, draftCount) {
  const today = new Date().toISOString().slice(0, 10);
  const entry = {
    id: `eng-agent-${Date.now()}`,
    date: today,
    type: 'email',
    summary: `Sent WQA intro email (LED UV-C) to ${draftCount} contact${draftCount !== 1 ? 's' : ''} at ${companyName}.`,
    activity: { emails: draftCount },
    loggedBy: 'Samir Chibane',
  };
  const engagements = [...(existing || []), entry];
  if (!HAS_SERVICE_KEY) {
    const ej = JSON.stringify(engagements).replace(/'/g, "''");
    pendingSQL.push(`UPDATE prospects SET engagements = '${ej}'::jsonb, last_contact = '${today}', stage = 'contacted', updated_at = NOW() WHERE id = '${prospectId}';`);
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ engagements, last_contact: today, stage: 'contacted', updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase engagement update failed ${res.status}: ${await res.text()}`);
  return res.json();
}

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
  if (!data.access_token) throw new Error('Failed to get Gmail token: ' + JSON.stringify(data));
  return data.access_token;
}

function buildEmail(firstName, hook, companyName) {
  return `<div dir="ltr">
Hey ${firstName},<br><br>
Will you or your team be at the upcoming WQA in Miami?<br><br>
${hook} Most importantly, the external maintenance only takes seconds.<br><br>
Refer to our brochure and tech sheets here: <a href="${DRIVE_LINK}">${DRIVE_LINK}</a><br><br>
If not, we can schedule a time next week for a technical discussion on how we can best support your applications at ${companyName}.<br><br>
${SIGNATURE}
</div>`;
}

function makeMime(to, htmlBody) {
  const raw = [`From: ${FROM}`, `To: ${to}`, `Subject: ${SUBJECT}`, `MIME-Version: 1.0`,
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

// --- Prompt helper ---
function confirm(question) {
  return new Promise(resolve => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, ans => { rl.close(); resolve(ans.trim().toLowerCase() === 'y'); });
  });
}

// ===== MAIN =====
console.log(`\n🚀 Outreach Agent — "${companyArg}"${DRY_RUN ? ' [DRY RUN]' : ''}${AUTO ? ' [AUTO]' : ''}\n`);

// Phase 0: Look up prospect in CRM
let prospect;
if (PROSPECT_ID_FLAG && MARKET_TYPE_FLAG) {
  // Bypass DB lookup — data provided via flags
  prospect = {
    id: PROSPECT_ID_FLAG,
    company_name: companyArg,
    market_type: MARKET_TYPE_FLAG,
    type: COMPANY_TYPE_FLAG || '',
    contacts: [],
    engagements: [],
  };
  console.log(`Phase 0: Using provided prospect ID — ${companyArg} (${prospect.type} / ${prospect.market_type})`);
} else {
  process.stdout.write('Phase 0: Looking up prospect in Supabase... ');
  prospect = await getProspect(companyArg);
  if (!prospect) {
    console.error(`\n  ✗ "${companyArg}" not found in CRM. Add it first via the UI.`);
    process.exit(1);
  }
  console.log(`✓ ${prospect.company_name} (${prospect.type} / ${prospect.market_type})`);
}

const hook = selectHook(prospect);
const existingIds = new Set([
  ...(prospect.contacts || []).map(c => c.id).filter(Boolean),
  ...(prospect.contacts || []).map(c => c.linkedIn).filter(Boolean),
]);
console.log(`  Hook: "${hook.slice(0, 80)}..."\n`);

// Phase 1a: Find Apollo org
process.stdout.write('Phase 1: Finding Apollo org... ');
const org = await apolloFindOrg(companyArg);
if (!org) {
  console.error(`\n  ✗ "${companyArg}" not found in Apollo. Cannot proceed.`);
  process.exit(1);
}
console.log(`✓ ${org.name} (${org.id})\n`);

// Phase 1b: Search contacts (dual pass — leadership + role-specific)
console.log('Phase 2: Searching Apollo (leadership pass + role-titles pass)...\n');
const allPeople = await apolloSearchAll(org.id);
console.log(`\n  Total unique from Apollo: ${allPeople.length} people`);

const relevant = allPeople
  .filter(p => p.first_name && !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s)))
  .slice(0, LIMIT === 0 ? Infinity : LIMIT);
console.log(`  After role filter${LIMIT > 0 ? ` (cap ${LIMIT})` : ''}: ${relevant.length} to enrich\n`);

if (relevant.length === 0) {
  const titles = allPeople.map(p => p.title).filter(Boolean).slice(0, 10);
  console.log('  No contacts passed role filters. Titles found:', titles.join(', '));
  process.exit(0);
}

// Phase 1c: Enrich
console.log('Phase 3: Enriching via Apollo people/match...\n');
const enriched = [];
for (const person of relevant) {
  process.stdout.write(`  ${(person.first_name + ' ' + (person.last_name_obfuscated || '')).padEnd(25)} `);
  try {
    const full = await apolloEnrich(person.id);
    if (full) {
      enriched.push({ apolloId: person.id, name: full.name || `${full.first_name} ${full.last_name}`.trim(),
        title: full.title || person.title || '', email: full.email || '', linkedIn: full.linkedin_url || '' });
      console.log(`→ ${full.name} | ${full.title || 'no title'} | ${full.email || 'no email'}`);
    } else { console.log('→ no result'); }
  } catch (e) { console.log(`→ error: ${e.message}`); }
  await new Promise(r => setTimeout(r, 300));
}
console.log(`\n  Enriched: ${enriched.length} contacts\n`);

// Phase 1d-pre: Guess emails for contacts missing one, using detected company format
function detectEmailFormat(contacts, domain) {
  for (const c of contacts) {
    if (!c.email || !c.name) continue;
    const parts = c.name.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) continue;
    const [first, ...rest] = parts;
    const last = rest.join('');
    const f = first[0];
    const local = c.email.split('@')[0].toLowerCase();
    if (local === `${f}${last}`)          return 'flast';
    if (local === `${first}.${last}`)     return 'first.last';
    if (local === `${first}${last}`)      return 'firstlast';
    if (local === `${f}.${last}`)         return 'f.last';
    if (local === `${last}.${first}`)     return 'last.first';
    if (local === `${last}${f}`)          return 'lastf';
    if (local === first)                  return 'first';
  }
  return null;
}

function generateEmail(name, format, domain) {
  const parts = name.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return null;
  const [first, ...rest] = parts;
  const last = rest.join('');
  const f = first[0];
  switch (format) {
    case 'flast':      return `${f}${last}@${domain}`;
    case 'first.last': return `${first}.${last}@${domain}`;
    case 'firstlast':  return `${first}${last}@${domain}`;
    case 'f.last':     return `${f}.${last}@${domain}`;
    case 'last.first': return `${last}.${first}@${domain}`;
    case 'lastf':      return `${last}${f}@${domain}`;
    case 'first':      return `${first}@${domain}`;
    default:           return null;
  }
}

const withEmails    = enriched.filter(c => c.email);
const withoutEmails = enriched.filter(c => !c.email);

if (withoutEmails.length > 0 && withEmails.length > 0) {
  // Infer domain and format from known emails
  const knownDomain = withEmails[0].email.split('@')[1];
  const format = detectEmailFormat(withEmails, knownDomain);
  if (format) {
    console.log(`Phase 3b: Guessing emails (format: ${format} @${knownDomain})...\n`);
    for (const contact of withoutEmails) {
      const guess = generateEmail(contact.name, format, knownDomain);
      if (guess) {
        process.stdout.write(`  ${contact.name.padEnd(25)} → ${guess} → `);
        const v = await verifyEmail(guess);
        if (v.verified || v.catchAll) {
          contact.email = guess;
          console.log(`${v.status}${v.catchAll ? ' (catch-all)' : ''} ✓`);
        } else {
          console.log(`${v.status} — skipped`);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }
    console.log();
  } else {
    console.log('Phase 3b: Could not detect email format from known contacts — skipping guesses.\n');
  }
}

// Phase 1d: Verify emails
console.log('Phase 4: Verifying emails with Clearout...\n');
const results = [];
for (const contact of enriched) {
  if (!contact.email) {
    results.push({ ...contact, emailStatus: 'no_email', verified: false, catchAll: false });
    console.log(`  ${contact.name.padEnd(25)} → no email`);
    continue;
  }
  process.stdout.write(`  ${contact.email.padEnd(45)} → `);
  const v = await verifyEmail(contact.email);
  results.push({ ...contact, emailStatus: v.status, verified: v.verified, catchAll: v.catchAll });
  console.log(`${v.status}${v.catchAll ? ' (catch-all)' : ''}`);
  await new Promise(r => setTimeout(r, 200));
}

// Dedup against existing
const toAdd = results
  .filter(r => r.email)
  .filter(r => !existingIds.has(`contact-apollo-${r.apolloId}`) && !existingIds.has(r.linkedIn));

const dupeCount = results.filter(r => r.email).length - toAdd.length;

// Summary table
const valid    = results.filter(r => r.verified);
const catchAll = results.filter(r => r.catchAll && !r.verified);
const noEmail  = results.filter(r => !r.email);

console.log(`
--- CONTACT DISCOVERY SUMMARY ---
  Company:  ${prospect.company_name}
  Hook:     "${hook.slice(0, 70)}..."

  ✅ Valid emails:    ${valid.length}
  ⚠️  Catch-all:      ${catchAll.length}
  ❌ No email:       ${noEmail.length}
  ⏭️  Already in CRM: ${dupeCount}
  📬 New to add:     ${toAdd.length}
`);

if (toAdd.length === 0) { console.log('No new contacts to process. Exiting.'); process.exit(0); }

if (DRY_RUN) { console.log('[DRY RUN] Exiting before writes.'); process.exit(0); }

if (!AUTO) {
  const go = await confirm('Proceed with saving contacts + creating Gmail drafts? (y/N): ');
  if (!go) { console.log('Aborted.'); process.exit(0); }
}

// Phase 2a: Validate Gmail token before any writes
console.log('\nPhase 5: Validating Gmail token...');
const gmailToken = await getGmailToken();
console.log('  ✓ Token OK\n');

// Phase 2b: Save contacts to Supabase
console.log('Phase 6: Saving contacts to Supabase...\n');
const newContacts = toAdd.map(r => ({
  id: `contact-apollo-${r.apolloId}`,
  name: r.name,
  role: r.title,
  email: r.email,
  phone: '',
  linkedIn: r.linkedIn,
  ...(r.verified ? { emailVerified: true } : {}),
}));
const merged = [...(prospect.contacts || []), ...newContacts];
await saveContacts(prospect.id, merged);
console.log(`  ✓ Saved ${newContacts.length} new contact(s)\n`);

// Phase 2c: Create Gmail drafts
console.log('Phase 7: Creating Gmail drafts...\n');
const draftTargets = newContacts.filter(c => c.email);
let draftCount = 0;
for (const c of draftTargets) {
  const firstName = c.name.split(' ')[0];
  const html = buildEmail(firstName, hook, prospect.company_name);
  const raw  = makeMime(c.email, html);
  try {
    await createDraft(gmailToken, raw);
    console.log(`  ✓ ${firstName} <${c.email}>`);
    draftCount++;
  } catch (e) {
    console.error(`  ✗ ${c.email}: ${e.message}`);
  }
}
console.log(`\n  ${draftCount} draft(s) created\n`);

// Phase 2d: Log engagement
console.log('Phase 8: Logging engagement...\n');
await logEngagement(prospect.id, prospect.engagements, prospect.company_name, draftCount);
console.log(`  ✓ Engagement logged (${draftCount} emails, stage → contacted)\n`);

console.log('--- DONE ---');
console.log(`  New contacts saved:  ${newContacts.length}`);
console.log(`  Gmail drafts:        ${draftCount}`);
console.log(`  Check your drafts folder.\n`);

if (pendingSQL.length > 0) {
  console.log('--- PENDING SQL (run via Supabase MCP) ---\n');
  pendingSQL.forEach(q => console.log(q + '\n'));
}
