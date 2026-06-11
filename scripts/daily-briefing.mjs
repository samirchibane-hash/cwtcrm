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

const SUPABASE_URL     = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY           = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;

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

function buildContext(prospect, orders, emailThreadSummary) {
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
  };
}

// ── System prompt ────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are an executive sales assistant for Canopus Water Technologies, a company that sells UV-C water purification systems to OEMs, distributors, and other businesses.

You will receive a list of companies from our CRM. For each company, recommend the single most valuable action Samir (our CMO) should take today.

Respond with a JSON array — one object per company — in this exact format:
[
  {
    "company": "Company Name",
    "action_type": "call" | "email" | "linkedin" | "customer_checkin" | "replenishment" | "quote_followup" | "none",
    "priority": "urgent" | "high" | "normal",
    "contact_name": "First Last",
    "contact_method": "phone number or LinkedIn URL or email address",
    "reason": "One sentence explaining why this action is needed today.",
    "talking_point": "Specific conversation starter or key message for this outreach."
  }
]

Action type guidance:
- "call": Use when a quote was sent with no follow-up, the prospect responded to email and deserves a real conversation, or the contact has a phone number and email isn't working.
- "email": Use when a follow-up email is clearly needed and calling isn't warranted yet.
- "linkedin": Use when 2+ emails went unanswered and the contact has a LinkedIn URL — try a different channel.
- "customer_checkin": Use for existing customers (lead_tier="Customer" or stage includes "Closed Won") who placed an order 30-90 days ago with no recent contact — check if they've tested/deployed the units.
- "replenishment": Use for customers with a large order (10+ units) placed 90+ days ago with no recent follow-up — suggest reorder or check inventory.
- "quote_followup": Use when stage is "Quotes" and last contact was more than 5 days ago.
- "none": Use if no action is needed today (recently contacted, in progress, etc.).

Priority guidance:
- "urgent": Quote/proposal sent >7 days ago with no response, OR customer with delivered units and no check-in in 60+ days.
- "high": Active prospect >5 days without contact, OR customer with recent large order.
- "normal": Routine follow-up, longer-term nurture.

For contact_name and contact_method: pick the most relevant contact. Prefer the champion (isChampion=true), then the most senior person. For "call" use their phone number; for "linkedin" use their LinkedIn URL; for "email" use their email address. If the ideal method isn't available, pick the next best.

Return ONLY the JSON array with no additional text.`;

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

// Fetch orders (for customer check-ins)
const allOrders = await sbGet('orders?select=company,status,total_value,model_type,order_type,created_at&order=created_at.desc');
const ordersByCompany = {};
for (const o of allOrders) {
  if (!ordersByCompany[o.company]) ordersByCompany[o.company] = [];
  ordersByCompany[o.company].push(o);
}

// Fetch email thread summaries
const threadRows = await sbGet('email_threads?select=prospect_id,responded&order=sent_at.desc');
const threadsByProspect = {};
for (const t of threadRows) {
  if (!threadsByProspect[t.prospect_id]) threadsByProspect[t.prospect_id] = { total: 0, responded: false };
  threadsByProspect[t.prospect_id].total++;
  if (t.responded) threadsByProspect[t.prospect_id].responded = true;
}

// Build context objects
const contexts = prospects.map(p => buildContext(
  p,
  ordersByCompany[p.company_name] || [],
  threadsByProspect[p.id] || null
));

// Call Claude in batches of 15
const BATCH_SIZE = 15;
const recommendations = [];

for (let i = 0; i < contexts.length; i += BATCH_SIZE) {
  const batch = contexts.slice(i, i + BATCH_SIZE);
  process.stdout.write(`  Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(contexts.length / BATCH_SIZE)}... `);

  try {
    const userPrompt = `Here are ${batch.length} companies to analyze:\n\n${JSON.stringify(batch, null, 2)}`;
    const raw = await callClaude(SYSTEM_PROMPT, userPrompt);

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

if (DRY_RUN) {
  console.log('\n--- Preview ---\n');
  const byPriority = { urgent: [], high: [], normal: [] };
  for (const r of actionable) {
    (byPriority[r.priority] || byPriority.normal).push(r);
  }
  for (const [pri, recs] of Object.entries(byPriority)) {
    if (recs.length === 0) continue;
    console.log(`\n[${pri.toUpperCase()}]`);
    for (const r of recs) {
      console.log(`  ${r.company} — ${r.action_type} → ${r.contact_name || 'N/A'} (${r.contact_method || 'N/A'})`);
      console.log(`    Why: ${r.reason}`);
      console.log(`    Say: ${r.talking_point}`);
    }
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
