#!/usr/bin/env node
/**
 * Enrich 10 new companies via Apollo, insert into pipeline, then scrape contacts.
 *
 * Steps per company:
 *   1. Apollo /organizations/enrich — get org ID + company details
 *   2. Insert prospect into Supabase (skip if already exists)
 *   3. Apollo people search (seniority-only, up to 10 pages)
 *   4. Score/filter contacts client-side, enrich top 10 via people/match
 *   5. Verify emails with Clearout
 *   6. Save contacts to prospect record
 *
 * Usage: node scripts/apollo-enrich-add-pipeline.mjs
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
const SUPABASE_URL = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY       = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!APOLLO_KEY)   { console.error('Missing APOLLO_API in .env');   process.exit(1); }
if (!CLEAROUT_KEY) { console.error('Missing CLEAROUT_API_KEY in .env'); process.exit(1); }
if (!SB_KEY)       { console.error('Missing SUPABASE key in .env'); process.exit(1); }

// If no service role key, we output SQL instead of writing directly
const USE_SQL_OUTPUT = !env.SUPABASE_SERVICE_ROLE_KEY;

const TARGET_COUNT = 10;
const SENIORITIES  = ['owner', 'founder', 'c_suite', 'vp', 'director', 'manager'];

const KEEP_TITLES = [
  'engineer', 'engineering', 'product', 'purchasing', 'procurement',
  'service manager', 'operations', 'quality', 'manufacturing', 'supply chain',
  'r&d', 'research', 'technical', 'development', 'president', 'owner',
  'founder', 'ceo', 'coo', 'cto', 'vp', 'vice president', 'director', 'manager',
];
const SKIP_TITLES = [
  'marketing', 'finance', 'accounting', 'warehouse', 'intern', 'co-op',
  'sales representative', 'inside sales', 'territory', 'logistics', 'driver',
  'receptionist', 'administrator', 'dispatch', 'associate', 'hr ', 'human resources',
  'legal', 'payroll', 'recruiter',
];

const DOMAINS = [
  'nordoninc.com',
  'purewatertech.com',
  'totalfiltrationservices.com',
  'globalfilter.com',
  'ecosoft.com',
  'sloan.com',
  'paragonwater.com',
  'wigen.com',
  'watergen.com',
  'total-water.com',
];

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Apollo
// ---------------------------------------------------------------------------

async function apolloOrgEnrich(domain) {
  const res = await fetch(`https://api.apollo.io/v1/organizations/enrich?domain=${domain}`, {
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
  });
  if (!res.ok) throw new Error(`Apollo org enrich ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.organization || null;
}

async function apolloSearch(apolloOrgId, page = 1) {
  const res = await fetch('https://api.apollo.io/v1/mixed_people/api_search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({
      organization_ids: [apolloOrgId],
      person_seniorities: SENIORITIES,
      page,
      per_page: 25,
    }),
  });
  if (!res.ok) throw new Error(`Apollo people search ${res.status}: ${await res.text()}`);
  return res.json();
}

async function apolloEnrich(personId) {
  const res = await fetch('https://api.apollo.io/v1/people/match', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': APOLLO_KEY },
    body: JSON.stringify({ id: personId, reveal_personal_emails: false }),
  });
  if (!res.ok) throw new Error(`Apollo people/match ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.person || null;
}

// ---------------------------------------------------------------------------
// Clearout
// ---------------------------------------------------------------------------

async function verifyEmail(email) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer:${CLEAROUT_KEY}` },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { status: 'error', safeToSend: false, catchAll: false };
  const data = await res.json();
  return {
    status:     data.data?.status || 'unknown',
    safeToSend: data.data?.status === 'valid',
    catchAll:   data.data?.is_catch_all === 'yes',
  };
}

// ---------------------------------------------------------------------------
// Supabase
// ---------------------------------------------------------------------------

const SB_HEADERS = {
  apikey:        SB_KEY,
  Authorization: `Bearer ${SB_KEY}`,
  'Content-Type': 'application/json',
  Prefer:        'return=representation',
};

async function findExistingProspect(domain) {
  const encoded = encodeURIComponent(`%${domain}%`);
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/prospects?website=ilike.${encoded}&select=id,company_name,contacts`,
    { headers: SB_HEADERS }
  );
  const rows = await res.json();
  return Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
}

async function insertProspect(org, domain) {
  const body = {
    company_name: org.name,
    website:      org.website_url || `https://${domain}`,
    linkedin:     org.linkedin_url || '',
    state:        org.state || '',
    country:      org.country || '',
    city:         org.city || '',
    phone:        org.phone || '',
    stage:        '',
    contacts:     [],
    engagements:  [],
  };
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects`, {
    method: 'POST',
    headers: SB_HEADERS,
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase insert failed ${res.status}: ${await res.text()}`);
  const rows = await res.json();
  return Array.isArray(rows) ? rows[0] : rows;
}

async function saveContacts(prospectId, contacts) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/prospects?id=eq.${prospectId}`, {
    method: 'PATCH',
    headers: SB_HEADERS,
    body: JSON.stringify({ contacts, updated_at: new Date().toISOString() }),
  });
  if (!res.ok) throw new Error(`Supabase contacts update failed ${res.status}: ${await res.text()}`);
  return res.json();
}

// ---------------------------------------------------------------------------
// Per-company processor
// ---------------------------------------------------------------------------

async function processCompany(domain) {
  console.log(`\n${'='.repeat(64)}`);
  console.log(`  ${domain}`);
  console.log('='.repeat(64));

  // Step 1: Apollo org enrich
  console.log('\nStep 1: Apollo org enrich...');
  let org = null;
  try {
    org = await apolloOrgEnrich(domain);
    await sleep(400);
  } catch (e) {
    console.log(`  ERROR: ${e.message}`);
  }

  if (!org) {
    console.log('  Not found in Apollo — skipping.');
    return { domain, status: 'no_org' };
  }

  console.log(`  Name:      ${org.name}`);
  console.log(`  Employees: ${org.estimated_num_employees || 'unknown'}`);
  console.log(`  LinkedIn:  ${org.linkedin_url || 'none'}`);
  console.log(`  Website:   ${org.website_url || 'none'}`);
  console.log(`  City:      ${org.city || ''}${org.state ? ', ' + org.state : ''} ${org.country || ''}`);

  // Step 2: Check / insert prospect
  console.log('\nStep 2: Supabase — check/insert prospect...');
  let prospectId, existingContacts;
  const existing = await findExistingProspect(domain);
  if (existing) {
    prospectId       = existing.id;
    existingContacts = Array.isArray(existing.contacts) ? existing.contacts : [];
    console.log(`  Already exists: ${existing.company_name} (${prospectId})`);
  } else if (USE_SQL_OUTPUT) {
    // Generate a stable UUID-like placeholder; real UUID assigned by DB
    prospectId       = `NEW:${domain}`;
    existingContacts = [];
    console.log(`  Will INSERT via SQL (no service role key).`);
  } else {
    const row = await insertProspect(org, domain);
    prospectId       = row.id;
    existingContacts = [];
    console.log(`  Inserted: ${org.name} (${prospectId})`);
  }

  // Step 3: People search
  console.log('\nStep 3: Apollo people search (up to 10 pages)...');
  let allPeople = [];
  for (let page = 1; page <= 10; page++) {
    try {
      const data = await apolloSearch(org.id, page);
      if (data.error) { console.log(`  Apollo error: ${data.error}`); break; }
      const people = data.people || [];
      allPeople = allPeople.concat(people);
      process.stdout.write(`  Page ${page}: ${people.length} (total: ${allPeople.length})\n`);
      if (people.length < 25) break;
      await sleep(350);
    } catch (e) {
      console.log(`  Search error: ${e.message}`);
      break;
    }
  }
  console.log(`  Total people: ${allPeople.length}`);

  if (allPeople.length === 0) {
    console.log('  No contacts found — skipping contact steps.');
    return { domain, orgName: org.name, prospectId, status: 'no_contacts' };
  }

  // Score and filter
  const scored = allPeople
    .filter(p => p.first_name)
    .filter(p => !SKIP_TITLES.some(s => (p.title || '').toLowerCase().includes(s)))
    .map(p => {
      const t = (p.title || '').toLowerCase();
      const score = KEEP_TITLES.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
      return { ...p, _score: score };
    })
    .sort((a, b) => b._score - a._score);
  const relevant = scored.slice(0, TARGET_COUNT);
  console.log(`  After filter: ${relevant.length} to enrich (from ${scored.length} relevant)`);

  // Step 4: Enrich contacts
  console.log('\nStep 4: Enriching via people/match...');
  const enriched = [];
  for (const person of relevant) {
    const label = `${person.first_name} ${person.last_name_obfuscated || ''}`.trim().padEnd(25);
    process.stdout.write(`  ${label} → `);
    try {
      const full = await apolloEnrich(person.id);
      if (full) {
        enriched.push({
          apolloId: person.id,
          name:     full.name || `${full.first_name} ${full.last_name}`.trim(),
          title:    full.title || person.title || '',
          email:    full.email || '',
          linkedIn: full.linkedin_url || '',
        });
        console.log(`${full.name} | ${full.title || 'no title'} | ${full.email || 'no email'}`);
      } else {
        console.log('no result');
      }
    } catch (e) {
      console.log(`error: ${e.message}`);
    }
    await sleep(350);
  }
  console.log(`  Enriched: ${enriched.length}`);

  // Step 5: Verify emails
  console.log('\nStep 5: Verifying emails with Clearout...');
  const results = [];
  for (const contact of enriched) {
    if (!contact.email) {
      results.push({ ...contact, emailStatus: 'no_email', safeToSend: false, catchAll: false });
      console.log(`  ${contact.name}: no email`);
      continue;
    }
    process.stdout.write(`  ${contact.email.padEnd(45)} → `);
    const v = await verifyEmail(contact.email);
    results.push({ ...contact, emailStatus: v.status, safeToSend: v.safeToSend, catchAll: v.catchAll });
    console.log(`${v.status}${v.catchAll ? ' (catch-all)' : ''}`);
    await sleep(250);
  }

  // Step 6: Build & save contacts
  const existingKeys = new Set([
    ...existingContacts.map(c => c.linkedIn).filter(Boolean),
    ...existingContacts.map(c => c.id).filter(Boolean),
  ]);
  const toAdd = results
    .filter(r => r.email)
    .filter(r => !existingKeys.has(r.linkedIn) && !existingKeys.has(`contact-apollo-${r.apolloId}`))
    .map(r => ({
      id:       `contact-apollo-${r.apolloId}`,
      name:     r.name,
      role:     r.title,
      email:    r.email,
      phone:    '',
      linkedIn: r.linkedIn,
      ...(r.safeToSend ? { emailVerified: true } : {}),
    }));

  const merged = [...existingContacts, ...toAdd];
  toAdd.forEach(c => {
    const tag = c.emailVerified ? 'valid' : 'unverified';
    console.log(`  + ${c.name} | ${c.role || 'no title'} | ${c.email} [${tag}]`);
  });

  if (USE_SQL_OUTPUT || prospectId.startsWith('NEW:')) {
    console.log(`\nStep 6: Will output SQL at end (no service role key).`);
  } else {
    console.log(`\nStep 6: Saving ${toAdd.length} new contact(s) to Supabase...`);
    await saveContacts(prospectId, merged);
    console.log('  Saved.');
  }

  return {
    domain,
    orgName:      org.name,
    prospectId,
    orgData:      org,
    mergedContacts: merged,
    toAdd,
    status:       'ok',
    added:        toAdd.length,
    valid:        results.filter(r => r.safeToSend).length,
    catchAll:     results.filter(r => r.catchAll && !r.safeToSend).length,
    noEmail:      results.filter(r => !r.email).length,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

console.log('\nApollo enrich + add to pipeline — 10 companies');
console.log(`Supabase: ${SUPABASE_URL}\n`);

const summaries = [];
for (const domain of DOMAINS) {
  const result = await processCompany(domain);
  summaries.push(result);
  await sleep(1000);
}

// ---------------------------------------------------------------------------
// SQL output (when no service role key)
// ---------------------------------------------------------------------------

if (USE_SQL_OUTPUT) {
  console.log('\n\n' + '='.repeat(64));
  console.log('  SQL FOR SUPABASE MCP');
  console.log('='.repeat(64));
  for (const s of summaries) {
    if (s.status !== 'ok') continue;
    const org = s.orgData;
    if (s.prospectId.startsWith('NEW:')) {
      // INSERT company + contacts in one go
      const contactsJson = JSON.stringify(s.mergedContacts).replace(/'/g, "''");
      console.log(`\n-- INSERT: ${s.orgName}`);
      console.log(`INSERT INTO prospects (company_name, website, linkedin, state, country, city, phone, stage, contacts, engagements)
VALUES (
  '${(org.name||'').replace(/'/g,"''")}',
  '${(org.website_url||`https://${s.domain}`).replace(/'/g,"''")}',
  '${(org.linkedin_url||'').replace(/'/g,"''")}',
  '${(org.state||'').replace(/'/g,"''")}',
  '${(org.country||'').replace(/'/g,"''")}',
  '${(org.city||'').replace(/'/g,"''")}',
  '${(org.phone||'').replace(/'/g,"''")}',
  'prospect',
  '${contactsJson}'::jsonb,
  '[]'::jsonb
);`);
    } else if (s.toAdd && s.toAdd.length > 0) {
      // UPDATE existing prospect's contacts
      const contactsJson = JSON.stringify(s.mergedContacts).replace(/'/g, "''");
      console.log(`\n-- UPDATE contacts: ${s.orgName} (${s.prospectId})`);
      console.log(`UPDATE prospects SET contacts = '${contactsJson}'::jsonb, updated_at = NOW() WHERE id = '${s.prospectId}';`);
    } else {
      console.log(`\n-- ${s.orgName}: no new contacts to add`);
    }
  }
}

console.log('\n\n' + '='.repeat(64));
console.log('  FINAL SUMMARY');
console.log('='.repeat(64));
console.log(`${'Company'.padEnd(32)} ${'Added'.padStart(5)} ${'Valid'.padStart(5)} ${'C-All'.padStart(5)} ${'NoEml'.padStart(5)}  Status`);
console.log('-'.repeat(64));
for (const s of summaries) {
  const name = (s.orgName || s.domain).substring(0, 31).padEnd(32);
  if (s.status === 'no_org') {
    console.log(`${name}                                not found in Apollo`);
  } else if (s.status === 'no_contacts') {
    console.log(`${name}     0     0     0     0  no contacts found`);
  } else {
    console.log(`${name} ${String(s.added||0).padStart(5)} ${String(s.valid||0).padStart(5)} ${String(s.catchAll||0).padStart(5)} ${String(s.noEmail||0).padStart(5)}`);
  }
}
console.log('\nDone.');
