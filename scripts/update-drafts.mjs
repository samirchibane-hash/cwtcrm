#!/usr/bin/env node
/**
 * Find and update Gmail drafts by recipient
 * Usage: node scripts/update-drafts.mjs
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, '../.env');

const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
);

const CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;
const FROM = 'samir@canopuswatertechnologies.com';

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img data-aii="CiExTVJyMFlBWUJMUFVUVnpJbXFpUjZSNWZWM1prcHRHdy0" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l" data-os="https://lh3.googleusercontent.com/d/1MRr0YAYBLPUTVzImqiR6R5fV3ZkptGw-"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font><a href="http://linkedin.com/company/canopus-water-tech" title="" style="color:rgb(17,85,204);font-family:ARIAL;font-size:13.3333px" target="_blank"><img src="https://ci3.googleusercontent.com/meips/ADKq_NbJ5G4vDTIjULf2Brm-nHPca2_m1oqvxln5IPslZieOOvuq9FdIqfiqRqWLkSKeaMlFn2jsgSv_rSpc2kKIAU4SPhLCkvif1CCc7QG2bQybLglFt84YRPTa8sXUn8pOBvvqOIQu5C5pAA=s0-d-e1-ft#https://media2.thegranitegroup.com/TGG_Email_Signatures/whitebackround/LinkedIn.png" border="0" alt="linkedin.com/company/canopus-water-tech"></a></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get access token: ' + JSON.stringify(data));
  return data.access_token;
}

function buildHtmlBody(name, company) {
  const driveLink = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';
  return `<div dir="ltr">
Hey ${name},<br><br>
Will you or your team be at the upcoming WQA in Miami?<br><br>
Several ice and water dispenser OEMs now prefer our LED based UV-C systems because they are compact, long-lasting, and don't affect water temperatures. Most importantly, the external maintenance only takes seconds.<br><br>
If you are attending, we would love to schedule a meeting to discuss how we can best support your applications at ${company}. In the meantime, you can refer to our brochure and technical sheets here: <a href="${driveLink}">${driveLink}</a><br><br>
Regards,<br><br>
${SIGNATURE}
</div>`;
}

function makeMime({ to, subject, htmlBody, from }) {
  const raw = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=UTF-8`,
    ``,
    htmlBody,
  ].join('\r\n');
  return Buffer.from(raw).toString('base64url');
}

const targets = [
  { to: 'Joseph.wolff@elkay.com',    name: 'Joe',      company: 'Elkay' },
  { to: 'todd.morrison@elkay.com',   name: 'Todd',     company: 'Elkay' },
  { to: 'bryan.miller@elkay.com',    name: 'Bryan',    company: 'Elkay' },
  { to: 'joe.hutko@elkay.com',       name: 'Joe',      company: 'Elkay' },
  { to: 'abdullah.ahmad@elkay.com',  name: 'Abdullah', company: 'Elkay' },
  { to: 'daniel.pope@zurn.com',      name: 'Daniel',   company: 'Zurn' },
  { to: 'dylan.eickmeier@zurn.com',  name: 'Dylan',    company: 'Zurn' },
  { to: 'craig.wehr@zurn.com',       name: 'Craig',    company: 'Zurn' },
  { to: 'jeff.schoon@zurn.com',      name: 'Jeff',     company: 'Zurn' },
  { to: 'randy.foltz@zurn.com',      name: 'Randy',    company: 'Zurn' },
];

const subject = 'LED UVs at the WQA in Miami';

const token = await getAccessToken();

// List all drafts
const draftsRes = await fetch(
  'https://gmail.googleapis.com/gmail/v1/users/me/drafts?maxResults=50',
  { headers: { Authorization: `Bearer ${token}` } }
);
const draftsData = await draftsRes.json();
const draftList = draftsData.drafts || [];

// Fetch each draft to find matches
const drafts = [];
for (const { id } of draftList) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${id}`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const d = await res.json();
  const headers = Object.fromEntries(
    (d.message?.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value])
  );
  drafts.push({ draftId: id, to: headers['to'], subject: headers['subject'] });
}

for (const target of targets) {
  const draft = drafts.find(d =>
    d.to?.toLowerCase().includes(target.to.toLowerCase()) &&
    d.subject?.includes('LED UVs at the WQA in Miami')
  );

  if (!draft) {
    console.log(`✗ No matching draft found for ${target.to}`);
    continue;
  }

  const htmlBody = buildHtmlBody(target.name, target.company);
  const raw = makeMime({ to: target.to, subject, htmlBody, from: FROM });

  const updateRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${draft.draftId}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ message: { raw } }),
    }
  );

  if (updateRes.ok) {
    console.log(`✓ Updated draft for ${target.to}`);
  } else {
    const err = await updateRes.json();
    console.error(`✗ Failed for ${target.to}:`, JSON.stringify(err));
  }
}
