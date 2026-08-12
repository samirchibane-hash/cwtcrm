#!/usr/bin/env node
/**
 * daily-briefing.mjs
 *
 * AI-powered executive sales assistant. Reads every active company in the CRM
 * — their stage, engagement history, notes, contacts (phone + LinkedIn), and
 * orders — and uses Claude to generate a prioritized action list for today.
 *
 * Results are saved to the `daily_recommendations` table and shown in
 * CRM → Daily Briefing page.
 *
 * Usage:
 *   node scripts/daily-briefing.mjs [--limit N] [--dry-run] [--stages "Contact Made,Quotes"]
 *
 * Setup:
 *   Add to your .env file:  ANTHROPIC_API_KEY=sk-ant-...
 *
 * Options:
 *   --limit N       Max companies to analyze (default: 100)
 *   --dry-run       Print recommendations without saving to DB
 *   --stages "..."  Comma-separated list of stages to include (default: all active)
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

const SUPABASE_URL      = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY            = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
const CLIENT_ID         = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET     = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN     = env.GOOGLE_REFRESH_TOKEN;
const FROM_EMAIL        = 'samir@canopuswatertechnologies.com';

if (!ANTHROPIC_API_KEY) {
  console.error('\n❌  ANTHROPIC_API_KEY is not set in your .env file.');
  console.error('    Add it:  ANTHROPIC_API_KEY=sk-ant-...\n');
  process.exit(1);
}

const args       = process.argv.slice(2);
const getFlag    = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const LIMIT      = parseInt(getFlag('--limit') || '100');
const DRY_RUN    = args.includes('--dry-run');
const STAGES_ARG = getFlag('--stages');

const SKIP_STAGES = ['No Current Interest'];
const TODAY       = new Date().toISOString().split('T')[0];

// ── Supabase helpers ─────────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
  return res.json();
}

async function sbPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${await res.text()}`);
}

async function sbDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'DELETE',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  if (!res.ok) throw new Error(`Supabase DELETE ${path}: ${await res.text()}`);
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

// ── Reply checking ───────────────────────────────────────────────────────────

async function getGmailToken() {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
      refresh_token: REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Gmail token error: ' + JSON.stringify(data));
  return data.access_token;
}

async function getGmailThread(token, threadId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=metadata&metadataHeaders=From`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    if (err?.error?.code === 404) return null;
    throw new Error(`Gmail thread ${threadId}: ${JSON.stringify(err)}`);
  }
  return res.json();
}

async function searchInboxForReply(token, contactEmail, afterDate) {
  const afterTs = Math.floor(new Date(afterDate).getTime() / 1000);
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`from:${contactEmail} after:${afterTs}`)}&maxResults=1`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return false;
  const data = await res.json();
  return (data.messages?.length ?? 0) > 0;
}

function hasReply(thread) {
  if (!thread?.messages?.length) return false;
  return thread.messages.slice(1).some(msg => {
    const from = msg.payload?.headers?.find(h => h.name === 'From')?.value ?? '';
    return !from.toLowerCase().includes(FROM_EMAIL.toLowerCase());
  });
}

// ── Email body helpers ────────────────────────────────────────────────────────

function decodeEmailBody(data) {
  if (!data) return '';
  const base64 = data.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(base64, 'base64').toString('utf-8');
}

function extractTextFromPayload(payload) {
  if (!payload) return '';
  if (payload.mimeType === 'text/plain' && payload.body?.data) return decodeEmailBody(payload.body.data);
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) return decodeEmailBody(part.body.data);
    }
    for (const part of payload.parts) {
      const nested = extractTextFromPayload(part);
      if (nested) return nested;
    }
  }
  return '';
}

function cleanEmailBody(text, maxChars = 400) {
  if (!text) return '';
  const lines = text.split('\n')
    .filter(l => !l.trim().startsWith('>'))
    .filter(l => !/^On .+wrote:/.test(l.trim()));
  const cleaned = lines.join('\n').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length > maxChars ? cleaned.slice(0, maxChars) + '...' : cleaned;
}

async function fetchLastExchange(token, threadId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return null;
  const thread = await res.json().catch(() => null);
  if (!thread?.messages?.length) return null;

  const exchange = [];
  for (const msg of thread.messages.slice(-2)) {
    const from = msg.payload?.headers?.find(h => h.name === 'From')?.value ?? '';
    const date = msg.payload?.headers?.find(h => h.name === 'Date')?.value ?? '';
    const isMe = from.toLowerCase().includes(FROM_EMAIL.toLowerCase());
    const body = cleanEmailBody(extractTextFromPayload(msg.payload), 350);
    if (body) exchange.push({
      role: isMe ? 'you' : 'them',
      date: date.split(',').slice(1).join(',').trim().split(' ').slice(0, 3).join(' '),
      body,
    });
  }
  return exchange.length > 0 ? exchange : null;
}

async function fetchSentStyleSnapshot(token, days = 14) {
  const afterTs = Math.floor((Date.now() - days * 86400000) / 1000);
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(`in:sent after:${afterTs}`)}&maxResults=20`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!listRes.ok) return null;
  const listData = await listRes.json().catch(() => null);
  if (!listData?.messages?.length) return null;

  const sample = listData.messages.slice(0, 15);
  process.stdout.write(`  Scanning ${sample.length} sent email(s) for style patterns... `);

  const emails = [];
  for (const msg of sample) {
    try {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}?format=full`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!msgRes.ok) continue;
      const msgData = await msgRes.json();
      const subject = msgData.payload?.headers?.find(h => h.name === 'Subject')?.value ?? '';
      const body = cleanEmailBody(extractTextFromPayload(msgData.payload), 400);
      if (body.length > 40) emails.push({ subject, body });
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 80));
  }

  if (emails.length < 3) { console.log('not enough emails'); return null; }

  try {
    const guide = await callClaude(
      'You analyze sales email writing patterns. Be concise and specific.',
      `Analyze these ${emails.length} sales emails from Samir at Canopus Water Technologies. Extract 5-7 bullet points covering: tone, typical length, how he opens, subject line style, call-to-action patterns, and any distinctive phrases or approaches.\n\nEmails:\n${emails.map((e, i) => `[${i + 1}] Subject: ${e.subject}\n${e.body}`).join('\n\n---\n\n')}\n\nReturn ONLY the bullet points, no intro text.`
    );
    console.log('done');
    return guide;
  } catch (e) {
    console.log(`failed (${e.message})`);
    return null;
  }
}

async function fetchAllThreadContents(token, threadsByProspect) {
  const entries = Object.entries(threadsByProspect).filter(([, v]) => v.latestThreadId).slice(0, 50);
  if (entries.length === 0) return {};

  process.stdout.write(`  Enriching ${entries.length} email thread(s) with content... `);
  const contents = {};
  let count = 0;
  for (const [prospectId, info] of entries) {
    try {
      const exchange = await fetchLastExchange(token, info.latestThreadId);
      if (exchange) { contents[prospectId] = exchange; count++; }
    } catch { /* skip */ }
    await new Promise(r => setTimeout(r, 120));
  }
  console.log(`${count} enriched`);
  return contents;
}

