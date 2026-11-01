import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, isBefore, isPast, isToday, parseISO, startOfDay } from 'date-fns';
import { Plus, Search, X, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useTasks, Task, TaskPriority } from '@/context/TasksContext';
import { useAuth } from '@/hooks/useAuth';
import { PRIORITY_CONFIG, TaskCard, TaskDetailSheet, useToggleTaskDone } from '@/components/crm/TaskDetailSheet';

type SortBy = 'due_date' | 'priority' | 'created';
type DueFilter = 'overdue' | 'today' | null;

const STATUS_TABS = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'done', label: 'Done' },
  { value: 'cancelled', label: 'Cancelled' },
];
const PRIORITY_ORDER: Record<TaskPriority, number> = { urgent: 0, high: 1, medium: 2, low: 3 };

const isOpen = (t: Task) => t.status !== 'done' && t.status !== 'cancelled';
const isOverdue = (t: Task) => !!t.due_date && isOpen(t) && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date));
const isDueToday = (t: Task) => !!t.due_date && isOpen(t) && isToday(parseISO(t.due_date));

// Due-date buckets used to group the list when sorting by due date
const bucketOf = (t: Task): string => {
  if (!isOpen(t)) return 'Completed';
  if (!t.due_date) return 'No due date';
  const d = parseISO(t.due_date);
  if (isOverdue(t)) return 'Overdue';
  if (isToday(d)) return 'Today';
  if (isBefore(d, addDays(startOfDay(new Date()), 8))) return 'Next 7 days';
  return 'Later';
};
const BUCKET_ORDER = ['Overdue', 'Today', 'Next 7 days', 'Later', 'No due date', 'Completed'];

// ─── Main Page ────────────────────────────────────────────────────────────────

