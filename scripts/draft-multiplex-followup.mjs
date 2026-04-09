#!/usr/bin/env node
/**
 * Draft follow-up replies in the original Multiplex Beverage email threads
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

const targets = [
  { email: 'jonathan.hurtado@multiplexbev.com', firstName: 'Jonathan' },
  { email: 'abimael.gomez@multiplexbev.com',    firstName: 'Abimael' },
  { email: 'giuseppe.briguglio@multiplexbev.com', firstName: 'Giuseppe' },
  { email: 'jim.brown@multiplexbev.com',         firstName: 'Jim' },
];

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
  return `<div dir="ltr">Hey ${firstName},<br><br>For a better visual of our systems, here's a quick demo of the 1 GPM &amp; 2 GPM units:<br><a href="https://www.youtube.com/watch?v=22wvwcnJ86E">https://www.youtube.com/watch?v=22wvwcnJ86E</a><br><br>Let me know your availability next week to connect with our founder &amp; CEO, Souheil Benzerrouk. He is flexible so I can coordinate around your schedule.<br><br>${SIGNATURE_HTML}</div>`;
}

function buildRaw({ to, subject, threadMessageId, htmlBody }) {
  const lines = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `In-Reply-To: ${threadMessageId}`,
    `References: ${threadMessageId}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

const token = await getAccessToken();

for (const target of targets) {
  // Find the original sent email to this contact
  const searchRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`to:${target.email} subject:"LED UV-C in 2026"`)}&maxResults=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const searchData = await searchRes.json();

  if (!searchData.messages?.length) {
    console.log(`✗ No original email found for ${target.email}`);
    continue;
  }

  const msgId = searchData.messages[0].id;
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}?format=metadata&metadataHeaders=Message-ID&metadataHeaders=Subject`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const msg = await msgRes.json();
  const headers = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value]));
  const threadId = msg.threadId;
  const originalMessageId = headers['message-id'];

  if (!originalMessageId) {
    console.log(`✗ Could not find Message-ID for ${target.email}`);
    continue;
  }

  const subject = `Re: ${headers['subject'] || 'LED UV-C in 2026'}`;
  const raw = buildRaw({ to: target.email, subject, threadMessageId: originalMessageId, htmlBody: buildBody(target.firstName) });

  const draftRes = await fetch('https://www.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw, threadId } }),
  });

  if (draftRes.ok) {
    console.log(`✓ Draft created for ${target.email} (thread: ${threadId})`);
  } else {
    const err = await draftRes.json();
    console.error(`✗ Failed for ${target.email}:`, JSON.stringify(err));
  }
}
