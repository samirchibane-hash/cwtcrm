import { useState, useMemo, useEffect } from 'react';
import { isPast, isToday, parseISO } from 'date-fns';
import {
  Plus, Search, X,
  CheckCircle2, Clock, AlertCircle, Loader2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useTasks, Task, TaskStatus, TaskPriority } from '@/context/TasksContext';
import { useAuth } from '@/hooks/useAuth';
import { PRIORITY_CONFIG, TaskCard, TaskDetailSheet } from '@/components/crm/TaskDetailSheet';

// ─── Main Page ────────────────────────────────────────────────────────────────

export const TasksPage = () => {
  const { tasks, isLoading, updateTask } = useTasks();
  const { user } = useAuth();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'due_date' | 'priority' | 'created'>('due_date');

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Track comment counts per task (fetched lazily as tasks are opened)
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});
  const { getComments } = useTasks();

  // Load comment counts on mount
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
  }, [tasks.length]);

  const stats = useMemo(() => ({
    overdue: tasks.filter(t => t.due_date && isPast(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && t.status !== 'done' && t.status !== 'cancelled').length,
    dueToday: tasks.filter(t => t.due_date && isToday(parseISO(t.due_date)) && t.status !== 'done' && t.status !== 'cancelled').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    total: tasks.filter(t => t.status !== 'done' && t.status !== 'cancelled').length,
  }), [tasks]);

  const filteredTasks = useMemo(() => {
    const list = tasks.filter(t => {
      if (statusFilter !== 'all' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
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
      const aActive = a.status !== 'done' && a.status !== 'cancelled';
      const bActive = b.status !== 'done' && b.status !== 'cancelled';
      if (aActive !== bActive) return aActive ? -1 : 1;

      if (sortBy === 'priority') {
        const order = { urgent: 0, high: 1, medium: 2, low: 3 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
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
  }, [tasks, statusFilter, priorityFilter, searchQuery, sortBy]);

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

  const toggleDone = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const next: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    await updateTask({ ...task, status: next });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Stats bar */}
        {(stats.overdue > 0 || stats.dueToday > 0 || stats.inProgress > 0) && (
          <div className="flex items-center gap-4 flex-wrap">
            {stats.overdue > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-red-600">
                <AlertCircle className="w-4 h-4" />
                <span className="font-medium">{stats.overdue}</span> overdue
              </div>
            )}
            {stats.dueToday > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-orange-500">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{stats.dueToday}</span> due today
              </div>
            )}
            {stats.inProgress > 0 && (
              <div className="flex items-center gap-1.5 text-sm text-blue-500">
                <Clock className="w-4 h-4" />
                <span className="font-medium">{stats.inProgress}</span> in progress
              </div>
            )}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search tasks…"
              className="pl-9 h-9"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Priority filter */}
          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="h-9 w-[140px] text-sm">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All priorities</SelectItem>
              {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG['medium']][]).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className={cn('flex items-center gap-1.5', v.color)}>
                    <span className={cn('w-2 h-2 rounded-full', v.dot)} />{v.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Sort */}
          <Select value={sortBy} onValueChange={(v: typeof sortBy) => setSortBy(v)}>
            <SelectTrigger className="h-9 w-[140px] text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="due_date">By due date</SelectItem>
              <SelectItem value="priority">By priority</SelectItem>
              <SelectItem value="created">By created</SelectItem>
            </SelectContent>
          </Select>

          {/* New task */}
          <Button onClick={openNewTask} className="h-9 gap-1.5 ml-auto">
            <Plus className="w-4 h-4" />
            New Task
          </Button>
        </div>

        {/* Status tabs */}
        <Tabs value={statusFilter} onValueChange={setStatusFilter}>
          <TabsList className="h-9">
            <TabsTrigger value="all" className="text-sm">
              All <span className="ml-1.5 text-xs opacity-60">{tasks.length}</span>
            </TabsTrigger>
            <TabsTrigger value="todo" className="text-sm">To Do</TabsTrigger>
            <TabsTrigger value="in_progress" className="text-sm">In Progress</TabsTrigger>
            <TabsTrigger value="done" className="text-sm">Done</TabsTrigger>
            <TabsTrigger value="cancelled" className="text-sm">Cancelled</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Task List */}
        {filteredTasks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="w-12 h-12 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">
              {searchQuery || statusFilter !== 'all' || priorityFilter !== 'all'
                ? 'No tasks match your filters'
                : 'No tasks yet'}
            </p>
            {!searchQuery && statusFilter === 'all' && (
              <Button onClick={openNewTask} variant="outline" size="sm" className="mt-4 gap-1.5">
                <Plus className="w-4 h-4" />
                Create your first task
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                commentCounts={commentCounts}
                onClick={() => openTask(task)}
                onToggleDone={e => toggleDone(task, e)}
              />
            ))}
          </div>
        )}
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
