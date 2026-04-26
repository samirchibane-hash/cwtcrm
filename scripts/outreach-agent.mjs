#!/usr/bin/env node
/**
 * Unified outreach agent — Apollo search → Clearout verify → Supabase import → Gmail drafts → engagement log
 *
 * Three-phase flow (Claude mediates approvals between phases):
 *   Phase 1 — Discover contacts, print table, save state file, exit for approval.
 *   Phase 2 — Import approved contacts to CRM, print email preview, exit for approval.
 *   Phase 3 — Create Gmail drafts, log engagement, output pending SQL.
 *
 * Usage:
 *   # Phase 1: discover (run first)
 *   node scripts/outreach-agent.mjs "Company Name" \
 *     --prospect-id <uuid> --market-type "<market>" --type "<OEM|Distributor|...>" \
 *     [--contacts <base64-json>] [--engagements <base64-json>] \
 *     [--limit N] [--template standard|wqa]
 *
 *   # Phase 2: import contacts + preview email (after user approves contact list)
 *   node scripts/outreach-agent.mjs --phase 2 --state-file <path>
 *
 *   # Phase 3: create drafts + log engagement (after user approves email template)
 *   node scripts/outreach-agent.mjs --phase 3 --state-file <path>
 *
 *   # Legacy: fully hands-free (skips all approval steps)
 *   node scripts/outreach-agent.mjs "Company Name" ... --auto
 *
 *   --prospect-id   UUID of the prospect in Supabase
 *   --market-type   Market type string (e.g. "Water Filtration")
 *   --type          Company type (e.g. "OEM")
 *   --contacts      Base64-encoded JSON array of existing contacts (for dedup)
 *   --engagements   Base64-encoded JSON array of existing engagements
 *   --limit N       Cap enrichment at N contacts (0 = unlimited, default)
 *   --template standard Use standard intro email (default)
 *   --template wqa      Use WQA event intro email
 *   --broad-search  Skip Apollo-side filters; pull all pages and score/filter client-side.
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

// --- CLI args ---
const args = process.argv.slice(2);
const companyArg = args.find(a => !a.startsWith('--'));
const AUTO          = args.includes('--auto');
const BROAD_SEARCH  = !args.includes('--no-broad-search');
const limitIdx  = args.indexOf('--limit');
const LIMIT     = limitIdx !== -1 ? parseInt(args[limitIdx + 1]) : 0; // 0 = unlimited

const getFlag = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const SESSION_ID        = getFlag('--session');      // execute an approved session from CRM
const PROSPECT_ID_FLAG  = getFlag('--prospect-id');
const MARKET_TYPE_FLAG  = getFlag('--market-type');
const COMPANY_TYPE_FLAG = getFlag('--type');
const CONTACTS_FLAG     = getFlag('--contacts');    // base64-encoded JSON array
const ENGAGEMENTS_FLAG  = getFlag('--engagements'); // base64-encoded JSON array
const TEMPLATE          = getFlag('--template') || 'standard'; // 'standard' | 'wqa'
const SUBJECT_OVERRIDE  = getFlag('--subject'); // optional subject line override
const APOLLO_ORG_ID     = getFlag('--apollo-org-id'); // bypass org search with known org ID

if (!SESSION_ID && (!companyArg || !PROSPECT_ID_FLAG || !MARKET_TYPE_FLAG)) {
  console.error('Usage:');
  console.error('  Discovery: node scripts/outreach-agent.mjs "Company Name" --prospect-id <uuid> --market-type "<market>" --type "<type>" [--contacts <b64>] [--engagements <b64>]');
  console.error('  Execute:   node scripts/outreach-agent.mjs --session <session-id>');
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
  for (let page = 1; page <= 50; page++) {
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

// Scoring keywords for client-side ranking in broad-search mode.
// Contacts must score >= 1 to be enriched. Higher score = ranked first.
const BROAD_KEEP = [
  // C-suite / Leadership (score heavily — always relevant)
  'president', 'owner', 'founder', 'ceo', 'coo', 'cto', 'cfo', 'chief',
  'vp', 'vice president',
  'director', 'general manager',
  // Engineering / Technical / R&D / Quality
  'engineer', 'engineering', 'technical', 'technician',
  'r&d', 'research', 'research and development', 'development',
  'quality', 'quality control', 'quality assurance', 'manufacturing',
  // Service
  'service manager', 'service tech', 'service director', 'service coordinator',
  'service', 'warranty manager', 'warranty',
  // Product
  'product manager', 'product development', 'product director', 'product',
  // Water-related (any title mentioning water is highly relevant)
  'water', 'water treatment', 'water filtration', 'water quality', 'water systems',
  'spa', 'hot tub', 'aquatic',
  // Procurement / Operations / Supply chain
  'procurement', 'purchasing', 'buyer', 'supply chain', 'operations', 'inventory',
  // Business development (relevant for partnerships)
  'business development',
];
const BROAD_SKIP = [
  // Sales roles (not decision-makers for components)
  'sales representative', 'sales rep', 'field sales', 'inside sales', 'outside sales',
  'account executive', 'territory manager', 'territory sales', 'territory',
  'salesperson', 'sales consultant', 'sales associate', 'sales professional',
  'regional sales manager', 'brand ambassador', 'appointment setter', 'referral',
  'dealer support', 'dealer development', 'dealer representative',
  // Marketing roles
  'marketing manager', 'marketing coordinator', 'marketing specialist',
  'marketing representative', 'marketing agent', 'marketing content',
  'graphic designer', 'graphic design',
  // Admin / ops non-relevant
  'warehouse', 'driver', 'delivery', 'forklift', 'installer', 'installation technician',
  'receptionist', 'administrative assistant', 'dispatcher', 'schedule planner',
  'human resources', 'hr ', 'recruiter', 'talent acquisition',
  'payroll', 'bookkeeper', 'accounts payable', 'accounts receivable', 'accounting clerk',
  'controller', 'finance', 'accountant',
  'intern', 'co-op', 'apprentice', 'laborer', 'labourer',
  'crane operator', 'shipper', 'yard', 'woodshop',
  'retail', 'store manager', 'store associate',
];

async function apolloSearchAll(orgId) {
  if (BROAD_SEARCH) {
    // Broad mode: no Apollo-side filters — pull everything, score client-side
    const all = await apolloSearchPass(orgId, {}, 'broad');
    console.log(`\n  Titles found (${all.length} total):`);
    all.forEach(p => console.log(`    ${p.first_name} ${p.last_name_obfuscated || ''} | ${p.title || '(no title)'}`));
    return all;
  }
  // Standard mode: dual pass — leadership seniority + role titles
  const leadership = await apolloSearchPass(orgId, { person_seniorities: LEADERSHIP_SENIORITIES }, 'leadership');
  await new Promise(r => setTimeout(r, 400));
  const roles = await apolloSearchPass(orgId, { person_titles: ROLE_TITLES }, 'roles');
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
async function verifyEmail(email, retries = 4) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer:${CLEAROUT_KEY}` },
      body: JSON.stringify({ email }),
    });
    if (res.status === 429 || res.status === 503) {
      const wait = (attempt + 1) * 3000;
      process.stdout.write(` [rate-limited, retrying in ${wait / 1000}s]`);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) return { status: 'error', verified: false, catchAll: false };
    const data = await res.json();
    return {
      status: data.data?.status || 'unknown',
      verified: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
      catchAll: data.data?.is_catch_all === 'yes' || data.data?.status === 'catch_all',
    };
  }
  return { status: 'rate-limited', verified: false, catchAll: false };
}

// --- Supabase ---
// Note: reads are handled by the caller (Claude via Supabase MCP) and passed in via flags.

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
  const d = new Date();
  const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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
    pendingSQL.push(`UPDATE prospects SET engagements = '${ej}'::jsonb, last_contact = '${today}', updated_at = NOW() WHERE id = '${prospectId}';`);
    return;
  }
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify({ engagements, last_contact: today, updated_at: new Date().toISOString() }),
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

// Returns the plain-text-friendly body lines (no signature, no wrapping div).
// Used for terminal preview before confirmation.
function buildEmailBody(firstName, hook, companyName) {
  if (TEMPLATE === 'wqa') {
    return [
      `Hey ${firstName},`,
      ``,
      `Will you or your team be at the upcoming WQA in Miami?`,
      ``,
      `${hook} Most importantly, the external maintenance only takes seconds.`,
      ``,
      `Refer to our brochure and tech sheets here: ${DRIVE_LINK}`,
      ``,
      `If not, we can schedule a time next week for a technical discussion on how we can best support your applications at ${companyName}.`,
    ].join('\n');
  }
  return [
    `Hey ${firstName},`,
    ``,
    `${hook}`,
    ``,
    `You can find our brochure and tech sheets here: ${DRIVE_LINK}`,
    ``,
    `Let me know your availability this week or the next for a technical discussion on how we can best support your applications at ${companyName}.`,
  ].join('\n');
}

// Returns the full HTML email with signature appended. Used for Gmail drafts.
function buildEmail(firstName, hook, companyName) {
  const body = buildEmailBody(firstName, hook, companyName)
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  return `<div dir="ltr">\n${body}<br><br>\n${SIGNATURE}\n</div>`;
}

function getSubject(companyName) {
  if (SUBJECT_OVERRIDE) return SUBJECT_OVERRIDE;
  if (TEMPLATE === 'wqa') return 'LED UVs at the WQA in Miami';
  return `LED UVs for ${companyName}`;
}

function makeMime(to, htmlBody, subject) {
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

// ── Supabase session helpers ─────────────────────────────────────────────────

async function saveSession(session) {
  const url = `${SUPABASE_URL}/rest/v1/outreach_sessions`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify(session),
  });
  if (!res.ok) throw new Error(`Supabase session insert failed ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return rows[0];
}

async function getSession(id) {
  const url = `${SUPABASE_URL}/rest/v1/outreach_sessions?id=eq.${id}&select=*`;
  const res = await fetch(url, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase session fetch failed ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

async function updateSession(id, fields) {
  const url = `${SUPABASE_URL}/rest/v1/outreach_sessions?id=eq.${id}`;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: {
      apikey: SB_KEY,
      Authorization: `Bearer ${SB_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...fields, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase session update failed ${res.status}: ${await res.text()}`);
}

// ===== MAIN =====

// ── Execute an approved session from the CRM ─────────────────────────────────
if (SESSION_ID) {
  console.log(`\n📤 Executing approved session: ${SESSION_ID}\n`);

  const session = await getSession(SESSION_ID);
  if (!session) { console.error('Session not found.'); process.exit(1); }
  if (session.status !== 'approved') {
    console.error(`Session status is "${session.status}" — must be "approved" to execute.`);
    process.exit(1);
  }

  const approvedImportIds  = new Set(session.approved_import_ids || []);
  const approvedEmailIds   = new Set(session.approved_email_ids  || []);
  const contacts           = session.discovered_contacts || [];
  const companyName        = session.prospect_name;
  const prospectId         = session.prospect_id;
  const bodyTemplate       = session.email_body || session.body_template;
  const subject            = session.email_subject || `LED UVs for ${companyName}`;
  const mode               = session.email_mode || 'draft';

  const toImport = contacts.filter(c => approvedImportIds.has(c.apolloId));
  const toEmail  = contacts.filter(c => approvedEmailIds.has(c.apolloId) && c.email);

  console.log(`  Prospect:  ${companyName}`);
  console.log(`  Importing: ${toImport.length} contact(s)`);
  console.log(`  Emailing:  ${toEmail.length} contact(s) [${mode}]`);
  console.log(`  Subject:   ${subject}\n`);

  // 1. Import contacts to prospects table
  if (toImport.length > 0 && prospectId) {
    const newContacts = toImport.map(c => ({
      id: `contact-apollo-${c.apolloId}`,
      name: c.name,
      role: c.title,
      email: c.email,
      phone: '',
      linkedIn: c.linkedIn,
      emailVerified: c.verified,
    }));

    // Fetch current contacts from Supabase
    const prospectRes = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}&select=contacts,engagements`, {
      headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
    });
    const [prospectRow] = await prospectRes.json();
    const existingContacts = prospectRow?.contacts || [];
    const existingEngagements = prospectRow?.engagements || [];
    const merged = [...existingContacts, ...newContacts];

    await saveContacts(prospectId, merged);
    console.log(`  ✓ Imported ${newContacts.length} contact(s) to CRM\n`);

    // Log engagement after emailing
    if (toEmail.length > 0) {
      await logEngagement(prospectId, existingEngagements, companyName, toEmail.length);
      console.log(`  ✓ Engagement logged\n`);
    }
  }

  // 2. Create Gmail drafts or send
  if (toEmail.length > 0) {
    process.stdout.write('Validating Gmail token... ');
    const gmailToken = await getGmailToken();
    console.log('✓\n');

    // Build a TEMPLATE-aware body: replace placeholders
    function personalizeBody(template, firstName, cName) {
      return template
        .replace(/\{firstName\}/g, firstName)
        .replace(/\{companyName\}/g, cName);
    }

    let count = 0;
    for (const c of toEmail) {
      const firstName = c.name.split(' ')[0];
      // If body has placeholders, personalize; otherwise use old buildEmail
      let html;
      if (bodyTemplate && bodyTemplate.includes('{firstName}')) {
        const personalized = personalizeBody(bodyTemplate, firstName, companyName)
          .replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
        html = `<div dir="ltr">\n${personalized}<br><br>\n${SIGNATURE}\n</div>`;
      } else {
        html = buildEmail(firstName, session.hook || selectHook({ market_type: '', type: '' }), companyName);
      }
      const raw = makeMime(c.email, html, subject);
      try {
        if (mode === 'send') {
          const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
            method: 'POST',
            headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ raw }),
          });
          if (!res.ok) throw new Error(JSON.stringify(await res.json()));
        } else {
          await createDraft(gmailToken, raw);
        }
        console.log(`  ✓ ${firstName} <${c.email}>`);
        count++;
      } catch (e) {
        console.error(`  ✗ ${c.email}: ${e.message}`);
      }
    }
    console.log(`\n  ${count} message(s) ${mode === 'send' ? 'sent' : 'drafted'}\n`);
  }

  // 3. Mark session completed
  await updateSession(SESSION_ID, { status: 'completed' });

  console.log('--- DONE ---');
  console.log(`  Session ${SESSION_ID} marked completed.`);
  if (session.email_mode !== 'send') console.log('  Check your Gmail Drafts folder.\n');

  if (pendingSQL.length > 0) {
    console.log('--- PENDING SQL (run via Supabase MCP) ---\n');
    pendingSQL.forEach(q => console.log(q + '\n'));
  }
  process.exit(0);
}

// ── Phase 2 (legacy state-file path, kept for --auto) ────────────────────────
if (false) {
  // removed — replaced by session-based flow
  const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'));
  const { prospect, toAdd, hook, template, subjectOverride } = state;
  const resolvedTemplate = template || 'standard';
  const subject = subjectOverride || getSubject(prospect.company_name);

  console.log(`\n📋 Phase 2 — Importing contacts to CRM: ${prospect.company_name}\n`);

  // Validate Gmail token before writes
  process.stdout.write('Validating Gmail token... ');
  const gmailToken = await getGmailToken();
  console.log('✓\n');

  // Save contacts to Supabase
  console.log(`Saving ${toAdd.length} contact(s) to Supabase...\n`);
  const newContacts = toAdd.map(r => ({
    id: `contact-apollo-${r.apolloId}`,
    name: r.name,
    role: r.title,
    email: r.email,
    phone: '',
    linkedIn: r.linkedIn,
    emailVerified: r.verified,
  }));
  const mergedContacts = [...(prospect.contacts || []), ...newContacts];
  await saveContacts(prospect.id, mergedContacts);
  console.log(`  ✓ Saved ${newContacts.length} new contact(s)\n`);

  // Email preview
  const draftTargets = newContacts.filter(c => c.email);
  const previewFirst = draftTargets.length > 0 ? draftTargets[0].name.split(' ')[0] : 'there';
  const previewBody  = buildEmailBody(previewFirst, hook, prospect.company_name);

  console.log('--- EMAIL PREVIEW ---\n');
  console.log(`  Subject : ${subject}\n`);
  console.log('  Body:\n');
  previewBody.split('\n').forEach(line => console.log(`  ${line}`));
  console.log();
  console.log(`  Recipients (${draftTargets.length}):`);
  draftTargets.forEach(c => console.log(`    · ${c.name} <${c.email}>`));
  console.log();

  // Save updated state for phase 3
  writeFileSync(STATE_FILE, JSON.stringify({ ...state, newContacts, draftTargets, subject, gmailToken }));
  console.log(`\n--- AWAITING APPROVAL ---`);
  console.log(`  Review the email preview above.`);
  console.log(`  To create ${draftTargets.length} Gmail draft(s), run Phase 3:`);
  console.log(`  node scripts/outreach-agent.mjs --phase 3 --state-file ${STATE_FILE}\n`);
  process.exit(0);
}

// (Phase 3 removed — replaced by --session execution path above)

// ── Phase 1: Contact discovery ───────────────────────────────────────────────
console.log(`\n🚀 Outreach Agent — "${companyArg}"${AUTO ? ' [AUTO]' : ''}${BROAD_SEARCH ? ' [BROAD]' : ''} [template: ${TEMPLATE}] [phase 1]\n`);

// Load prospect data from flags (looked up by caller via Supabase MCP)
const prospect = {
  id: PROSPECT_ID_FLAG,
  company_name: companyArg,
  market_type: MARKET_TYPE_FLAG,
  type: COMPANY_TYPE_FLAG || '',
  contacts:    CONTACTS_FLAG    ? JSON.parse(Buffer.from(CONTACTS_FLAG,    'base64').toString('utf8')) : [],
  engagements: ENGAGEMENTS_FLAG ? JSON.parse(Buffer.from(ENGAGEMENTS_FLAG, 'base64').toString('utf8')) : [],
};
console.log(`Phase 0: ${prospect.company_name} (${prospect.type} / ${prospect.market_type}) — ${prospect.contacts.length} existing contact(s)`);

const hook = selectHook(prospect);
const existingIds = new Set([
  ...(prospect.contacts || []).map(c => c.id).filter(Boolean),
  ...(prospect.contacts || []).map(c => c.linkedIn).filter(Boolean),
]);
console.log(`  Hook: "${hook.slice(0, 80)}..."\n`);

// Phase 1a: Find Apollo org
process.stdout.write('Phase 1: Finding Apollo org... ');
const org = APOLLO_ORG_ID
  ? { id: APOLLO_ORG_ID, name: companyArg }
  : await apolloFindOrg(companyArg);
if (!org) {
  console.error(`\n  ✗ "${companyArg}" not found in Apollo. Cannot proceed.`);
  process.exit(1);
}
console.log(`✓ ${org.name} (${org.id})\n`);

// Phase 1b: Search contacts
console.log(`Phase 2: Searching Apollo (${BROAD_SEARCH ? 'broad — no filters, client-side scoring' : 'leadership pass + role-titles pass'})...\n`);
const allPeople = await apolloSearchAll(org.id);
console.log(`\n  Total unique from Apollo: ${allPeople.length} people`);

const SESSION_CAP = LIMIT === 0 ? 15 : LIMIT;
let scored = [];  // populated in broad mode; used for Phase 4 expansion
let relevant;
if (BROAD_SEARCH) {
  // Score each contact; skip irrelevant titles; sort by score desc
  scored = allPeople
    .filter(p => p.first_name)
    .filter(p => !BROAD_SKIP.some(s => (p.title || '').toLowerCase().includes(s)))
    .map(p => {
      const t = (p.title || '').toLowerCase();
      const score = BROAD_KEEP.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
      return { ...p, _score: score };
    })
    .filter(p => p._score >= 1)  // require at least one relevant keyword match
    .sort((a, b) => b._score - a._score);
  // Enrich 2× the session cap to build a larger pool for format detection
  const ENRICH_CAP = SESSION_CAP * 2;
  relevant = scored.slice(0, ENRICH_CAP);
  console.log(`  After broad filter + scoring: ${scored.length} relevant (enriching top ${ENRICH_CAP} for format detection)`);
  relevant.forEach(p => console.log(`    [score ${p._score}] ${p.first_name} ${p.last_name_obfuscated || ''} — ${p.title || 'no title'}`));
  console.log();
} else {
  relevant = allPeople
    .filter(p => p.first_name && !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s)))
    .slice(0, SESSION_CAP);
  console.log(`  After role filter (top ${SESSION_CAP}): ${relevant.length} to enrich\n`);
}

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
        title: full.title || person.title || '', email: full.email || '', linkedIn: full.linkedin_url || '',
        _score: person._score || 0 });
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

// Phase 3b + 4: For each contact, find and verify the best email via priority chain:
//   1. Apollo-suggested email
//   2. Detected company format
//   3. All other format variations
// Only keep contacts where a verified or catch-all email is found.

const ALL_FORMATS = ['flast', 'first.last', 'firstlast', 'f.last', 'last.first', 'lastf', 'first'];

// Detect company email format from contacts that already have emails
const knownEmailContacts = enriched.filter(c => c.email);
const knownDomain = knownEmailContacts.length > 0
  ? knownEmailContacts[0].email.split('@')[1]
  : null;
const detectedFormat = knownDomain ? detectEmailFormat(knownEmailContacts, knownDomain) : null;
const fallbackFormats = detectedFormat
  ? ALL_FORMATS.filter(f => f !== detectedFormat)
  : ALL_FORMATS;

console.log(`Phase 3b+4: Verifying emails for ${enriched.length} contacts (this may take a while)...\n`);
if (detectedFormat) console.log(`  Detected company format: ${detectedFormat} @${knownDomain}\n`);

const results = [];
for (const contact of enriched) {
  process.stdout.write(`  ${contact.name.padEnd(28)}`);

  // Build candidate list in priority order
  const candidates = [];

  // 1. Apollo-suggested email (highest priority)
  if (contact.email) candidates.push({ email: contact.email, source: 'apollo' });

  // 2. Detected company format (only if different from Apollo email)
  if (knownDomain && detectedFormat) {
    const guess = generateEmail(contact.name, detectedFormat, knownDomain);
    if (guess && guess !== contact.email) candidates.push({ email: guess, source: `fmt:${detectedFormat}` });
  }

  // 3. All remaining format variations
  if (knownDomain) {
    for (const fmt of fallbackFormats) {
      const guess = generateEmail(contact.name, fmt, knownDomain);
      if (guess && !candidates.some(c => c.email === guess)) {
        candidates.push({ email: guess, source: `fmt:${fmt}` });
      }
    }
  }

  if (candidates.length === 0) {
    console.log(` → no email candidates`);
    results.push({ ...contact, email: null, emailStatus: 'no_email', verified: false, catchAll: false });
    continue;
  }

  let found = false;
  for (const { email, source } of candidates) {
    process.stdout.write(` [${source}] ${email}`);
    const v = await verifyEmail(email);
    await new Promise(r => setTimeout(r, 600));
    if (v.verified || v.catchAll) {
      contact.email = email;
      console.log(` → ${v.status}${v.catchAll ? ' (catch-all)' : ''} ✓`);
      results.push({ ...contact, emailStatus: v.status, verified: v.verified, catchAll: v.catchAll });
      found = true;
      break;
    }
    process.stdout.write(` (${v.status})`);
  }
  if (!found) {
    console.log(` → none verified`);
    results.push({ ...contact, email: null, emailStatus: 'no_email', verified: false, catchAll: false });
  }
}
console.log();

// Phase 4: Format expansion — once the format is known, scan ALL remaining scored contacts
// and verify emails using the detected format only (1 Clearout call each).
// Only runs in broad-search mode and only if format was detected and we're under the session cap.
if (BROAD_SEARCH && detectedFormat && knownDomain) {
  const enrichedIds = new Set(enriched.map(c => c.apolloId));
  const remaining = scored.filter(p => !enrichedIds.has(p.id));
  const verifiedSoFar = results.filter(r => r.verified || r.catchAll).length;

  if (remaining.length > 0 && verifiedSoFar < SESSION_CAP) {
    console.log(`Phase 4: Format expansion — trying ${detectedFormat}@${knownDomain} on ${remaining.length} remaining scored contacts...\n`);
    for (const person of remaining) {
      if (results.filter(r => r.verified || r.catchAll).length >= SESSION_CAP) break;
      const fullName = `${person.first_name} ${person.last_name || ''}`.trim();
      const guess = generateEmail(fullName, detectedFormat, knownDomain);
      if (!guess) continue;
      process.stdout.write(`  ${fullName.padEnd(28)} [fmt:${detectedFormat}] ${guess}`);
      const v = await verifyEmail(guess);
      await new Promise(r => setTimeout(r, 600));
      if (v.verified || v.catchAll) {
        console.log(` → ${v.status}${v.catchAll ? ' (catch-all)' : ''} ✓`);
        results.push({ apolloId: person.id, name: fullName, title: person.title || '',
          email: guess, linkedIn: person.linkedin_url || '', emailStatus: v.status,
          verified: v.verified, catchAll: v.catchAll, _score: person._score || 0 });
      } else {
        console.log(` → ${v.status}`);
      }
    }
    console.log();
  }
}

// Dedup against existing, sort by relevance score, cap at SESSION_CAP
const allWithEmail = results.filter(r => r.email);
const newContacts  = allWithEmail
  .filter(r => !existingIds.has(`contact-apollo-${r.apolloId}`) && !existingIds.has(r.linkedIn))
  .sort((a, b) => (b._score || 0) - (a._score || 0));
const toAdd        = newContacts.filter(r => r.verified || r.catchAll).slice(0, SESSION_CAP);
const unverified   = newContacts.filter(r => !r.verified && !r.catchAll);

const dupeCount = allWithEmail.length - newContacts.length;

// Summary table
const valid    = results.filter(r => r.verified);
const catchAll = results.filter(r => r.catchAll && !r.verified);
const noEmail  = results.filter(r => !r.email);

console.log(`
--- CONTACT DISCOVERY SUMMARY ---
  Company:  ${prospect.company_name}
  Hook:     "${hook.slice(0, 70)}..."

  ✅ Valid emails:      ${valid.length}
  ⚠️  Catch-all:        ${catchAll.length}
  ❌ No email:         ${noEmail.length}
  🚫 Unverified (skip): ${unverified.length}
  ⏭️  Already in CRM:  ${dupeCount}
  📬 New to add:       ${toAdd.length}
`);

if (toAdd.length === 0) { console.log('No new contacts to process. Exiting.'); process.exit(0); }

// ── Print contact table ──────────────────────────────────────────────────────
if (toAdd.length > 0) {
  console.log('--- CONTACTS APPROVED FOR OUTREACH ---\n');
  const nameW  = Math.max(20, ...toAdd.map(r => r.name.length));
  const roleW  = Math.max(30, ...toAdd.map(r => (r.title || '').length));
  const emailW = Math.max(35, ...toAdd.map(r => (r.email || '').length));
  const header = `  ${'#'.padEnd(3)} ${'Name'.padEnd(nameW)} ${'Role'.padEnd(roleW)} ${'Email'.padEnd(emailW)} Status`;
  console.log(header);
  console.log('  ' + '-'.repeat(header.length - 2));
  toAdd.forEach((r, i) => {
    const status = r.verified ? 'valid' : 'catch-all';
    console.log(`  ${String(i + 1).padEnd(3)} ${r.name.padEnd(nameW)} ${(r.title || '').padEnd(roleW)} ${(r.email || '').padEnd(emailW)} ${status}`);
  });
  console.log();
}

if (unverified.length > 0) {
  console.log(`--- SKIPPED (unverified emails — ${unverified.length}) ---\n`);
  unverified.forEach(r => console.log(`  · ${r.name.padEnd(25)} ${r.email}  [${r.emailStatus}]`));
  console.log();
}

if (!AUTO) {
  // Save session to Supabase for CRM review
  const DRIVE_LINK = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';
  const bodyTemplate = [
    `Hey {firstName},`,
    ``,
    hook,
    ``,
    `You can find our brochure and tech sheets here: ${DRIVE_LINK}`,
    ``,
    `Let me know your availability this week or the next for a technical discussion on how we can best support your applications at {companyName}.`,
  ].join('\n');
  const wqaBodyTemplate = [
    `Hey {firstName},`,
    ``,
    `Will you or your team be at the upcoming WQA in Miami?`,
    ``,
    `${hook} Most importantly, the external maintenance only takes seconds.`,
    ``,
    `Refer to our brochure and tech sheets here: ${DRIVE_LINK}`,
    ``,
    `If not, we can schedule a time next week for a technical discussion on how we can best support your applications at {companyName}.`,
  ].join('\n');

  // Mark all as alreadyInCrm = false (these are all new, we pre-filtered dupes)
  const sessionContacts = toAdd.map(r => ({
    apolloId: r.apolloId,
    name: r.name,
    title: r.title,
    email: r.email,
    emailStatus: r.verified ? 'valid' : r.catchAll ? 'catch-all' : 'unverified',
    verified: r.verified,
    catchAll: r.catchAll,
    linkedIn: r.linkedIn,
    alreadyInCrm: false,
  }));

  // Also include already-in-CRM contacts so the UI can show them greyed out
  const crmContacts = (prospect.contacts || []).map(c => ({
    apolloId: c.id?.replace('contact-apollo-', '') || c.id,
    name: c.name,
    title: c.role || '',
    email: c.email || '',
    emailStatus: c.emailVerified ? 'valid' : 'unverified',
    verified: !!c.emailVerified,
    catchAll: false,
    linkedIn: c.linkedIn || '',
    alreadyInCrm: true,
  }));

  process.stdout.write('\nSaving session to Supabase... ');
  const session = await saveSession({
    prospect_id: prospect.id,
    prospect_name: prospect.company_name,
    discovered_contacts: [...crmContacts, ...sessionContacts],
    hook,
    body_template: bodyTemplate,
    wqa_body_template: wqaBodyTemplate,
    email_subject: SUBJECT_OVERRIDE || `LED UVs for ${prospect.company_name}`,
    email_body: TEMPLATE === 'wqa' ? wqaBodyTemplate : bodyTemplate,
    email_mode: 'draft',
    status: 'pending',
    approved_import_ids: [],
    approved_email_ids: [],
  });
  console.log(`✓ Session ID: ${session.id}\n`);

  console.log('--- AWAITING CRM APPROVAL ---');
  console.log(`  ${toAdd.length} contact(s) staged for review.`);
  console.log(`  Open the CRM → Claude Agent tab to review and approve.`);
  console.log(`  Session ID: ${session.id}`);
  console.log(`\n  Once approved, run:`);
  console.log(`  node scripts/outreach-agent.mjs --session ${session.id}\n`);
  process.exit(0);
}

// ── AUTO mode: continue directly through phases 2 and 3 ─────────────────────
process.stdout.write('\nValidating Gmail token... ');
const gmailToken = await getGmailToken();
console.log('✓\n');

console.log(`Saving ${toAdd.length} contact(s) to Supabase...\n`);
const autoNewContacts = toAdd.map(r => ({
  id: `contact-apollo-${r.apolloId}`,
  name: r.name,
  role: r.title,
  email: r.email,
  phone: '',
  linkedIn: r.linkedIn,
  emailVerified: r.verified,
}));
const mergedContacts = [...(prospect.contacts || []), ...autoNewContacts];
await saveContacts(prospect.id, mergedContacts);
console.log(`  ✓ Saved ${autoNewContacts.length} new contact(s)\n`);

const subject      = SUBJECT_OVERRIDE || getSubject(prospect.company_name);
const draftTargets = autoNewContacts.filter(c => c.email);

console.log('Creating Gmail drafts...\n');
let draftCount = 0;
for (const c of draftTargets) {
  const firstName = c.name.split(' ')[0];
  const html = buildEmail(firstName, hook, prospect.company_name);
  const raw  = makeMime(c.email, html, subject);
  try {
    await createDraft(gmailToken, raw);
    console.log(`  ✓ ${firstName} <${c.email}>`);
    draftCount++;
  } catch (e) {
    console.error(`  ✗ ${c.email}: ${e.message}`);
  }
}
console.log(`\n  ${draftCount} draft(s) created\n`);

console.log('Logging engagement...\n');
await logEngagement(prospect.id, prospect.engagements, prospect.company_name, draftCount);
console.log(`  ✓ Engagement logged (${draftCount} emails)\n`);

console.log('--- DONE ---');
console.log(`  New contacts saved:  ${newContacts.length}`);
console.log(`  Gmail drafts:        ${draftCount}`);
console.log(`  Check your drafts folder.\n`);

if (pendingSQL.length > 0) {
  console.log('--- PENDING SQL (run via Supabase MCP) ---\n');
  pendingSQL.forEach(q => console.log(q + '\n'));
}
