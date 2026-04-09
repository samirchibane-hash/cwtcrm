#!/usr/bin/env node
/**
 * Draft UV-C intro emails to new Multiplex Beverage contacts
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

const CLIENT_ID = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN = env.GOOGLE_REFRESH_TOKEN;
const FROM = 'samir@canopuswatertechnologies.com';

const SIGNATURE_HTML = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img data-aii="CiExTVJyMFlBWUJMUFVUVnpJbXFpUjZSNWZWM1prcHRHdy0" src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l" data-os="https://lh3.googleusercontent.com/d/1MRr0YAYBLPUTVzImqiR6R5fV3ZkptGw-"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font><a href="http://linkedin.com/company/canopus-water-tech" title="" style="color:rgb(17,85,204);font-family:ARIAL;font-size:13.3333px" target="_blank"><img src="https://ci3.googleusercontent.com/meips/ADKq_NbJ5G4vDTIjULf2Brm-nHPca2_m1oqvxln5IPslZieOOvuq9FdIqfiqRqWLkSKeaMlFn2jsgSv_rSpc2kKIAU4SPhLCkvif1CCc7QG2bQybLglFt84YRPTa8sXUn8pOBvvqOIQu5C5pAA=s0-d-e1-ft#https://media2.thegranitegroup.com/TGG_Email_Signatures/whitebackround/LinkedIn.png" border="0" alt="linkedin.com/company/canopus-water-tech"></a></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

const driveLink = 'https://drive.google.com/drive/folders/1Pb8pPqPLei7VxoSe3FWT7IQZ93-dnT3q?usp=sharing';
const hook = 'We have a few beverage dispenser OEMs preferring our LED based UV-C systems for disinfection since they\'re compact, long-lasting, don\'t affect water temps and most importantly, the external maintenance only takes seconds.';

const targets = [
  { to: 'ledimo.constantino@multiplexbev.com', firstName: 'Ledimo' },
  { to: 'david.stevens@multiplexbev.com',      firstName: 'David' },
  { to: 'nader.chouchane@multiplexbev.com',    firstName: 'Nader' },
  { to: 'andrew.jones@multiplexbev.com',       firstName: 'Andrew' },
  { to: 'robert.newby@multiplexbev.com',       firstName: 'Robert' },
];

const subject = 'LED UVs for Multiplex Beverage';

async function getAccessToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Token error: ' + JSON.stringify(data));
  return data.access_token;
}

function buildBody(firstName) {
  return `<div dir="ltr">Hey ${firstName},<br><br>${hook}<br><br>You can find our brochure and tech sheets here: <a href="${driveLink}">${driveLink}</a><br><br>Let me know your availability this week or the next for a technical discussion on how we can best support your applications at Multiplex Beverage.<br><br>${SIGNATURE_HTML}</div>`;
}

function buildRaw(to, htmlBody) {
  const lines = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

const token = await getAccessToken();

for (const target of targets) {
  const raw = buildRaw(target.to, buildBody(target.firstName));

  const res = await fetch('https://www.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw } }),
  });

  if (res.ok) {
    console.log(`✓ Draft created for ${target.to}`);
  } else {
    const err = await res.json();
    console.error(`✗ Failed for ${target.to}:`, JSON.stringify(err));
  }
}
