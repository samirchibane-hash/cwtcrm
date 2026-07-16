// Automation tick. Invoked on a schedule (pg_cron -> pg_net) or manually from
// the CRM. Walks every enrollment whose next step is due, stops sequences whose
// contact has replied, and sends the rest through Gmail.
//
// Body (all optional):
//   { dryRun?: boolean, force?: boolean, enrollmentId?: string }
//   dryRun — resolve and report what would send, without sending or writing
//   force  — ignore the business-hours send window (still honours the kill switch)

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import {
  applyVars,
  getGmailToken,
  getRfcMessageId,
  makeMime,
  renderBody,
  sendMessage,
  threadHasReply,
} from '../_shared/gmail.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const sbHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
};

async function sbGet<T>(path: string): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { headers: sbHeaders });
  if (!res.ok) throw new Error(`Supabase GET ${path}: ${await res.text()}`);
  return await res.json() as T;
}

async function sbPatch(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'PATCH',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase PATCH ${path}: ${await res.text()}`);
}

async function sbPost(path: string, body: unknown): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method: 'POST',
    headers: { ...sbHeaders, Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase POST ${path}: ${await res.text()}`);
}

// ── Types ────────────────────────────────────────────────────────────────────

type Step =
  | {
    id: string;
    type: 'email';
    subject: string;
    body: string;
    // How this touch lands in Gmail. Defaults to 'reply' when absent, so an
    // unset step threads onto the previous send rather than opening a new one.
    send_as?: 'reply' | 'new';
  }
  | { id: string; type: 'wait'; days: number };

interface Enrollment {
  id: string;
  prospect_id: string;
  prospect_name: string | null;
  contact_email: string;
  contact_name: string | null;
  steps: Step[];
  exit_on_reply: boolean;
  current_step: number;
  gmail_thread_id: string | null;
  last_rfc_message_id: string | null;
  thread_subject: string | null;
}

interface Settings {
  enabled: boolean;
  send_window_start: number;
  send_window_end: number;
  send_days: number[];
  timezone: string;
  max_sends_per_tick: number;
  daily_send_cap: number;
}

// ── Scheduling ───────────────────────────────────────────────────────────────

/**
 * Walks forward from `from`, absorbing consecutive wait steps, to find the next
 * email step and how long until it is due.
 */
function resolveNext(
  steps: Step[],
  from: number,
): { done: true; delayDays: number } | { done: false; index: number; delayDays: number } {
  let i = from;
  let delayDays = 0;
  while (i < steps.length && steps[i].type === 'wait') {
    delayDays += (steps[i] as { days: number }).days || 0;
    i++;
  }
  if (i >= steps.length) return { done: true, delayDays };
  return { done: false, index: i, delayDays };
}

/** Local wall-clock hour and ISO day-of-week (1=Mon..7=Sun) in `timezone`. */
function localHourAndDay(timezone: string): { hour: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
    weekday: 'short',
  }).formatToParts(new Date());

  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  return { hour: hour % 24, day: days.indexOf(weekday) + 1 };
}

function inSendWindow(s: Settings): boolean {
  const { hour, day } = localHourAndDay(s.timezone);
  return s.send_days.includes(day) && hour >= s.send_window_start && hour < s.send_window_end;
}

function addDays(days: number): string {
  return new Date(Date.now() + days * 86400000).toISOString();
}

