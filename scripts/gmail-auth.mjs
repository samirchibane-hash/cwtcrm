#!/usr/bin/env node
/**
 * Re-authorize Gmail OAuth with send + read scopes.
 * Updates GOOGLE_REFRESH_TOKEN in .env
 *
 * Usage:
 *   Step 1: node scripts/gmail-auth.mjs
 *   Step 2: node scripts/gmail-auth.mjs <code>
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';

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
const REDIRECT_URI = 'https://cwt.treatengine.com/auth/callback';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
].join(' ');

const code = process.argv[2];

if (!code) {
  // Step 1: print auth URL
  const authUrl = 'https://accounts.google.com/o/oauth2/v2/auth?' +
    new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES,
      access_type: 'offline',
      prompt: 'consent',
    });

  console.log('\nStep 1: Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nAfter authorizing, you\'ll be redirected to cwt.treatengine.com/auth/callback?code=...');
  console.log('Copy the "code" value from the URL and run:\n');
  console.log('  node scripts/gmail-auth.mjs <code>\n');
  exec(`open "${authUrl}"`);
  process.exit(0);
}

// Step 2: exchange code for tokens
console.log('Exchanging code for tokens...');
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    code,
    client_id: CLIENT_ID,
    client_secret: CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
    grant_type: 'authorization_code',
  }),
});

const tokens = await tokenRes.json();

if (!tokens.refresh_token) {
  console.error('Error: No refresh token returned.');
  console.error(JSON.stringify(tokens, null, 2));
  process.exit(1);
}

// Update .env
const envContent = readFileSync(envPath, 'utf8');
const updated = envContent.replace(
  /^GOOGLE_REFRESH_TOKEN=.*/m,
  `GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`
);
writeFileSync(envPath, updated);

console.log('✓ New refresh token saved to .env');
console.log('Scopes:', tokens.scope);
