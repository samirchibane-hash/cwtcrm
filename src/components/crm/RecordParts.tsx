// Building blocks shared by record pages (companies and investors)
import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, Check, CheckCircle, CheckSquare, Copy, Linkedin, Mail, MessageSquare, Pencil, Phone, Plus, Star, XCircle,
  type LucideIcon,
} from 'lucide-react';
import { Contact, Engagement, getRepConfig } from '@/data/prospects';
import { parseDateLoose, formatMmDdYyyy } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useTasks, Task } from '@/context/TasksContext';
import { useAuth } from '@/hooks/useAuth';
import { TaskCard, TaskDetailSheet, useToggleTaskDone } from '@/components/crm/TaskDetailSheet';
import EditNoteDialog from '@/components/crm/EditNoteDialog';

export const normalizeUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

// Newest first. Engagement dates arrive in mixed formats (ISO from scripts, M/D/YYYY
// from the composer) and some legacy rows have none at all — undated entries sort last
// rather than throwing.
export const byDateDesc = (a: { date?: string }, b: { date?: string }) => {
  const at = parseDateLoose(a.date ?? '')?.getTime();
  const bt = parseDateLoose(b.date ?? '')?.getTime();
  if (at === undefined && bt === undefined) return 0;
  if (at === undefined) return 1;
  if (bt === undefined) return -1;
  return bt - at;
};

// Small inline copy-to-clipboard affordance; swaps to a check on success
export const CopyButton = ({ value, label }: { value: string; label: string }) => {
  const [copied, setCopied] = useState(false);
  const copy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      /* clipboard unavailable — no-op */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      title={copied ? 'Copied!' : `Copy ${label}`}
      aria-label={`Copy ${label}`}
      className={`p-0.5 rounded transition-colors ${copied ? 'text-success-foreground' : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'}`}
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
};


export const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-card px-4 py-3 min-w-0">
    <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    <div className="mt-1 truncate text-base font-semibold leading-tight tabular-nums">{value}</div>
  </div>
);

