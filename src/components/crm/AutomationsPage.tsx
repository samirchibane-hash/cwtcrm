import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  Copy,
  Mail,
  Pause,
  Play,
  Plus,
  Settings2,
  Square,
  Trash2,
  Workflow,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { emailSteps, newEmailStep, totalDays, validateSteps, type WorkflowStep } from '@/lib/workflow';
import {
  runAutomationsNow,
  useAutomationSettings,
  useEnrollments,
  useWorkflowTemplates,
  type Enrollment,
  type WorkflowTemplate,
} from '@/hooks/useWorkflows';
import WorkflowStepEditor from '@/components/crm/WorkflowStepEditor';

const STATUS_STYLES: Record<Enrollment['status'], string> = {
  active: 'bg-success/10 text-success-foreground',
  paused: 'bg-warning/10 text-warning-foreground',
  completed: 'bg-muted text-muted-foreground',
  replied: 'bg-info/10 text-info-foreground',
  stopped: 'bg-muted text-muted-foreground',
  failed: 'bg-destructive/10 text-destructive',
};

const STATUS_LABELS: Record<Enrollment['status'], string> = {
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
  replied: 'Replied',
  stopped: 'Stopped',
  failed: 'Failed',
};

const DAYS = [
  { value: 1, label: 'M', name: 'Monday' },
  { value: 2, label: 'T', name: 'Tuesday' },
  { value: 3, label: 'W', name: 'Wednesday' },
  { value: 4, label: 'T', name: 'Thursday' },
  { value: 5, label: 'F', name: 'Friday' },
  { value: 6, label: 'S', name: 'Saturday' },
  { value: 7, label: 'S', name: 'Sunday' },
];

const TABS = ['workflows', 'enrollments', 'settings'] as const;
const ENROLLMENT_FILTERS: { value: 'all' | Enrollment['status']; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'failed', label: 'Failed' },
  { value: 'replied', label: 'Replied' },
  { value: 'completed', label: 'Completed' },
  { value: 'stopped', label: 'Stopped' },
];

const clampInt = (raw: string, min: number, max: number, fallback: number) => {
  const n = parseInt(raw, 10);
  return Number.isNaN(n) ? fallback : Math.min(max, Math.max(min, n));
};

const formatDue = (iso?: string) => {
  if (!iso) return '—';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Due now';
  const days = Math.floor(diff / 86400000);
  if (days > 0) return `in ${days}d`;
  const hours = Math.max(1, Math.floor(diff / 3600000));
  return `in ${hours}h`;
};

