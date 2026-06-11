#!/usr/bin/env node
/**
 * followup-agent.mjs
 *
 * Builds the daily email follow-up queue. For every company that hasn't
 * responded and is due for another touch, creates an outreach_sessions row
 * (session_type='followup') that you approve in the CRM → Follow-up Queue tab.
 *
 * Usage:
 *   node scripts/followup-agent.mjs [options]
 *   node scripts/followup-agent.mjs --session <id>   ← execute an approved follow-up session
 *
 * Options:
 *   --days N        Min days since last touch to qualify (default: 5)
 *   --limit N       Max companies to queue (default: 30)
 *   --dry-run       Print queue without creating sessions
 *   --session <id>  Execute an approved follow-up session (send emails as replies)
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env'), 'utf8')
    .split('\n')
    .filter(l => l.includes('=') && !l.startsWith('#'))
    .map(l => { const [k, ...v] = l.split('='); return [k.trim(), v.join('=').trim().replace(/^["']|["']$/g, '')]; })
);

const SUPABASE_URL   = env.VITE_SUPABASE_URL || `https://${env.VITE_SUPABASE_PROJECT_ID}.supabase.co`;
const SB_KEY         = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
const CLIENT_ID      = env.VITE_GOOGLE_CLIENT_ID;
const CLIENT_SECRET  = env.GOOGLE_CLIENT_SECRET;
const REFRESH_TOKEN  = env.GOOGLE_REFRESH_TOKEN;
const FROM           = 'samir@canopuswatertechnologies.com';

const args       = process.argv.slice(2);
const getFlag    = (f) => { const i = args.indexOf(f); return i !== -1 ? args[i + 1] : null; };
const SESSION_ID = getFlag('--session');
const MIN_DAYS   = parseInt(getFlag('--days') || '5');
const LIMIT      = parseInt(getFlag('--limit') || '30');
const DRY_RUN    = args.includes('--dry-run');

// Follow-up cadence: sequence_number → min days since previous touch
const CADENCE = { 2: 5, 3: 12, 4: 26 };
const MAX_SEQUENCE = 4;

const SIGNATURE = `<div dir="ltr"><div dir="ltr" style="color:rgb(34,34,34)"><div dir="ltr"><div dir="ltr"><div dir="ltr"><div><div><div><b>Samir Chibane</b><br></div>Chief Marketing Officer<br><span style="font-size:12.8px">Canopus Water Technologies Inc.<br></span><img src="https://ci3.googleusercontent.com/mail-sig/AIorK4wNPew27ctjfDTJcQYws2TfSh4sKVvrD3PBrJ5siii-INAgjHySmu-F9hNHWt3AnQd56yLC3-VNni5l"><br></div><div>Mobile: (617) 653-7033</div></div>Email: <a href="mailto:samir@canopuswatertechnologies.com" style="color:rgb(17,85,204)" target="_blank">samir@canopuswatertechnologies.com</a></div><div dir="ltr"><font size="2">Website: <a href="http://canopuswater.co" style="color:rgb(17,85,204)" target="_blank">canopuswater.co</a></font></div><div dir="ltr"><br></div></div></div></div><div dir="ltr" style="color:rgb(34,34,34)"><div>The information contained in this communication from the sender is confidential. It is intended solely for use by the recipient and others authorized to receive it. If you are not the recipient, you are hereby notified that any disclosure, copying, distribution or taking action in relation of the contents of this information is strictly prohibited and may be unlawful.</div></div></div>`;

// ── Template loader ──────────────────────────────────────────────────────────

function loadTemplate(filename) {
  const path = resolve(__dirname, 'templates', filename);
  if (!existsSync(path)) return null;
  const raw = readFileSync(path, 'utf8');
  // Strip markdown metadata lines (lines starting with # or **)
  return raw.split('\n')
    .filter(l => !l.startsWith('#') && !l.startsWith('**') && !l.startsWith('---'))
    .join('\n')
    .trim();
}

const TEMPLATES = {
  2: loadTemplate('uvc-followup-demo.md'),
  3: loadTemplate('uvc-followup-3.md'),
  4: loadTemplate('uvc-followup-4.md'),
};

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
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${await res.text()}`);
  return res.json();
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

// ── Gmail helpers ────────────────────────────────────────────────────────────

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

function buildReplyMime(to, htmlBody, subject, inReplyTo, threadGmailId) {
  const lines = [
    `From: ${FROM}`,
    `To: ${to}`,
    `Subject: ${subject.startsWith('Re:') ? subject : 'Re: ' + subject}`,
    `In-Reply-To: ${inReplyTo}`,
    `References: ${inReplyTo}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/html; charset=utf-8`,
    ``,
    htmlBody,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64url');
}

async function sendReply(token, raw, threadId) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, threadId }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
  return res.json();
}

async function createReplyDraft(token, raw, threadId) {
  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: { raw, threadId } }),
  });
  if (!res.ok) throw new Error(JSON.stringify(await res.json()));
}

async function getRfcMessageId(token, gmailId) {
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages/${gmailId}?format=metadata&metadataHeaders=Message-ID`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  if (!res.ok) return '';
  const data = await res.json();
  return data.payload?.headers?.find(h => h.name === 'Message-ID')?.value ?? '';
}

// ── Execute approved follow-up session ───────────────────────────────────────

if (SESSION_ID) {
  console.log(`\n📤 Executing approved follow-up session: ${SESSION_ID}\n`);

  const res = await fetch(`${SUPABASE_URL}/rest/v1/outreach_sessions?id=eq.${SESSION_ID}&select=*`, {
    headers: { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` },
  });
  const [session] = await res.json();

  if (!session) { console.error('Session not found.'); process.exit(1); }
  if (session.status !== 'approved') {
    console.error(`Session status is "${session.status}" — must be "approved" to execute.`);
    process.exit(1);
  }

  const approvedIds  = new Set(session.approved_email_ids || []);
  const contacts     = (session.discovered_contacts || []).filter(c => approvedIds.has(c.id || c.apolloId) && c.email);
  const companyName  = session.prospect_name;
  const prospectId   = session.prospect_id;
  const bodyTemplate = session.email_body || session.body_template || '';
  const subject      = session.email_subject || '';
  const sequence     = session.followup_sequence || 2;
  const mode         = session.email_mode || 'draft';

  console.log(`  Company:   ${companyName}`);
  console.log(`  Touch:     Follow-up #${sequence}`);
  console.log(`  Emailing:  ${contacts.length} contact(s) [${mode}]`);
  console.log(`  Subject:   ${subject.startsWith('Re:') ? subject : 'Re: ' + subject}\n`);

  // Load thread info for each contact so we can reply in-thread
  const threadRows = await sbGet(
    `email_threads?prospect_id=eq.${prospectId}&responded=eq.false&skipped=eq.false&order=sent_at.desc&select=contact_email,gmail_thread_id,gmail_message_id,subject`
  );
  const threadByEmail = Object.fromEntries(threadRows.map(t => [t.contact_email, t]));

  const token = await getGmailToken();
  let count = 0;

  for (const c of contacts) {
    const firstName = c.name.split(' ')[0];
    const personalized = bodyTemplate
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{companyName\}/g, companyName);
    const html = `<div dir="ltr">\n${personalized.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>')}<br><br>\n${SIGNATURE}\n</div>`;

    const thread = threadByEmail[c.email];
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${thread?.subject || subject}`;

    try {
      let gmailResult;
      if (thread?.gmail_thread_id) {
        const raw = buildReplyMime(c.email, html, replySubject, thread.gmail_message_id, thread.gmail_thread_id);
        if (mode === 'send') {
          gmailResult = await sendReply(token, raw, thread.gmail_thread_id);
        } else {
          await createReplyDraft(token, raw, thread.gmail_thread_id);
        }
      } else {
        // No original thread found — send as new email
        const mimeLines = [
          `From: ${FROM}`, `To: ${c.email}`, `Subject: ${replySubject}`,
          `MIME-Version: 1.0`, `Content-Type: text/html; charset=utf-8`, ``, html,
        ];
        const raw = Buffer.from(mimeLines.join('\r\n')).toString('base64url');
        if (mode === 'send') {
          gmailResult = await sendReply(token, raw);
        } else {
          await fetch('https://gmail.googleapis.com/gmail/v1/users/me/drafts', {
            method: 'POST',
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: { raw } }),
          });
        }
      }

      if (mode === 'send' && gmailResult) {
        const rfcId = await getRfcMessageId(token, gmailResult.id);
        await sbPost('email_threads', {
          prospect_id: prospectId,
          contact_email: c.email,
          contact_name: c.name,
          gmail_thread_id: gmailResult.threadId,
          gmail_message_id: rfcId || gmailResult.id,
          subject: replySubject,
          sequence_number: sequence,
          outreach_session_id: SESSION_ID,
        });
      }

      console.log(`  ✓ ${firstName} <${c.email}>`);
      count++;
    } catch (e) {
      console.error(`  ✗ ${c.email}: ${e.message}`);
    }

    await new Promise(r => setTimeout(r, 200));
  }

  // Log engagement
  if (count > 0 && prospectId) {
    const [prospect] = await sbGet(`prospects?id=eq.${prospectId}&select=engagements,company_name`);
    const engagements = prospect?.engagements || [];
    const now = new Date().toISOString().split('T')[0];
    engagements.push({
      id: `eng-followup-${Date.now()}`,
      date: now,
      type: 'email',
      summary: `Follow-up #${sequence} sent to ${count} contact(s) at ${companyName}`,
      activity: { emails: count },
      loggedBy: 'Samir Chibane',
    });
    await sbPatch(`prospects?id=eq.${prospectId}`, { engagements, last_contact: now });
  }

  await sbPatch(`outreach_sessions?id=eq.${SESSION_ID}`, { status: 'completed' });

  console.log(`\n  ${count} message(s) ${mode === 'send' ? 'sent' : 'drafted'}`);
  console.log(`  Session ${SESSION_ID} marked completed.\n`);
  if (mode !== 'send') console.log('  Check your Gmail Drafts folder.\n');

  process.exit(0);
}

// ── Build follow-up queue ────────────────────────────────────────────────────

console.log(`\n📋 Building follow-up queue (min ${MIN_DAYS} days since last touch)${DRY_RUN ? ' [DRY RUN]' : ''}...\n`);

// Get all unreplied threads grouped by prospect
const allThreads = await sbGet(
  'email_threads?responded=eq.false&skipped=eq.false&select=id,prospect_id,contact_email,contact_name,gmail_thread_id,gmail_message_id,subject,sent_at,sequence_number&order=sent_at.asc'
);

// Group by prospect: compute max sequence and latest sent_at, skip any where ANY contact responded
const repliedProspects = new Set(
  (await sbGet('email_threads?responded=eq.true&select=prospect_id')).map(t => t.prospect_id)
);

const prospectMap = {};
for (const t of allThreads) {
  if (repliedProspects.has(t.prospect_id)) continue;
  if (!prospectMap[t.prospect_id]) {
    prospectMap[t.prospect_id] = { threads: [], maxSeq: 0, latestSentAt: null };
  }
  const p = prospectMap[t.prospect_id];
  p.threads.push(t);
  if (t.sequence_number > p.maxSeq) p.maxSeq = t.sequence_number;
  if (!p.latestSentAt || t.sent_at > p.latestSentAt) p.latestSentAt = t.sent_at;
}

const now = Date.now();
const due = [];

for (const [prospectId, info] of Object.entries(prospectMap)) {
  const nextSeq = info.maxSeq + 1;
  if (nextSeq > MAX_SEQUENCE) continue; // exhausted all touches

  const minDaysForSeq = CADENCE[nextSeq] || MIN_DAYS;
  const daysSince = (now - new Date(info.latestSentAt).getTime()) / 86400000;
  if (daysSince < minDaysForSeq) continue;

  due.push({ prospectId, nextSeq, daysSince: Math.floor(daysSince), threads: info.threads });
}

due.sort((a, b) => b.daysSince - a.daysSince);
const queued = due.slice(0, LIMIT);

if (queued.length === 0) {
  console.log('  No companies due for follow-up today.\n');
  process.exit(0);
}

// Fetch prospect details for each
const prospectIds = queued.map(q => q.prospectId);
const prospectsRaw = await sbGet(
  `prospects?id=in.(${prospectIds.join(',')})&select=id,company_name,contacts,engagements,stage,lead_tier`
);
const prospectsById = Object.fromEntries(prospectsRaw.map(p => [p.id, p]));

// Skip prospects in terminal stages
const SKIP_STAGES = ['No Current Interest', 'Longterm'];

let created = 0;
for (const item of queued) {
  const prospect = prospectsById[item.prospectId];
  if (!prospect) continue;
  if (SKIP_STAGES.some(s => (prospect.stage || '').includes(s))) continue;

  const template = TEMPLATES[item.nextSeq];
  if (!template) {
    console.log(`  ⚠ No template for follow-up #${item.nextSeq} — skipping ${prospect.company_name}. Add uvc-followup-${item.nextSeq}.md to scripts/templates/`);
    continue;
  }

  // Contacts to email: those who have an unreplied thread
  const emailedContacts = item.threads.map(t => ({
    id: t.contact_email,
    apolloId: t.contact_email,
    name: t.contact_name || t.contact_email.split('@')[0],
    email: t.contact_email,
  }));

  // Original subject from first thread
  const originalThread = item.threads.find(t => t.sequence_number === 1) || item.threads[0];
  const replySubject = `Re: ${originalThread.subject}`;

  if (DRY_RUN) {
    console.log(`  [DRY RUN] ${prospect.company_name} — Follow-up #${item.nextSeq} — ${item.daysSince}d ago — ${emailedContacts.length} contact(s)`);
    continue;
  }

  // Find the original outreach session to link back to
  const originalSessionId = originalThread ? null : null; // will be null unless we query it

  const [session] = await sbPost('outreach_sessions', {
    prospect_id: item.prospectId,
    prospect_name: prospect.company_name,
    discovered_contacts: emailedContacts,
    email_subject: replySubject,
    email_body: template,
    email_mode: 'send',
    status: 'pending',
    approved_import_ids: [],
    approved_email_ids: [],
    session_type: 'followup',
    followup_sequence: item.nextSeq,
  });

  created++;
  console.log(`  ✓ Queued: ${prospect.company_name} — Follow-up #${item.nextSeq} — ${item.daysSince}d since last touch — ${emailedContacts.length} contact(s)`);
  console.log(`    Session: ${session.id}`);
}

console.log(`\n--- Summary ---`);
console.log(`  ${queued.length} company(s) due for follow-up`);
console.log(`  ${created} session(s) created`);
if (created > 0) {
  console.log('\n  → Open CRM → Claude Agent → Follow-up Queue tab to review and approve.\n');
}
if (DRY_RUN) console.log('  [Dry run — no sessions created]\n');
