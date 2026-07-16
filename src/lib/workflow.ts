// Domain model for email automation workflows.
//
// A workflow is an ordered list of steps. Enrolling a contact deep-copies the
// steps onto the enrollment, so editing one contact's emails never touches the
// template or anyone else's queued mail.

export type SendAs = 'reply' | 'new';

export interface EmailStep {
  id: string;
  type: 'email';
  subject: string;
  body: string;
  /**
   * How the touch lands in Gmail. 'reply' threads onto the previous send;
   * 'new' opens a fresh thread. Defaults to 'reply' when absent — the first
   * email in a workflow always starts a thread regardless, having nothing to
   * reply to.
   */
  sendAs: SendAs;
}

export interface WaitStep {
  id: string;
  type: 'wait';
  days: number;
}

export type WorkflowStep = EmailStep | WaitStep;

export const MERGE_FIELDS = [
  { token: '{firstName}', label: 'First name' },
  { token: '{contactName}', label: 'Full name' },
  { token: '{companyName}', label: 'Company' },
] as const;

const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? `s-${Date.now()}-${Math.random().toString(36).slice(2)}`);

export const newEmailStep = (overrides: Partial<EmailStep> = {}): EmailStep => ({
  id: uid(),
  type: 'email',
  subject: '',
  body: '',
  sendAs: 'reply',
  ...overrides,
});

export const newWaitStep = (days = 3): WaitStep => ({ id: uid(), type: 'wait', days });

// ── Serialisation ────────────────────────────────────────────────────────────
// The DB stores steps as snake_case JSON (the edge function reads `send_as`),
// while the UI works in camelCase.

export const stepsToJson = (steps: WorkflowStep[]): unknown =>
  steps.map((s) =>
    s.type === 'email'
      ? { id: s.id, type: 'email', subject: s.subject, body: s.body, send_as: s.sendAs }
      : { id: s.id, type: 'wait', days: s.days },
  );

export const stepsFromJson = (json: unknown): WorkflowStep[] => {
  if (!Array.isArray(json)) return [];
  return json.flatMap((raw): WorkflowStep[] => {
    const s = raw as Record<string, unknown>;
    if (s?.type === 'email') {
      return [{
        id: String(s.id ?? uid()),
        type: 'email',
        subject: String(s.subject ?? ''),
        body: String(s.body ?? ''),
        sendAs: s.send_as === 'new' ? 'new' : 'reply',
      }];
    }
    if (s?.type === 'wait') {
      return [{ id: String(s.id ?? uid()), type: 'wait', days: Number(s.days ?? 0) }];
    }
    return [];
  });
};

/** Deep copy for snapshot-on-enroll, with fresh step ids. */
export const cloneSteps = (steps: WorkflowStep[]): WorkflowStep[] =>
  steps.map((s) => ({ ...s, id: uid() }));

// ── Scheduling ───────────────────────────────────────────────────────────────
// Mirrors resolveNext() in supabase/functions/run-automations. Kept in sync by
// hand: the engine runs on Deno and can't import from src/.

export const emailSteps = (steps: WorkflowStep[]): EmailStep[] =>
  steps.filter((s): s is EmailStep => s.type === 'email');

/** True when this email step will actually thread onto a previous send. */
export const willReply = (steps: WorkflowStep[], index: number): boolean => {
  const step = steps[index];
  if (step?.type !== 'email' || step.sendAs !== 'reply') return false;
  // Nothing to reply to until an earlier email has gone out.
  return steps.slice(0, index).some((s) => s.type === 'email');
};

/**
 * The subject a reply at `index` inherits. Gmail keeps the subject of the
 * thread being replied to, and the engine re-anchors on every send — so this
 * is the most recent preceding email that opened a thread, not the first one.
 */
export const threadSubjectFor = (steps: WorkflowStep[], index: number): string => {
  for (let i = index - 1; i >= 0; i--) {
    const s = steps[i];
    if (s.type !== 'email') continue;
    const isFirstEmail = !steps.slice(0, i).some((x) => x.type === 'email');
    if (s.sendAs === 'new' || isFirstEmail) return s.subject;
  }
  return '';
};

export interface ScheduledStep {
  step: EmailStep;
  index: number;
  dayOffset: number;
  date: Date;
}

/** Cumulative send dates for each email step, for the builder's timeline. */
export const schedulePreview = (steps: WorkflowStep[], from = new Date()): ScheduledStep[] => {
  const out: ScheduledStep[] = [];
  let dayOffset = 0;
  steps.forEach((step, index) => {
    if (step.type === 'wait') {
      dayOffset += step.days || 0;
      return;
    }
    out.push({
      step,
      index,
      dayOffset,
      date: new Date(from.getTime() + dayOffset * 86400000),
    });
  });
  return out;
};

export const totalDays = (steps: WorkflowStep[]): number =>
  steps.reduce((sum, s) => sum + (s.type === 'wait' ? s.days || 0 : 0), 0);

// ── Validation ───────────────────────────────────────────────────────────────

export const validateSteps = (steps: WorkflowStep[]): string[] => {
  const errors: string[] = [];
  const emails = emailSteps(steps);

  if (emails.length === 0) errors.push('Add at least one email.');

  steps.forEach((s, i) => {
    if (s.type === 'wait' && (!Number.isFinite(s.days) || s.days < 1)) {
      errors.push(`Step ${i + 1}: wait must be at least 1 day.`);
    }
    if (s.type === 'email') {
      // A reply inherits its thread's subject, so only a new thread needs one.
      if (!s.subject.trim() && !willReply(steps, i)) {
        errors.push(`Step ${i + 1}: subject is required for an email that starts a new thread.`);
      }
      if (!s.body.trim()) errors.push(`Step ${i + 1}: body is empty.`);
    }
  });

  return errors;
};

/** Renders merge fields for the preview pane. */
export const renderPreview = (text: string, vars: Record<string, string>): string => {
  let out = text;
  for (const [key, value] of Object.entries(vars)) {
    out = out.replace(new RegExp(`\\{${key}\\}`, 'g'), value || `{${key}}`);
  }
  return out;
};
