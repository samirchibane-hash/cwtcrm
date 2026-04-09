#!/usr/bin/env node
/**
 * Test standard email format variations for A.O. Smith contacts
 * to find deliverable addresses on a catch-all domain.
 *
 * Variations tested: firstname, lastname, firstname.lastname,
 * f.lastname, firstname.l, firstnamelastname, flastname, firstnamel
 *
 * Usage: node scripts/verify-ao-smith-emails.mjs
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

const CLEAROUT_KEY = env.CLEAROUT_API_KEY;
const DOMAIN = 'aosmith.com';

// Key contacts to verify — relevant roles only (c-suite, engineering, product, procurement)
const CONTACTS = [
  { id: 'contact-apollo-sdkarge',    name: 'Samuel Karge',         role: 'President, North America Water Treatment' },
  { id: 'contact-apollo-rmtallon',   name: 'Rebecca Tallon',        role: 'Engineering Director - Water Treatment Technology' },
  { id: 'contact-apollo-arichter',   name: 'Alisa Richter-Jordan',  role: 'Business Development Manager, NAWT' },
  { id: 'contact-apollo-ckurz',      name: 'Chris Kurz',            role: 'Product Manager - Water Softeners' },
  { id: 'contact-apollo-rclevis',    name: 'Robert Clevis',         role: 'Product Manager New Technologies' },
  { id: 'contact-apollo-kjason',     name: 'Kyle Jason',            role: 'Senior Product Manager' },
  { id: 'contact-apollo-bvossler',   name: 'Brad Vossler',          role: 'Senior Product Manager' },
  { id: 'contact-apollo-mfalk',      name: 'Madalyn Falk',          role: 'Product Manager' },
  { id: 'contact-apollo-mdarr',      name: 'Megan Darr',            role: 'Product Manager' },
  { id: 'contact-apollo-gbhat',      name: 'Gulzar Bhat',           role: 'Product Development Manager' },
  { id: 'contact-apollo-tsnively',   name: 'Trent Snively',         role: 'Product Development Engineer' },
  { id: 'contact-apollo-mwoolery',   name: 'Michael Woolery',       role: 'Senior Product Development Engineer' },
  { id: 'contact-apollo-sdellinger', name: 'Steve Dellinger',       role: 'Director of Engineering' },
  { id: 'contact-apollo-aviens',     name: 'Andrew Viens',          role: 'Senior Product Manager - Commercial Electric' },
  { id: 'contact-apollo-mwilczynski',name: 'Mike Wilczynski',       role: 'Product Manager' },
  { id: 'contact-apollo-vnagargoje', name: 'Varad Nagargoje',       role: 'Engineer - Technology Development (Water Treatment)' },
  // Keep Doug with his existing known email (hotwater.com)
];

function buildVariations(fullName, domain) {
  const parts = fullName.toLowerCase().replace(/[^a-z\s]/g, '').trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts[parts.length - 1] || '';
  if (!first || !last || first === last) return [];

  return [
    `${first}@${domain}`,
    `${last}@${domain}`,
    `${first}.${last}@${domain}`,
    `${first[0]}.${last}@${domain}`,
    `${first}.${last[0]}@${domain}`,
    `${first}${last}@${domain}`,
    `${first[0]}${last}@${domain}`,
    `${first}${last[0]}@${domain}`,
  ];
}

async function verifyEmail(email) {
  const res = await fetch('https://api.clearout.io/v2/email_verify/instant', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer:${CLEAROUT_KEY}`,
    },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) return { status: 'error', safe_to_send: false };
  const data = await res.json();
  return {
    status: data.data?.status || 'unknown',
    safe_to_send: data.data?.status === 'valid' || data.data?.safe_to_send === 'yes',
    catch_all: data.data?.is_catch_all === 'yes',
  };
}

console.log(`Testing email variations for ${CONTACTS.length} contacts on @${DOMAIN}\n`);
console.log('Variations: firstname, lastname, firstname.lastname, f.lastname, firstname.l, firstnamelastname, flastname, firstnamel\n');
console.log('='.repeat(70));

const results = [];

for (const contact of CONTACTS) {
  const variations = buildVariations(contact.name, DOMAIN);
  console.log(`\n${contact.name} (${contact.role})`);

  let bestEmail = null;
  let bestStatus = null;

  for (const email of variations) {
    process.stdout.write(`  ${email.padEnd(45)} → `);
    const v = await verifyEmail(email);
    console.log(`${v.status}${v.catch_all ? ' (catch-all)' : ''}`);

    if (v.safe_to_send && !bestEmail) {
      bestEmail = email;
      bestStatus = 'valid';
    } else if (v.status === 'catch_all' && !bestEmail) {
      // Keep track but don't commit yet
      if (!bestEmail) { bestEmail = email; bestStatus = 'catch_all'; }
    }

    await new Promise(r => setTimeout(r, 250));
  }

  results.push({ ...contact, bestEmail, bestStatus });
}

console.log('\n' + '='.repeat(70));
console.log('\nSUMMARY:\n');

const valid = results.filter(r => r.bestStatus === 'valid');
const catchAll = results.filter(r => r.bestStatus === 'catch_all');
const noEmail = results.filter(r => !r.bestEmail);

if (valid.length) {
  console.log(`✅ VALID (${valid.length}):`);
  valid.forEach(r => console.log(`  ${r.name} → ${r.bestEmail}`));
}
if (catchAll.length) {
  console.log(`\n⚠️  CATCH-ALL only (${catchAll.length}) — use Apollo best-guess:`);
  catchAll.forEach(r => console.log(`  ${r.name} → ${r.bestEmail}`));
}
if (noEmail.length) {
  console.log(`\n❌ No email found (${noEmail.length}):`);
  noEmail.forEach(r => console.log(`  ${r.name}`));
}

// Output final contact list for DB update
console.log('\n--- FINAL CONTACTS JSON ---');
const finalContacts = results
  .filter(r => r.bestEmail) // only keep ones with an email
  .map(r => ({
    id: r.id,
    name: r.name,
    role: r.role,
    email: r.bestEmail,
    phone: '',
    linkedIn: '',
    emailVerified: r.bestStatus === 'valid' ? 'valid' : undefined,
  }));
console.log(JSON.stringify(finalContacts, null, 2));
