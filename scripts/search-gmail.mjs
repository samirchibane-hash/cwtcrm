#!/usr/bin/env node
/**
 * Search Gmail for a query and print thread summaries
 * Usage: node scripts/search-gmail.mjs "query"
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

function decodeBody(part) {
  if (!part) return '';
  if (part.body?.data) {
    return Buffer.from(part.body.data, 'base64url').toString('utf8');
  }
  if (part.parts) {
    for (const p of part.parts) {
      const text = decodeBody(p);
      if (text) return text;
    }
  }
  return '';
}

const query = process.argv[2] || 'Mar Cor Purification';

const token = await getAccessToken();

// Search messages
const searchRes = await fetch(
  `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=20`,
  { headers: { Authorization: `Bearer ${token}` } }
);
const searchData = await searchRes.json();

if (!searchData.messages?.length) {
  console.log('No messages found for query:', query);
  process.exit(0);
}

console.log(`Found ${searchData.messages.length} message(s) for "${query}":\n`);

for (const { id } of searchData.messages) {
  const msgRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const msg = await msgRes.json();

  const headers = Object.fromEntries(
    (msg.payload?.headers || []).map(h => [h.name.toLowerCase(), h.value])
  );

  const date = headers['date'] || '';
  const from = headers['from'] || '';
  const to = headers['to'] || '';
  const subject = headers['subject'] || '(no subject)';

  const body = decodeBody(msg.payload);
  // Strip HTML tags for readability
  const plainBody = body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);

  console.log('---');
  console.log(`Date:    ${date}`);
  console.log(`From:    ${from}`);
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(`Preview: ${plainBody}`);
  console.log();
}
