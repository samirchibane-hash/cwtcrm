import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Json, Tables, TablesUpdate } from '@/integrations/supabase/types';
import {
  cloneSteps,
  stepsFromJson,
  stepsToJson,
  type WorkflowStep,
} from '@/lib/workflow';

export interface WorkflowTemplate {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  exitOnReply: boolean;
  createdAt: string;
  updatedAt: string;
}

export type EnrollmentStatus =
  | 'active'
  | 'paused'
  | 'completed'
  | 'replied'
  | 'stopped'
  | 'failed';

export interface Enrollment {
  id: string;
  templateId?: string;
  templateName?: string;
  prospectId: string;
  prospectName?: string;
  contactEmail: string;
  contactName?: string;
  steps: WorkflowStep[];
  exitOnReply: boolean;
  status: EnrollmentStatus;
  currentStep: number;
  nextRunAt?: string;
  lastError?: string;
  enrolledAt: string;
  completedAt?: string;
}

const mapTemplate = (row: Tables<'workflow_templates'>): WorkflowTemplate => ({
  id: row.id,
  name: row.name,
  description: row.description || undefined,
  steps: stepsFromJson(row.steps),
  exitOnReply: row.exit_on_reply,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapEnrollment = (row: Tables<'workflow_enrollments'>): Enrollment => ({
  id: row.id,
  templateId: row.template_id || undefined,
  templateName: row.template_name || undefined,
  prospectId: row.prospect_id,
  prospectName: row.prospect_name || undefined,
  contactEmail: row.contact_email,
  contactName: row.contact_name || undefined,
  steps: stepsFromJson(row.steps),
  exitOnReply: row.exit_on_reply,
  status: row.status as EnrollmentStatus,
  currentStep: row.current_step,
  nextRunAt: row.next_run_at || undefined,
  lastError: row.last_error || undefined,
  enrolledAt: row.enrolled_at,
  completedAt: row.completed_at || undefined,
});

// ── Templates ────────────────────────────────────────────────────────────────

export const useWorkflowTemplates = () => {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('archived', false)
      .order('updated_at', { ascending: false });
    if (!error && data) setTemplates(data.map(mapTemplate));
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const createTemplate = async (input: {
    name: string;
    description?: string;
    steps: WorkflowStep[];
    exitOnReply?: boolean;
    derivedFromEnrollmentId?: string;
  }): Promise<WorkflowTemplate | null> => {
    const { data, error } = await supabase
      .from('workflow_templates')
      .insert({
        name: input.name,
        description: input.description || null,
        steps: stepsToJson(input.steps) as Json,
        exit_on_reply: input.exitOnReply ?? true,
        derived_from_enrollment_id: input.derivedFromEnrollmentId || null,
      })
      .select()
      .single();
    if (error || !data) return null;
    const created = mapTemplate(data);
    setTemplates(prev => [created, ...prev]);
    return created;
  };

  const updateTemplate = async (id: string, patch: Partial<WorkflowTemplate>) => {
    const payload: TablesUpdate<'workflow_templates'> = {};
    if (patch.name !== undefined) payload.name = patch.name;
    if (patch.description !== undefined) payload.description = patch.description || null;
    if (patch.steps !== undefined) payload.steps = stepsToJson(patch.steps) as Json;
    if (patch.exitOnReply !== undefined) payload.exit_on_reply = patch.exitOnReply;

    const { data, error } = await supabase
      .from('workflow_templates')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return null;
    const updated = mapTemplate(data);
    setTemplates(prev => prev.map(t => (t.id === id ? updated : t)));
    return updated;
  };

  // Archive rather than delete: enrollments reference the template for provenance.
  const archiveTemplate = async (id: string) => {
    await supabase.from('workflow_templates').update({ archived: true }).eq('id', id);
    setTemplates(prev => prev.filter(t => t.id !== id));
  };

  const duplicateTemplate = async (t: WorkflowTemplate) =>
    createTemplate({
      name: `${t.name} (copy)`,
      description: t.description,
      steps: cloneSteps(t.steps),
      exitOnReply: t.exitOnReply,
    });

  return {
    templates,
    isLoading,
    reload: load,
    createTemplate,
    updateTemplate,
    archiveTemplate,
    duplicateTemplate,
  };
};

// ── Enrollments ──────────────────────────────────────────────────────────────

export const useEnrollments = (prospectId?: string) => {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    let query = supabase
      .from('workflow_enrollments')
      .select('*')
      .order('enrolled_at', { ascending: false });
    if (prospectId) query = query.eq('prospect_id', prospectId);

    const { data, error } = await query;
    if (!error && data) setEnrollments(data.map(mapEnrollment));
    setIsLoading(false);
  }, [prospectId]);

  useEffect(() => { load(); }, [load]);

  const enroll = async (input: {
    template?: WorkflowTemplate;
    templateName?: string;
    prospectId: string;
    prospectName: string;
    contactEmail: string;
    contactName?: string;
    steps: WorkflowStep[];
    exitOnReply?: boolean;
  }): Promise<{ enrollment?: Enrollment; error?: string }> => {
    const { data, error } = await supabase
      .from('workflow_enrollments')
      .insert({
        template_id: input.template?.id ?? null,
        template_name: input.templateName ?? input.template?.name ?? 'Custom sequence',
        prospect_id: input.prospectId,
        prospect_name: input.prospectName,
        contact_email: input.contactEmail,
        contact_name: input.contactName ?? null,
        // Snapshot: this contact's own editable copy.
        steps: stepsToJson(input.steps) as Json,
        exit_on_reply: input.exitOnReply ?? input.template?.exitOnReply ?? true,
        status: 'active',
        current_step: 0,
        // Due immediately; the engine resolves any leading wait itself.
        next_run_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      // Partial unique index on (prospect, contact, template) where active/paused.
      if (error.code === '23505') {
        return { error: 'This contact is already enrolled in that workflow.' };
      }
      return { error: error.message };
    }
    const created = mapEnrollment(data);
    setEnrollments(prev => [created, ...prev]);
    return { enrollment: created };
  };

  const updateEnrollment = async (id: string, patch: Partial<Enrollment>) => {
    const payload: TablesUpdate<'workflow_enrollments'> = {};
    if (patch.steps !== undefined) payload.steps = stepsToJson(patch.steps) as Json;
    if (patch.status !== undefined) payload.status = patch.status;
    if (patch.exitOnReply !== undefined) payload.exit_on_reply = patch.exitOnReply;
    if (patch.nextRunAt !== undefined) payload.next_run_at = patch.nextRunAt;

    const { data, error } = await supabase
      .from('workflow_enrollments')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (error || !data) return null;
    const updated = mapEnrollment(data);
    setEnrollments(prev => prev.map(e => (e.id === id ? updated : e)));
    return updated;
  };

  const setStatus = (id: string, status: EnrollmentStatus) => {
    // Resuming needs a due time again; stopping should clear it.
    const extra =
      status === 'active'
        ? { nextRunAt: new Date().toISOString() }
        : status === 'stopped'
          ? { nextRunAt: null as unknown as string }
          : {};
    return updateEnrollment(id, { status, ...extra });
  };

  return { enrollments, isLoading, reload: load, enroll, updateEnrollment, setStatus };
};

// ── Global rails ─────────────────────────────────────────────────────────────

export interface AutomationSettings {
  enabled: boolean;
  sendWindowStart: number;
  sendWindowEnd: number;
  sendDays: number[];
  timezone: string;
  dailySendCap: number;
  maxSendsPerTick: number;
}

export const useAutomationSettings = () => {
  const [settings, setSettings] = useState<AutomationSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const load = useCallback(async () => {
    const { data } = await supabase.from('automation_settings').select('*').limit(1).single();
    if (data) {
      setSettings({
        enabled: data.enabled,
        sendWindowStart: data.send_window_start,
        sendWindowEnd: data.send_window_end,
        sendDays: data.send_days,
        timezone: data.timezone,
        dailySendCap: data.daily_send_cap,
        maxSendsPerTick: data.max_sends_per_tick,
      });
    }
    setIsLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const update = async (patch: Partial<AutomationSettings>) => {
    const payload: TablesUpdate<'automation_settings'> = {};
    if (patch.enabled !== undefined) payload.enabled = patch.enabled;
    if (patch.sendWindowStart !== undefined) payload.send_window_start = patch.sendWindowStart;
    if (patch.sendWindowEnd !== undefined) payload.send_window_end = patch.sendWindowEnd;
    if (patch.sendDays !== undefined) payload.send_days = patch.sendDays;
    if (patch.timezone !== undefined) payload.timezone = patch.timezone;
    if (patch.dailySendCap !== undefined) payload.daily_send_cap = patch.dailySendCap;

    await supabase.from('automation_settings').update(payload).eq('id', true);
    setSettings(prev => (prev ? { ...prev, ...patch } : prev));
  };

  return { settings, isLoading, update };
};

/** Fires the engine now, bypassing the send window. */
export const runAutomationsNow = async (opts: { dryRun?: boolean } = {}) => {
  const { data, error } = await supabase.functions.invoke('run-automations', {
    body: { force: true, dryRun: opts.dryRun ?? false },
  });
  if (error) throw error;
  return data as { sent: number; checked: number; skipped?: string; results: unknown[] };
};