// ── Tick ─────────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const { dryRun = false, force = false, enrollmentId } = await req.json().catch(() => ({}));

    const [settings] = await sbGet<Settings[]>('automation_settings?select=*&limit=1');
    if (!settings) throw new Error('automation_settings row missing');

    if (!settings.enabled) return json({ skipped: 'automations_disabled', sent: 0 });
    if (!force && !inSendWindow(settings)) {
      return json({ skipped: 'outside_send_window', timezone: settings.timezone, sent: 0 });
    }

    // Daily cap, measured against what actually went out today.
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const todays = await sbGet<{ id: string }[]>(
      `workflow_step_runs?status=eq.sent&ran_at=gte.${startOfDay.toISOString()}&select=id`,
    );
    const remainingToday = settings.daily_send_cap - todays.length;
    if (remainingToday <= 0 && !dryRun) {
      return json({ skipped: 'daily_cap_reached', cap: settings.daily_send_cap, sent: 0 });
    }

    const limit = Math.max(0, Math.min(settings.max_sends_per_tick, remainingToday));
    // Targeting one enrollment skips the due-date check but never the status
    // check — a paused or finished sequence must not send.
    const filter = enrollmentId
      ? `id=eq.${enrollmentId}&status=eq.active`
      : `status=eq.active&next_run_at=lte.${new Date().toISOString()}`;
    const due = await sbGet<Enrollment[]>(
      `workflow_enrollments?${filter}&select=*&order=next_run_at.asc&limit=${limit}`,
    );

    if (due.length === 0) return json({ sent: 0, checked: 0, results: [] });

    const token = await getGmailToken();
    const results: Record<string, unknown>[] = [];
    let sent = 0;

    for (const e of due) {
      const steps = Array.isArray(e.steps) ? e.steps : [];

      // Someone replied — stop the sequence before sending anything else.
      if (e.exit_on_reply && e.gmail_thread_id) {
        try {
          if (await threadHasReply(token, e.gmail_thread_id)) {
            if (!dryRun) {
              await sbPatch(`workflow_enrollments?id=eq.${e.id}`, {
                status: 'replied',
                next_run_at: null,
                completed_at: new Date().toISOString(),
              });
            }
            results.push({ enrollment: e.id, contact: e.contact_email, action: 'stopped_replied' });
            continue;
          }
        } catch (err) {
          // A reply check that fails must not cause a send we can't justify.
          results.push({
            enrollment: e.id,
            contact: e.contact_email,
            action: 'skipped_reply_check_failed',
            error: (err as Error).message,
          });
          continue;
        }
      }

      const next = resolveNext(steps, e.current_step);

      if (next.done) {
        if (!dryRun) {
          await sbPatch(`workflow_enrollments?id=eq.${e.id}`, {
            status: 'completed',
            next_run_at: null,
            completed_at: new Date().toISOString(),
          });
        }
        results.push({ enrollment: e.id, contact: e.contact_email, action: 'completed' });
        continue;
      }

      // Sitting on a wait (e.g. a workflow that opens with one) — just reschedule.
      if (next.delayDays > 0) {
        if (!dryRun) {
          await sbPatch(`workflow_enrollments?id=eq.${e.id}`, {
            current_step: next.index,
            next_run_at: addDays(next.delayDays),
          });
        }
        results.push({
          enrollment: e.id,
          contact: e.contact_email,
          action: 'waiting',
          due_in_days: next.delayDays,
        });
        continue;
      }

      const step = steps[next.index] as Extract<Step, { type: 'email' }>;
      const contactName = e.contact_name || e.contact_email.split('@')[0];
      const vars = {
        firstName: contactName.split(' ')[0],
        contactName,
        companyName: e.prospect_name ?? '',
      };

      // Reply is the default; 'new' deliberately opens a fresh thread. The first
      // touch has nothing to reply to, so it always starts one regardless.
      const hasThread = Boolean(e.gmail_thread_id && e.last_rfc_message_id);
      const startNewThread = step.send_as === 'new' || !hasThread;
      // Merge fields must be substituted in the subject too, not just the body.
      // thread_subject is stored already rendered.
      const baseSubject = applyVars(step.subject || '', vars) || e.thread_subject || '';
      const subject = startNewThread
        ? baseSubject
        : (baseSubject.startsWith('Re:') ? baseSubject : `Re: ${e.thread_subject || baseSubject}`);

      if (dryRun) {
        results.push({
          enrollment: e.id,
          contact: e.contact_email,
          action: 'would_send',
          step_index: next.index,
          subject,
          as_reply: !startNewThread,
        });
        continue;
      }

      try {
        const html = renderBody(step.body, vars);
        const raw = makeMime(
          e.contact_email,
          subject,
          html,
          startNewThread ? {} : {
            inReplyTo: e.last_rfc_message_id ?? undefined,
            references: e.last_rfc_message_id ?? undefined,
          },
        );
        const result = await sendMessage(
          token,
          raw,
          startNewThread ? undefined : e.gmail_thread_id ?? undefined,
        );
        const rfcId = await getRfcMessageId(token, result.id);

        await sbPost('workflow_step_runs', {
          enrollment_id: e.id,
          step_index: next.index,
          step_id: step.id,
          status: 'sent',
          subject,
          gmail_message_id: result.id,
          gmail_thread_id: result.threadId,
          rfc_message_id: rfcId,
        });

        // Mirror into email_threads so the existing follow-up/reply tooling
        // sees automation touches too.
        await sbPost('email_threads', {
          prospect_id: e.prospect_id,
          contact_email: e.contact_email,
          contact_name: e.contact_name,
          gmail_thread_id: result.threadId,
          gmail_message_id: rfcId || result.id,
          subject,
          sequence_number: next.index + 1,
        });

        const after = resolveNext(steps, next.index + 1);
        await sbPatch(`workflow_enrollments?id=eq.${e.id}`, {
          // The anchor always moves to the newest send, so a later 'reply' step
          // threads onto the most recent email rather than a stale one.
          gmail_thread_id: result.threadId,
          last_rfc_message_id: rfcId || e.last_rfc_message_id,
          thread_subject: startNewThread ? subject : e.thread_subject ?? subject,
          last_error: null,
          ...(after.done
            ? { status: 'completed', next_run_at: null, completed_at: new Date().toISOString() }
            : { current_step: after.index, next_run_at: addDays(after.delayDays) }),
        });

        sent++;
        results.push({
          enrollment: e.id,
          contact: e.contact_email,
          action: 'sent',
          step_index: next.index,
          subject,
        });
      } catch (err) {
        const message = (err as Error).message;
        await sbPost('workflow_step_runs', {
          enrollment_id: e.id,
          step_index: next.index,
          step_id: step.id,
          status: 'failed',
          subject,
          error: message,
        });
        // Park it rather than retrying blindly against a broken address.
        await sbPatch(`workflow_enrollments?id=eq.${e.id}`, {
          status: 'failed',
          next_run_at: null,
          last_error: message,
        });
        results.push({ enrollment: e.id, contact: e.contact_email, action: 'failed', error: message });
      }

      await new Promise((r) => setTimeout(r, 200));
    }

    return json({ sent, checked: due.length, dryRun, results });
  } catch (error) {
    console.error('run-automations error:', error);
    return json({ error: (error as Error).message }, 500);
  }
});