export const TasksPage = () => {
  const { tasks, isLoading, getComments } = useTasks();
  const { user } = useAuth();
  const toggleDone = useToggleTaskDone();
  const [searchParams, setSearchParams] = useSearchParams();

  // Filter/sort state lives in the URL so views are shareable and survive refresh
  const searchQuery = searchParams.get('q') ?? '';
  const statusFilter = STATUS_TABS.some(t => t.value === searchParams.get('status')) ? searchParams.get('status')! : 'all';
  const priorityFilter = searchParams.get('priority') && searchParams.get('priority')! in PRIORITY_CONFIG ? searchParams.get('priority')! : 'all';
  const sortParam = searchParams.get('sort');
  const sortBy: SortBy = sortParam === 'priority' || sortParam === 'created' ? sortParam : 'due_date';
  const dueParam = searchParams.get('due');
  const dueFilter: DueFilter = dueParam === 'overdue' || dueParam === 'today' ? dueParam : null;

  const setParam = (key: string, value: string | null, defaultValue?: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Track comment counts per task
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!tasks.length) return;
    const loadCounts = async () => {
      const counts: Record<string, number> = {};
      await Promise.all(tasks.map(async t => {
        const cs = await getComments(t.id);
        counts[t.id] = cs.length;
      }));
      setCommentCounts(counts);
    };
    loadCounts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks.length]);

  const stats = useMemo(() => ({
    overdue: tasks.filter(isOverdue).length,
    dueToday: tasks.filter(isDueToday).length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
  }), [tasks]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: tasks.length };
    for (const t of tasks) counts[t.status] = (counts[t.status] ?? 0) + 1;
    return counts;
  }, [tasks]);

  const filteredTasks = useMemo(() => {
    const q = searchQuery.toLowerCase();
    const list = tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (dueFilter === 'overdue' && !isOverdue(t)) return false;
      if (dueFilter === 'today' && !isDueToday(t)) return false;
      if (q) {
        return (
          t.title.toLowerCase().includes(q) ||
          (t.description || '').toLowerCase().includes(q) ||
          (t.prospect_name || '').toLowerCase().includes(q) ||
          (t.order_name || '').toLowerCase().includes(q) ||
          t.labels.some(l => l.toLowerCase().includes(q)) ||
          t.contact_tags.some(c => c.name.toLowerCase().includes(q))
        );
      }
      return true;
    });

    list.sort((a, b) => {
      // Done/cancelled always last
      if (isOpen(a) !== isOpen(b)) return isOpen(a) ? -1 : 1;

      if (sortBy === 'priority') {
        return (PRIORITY_ORDER[a.priority] ?? 2) - (PRIORITY_ORDER[b.priority] ?? 2);
      }
      if (sortBy === 'due_date') {
        if (!a.due_date && !b.due_date) return 0;
        if (!a.due_date) return 1;
        if (!b.due_date) return -1;
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

    return list;
  }, [tasks, statusFilter, priorityFilter, dueFilter, searchQuery, sortBy]);

  const groups = useMemo(() => {
    if (sortBy !== 'due_date') return [{ label: '', items: filteredTasks }];
    const byBucket = new Map<string, Task[]>();
    for (const t of filteredTasks) {
      const b = bucketOf(t);
      byBucket.set(b, [...(byBucket.get(b) ?? []), t]);
    }
    return BUCKET_ORDER.filter(b => byBucket.has(b)).map(b => ({ label: b, items: byBucket.get(b)! }));
  }, [filteredTasks, sortBy]);

  const hasFilters = !!searchQuery || statusFilter !== 'all' || priorityFilter !== 'all' || !!dueFilter;
  const clearFilters = () => {
    const next = new URLSearchParams(searchParams);
    ['q', 'status', 'priority', 'due'].forEach(k => next.delete(k));
    setSearchParams(next, { replace: true });
  };

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

  if (isLoading) {
    return (
      <div className="content-card" aria-busy="true" aria-label="Loading tasks">
        <div className="p-3 border-b border-border flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-32 rounded-lg hidden sm:block" />
          <Skeleton className="h-10 w-28 rounded-lg" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <Skeleton className="h-[18px] w-[18px] rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const quickFilters = [
    { key: 'overdue', label: 'overdue', count: stats.overdue, icon: AlertCircle, tone: 'text-danger-foreground', active: dueFilter === 'overdue', toggle: () => setParam('due', dueFilter === 'overdue' ? null : 'overdue') },
    { key: 'today', label: 'due today', count: stats.dueToday, icon: Clock, tone: 'text-warning-foreground', active: dueFilter === 'today', toggle: () => setParam('due', dueFilter === 'today' ? null : 'today') },
    { key: 'progress', label: 'in progress', count: stats.inProgress, icon: Clock, tone: 'text-info-foreground', active: statusFilter === 'in_progress', toggle: () => setParam('status', statusFilter === 'in_progress' ? null : 'in_progress') },
  ].filter(f => f.count > 0);

  return (
    <>
      <div className="space-y-4 animate-fade-in">
        {/* Attention chips double as filters */}
        {quickFilters.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap" role="group" aria-label="Quick filters">
            {quickFilters.map(f => (
              <button
                key={f.key}
                type="button"
                aria-pressed={f.active}
                onClick={f.toggle}
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  f.active ? 'border-foreground/20 bg-muted' : 'border-border bg-card hover:bg-muted/50',
                )}
              >
                <f.icon className={cn('w-3.5 h-3.5', f.tone)} aria-hidden="true" />
                <span className={cn('font-semibold tabular-nums', f.tone)}>{f.count}</span>
                <span className="text-muted-foreground">{f.label}</span>
              </button>
            ))}
          </div>
        )}

        <div className="content-card">
          {/* Toolbar */}
          <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
              <Input
                type="search"
                aria-label="Search tasks"
                value={searchQuery}
                onChange={e => setParam('q', e.target.value)}
                placeholder="Search tasks, companies, contacts, #labels…"
                className="pl-9 h-10 border-0 bg-muted/50 rounded-lg"
              />
            </div>
            <div className="flex gap-2">
              <Select value={priorityFilter} onValueChange={v => setParam('priority', v, 'all')}>
                <SelectTrigger className="h-10 w-full sm:w-[140px] text-sm rounded-lg" aria-label="Filter by priority">
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG['medium']][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className="flex items-center gap-1.5">
                        <span className={cn('w-2 h-2 rounded-full', v.dot)} aria-hidden="true" />{v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={v => setParam('sort', v, 'due_date')}>
                <SelectTrigger className="h-10 w-full sm:w-[140px] text-sm rounded-lg" aria-label="Sort tasks">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="due_date">By due date</SelectItem>
                  <SelectItem value="priority">By priority</SelectItem>
                  <SelectItem value="created">Newest first</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={openNewTask} className="h-10 gap-1.5 shrink-0">
                <Plus className="w-4 h-4" />
                New task
              </Button>
            </div>
          </div>

          {/* Status tabs */}
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto" role="group" aria-label="Filter by status">
            {STATUS_TABS.map(tab => {
              const active = statusFilter === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setParam('status', tab.value, 'all')}
                  className={cn(
                    'flex h-7 shrink-0 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                  )}
                >
                  {tab.label}
                  <span className="tabular-nums text-muted-foreground">{statusCounts[tab.value] ?? 0}</span>
                </button>
              );
            })}
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="ml-auto flex h-7 shrink-0 items-center gap-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="w-3 h-3" aria-hidden="true" />
                Clear filters
              </button>
            )}
          </div>

          {/* Task list */}
          {filteredTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
                <CheckCircle2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
              </div>
              {hasFilters ? (
                <>
                  <p className="text-sm text-muted-foreground">No tasks match these filters.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>Clear search and filters</Button>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">No tasks yet. Add a follow-up and link it to a company.</p>
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={openNewTask}>
                    <Plus className="w-4 h-4" />
                    New task
                  </Button>
                </>
              )}
            </div>
          ) : (
            groups.map(group => (
              <section key={group.label || 'all'} aria-label={group.label || undefined}>
                {group.label && (
                  <h3 className={cn(
                    'sticky top-0 z-10 flex items-center gap-2 bg-muted/60 backdrop-blur px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider border-b border-border',
                    group.label === 'Overdue' ? 'text-danger-foreground' : 'text-muted-foreground',
                  )}>
                    {group.label}
                    <span className="font-normal tabular-nums">{group.items.length}</span>
                  </h3>
                )}
                <div className="divide-y divide-border border-b border-border last:border-b-0">
                  {group.items.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      commentCounts={commentCounts}
                      onClick={() => openTask(task)}
                      onToggleDone={e => toggleDone(task, e)}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </div>

      {/* Detail Sheet */}
      <Sheet open={isDetailOpen} onOpenChange={open => { if (!open) closeDetail(); }}>
        <SheetContent side="right" className="w-full sm:w-[540px] p-0 flex flex-col" hideCloseButton>
          <TaskDetailSheet
            task={selectedTask}
            isNew={isNewTask}
            onClose={closeDetail}
            user={user}
          />
        </SheetContent>
      </Sheet>
    </>
  );
};