export const RailHeader = ({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-border">
    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
      {title}
      {!!count && <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>}
    </h2>
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

// Label/value pair in the Details card. Empty values become an "Add …" affordance (Attio-style)
export const PropertyRow = ({ icon: Icon, label, onAdd, children }: {
  icon: LucideIcon;
  label: string;
  onAdd: () => void;
  children: React.ReactNode;
}) => (
  <div className="flex items-start gap-3 py-1.5 text-sm">
    <dt className="flex w-28 shrink-0 items-center gap-2 pt-px text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {label}
    </dt>
    <dd className="min-w-0 flex-1">
      {children ?? (
        <button type="button" onClick={onAdd} className="rounded text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Add {label.toLowerCase()}…
        </button>
      )}
    </dd>
  </div>
);

export const CountField = ({ id, icon: Icon, label, value, onChange }: {
  id: string;
  icon: LucideIcon;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) => (
  <div className="space-y-1">
    <label htmlFor={id} className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
      <Icon className="w-3 h-3" aria-hidden="true" /> {label}
    </label>
    <Input
      id={id}
      type="number"
      min={0}
      inputMode="numeric"
      value={value || ''}
      onChange={(e) => onChange(Math.max(0, parseInt(e.target.value) || 0))}
      placeholder="0"
      className="h-8 w-16 text-sm tabular-nums"
    />
  </div>
);


// Record-scoped task list (company or investor), same interface as the Tasks page
export const RecordTasksSection = ({ recordId, recordName }: { recordId: string; recordName: string }) => {
  const { tasks, getComments } = useTasks();
  const { user } = useAuth();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const companyTasks = useMemo(() => {
    const active = tasks.filter(t => t.prospect_id === recordId);
    // Active tasks first (by due date), completed/cancelled last
    return active.sort((a, b) => {
      const aDone = a.status === 'done' || a.status === 'cancelled';
      const bDone = b.status === 'done' || b.status === 'cancelled';
      if (aDone !== bDone) return aDone ? 1 : -1;
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });
  }, [tasks, recordId]);

  const openCount = companyTasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length;
  const taskIdsKey = companyTasks.map(t => t.id).join(',');

  // Load comment counts for this company's tasks
  useEffect(() => {
    if (!taskIdsKey) return;
    let cancelled = false;
    (async () => {
      const counts: Record<string, number> = {};
      await Promise.all(taskIdsKey.split(',').map(async id => {
        const cs = await getComments(id);
        counts[id] = cs.length;
      }));
      if (!cancelled) setCommentCounts(counts);
    })();
    return () => { cancelled = true; };
  }, [taskIdsKey]);

  const openTask = (task: Task) => {
    setSelectedTask(task);
    setIsNewTask(false);
    setIsDetailOpen(true);
  };

  const openNewTask = () => {
    setSelectedTask(null);
    setIsNewTask(true);
    setIsDetailOpen(true);
  };

  const closeDetail = () => {
    setIsDetailOpen(false);
    setSelectedTask(null);
    setIsNewTask(false);
  };

  const toggleDone = useToggleTaskDone();

  return (
    <section className="content-card p-4">
      {companyTasks.length > 0 ? (
        <>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{openCount > 0 ? `${openCount} open` : 'All done'}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={openNewTask}>
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
        <div className="-mx-4 -mb-4 border-t border-border divide-y divide-border">
          {companyTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              commentCounts={commentCounts}
              onClick={() => openTask(task)}
              onToggleDone={e => toggleDone(task, e)}
            />
          ))}
        </div>
        </>
      ) : (
        <div className="text-center py-8">
          <CheckSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No tasks yet. Add a follow-up so this account doesn’t go cold.</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openNewTask}>
            <Plus className="w-4 h-4" />
            Add task
          </Button>
        </div>
      )}

      {/* Task detail / create slide-over — same interface as the Tasks page */}
      <Sheet open={isDetailOpen} onOpenChange={open => { if (!open) closeDetail(); }}>
        <SheetContent side="right" className="w-full sm:w-[540px] p-0 flex flex-col" hideCloseButton>
          <TaskDetailSheet
            task={selectedTask}
            isNew={isNewTask}
            onClose={closeDetail}
            user={user}
            defaultProspect={isNewTask ? { id: recordId, name: recordName } : null}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
};


export const ContactRow =({ contact, onToggleChampion, onEdit }: {
  contact: Contact;
  onToggleChampion: (id: string) => void;
  onEdit: (contact: Contact) => void;
}) => {
  return (
    <div className="flex items-start gap-2.5 px-4 py-3 hover:bg-muted/30 transition-colors group">
      <button
        type="button"
        onClick={() => onToggleChampion(contact.id)}
        aria-pressed={!!contact.isChampion}
        aria-label={contact.isChampion ? `Remove ${contact.name} as champion` : `Set ${contact.name} as champion`}
        title={contact.isChampion ? 'Remove as champion' : 'Set as champion'}
        className={`mt-px p-1 rounded-md transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-ring ${
          contact.isChampion
            ? 'text-champion bg-champion/10 hover:bg-champion/20'
            : 'text-muted-foreground hover:text-champion hover:bg-muted'
        }`}
      >
        <Star className={`w-3.5 h-3.5 ${contact.isChampion ? 'fill-current' : ''}`} />
      </button>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="text-sm font-medium truncate">{contact.name}</p>
        {contact.role && <p className="text-xs text-muted-foreground truncate">{contact.role}</p>}
        {contact.email && (
          <span className="flex items-center gap-1 min-w-0">
            {contact.emailVerified === true && (
              <CheckCircle className="w-3 h-3 text-success-foreground shrink-0" aria-label="Verified email" />
            )}
            {contact.emailVerified === false && (
              <XCircle className="w-3 h-3 text-destructive shrink-0" aria-label="Email failed verification" />
            )}
            <a href={`mailto:${contact.email}`} className="truncate text-xs text-accent hover:underline">
              {contact.email}
            </a>
            <CopyButton value={contact.email} label="email" />
          </span>
        )}
        {contact.phone && (
          <span className="flex items-center gap-1">
            <a href={`tel:${contact.phone}`} className="text-xs font-mono text-muted-foreground hover:text-foreground">
              {contact.phone}
            </a>
            <CopyButton value={contact.phone} label="phone" />
          </span>
        )}
      </div>

      {/* Visible on touch/small screens and on keyboard focus, not hover-only */}
      <div className="flex shrink-0 items-center opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
        {contact.linkedIn && (
          <a
            href={contact.linkedIn}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${contact.name} on LinkedIn`}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Linkedin className="w-3.5 h-3.5" />
          </a>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onEdit(contact)}
          aria-label={`Edit ${contact.name}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
};


export interface EngagementCardProps {
  engagement: Engagement;
  isLast?: boolean;
  onEdit?: (id: string, details: string, activity?: { calls?: number; emails?: number; linkedin?: number }, loggedBy?: string) => void;
  onDelete?: (id: string) => void;
}

const ENGAGEMENT_ICON: Record<Engagement['type'], LucideIcon> = {
  call: Phone,
  email: Mail,
  linkedin: Linkedin,
  meeting: CalendarDays,
  note: MessageSquare,
};

export const EngagementCard = ({ engagement, isLast, onEdit, onDelete }: EngagementCardProps) => {
  const calls = engagement.activity?.calls || 0;
  const emails = engagement.activity?.emails || 0;
  const linkedin = engagement.activity?.linkedin || 0;
  const rep = getRepConfig(engagement.loggedBy);
  const Icon = ENGAGEMENT_ICON[engagement.type] ?? MessageSquare;
  const date = parseDateLoose(engagement.date ?? '');

  const chips = [
    calls > 0 && { icon: Phone, label: `${calls} call${calls !== 1 ? 's' : ''}` },
    emails > 0 && { icon: Mail, label: `${emails} email${emails !== 1 ? 's' : ''}` },
    linkedin > 0 && { icon: Linkedin, label: `${linkedin} LinkedIn` },
  ].filter(Boolean) as { icon: LucideIcon; label: string }[];

  return (
    <li className="relative flex gap-3 pb-4 group">
      {/* Timeline rail */}
      {!isLast && <span className="absolute left-[13px] top-7 bottom-0 w-px bg-border" aria-hidden="true" />}
      <span className="relative z-[1] mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span className="sr-only">{engagement.type}</span>
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm whitespace-pre-line break-words">{engagement.details || engagement.summary}</p>
          {onEdit && onDelete && (
            <div className="shrink-0 -mt-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-within:opacity-100 transition-opacity">
              <EditNoteDialog engagement={engagement} onSave={onEdit} onDelete={onDelete} />
            </div>
          )}
        </div>
        {chips.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
            {chips.map(chip => (
              <span key={chip.label} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-foreground">
                <chip.icon className="w-3 h-3 text-muted-foreground" aria-hidden="true" />
                {chip.label}
              </span>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground">
          {engagement.loggedBy && (
            <>
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${rep.avatarClass}`} aria-hidden="true">
                {rep.initials}
              </span>
              <span>{rep.name}</span>
              <span aria-hidden="true">·</span>
            </>
          )}
          <time className="font-mono" dateTime={date?.toISOString()}>
            {date ? formatMmDdYyyy(date) : engagement.date || 'No date'}
          </time>
        </div>
      </div>
    </li>
  );
};