async function checkRepliesForProspects(prospectIds, gmailToken = null) {
  if (!CLIENT_ID || !CLIENT_SECRET || !REFRESH_TOKEN) return; // Gmail not configured

  const idList = prospectIds.join(',');
  const rows = await sbGet(
    `email_threads?prospect_id=in.(${idList})&responded=eq.false&skipped=eq.false` +
    `&select=id,prospect_id,contact_email,contact_name,gmail_thread_id,sent_at&order=sent_at.asc`
  );
  if (rows.length === 0) return;

  process.stdout.write(`  Checking replies for ${new Set(rows.map(r => r.contact_email)).size} contact(s)... `);

  let token = gmailToken;
  if (!token) {
    try { token = await getGmailToken(); }
    catch (e) { console.log(`skipped (${e.message})`); return; }
  }

  const byThreadId = new Map();
  for (const row of rows) {
    if (!byThreadId.has(row.gmail_thread_id)) byThreadId.set(row.gmail_thread_id, []);
    byThreadId.get(row.gmail_thread_id).push(row);
  }

  const needsFallback = new Map(); // contact_email → rows[]
  let found = 0;

  for (const [threadId, threadRows] of byThreadId) {
    let gmailThread;
    try { gmailThread = await getGmailThread(token, threadId); } catch { /* skip */ }

    if (gmailThread && hasReply(gmailThread)) {
      const ids = threadRows.map(r => r.id).join(',');
      await sbPatch(`email_threads?id=in.(${ids})`, { responded: true, responded_at: new Date().toISOString() });
      found++;
    } else {
      for (const row of threadRows) {
        if (!needsFallback.has(row.contact_email)) needsFallback.set(row.contact_email, []);
        if (!needsFallback.get(row.contact_email).find(r => r.id === row.id))
          needsFallback.get(row.contact_email).push(row);
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  for (const [email, contactRows] of needsFallback) {
    const earliestSentAt = contactRows.reduce((min, r) => r.sent_at < min ? r.sent_at : min, contactRows[0].sent_at);
    let replied = false;
    try { replied = await searchInboxForReply(token, email, earliestSentAt); } catch { /* skip */ }
    if (replied) {
      const ids = contactRows.map(r => r.id).join(',');
      await sbPatch(`email_threads?id=in.(${ids})`, { responded: true, responded_at: new Date().toISOString() });
      found++;
    }
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`${found} new reply(s) detected`);
}

// ── Claude API ───────────────────────────────────────────────────────────────

async function callClaude(systemPrompt, userPrompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// ── Build company context summary ────────────────────────────────────────────

function daysSince(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d)) return null;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function buildContext(prospect, orders, emailThreadSummary, lastExchange = null) {
  const contacts = (prospect.contacts || []).map(c => ({
    name: c.name,
    role: c.role,
    email: c.email || null,
    phone: c.phone || null,
    linkedin: c.linkedIn || null,
    isChampion: c.isChampion || false,
  }));

  const recentEngagements = (prospect.engagements || [])
    .slice(-5)
    .map(e => `[${e.date}] ${e.type.toUpperCase()}: ${e.summary || e.details || ''}`);

  const orderSummary = orders.length > 0
    ? orders.map(o => `${o.order_type || 'Order'} — ${o.model_type || 'units'} — Status: ${o.status} — Value: $${o.total_value || 0} — Date: ${o.created_at?.split('T')[0]}`).join('; ')
    : null;

  const days = daysSince(prospect.last_contact);

  return {
    company: prospect.company_name,
    stage: prospect.stage || 'New Lead',
    type: prospect.type,
    market_type: prospect.market_type,
    lead_tier: prospect.lead_tier,
    last_contact_days_ago: days,
    engagement_notes: prospect.engagement_notes || null,
    recent_engagements: recentEngagements,
    contacts,
    orders: orderSummary,
    email_touches_sent: emailThreadSummary?.total || 0,
    email_any_response: emailThreadSummary?.responded || false,
    last_email_exchange: lastExchange || null,
  };
}

// ── System prompt ────────────────────────────────────────────────────────────

function buildSystemPrompt(styleGuide = null) {
return `You are an executive sales assistant for Canopus Water Technologies, a company that sells UV-C water purification systems to OEMs, distributors, and other businesses.

You will receive a list of companies from our CRM. For each company, recommend the single most valuable action Samir (our CMO) should take today.

Respond with a JSON array — one object per company — in this exact format:
[
  {
    "company": "Company Name",
    "action_type": "call" | "email" | "linkedin" | "customer_checkin" | "replenishment" | "quote_followup" | "none",
    "priority": "urgent" | "high" | "normal",
    "contact_name": "First Last",
    "contact_method": "phone number or LinkedIn URL or email address",
    "reason": "One sentence explaining why this action is needed today. Always start with how long ago the last outreach was, e.g. 'Last contacted 12 days ago — ...' or 'No prior contact — ...'.",
    "talking_point": "Specific conversation starter or key message for this outreach."
  }
]

Action type guidance:
- "call": Use when a quote was sent with no follow-up, the prospect responded to email and deserves a real conversation, or the contact has a phone number and email isn't working.
- "email": Use when a follow-up email is clearly needed and calling isn't warranted yet.
- "linkedin": Use when 2+ emails went unanswered and the contact has a LinkedIn URL — try a different channel.
- "customer_checkin": Use for existing customers (stage includes "Customer", "Indirect Customer", or "VIP") who placed an order 30-90 days ago with no recent contact — check if they've tested/deployed the units.
- "replenishment": Use for customers with a large order (10+ units) placed 90+ days ago with no recent follow-up — suggest reorder or check inventory.
- "quote_followup": Use when stage is "Quotes" and last contact was more than 5 days ago.
- "none": Use if no action is needed today (recently contacted, in progress, etc.).

Priority guidance — staleness is the primary driver. Always escalate based on how long since last contact:
- "urgent": Last contact was 21+ days ago (any active prospect), OR quote/proposal sent >7 days with no response, OR customer with no check-in in 60+ days. Null last_contact (never contacted) is always urgent.
- "high": Last contact was 10–20 days ago, OR quote sent 3–7 days ago with no response, OR customer with a recent large order and no follow-up.
- "normal": Last contact within the past 10 days and no urgent trigger above.

For contact_name and contact_method: pick the most relevant contact. Prefer the champion (isChampion=true), then the most senior person. For "call" use their phone number; for "linkedin" use their LinkedIn URL; for "email" use their email address. If the ideal method isn't available, pick the next best.

Return ONLY the JSON array with no additional text.${styleGuide ? `\n\nSamir's writing style — use this to make talking_point suggestions sound like him:\n${styleGuide}` : ''}`;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log(`\n🤖 Generating daily briefing${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

// Fetch prospects
let prospectsQuery = `prospects?select=id,company_name,contacts,engagements,engagement_notes,last_contact,stage,lead_tier,type,market_type&order=last_contact.asc.nullsfirst&limit=${LIMIT}`;
if (STAGES_ARG) {
  const stageList = STAGES_ARG.split(',').map(s => s.trim());
  prospectsQuery += `&stage=in.(${stageList.join(',')})`;
}

const allProspects = await sbGet(prospectsQuery);
const prospects = allProspects.filter(p => !SKIP_STAGES.some(s => (p.stage || '').includes(s)));
console.log(`  Analyzing ${prospects.length} companies...\n`);

// Initialize Gmail token once — shared across reply-check, style scan, and thread enrichment
let gmailToken = null;
if (CLIENT_ID && CLIENT_SECRET && REFRESH_TOKEN) {
  try { gmailToken = await getGmailToken(); }
  catch (e) { console.warn('  Gmail auth skipped:', e.message); }
}

// Check for new replies from these companies before building context
await checkRepliesForProspects(prospects.map(p => p.id), gmailToken);

// Scan recent sent emails to learn Samir's messaging style
let styleGuide = null;
if (gmailToken) styleGuide = await fetchSentStyleSnapshot(gmailToken);

// Fetch orders (for customer check-ins)
const allOrders = await sbGet('orders?select=company,status,total_value,model_type,order_type,created_at&order=created_at.desc');
const ordersByCompany = {};
for (const o of allOrders) {
  if (!ordersByCompany[o.company]) ordersByCompany[o.company] = [];
  ordersByCompany[o.company].push(o);
}

// Fetch email thread summaries (ordered desc so first row per prospect = most recent)
const threadRows = await sbGet('email_threads?select=prospect_id,responded,gmail_thread_id,sent_at&order=sent_at.desc');
const threadsByProspect = {};
for (const t of threadRows) {
  if (!threadsByProspect[t.prospect_id]) {
    threadsByProspect[t.prospect_id] = { total: 0, responded: false, latestThreadId: t.gmail_thread_id };
  }
  threadsByProspect[t.prospect_id].total++;
  if (t.responded) threadsByProspect[t.prospect_id].responded = true;
}

// Enrich active threads with actual message content so Claude can see what was said
let threadContents = {};
if (gmailToken) threadContents = await fetchAllThreadContents(gmailToken, threadsByProspect);

// Build context objects
const contexts = prospects.map(p => buildContext(
  p,
  ordersByCompany[p.company_name] || [],
  threadsByProspect[p.id] || null,
  threadContents[p.id] || null
));

// Call Claude in batches of 15
const BATCH_SIZE = 15;
const recommendations = [];

for (let i = 0; i < contexts.length; i += BATCH_SIZE) {
  const batch = contexts.slice(i, i + BATCH_SIZE);
  process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contexts.length / BATCH_SIZE)}... `);

  try {
    const userPrompt = `Here are ${batch.length} companies to analyze:\n\n${JSON.stringify(batch, null, 2)}`;
    const raw = await callClaude(buildSystemPrompt(styleGuide), userPrompt);

    // Extract JSON from response (handle any markdown wrapping)
    const jsonMatch = raw.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error('No JSON array in response');
    const recs = JSON.parse(jsonMatch[0]);
    recommendations.push(...recs);
    console.log(`✓ ${recs.length} recommendations`);
  } catch (e) {
    console.error(`\n  ✗ Batch failed: ${e.message}`);
  }

  if (i + BATCH_SIZE < contexts.length) {
    await new Promise(r => setTimeout(r, 1000)); // rate limit
  }
}

// Filter out "none" actions
const actionable = recommendations.filter(r => r.action_type !== 'none');
console.log(`\n  ${actionable.length} actionable recommendation(s) out of ${recommendations.length} companies analyzed`);

// Sort by priority then by staleness (oldest last contact first) within each group
const daysByCompany = Object.fromEntries(contexts.map(c => [c.company, c.last_contact_days_ago ?? 9999]));
const PRIORITY_ORDER = { urgent: 0, high: 1, normal: 2 };
actionable.sort((a, b) => {
  const priDiff = (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
  if (priDiff !== 0) return priDiff;
  return (daysByCompany[b.company] ?? 0) - (daysByCompany[a.company] ?? 0); // oldest first within group
});

if (DRY_RUN) {
  console.log('\n--- Preview ---\n');
  for (const r of actionable) {
    const days = daysByCompany[r.company];
    const daysLabel = days === 9999 ? 'never contacted' : `${days}d ago`;
    console.log(`[${r.priority.toUpperCase()}] ${r.company} (${daysLabel}) — ${r.action_type} → ${r.contact_name || 'N/A'}`);
    console.log(`  Why: ${r.reason}`);
    console.log(`  Say: ${r.talking_point}\n`);
  }
  console.log('\n  [Dry run — nothing saved]\n');
  process.exit(0);
}

// Delete today's existing recommendations (so re-running is idempotent)
await sbDelete(`daily_recommendations?date=eq.${TODAY}`);

// Build prospect name → ID map for DB insert
const prospectsByName = Object.fromEntries(prospects.map(p => [p.company_name, p.id]));

// Save to DB
let saved = 0;
const toInsert = [];
for (const r of actionable) {
  const prospectId = prospectsByName[r.company];
  if (!prospectId) continue;
  toInsert.push({
    prospect_id: prospectId,
    date: TODAY,
    action_type: r.action_type,
    priority: r.priority,
    contact_name: r.contact_name || null,
    contact_method: r.contact_method || null,
    reason: r.reason,
    talking_point: r.talking_point || null,
    status: 'pending',
  });
}

if (toInsert.length > 0) {
  await sbPost('daily_recommendations', toInsert);
  saved = toInsert.length;
}

console.log(`  ${saved} recommendation(s) saved to CRM`);
console.log('\n  → Open CRM → Daily Briefing to review your action list.\n');