const AutomationsPage = () => {
  const { toast } = useToast();
  const { templates, isLoading, createTemplate, updateTemplate, archiveTemplate, duplicateTemplate } =
    useWorkflowTemplates();
  const { enrollments, reload: reloadEnrollments, setStatus } = useEnrollments();
  const { settings, update: updateSettings } = useAutomationSettings();

  const [editing, setEditing] = useState<WorkflowTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftSteps, setDraftSteps] = useState<WorkflowStep[]>([]);
  const [draftExitOnReply, setDraftExitOnReply] = useState(true);
  const [confirmArchive, setConfirmArchive] = useState<WorkflowTemplate | null>(null);
  const [running, setRunning] = useState(false);
  const [confirmStop, setConfirmStop] = useState<Enrollment | null>(null);

  // Tab and enrollment filter live in the URL
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = TABS.includes(searchParams.get('tab') as typeof TABS[number]) ? searchParams.get('tab')! : 'workflows';
  const enrollmentFilter = ENROLLMENT_FILTERS.some(f => f.value === searchParams.get('status')) ? searchParams.get('status')! : 'all';
  const setParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    if (key === 'tab' && value !== 'enrollments') next.delete('status');
    setSearchParams(next, { replace: true });
  };

  // Settings are edited locally and committed on blur, clamped to valid values
  const [settingsDraft, setSettingsDraft] = useState({ start: '', end: '', cap: '' });
  useEffect(() => {
    if (settings) {
      setSettingsDraft({
        start: String(settings.sendWindowStart),
        end: String(settings.sendWindowEnd),
        cap: String(settings.dailySendCap),
      });
    }
  }, [settings]);

  const commitSettings = () => {
    if (!settings) return;
    const start = clampInt(settingsDraft.start, 0, 23, settings.sendWindowStart);
    const end = clampInt(settingsDraft.end, 0, 23, settings.sendWindowEnd);
    const cap = clampInt(settingsDraft.cap, 1, 10000, settings.dailySendCap);
    if (end <= start) {
      toast({ title: 'Send window is empty', description: '“Send until” must be later than “Send from”.', variant: 'destructive' });
      setSettingsDraft({ start: String(settings.sendWindowStart), end: String(settings.sendWindowEnd), cap: String(cap) });
      return;
    }
    if (start === settings.sendWindowStart && end === settings.sendWindowEnd && cap === settings.dailySendCap) return;
    updateSettings({ sendWindowStart: start, sendWindowEnd: end, dailySendCap: cap });
    setSettingsDraft({ start: String(start), end: String(end), cap: String(cap) });
    toast({ title: 'Send rails saved' });
  };

  const activeCount = enrollments.filter(e => e.status === 'active').length;
  const repliedCount = enrollments.filter(e => e.status === 'replied').length;
  const failedCount = enrollments.filter(e => e.status === 'failed').length;

  const enrollmentCounts = useMemo(() => {
    const counts: Record<string, number> = { all: enrollments.length };
    for (const e of enrollments) counts[e.status] = (counts[e.status] ?? 0) + 1;
    return counts;
  }, [enrollments]);

  const sortedEnrollments = useMemo(
    () =>
      enrollments.filter(e => enrollmentFilter === 'all' || e.status === enrollmentFilter).sort((a, b) => {
        const rank = (e: Enrollment) => (e.status === 'active' ? 0 : e.status === 'failed' ? 1 : 2);
        return rank(a) - rank(b) || (a.nextRunAt ?? '').localeCompare(b.nextRunAt ?? '');
      }),
    [enrollments, enrollmentFilter],
  );

  const openNew = () => {
    setIsNew(true);
    setEditing(null);
    setDraftName('');
    setDraftSteps([newEmailStep({ sendAs: 'new' })]);
    setDraftExitOnReply(true);
  };

  const openEdit = (t: WorkflowTemplate) => {
    setIsNew(false);
    setEditing(t);
    setDraftName(t.name);
    setDraftSteps(t.steps);
    setDraftExitOnReply(t.exitOnReply);
  };

  const closeBuilder = () => {
    setEditing(null);
    setIsNew(false);
  };

  const draftErrors = validateSteps(draftSteps);

  const saveDraft = async () => {
    if (!draftName.trim()) {
      toast({ title: 'Name your workflow', variant: 'destructive' });
      return;
    }
    if (draftErrors.length > 0) {
      toast({ title: 'Fix the steps first', description: draftErrors[0], variant: 'destructive' });
      return;
    }

    if (isNew) {
      const created = await createTemplate({
        name: draftName.trim(),
        steps: draftSteps,
        exitOnReply: draftExitOnReply,
      });
      if (!created) {
        toast({ title: 'Could not create workflow', variant: 'destructive' });
        return;
      }
      toast({ title: `"${created.name}" created` });
    } else if (editing) {
      await updateTemplate(editing.id, {
        name: draftName.trim(),
        steps: draftSteps,
        exitOnReply: draftExitOnReply,
      });
      toast({
        title: 'Workflow saved',
        description: 'Contacts already enrolled keep the emails they were enrolled with.',
      });
    }
    closeBuilder();
  };

  const handleRunNow = async () => {
    setRunning(true);
    try {
      const result = await runAutomationsNow();
      await reloadEnrollments();
      toast({
        title: result.skipped ? 'Nothing sent' : `${result.sent} email${result.sent === 1 ? '' : 's'} sent`,
        description: result.skipped
          ? result.skipped.replace(/_/g, ' ')
          : `Checked ${result.checked} enrollment${result.checked === 1 ? '' : 's'}.`,
      });
    } catch (err) {
      toast({
        title: 'Run failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
    setRunning(false);
  };

  const builderOpen = isNew || Boolean(editing);

  return (
    <div className="space-y-6">
      {/* Master switch + at-a-glance */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
        <div
          className={cn(
            'content-card px-4 py-3 lg:col-span-2 flex items-center justify-between gap-4',
            settings && !settings.enabled && 'border-warning/40 bg-warning/5',
          )}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div
              className={cn(
                'w-10 h-10 rounded-xl flex items-center justify-center shrink-0',
                settings?.enabled ? 'bg-success/10' : 'bg-warning/10',
              )}
            >
              <Zap
                className={cn(
                  'w-5 h-5',
                  settings?.enabled ? 'text-success-foreground' : 'text-warning-foreground',
                )}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">
                {settings?.enabled ? 'Automations are live' : 'Automations are paused'}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {settings?.enabled
                  ? `Sending ${settings.sendWindowStart}:00–${settings.sendWindowEnd}:00 ${settings.timezone.split('/')[1]?.replace('_', ' ')}`
                  : 'No scheduled email will go out while this is off'}
              </p>
            </div>
          </div>
          <Switch
            aria-label="Automations live"
            checked={settings?.enabled ?? false}
            disabled={!settings}
            onCheckedChange={v => {
              updateSettings({ enabled: v });
              toast({ title: v ? 'Automations are live' : 'Automations paused', description: v ? undefined : 'No scheduled email will go out until you turn them back on.' });
            }}
          />
        </div>

        <div className="content-card lg:col-span-2 grid grid-cols-2 gap-px bg-border">
          <div className="bg-card px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">In flight</p>
            <p className="mt-1 text-lg font-semibold leading-tight tabular-nums">{activeCount}</p>
          </div>
          <div className="bg-card px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground">Stopped on reply</p>
            <p className="mt-1 text-lg font-semibold leading-tight tabular-nums">{repliedCount}</p>
          </div>
        </div>
      </div>

      {failedCount > 0 && (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-4 flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-danger-foreground shrink-0 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-sm font-medium text-danger-foreground">
              {failedCount} enrollment{failedCount === 1 ? '' : 's'} failed to send
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              They're parked so nothing retries blindly. Check the address, then resume.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', 'enrollments');
              next.set('status', 'failed');
              setSearchParams(next, { replace: true });
            }}
          >
            Review failed
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={v => setParam('tab', v, 'workflows')}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <TabsList>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="enrollments">Enrollments</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" className="rounded-xl" onClick={handleRunNow} disabled={running}>
              <Play className="w-3.5 h-3.5 mr-2" />
              {running ? 'Running…' : 'Run now'}
            </Button>
            <Button size="sm" className="rounded-xl" onClick={openNew}>
              <Plus className="w-3.5 h-3.5 mr-2" />
              New workflow
            </Button>
          </div>
        </div>

        {/* Workflows */}
        <TabsContent value="workflows" className="mt-4">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3" aria-busy="true" aria-label="Loading workflows">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="content-card p-5 space-y-3">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                  <div className="flex gap-2 pt-2">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-5 w-14 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="content-card p-12 text-center">
              <Workflow className="w-10 h-10 mx-auto mb-4 text-muted-foreground/30" />
              <p className="text-sm font-medium">No workflows yet</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Build a sequence of emails and waits once, then enroll contacts from any company profile.
              </p>
              <Button size="sm" className="rounded-xl mt-4" onClick={openNew}>
                <Plus className="w-4 h-4 mr-2" />
                New workflow
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map(t => {
                const enrolled = enrollments.filter(e => e.templateId === t.id).length;
                return (
                  <div key={t.id} className="content-card p-5 group">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => openEdit(t)}
                        className="min-w-0 text-left flex-1 rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <p className="text-sm font-medium truncate">{t.name}</p>
                        {t.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                            {t.description}
                          </p>
                        )}
                      </button>
                      {/* Always visible on touch; revealed on hover/focus with a pointer */}
                      <div className="flex items-center gap-0.5 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          onClick={async () => {
                            await duplicateTemplate(t);
                            toast({ title: `Duplicated “${t.name}”` });
                          }}
                          aria-label={`Duplicate ${t.name}`}
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => setConfirmArchive(t)}
                          aria-label={`Archive ${t.name}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-4 flex-wrap">
                      <span className="badge-soft bg-muted text-muted-foreground">
                        <Mail className="w-3 h-3 mr-1" />
                        {emailSteps(t.steps).length} emails
                      </span>
                      <span className="badge-soft bg-muted text-muted-foreground">
                        {totalDays(t.steps)} days
                      </span>
                      {t.exitOnReply && (
                        <span className="badge-soft bg-info/10 text-info-foreground">
                          Stops on reply
                        </span>
                      )}
                      {enrolled > 0 && (
                        <span className="badge-soft bg-success/10 text-success-foreground">
                          {enrolled} enrolled
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Enrollments */}
        <TabsContent value="enrollments" className="mt-4">
          {enrollments.length > 0 && (
            <div className="mb-3 flex items-center gap-1 overflow-x-auto" role="group" aria-label="Filter enrollments by status">
              {ENROLLMENT_FILTERS.filter(f => f.value === 'all' || (enrollmentCounts[f.value] ?? 0) > 0).map(f => {
                const active = enrollmentFilter === f.value;
                return (
                  <button
                    key={f.value}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setParam('status', f.value, 'all')}
                    className={cn(
                      'flex h-7 shrink-0 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                    )}
                  >
                    {f.label}
                    <span className="tabular-nums text-muted-foreground">{enrollmentCounts[f.value] ?? 0}</span>
                  </button>
                );
              })}
            </div>
          )}
          {sortedEnrollments.length === 0 ? (
            <div className="content-card p-12 text-center">
              <Zap className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
              {enrollments.length === 0 ? (
                <>
                  <p className="text-sm font-medium">Nobody is enrolled yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Open a company profile and add a contact to an automation.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No enrollments with this status.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setParam('status', 'all', 'all')}>Show all</Button>
                </>
              )}
            </div>
          ) : (
            <div className="content-card divide-y divide-border">
              {sortedEnrollments.map(e => (
                <div key={e.id} className="px-4 py-3 flex items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">
                        {e.contactName || e.contactEmail}
                      </p>
                      <span className={cn('badge-soft', STATUS_STYLES[e.status])}>
                        {STATUS_LABELS[e.status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {e.prospectName} · {e.templateName} · step {e.currentStep + 1} of {e.steps.length}
                      {e.status === 'active' && ` · next ${formatDue(e.nextRunAt)}`}
                    </p>
                    {e.lastError && (
                      <p className="text-xs text-danger-foreground line-clamp-2 mt-1">{e.lastError}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {e.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setStatus(e.id, 'paused')}
                        aria-label={`Pause sequence for ${e.contactName || e.contactEmail}`}
                      >
                        <Pause className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {(e.status === 'paused' || e.status === 'failed') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setStatus(e.id, 'active')}
                        aria-label={`Resume sequence for ${e.contactName || e.contactEmail}`}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    {(e.status === 'active' || e.status === 'paused') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmStop(e)}
                        aria-label={`Stop sequence for ${e.contactName || e.contactEmail}`}
                      >
                        <Square className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Settings */}
        <TabsContent value="settings" className="mt-4">
          <section className="content-card p-6 max-w-2xl">
            <h2 className="section-header flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-muted-foreground" />
              Send rails
            </h2>
            {settings && (
              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="window-start">Send from (hour)</Label>
                    <Input
                      id="window-start"
                      type="number"
                      min={0}
                      max={23}
                      inputMode="numeric"
                      value={settingsDraft.start}
                      onChange={e => setSettingsDraft(d => ({ ...d, start: e.target.value }))}
                      onBlur={commitSettings}
                      onKeyDown={e => { if (e.key === 'Enter') commitSettings(); }}
                      className="rounded-xl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="window-end">Send until (hour)</Label>
                    <Input
                      id="window-end"
                      type="number"
                      min={0}
                      max={23}
                      inputMode="numeric"
                      value={settingsDraft.end}
                      onChange={e => setSettingsDraft(d => ({ ...d, end: e.target.value }))}
                      onBlur={commitSettings}
                      onKeyDown={e => { if (e.key === 'Enter') commitSettings(); }}
                      className="rounded-xl"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label id="send-days-label">Send days</Label>
                  <div className="flex items-center gap-1.5" role="group" aria-labelledby="send-days-label">
                    {DAYS.map(d => {
                      const on = settings.sendDays.includes(d.value);
                      return (
                        <button
                          key={d.value}
                          type="button"
                          aria-pressed={on}
                          aria-label={d.name}
                          title={d.name}
                          onClick={() =>
                            updateSettings({
                              sendDays: on
                                ? settings.sendDays.filter(x => x !== d.value)
                                : [...settings.sendDays, d.value].sort(),
                            })
                          }
                          className={cn(
                            'w-9 h-9 rounded-lg text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            on
                              ? 'bg-accent text-accent-foreground'
                              : 'bg-muted text-muted-foreground hover:bg-muted/70',
                          )}
                        >
                          {d.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="daily-cap">Daily send cap</Label>
                  <Input
                    id="daily-cap"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    value={settingsDraft.cap}
                    onChange={e => setSettingsDraft(d => ({ ...d, cap: e.target.value }))}
                    onBlur={commitSettings}
                    onKeyDown={e => { if (e.key === 'Enter') commitSettings(); }}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    A hard ceiling across every workflow — protects your domain reputation if a
                    workflow is misconfigured.
                  </p>
                </div>
              </div>
            )}
          </section>
        </TabsContent>
      </Tabs>

      {/* Builder */}
      <Sheet open={builderOpen} onOpenChange={open => !open && closeBuilder()}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          <div className="flex h-full flex-col">
            <div className="shrink-0 pb-5 border-b border-border pr-8">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isNew ? 'New workflow' : 'Edit workflow'}
              </p>
              <h1 className="text-xl font-semibold tracking-tight truncate">
                {draftName || 'Untitled workflow'}
              </h1>
            </div>

            <div className="flex-1 overflow-y-auto -mx-6 px-6 pt-6 space-y-6">
              <section className="content-card p-6 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="workflow-name">Name</Label>
                  <Input
                    id="workflow-name"
                    autoFocus
                    value={draftName}
                    onChange={e => setDraftName(e.target.value)}
                    placeholder="UVC intro — OEM water coolers"
                    className="rounded-xl"
                  />
                </div>
                <div className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                  <div className="pr-4">
                    <p className="text-sm font-medium">Stop when they reply</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Cancels the remaining emails as soon as a contact responds.
                    </p>
                  </div>
                  <Switch checked={draftExitOnReply} onCheckedChange={setDraftExitOnReply} />
                </div>
              </section>

              <section className="space-y-3">
                <h2 className="section-header mb-0">Steps</h2>
                <WorkflowStepEditor steps={draftSteps} onChange={setDraftSteps} />
                {draftErrors.length > 0 && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-1">
                    {draftErrors.map(err => (
                      <p key={err} className="text-xs text-destructive flex items-start gap-2">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        {err}
                      </p>
                    ))}
                  </div>
                )}
              </section>

              {!isNew && (
                <p className="text-xs text-muted-foreground">
                  Editing a workflow only affects contacts enrolled from now on. Anyone already in
                  flight keeps the emails they were enrolled with.
                </p>
              )}
            </div>

            <div className="shrink-0 pt-4 border-t border-border flex items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {emailSteps(draftSteps).length} emails over {totalDays(draftSteps)} days
              </p>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={closeBuilder} className="rounded-xl">
                  Cancel
                </Button>
                <Button onClick={saveDraft} className="rounded-xl">
                  {isNew ? 'Create workflow' : 'Save changes'}
                </Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!confirmArchive} onOpenChange={open => !open && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archive "{confirmArchive?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              It disappears from the workflow list and can't be enrolled into. Contacts already in
              flight keep running with the emails they were enrolled with — stop them from the
              Enrollments tab if you want them to end.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmArchive) archiveTemplate(confirmArchive.id);
                setConfirmArchive(null);
              }}
            >
              Archive workflow
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!confirmStop} onOpenChange={open => !open && setConfirmStop(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop the sequence for {confirmStop?.contactName || confirmStop?.contactEmail}?</AlertDialogTitle>
            <AlertDialogDescription>
              The remaining emails in “{confirmStop?.templateName}” won’t send. A stopped sequence can’t be resumed — pause it instead if you may want to continue.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmStop) setStatus(confirmStop.id, 'stopped');
                setConfirmStop(null);
              }}
            >
              Stop sequence
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AutomationsPage;
