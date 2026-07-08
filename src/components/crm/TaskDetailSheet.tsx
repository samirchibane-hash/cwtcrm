import { useState, useMemo, useEffect, useRef, KeyboardEvent } from 'react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import {
  Plus, Trash2, X, ExternalLink, MessageSquare,
  ChevronDown, Calendar, Building2, ShoppingCart, User,
  CheckCircle2, Circle, Clock, Loader2, Send,
  ArrowUp, ArrowRight, ArrowDown, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTasks, Task, TaskComment, ContactTag, TaskStatus, TaskPriority } from '@/context/TasksContext';
import { useProspects } from '@/context/ProspectsContext';
import { useOrders } from '@/context/OrdersContext';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// ─── Config ──────────────────────────────────────────────────────────────────

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string; icon: typeof ArrowUp }> = {
  urgent: { label: 'Urgent', color: 'text-red-600', dot: 'bg-red-500', icon: ArrowUp },
  high:   { label: 'High',   color: 'text-orange-500', dot: 'bg-orange-400', icon: ArrowUp },
  medium: { label: 'Medium', color: 'text-blue-500', dot: 'bg-blue-400', icon: ArrowRight },
  low:    { label: 'Low',    color: 'text-slate-400', dot: 'bg-slate-300', icon: ArrowDown },
};

export const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  todo:        { label: 'To Do',       icon: Circle,       color: 'text-slate-400' },
  in_progress: { label: 'In Progress', icon: Clock,        color: 'text-blue-500' },
  done:        { label: 'Done',        icon: CheckCircle2, color: 'text-green-500' },
  cancelled:   { label: 'Cancelled',   icon: X,            color: 'text-slate-400' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function dueDateDisplay(due: string | null, status: TaskStatus) {
  if (!due || status === 'done' || status === 'cancelled') return null;
  const d = parseISO(due);
  if (isPast(d) && !isToday(d)) return { label: `Overdue · ${format(d, 'MMM d')}`, className: 'text-red-500 bg-red-50 border-red-200' };
  if (isToday(d)) return { label: 'Due today', className: 'text-orange-600 bg-orange-50 border-orange-200' };
  return { label: format(d, 'MMM d'), className: 'text-muted-foreground bg-muted/50 border-transparent' };
}

function initials(name: string | null) {
  if (!name) return '?';
  return name.split(' ').map(p => p[0]).join('').toUpperCase().slice(0, 2);
}

function formatCommentTime(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const mins = Math.floor((now.getTime() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return format(d, 'MMM d');
}

// ─── Task Card ────────────────────────────────────────────────────────────────

export function TaskCard({ task, commentCounts, onClick, onToggleDone }: {
  task: Task;
  commentCounts: Record<string, number>;
  onClick: () => void;
  onToggleDone: (e: React.MouseEvent) => void;
}) {
  const p = PRIORITY_CONFIG[task.priority];
  const dueInfo = dueDateDisplay(task.due_date, task.status);
  const isDone = task.status === 'done';
  const isCancelled = task.status === 'cancelled';
  const dimmed = isDone || isCancelled;

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-start gap-3 px-4 py-3 rounded-xl border cursor-pointer transition-all',
        'hover:border-accent/30 hover:shadow-sm hover:bg-muted/20',
        dimmed ? 'bg-muted/10 border-border/50' : 'bg-card border-border'
      )}
    >
      {/* Checkbox */}
      <button
        onClick={onToggleDone}
        className={cn(
          'mt-0.5 flex-shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors',
          isDone
            ? 'border-green-500 bg-green-500 text-white'
            : 'border-muted-foreground/40 hover:border-green-400'
        )}
      >
        {isDone && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Priority dot */}
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', p.dot)} />
          {/* Title */}
          <span className={cn(
            'font-medium text-sm leading-snug',
            dimmed ? 'line-through text-muted-foreground' : 'text-foreground'
          )}>
            {task.title}
          </span>
        </div>

        {/* Sub-line */}
        <div className="flex items-center flex-wrap gap-1.5 mt-1.5">
          {task.prospect_name && (
            <Badge variant="outline" className="text-xs h-5 gap-1 font-normal px-1.5">
              <Building2 className="w-3 h-3" />
              {task.prospect_name}
            </Badge>
          )}
          {task.order_name && (
            <Badge variant="outline" className="text-xs h-5 gap-1 font-normal px-1.5">
              <ShoppingCart className="w-3 h-3" />
              {task.order_name}
            </Badge>
          )}
          {task.contact_tags.slice(0, 2).map(c => (
            <Badge key={c.id} variant="secondary" className="text-xs h-5 gap-1 font-normal px-1.5">
              <User className="w-3 h-3" />
              {c.name}
            </Badge>
          ))}
          {task.contact_tags.length > 2 && (
            <span className="text-xs text-muted-foreground">+{task.contact_tags.length - 2}</span>
          )}
          {task.labels.map(l => (
            <span key={l} className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
              #{l}
            </span>
          ))}
        </div>
      </div>

      {/* Right meta */}
      <div className="flex items-center gap-2 flex-shrink-0 mt-0.5">
        {dueInfo && (
          <span className={cn('text-xs px-1.5 py-0.5 rounded-md border', dueInfo.className)}>
            {dueInfo.label}
          </span>
        )}
        {(commentCounts[task.id] ?? 0) > 0 && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MessageSquare className="w-3.5 h-3.5" />
            {commentCounts[task.id]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({ comment, currentUserEmail, onEdit, onDelete }: {
  comment: TaskComment;
  currentUserEmail: string;
  onEdit: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.content);
  const isOwn = comment.author === currentUserEmail;

  const handleSave = () => {
    if (draft.trim() && draft.trim() !== comment.content) {
      onEdit(comment.id, draft.trim());
    }
    setEditing(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSave();
    if (e.key === 'Escape') setEditing(false);
  };

  return (
    <div className="flex gap-3 group">
      <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
        {initials(comment.author)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-sm font-medium">{comment.author || 'Unknown'}</span>
          <span className="text-xs text-muted-foreground">{formatCommentTime(comment.created_at)}</span>
          {comment.edited && <span className="text-xs text-muted-foreground">(edited)</span>}
        </div>
        {editing ? (
          <div className="space-y-2">
            <Textarea
              value={draft}
              onChange={e => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              className="text-sm min-h-[80px] resize-none"
              autoFocus
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} className="h-7 text-xs">Save</Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)} className="h-7 text-xs">Cancel</Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground whitespace-pre-wrap break-words">{comment.content}</p>
        )}
        {isOwn && !editing && (
          <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={() => { setDraft(comment.content); setEditing(true); }} className="text-xs text-muted-foreground hover:text-foreground">
              Edit
            </button>
            <button onClick={() => onDelete(comment.id)} className="text-xs text-muted-foreground hover:text-destructive">
              Delete
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Label Input ──────────────────────────────────────────────────────────────

function LabelInput({ labels, onChange }: { labels: string[]; onChange: (labels: string[]) => void }) {
  const [input, setInput] = useState('');

  const add = (value: string) => {
    const trimmed = value.trim().toLowerCase().replace(/\s+/g, '-');
    if (trimmed && !labels.includes(trimmed)) {
      onChange([...labels, trimmed]);
    }
    setInput('');
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      add(input);
    }
    if (e.key === 'Backspace' && !input && labels.length > 0) {
      onChange(labels.slice(0, -1));
    }
  };

  return (
    <div className="flex flex-wrap gap-1.5 p-2 border rounded-lg min-h-[38px] items-center">
      {labels.map(l => (
        <span key={l} className="flex items-center gap-1 text-xs bg-muted px-2 py-0.5 rounded-full">
          #{l}
          <button onClick={() => onChange(labels.filter(x => x !== l))} className="hover:text-destructive ml-0.5">
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => { if (input.trim()) add(input); }}
        placeholder={labels.length === 0 ? 'Add labels…' : ''}
        className="flex-1 min-w-[80px] text-xs bg-transparent outline-none placeholder:text-muted-foreground"
      />
    </div>
  );
}

// ─── Prospect Combobox ────────────────────────────────────────────────────────

function ProspectCombobox({ value, label, onChange, onClear }: {
  value: string | null;
  label: string | null;
  onChange: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const { prospects } = useProspects();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors w-full text-left">
          <Building2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={cn('flex-1 truncate', !label && 'text-muted-foreground')}>
            {label || 'Link company…'}
          </span>
          {label && (
            <button onClick={e => { e.stopPropagation(); onClear(); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search companies…" />
          <CommandList>
            <CommandEmpty>No company found.</CommandEmpty>
            <CommandGroup>
              {prospects.map(p => (
                <CommandItem
                  key={p.id}
                  value={p.companyName}
                  onSelect={() => { onChange(p.id, p.companyName); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('w-4 h-4', value === p.id ? 'opacity-100' : 'opacity-0')} />
                  {p.companyName}
                  {p.stage && <span className="ml-auto text-xs text-muted-foreground">{p.stage}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Order Combobox ───────────────────────────────────────────────────────────

function OrderCombobox({ value, label, onChange, onClear }: {
  value: string | null;
  label: string | null;
  onChange: (id: string, name: string) => void;
  onClear: () => void;
}) {
  const { orders } = useOrders();
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors w-full text-left">
          <ShoppingCart className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={cn('flex-1 truncate', !label && 'text-muted-foreground')}>
            {label || 'Link order…'}
          </span>
          {label && (
            <button onClick={e => { e.stopPropagation(); onClear(); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search orders…" />
          <CommandList>
            <CommandEmpty>No order found.</CommandEmpty>
            <CommandGroup>
              {orders.map(o => (
                <CommandItem
                  key={o.id}
                  value={o.customer || o.id}
                  onSelect={() => { onChange(o.id, `${o.customer} · ${o.id.slice(0, 8)}`); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Check className={cn('w-4 h-4', value === o.id ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex flex-col">
                    <span className="text-sm">{o.customer}</span>
                    <span className="text-xs text-muted-foreground">{o.id.slice(0, 8)} · {o.status}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ─── Contact Picker ───────────────────────────────────────────────────────────

function ContactPicker({ prospectId, tags, onChange }: {
  prospectId: string | null;
  tags: ContactTag[];
  onChange: (tags: ContactTag[]) => void;
}) {
  const { prospects } = useProspects();
  const [open, setOpen] = useState(false);

  const availableContacts = useMemo(() => {
    if (prospectId) {
      const p = prospects.find(x => x.id === prospectId);
      return (p?.contacts || []).map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        companyId: prospectId,
        companyName: p?.companyName || '',
      }));
    }
    return prospects.flatMap(p =>
      (p.contacts || []).map(c => ({
        id: c.id,
        name: c.name,
        role: c.role,
        companyId: p.id,
        companyName: p.companyName,
      }))
    );
  }, [prospects, prospectId]);

  const toggle = (contact: ContactTag) => {
    const exists = tags.find(t => t.id === contact.id);
    onChange(exists ? tags.filter(t => t.id !== contact.id) : [...tags, contact]);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {tags.map(t => (
          <Badge key={t.id} variant="secondary" className="gap-1 text-xs">
            <User className="w-3 h-3" />
            {t.name}
            <button onClick={() => onChange(tags.filter(x => x.id !== t.id))} className="hover:text-destructive ml-0.5">
              <X className="w-3 h-3" />
            </button>
          </Badge>
        ))}
      </div>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded-lg border border-dashed hover:border-border transition-colors">
            <Plus className="w-3.5 h-3.5" />
            Tag contact
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <Command>
            <CommandInput placeholder="Search contacts…" />
            <CommandList>
              <CommandEmpty>No contacts found.</CommandEmpty>
              <CommandGroup>
                {availableContacts.map(c => (
                  <CommandItem
                    key={c.id}
                    value={c.name}
                    onSelect={() => toggle(c)}
                    className="flex items-center gap-2"
                  >
                    <Check className={cn('w-4 h-4', tags.find(t => t.id === c.id) ? 'opacity-100' : 'opacity-0')} />
                    <div className="flex flex-col">
                      <span className="text-sm">{c.name}</span>
                      {(c.role || c.companyName) && (
                        <span className="text-xs text-muted-foreground">
                          {[c.role, !prospectId && c.companyName].filter(Boolean).join(' · ')}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

function DatePickerButton({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseISO(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted/50 transition-colors w-full text-left">
          <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className={cn('flex-1', !value && 'text-muted-foreground')}>
            {value ? format(parseISO(value), 'MMM d, yyyy') : 'Set due date…'}
          </span>
          {value && (
            <button onClick={e => { e.stopPropagation(); onChange(null); }} className="text-muted-foreground hover:text-destructive flex-shrink-0">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={d => { onChange(d ? d.toISOString() : null); setOpen(false); }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );
}

// ─── Task Detail Sheet ────────────────────────────────────────────────────────

export function TaskDetailSheet({ task, isNew, onClose, user, defaultProspect }: {
  task: Task | null;
  isNew: boolean;
  onClose: () => void;
  user: { email?: string } | null;
  /** When creating a new task, pre-link it to this company (e.g. from the company profile). */
  defaultProspect?: { id: string; name: string } | null;
}) {
  const { addTask, updateTask, deleteTask, getComments, addComment, updateComment, deleteComment } = useTasks();
  const navigate = useNavigate();
  const { toast } = useToast();

  // Form state (used for both new and edit)
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [description, setDescription] = useState('');
  const [editingDescription, setEditingDescription] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [prospectId, setProspectId] = useState<string | null>(null);
  const [prospectName, setProspectName] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [orderName, setOrderName] = useState<string | null>(null);
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [labels, setLabels] = useState<string[]>([]);

  // Comments
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [commentInput, setCommentInput] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  const [postingComment, setPostingComment] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);
  const commentRef = useRef<HTMLTextAreaElement>(null);

  // Initialize form from task or blank
  useEffect(() => {
    if (isNew) {
      setTitle(''); setDescription(''); setStatus('todo'); setPriority('medium');
      setDueDate(null);
      setProspectId(defaultProspect?.id ?? null); setProspectName(defaultProspect?.name ?? null);
      setOrderId(null); setOrderName(null); setContactTags([]); setLabels([]);
      setComments([]); setEditingTitle(true);
    } else if (task) {
      setTitle(task.title); setDescription(task.description || '');
      setStatus(task.status); setPriority(task.priority); setDueDate(task.due_date);
      setProspectId(task.prospect_id); setProspectName(task.prospect_name);
      setOrderId(task.order_id); setOrderName(task.order_name);
      setContactTags(task.contact_tags || []); setLabels(task.labels || []);
      setEditingTitle(false); setEditingDescription(false);
      setLoadingComments(true);
      getComments(task.id).then(c => { setComments(c); setLoadingComments(false); });
    }
  }, [task?.id, isNew]);

  // Auto-focus title on new task
  useEffect(() => {
    if (isNew && editingTitle) setTimeout(() => titleRef.current?.focus(), 50);
  }, [isNew, editingTitle]);

  const currentEmail = user?.email || 'Unknown';

  const taskPayload = () => ({
    title: title.trim(),
    description: description || null,
    status, priority,
    due_date: dueDate,
    prospect_id: prospectId, prospect_name: prospectName,
    order_id: orderId, order_name: orderName,
    contact_tags: contactTags, labels,
    created_by: currentEmail,
  });

  const handleCreate = async () => {
    if (!title.trim()) { toast({ title: 'Title is required', variant: 'destructive' }); return; }
    const created = await addTask(taskPayload());
    if (created) { toast({ title: 'Task created' }); onClose(); }
  };

  const handleDelete = async () => {
    if (!task) return;
    await deleteTask(task.id);
    toast({ title: 'Task deleted' });
    onClose();
  };

  const handleAddComment = async () => {
    if (!task || !commentInput.trim()) return;
    setPostingComment(true);
    const c = await addComment(task.id, commentInput.trim(), currentEmail);
    if (c) { setComments(prev => [...prev, c]); setCommentInput(''); }
    setPostingComment(false);
  };

  const handleEditComment = async (id: string, content: string) => {
    const updated = await updateComment(id, content);
    if (updated) setComments(prev => prev.map(c => c.id === id ? updated : c));
  };

  const handleDeleteComment = async (id: string) => {
    await deleteComment(id);
    setComments(prev => prev.filter(c => c.id !== id));
  };

  // Auto-save for existing task fields on blur
  const autoSave = (override?: Partial<Task>) => {
    if (!task || isNew) return;
    updateTask({ ...task, title: title.trim() || task.title, description: description || null, status, priority, due_date: dueDate, prospect_id: prospectId, prospect_name: prospectName, order_id: orderId, order_name: orderName, contact_tags: contactTags, labels, ...override });
  };

  const p = PRIORITY_CONFIG[priority];
  const s = STATUS_CONFIG[status];
  const StatusIcon = s.icon;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          {!isNew && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={handleDelete}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete task</TooltipContent>
            </Tooltip>
          )}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
          <X className="w-4 h-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="px-6 py-5 space-y-5">

          {/* Title */}
          <div>
            {editingTitle ? (
              <input
                ref={titleRef}
                value={title}
                onChange={e => setTitle(e.target.value)}
                onBlur={() => { setEditingTitle(false); if (!isNew) autoSave(); }}
                onKeyDown={e => { if (e.key === 'Enter') { setEditingTitle(false); if (!isNew) autoSave(); } if (e.key === 'Escape') setEditingTitle(false); }}
                className="w-full text-xl font-semibold bg-transparent outline-none border-b-2 border-accent pb-1 placeholder:text-muted-foreground/50"
                placeholder="Task title…"
              />
            ) : (
              <button onClick={() => setEditingTitle(true)} className="w-full text-left group">
                <h2 className="text-xl font-semibold group-hover:text-accent transition-colors">
                  {title || <span className="text-muted-foreground/50">Untitled task</span>}
                </h2>
              </button>
            )}
          </div>

          {/* Status / Priority / Due Date row */}
          <div className="grid grid-cols-3 gap-2">
            {/* Status */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Status</p>
              <Select value={status} onValueChange={(v: TaskStatus) => { setStatus(v); if (!isNew) autoSave({ status: v }); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <StatusIcon className={cn('w-4 h-4', s.color)} />
                      <span>{s.label}</span>
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(STATUS_CONFIG) as [TaskStatus, typeof STATUS_CONFIG['todo']][]).map(([k, v]) => {
                    const Icon = v.icon;
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-1.5">
                          <Icon className={cn('w-4 h-4', v.color)} />
                          {v.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Priority</p>
              <Select value={priority} onValueChange={(v: TaskPriority) => { setPriority(v); if (!isNew) autoSave({ priority: v }); }}>
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue>
                    <span className={cn('flex items-center gap-1.5', p.color)}>
                      <span className={cn('w-2 h-2 rounded-full', p.dot)} />
                      {p.label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PRIORITY_CONFIG) as [TaskPriority, typeof PRIORITY_CONFIG['medium']][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      <span className={cn('flex items-center gap-1.5', v.color)}>
                        <span className={cn('w-2 h-2 rounded-full', v.dot)} />
                        {v.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Due Date (label only, picker below) */}
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Due Date</p>
              <DatePickerButton
                value={dueDate}
                onChange={v => { setDueDate(v); if (!isNew) autoSave({ due_date: v }); }}
              />
            </div>
          </div>

          <Separator />

          {/* Description */}
          <div className="space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Description</p>
            {editingDescription ? (
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                onBlur={() => { setEditingDescription(false); if (!isNew) autoSave(); }}
                placeholder="Add a description…"
                className="resize-none text-sm min-h-[100px]"
                autoFocus
              />
            ) : (
              <button onClick={() => setEditingDescription(true)} className="w-full text-left p-2 rounded-lg hover:bg-muted/50 transition-colors min-h-[60px]">
                {description
                  ? <p className="text-sm whitespace-pre-wrap text-foreground">{description}</p>
                  : <p className="text-sm text-muted-foreground/60">Add a description…</p>
                }
              </button>
            )}
          </div>

          <Separator />

          {/* Linked To */}
          <div className="space-y-2.5">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Linked To</p>
            <div className="space-y-2">
              <ProspectCombobox
                value={prospectId}
                label={prospectName}
                onChange={(id, name) => {
                  setProspectId(id); setProspectName(name);
                  setContactTags([]);
                  if (!isNew) autoSave({ prospect_id: id, prospect_name: name, contact_tags: [] });
                }}
                onClear={() => {
                  setProspectId(null); setProspectName(null); setContactTags([]);
                  if (!isNew) autoSave({ prospect_id: null, prospect_name: null, contact_tags: [] });
                }}
              />
              <OrderCombobox
                value={orderId}
                label={orderName}
                onChange={(id, name) => { setOrderId(id); setOrderName(name); if (!isNew) autoSave({ order_id: id, order_name: name }); }}
                onClear={() => { setOrderId(null); setOrderName(null); if (!isNew) autoSave({ order_id: null, order_name: null }); }}
              />
            </div>
            {prospectId && (
              <button
                onClick={() => navigate(`/company/${prospectId}`)}
                className="flex items-center gap-1.5 text-xs text-accent hover:underline"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open company page
              </button>
            )}
          </div>

          <Separator />

          {/* Contacts */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Tagged Contacts</p>
            <ContactPicker
              prospectId={prospectId}
              tags={contactTags}
              onChange={tags => { setContactTags(tags); if (!isNew) autoSave({ contact_tags: tags }); }}
            />
          </div>

          <Separator />

          {/* Labels */}
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Labels</p>
            <LabelInput labels={labels} onChange={l => { setLabels(l); if (!isNew) autoSave({ labels: l }); }} />
          </div>

          {/* Create button for new tasks */}
          {isNew && (
            <>
              <Separator />
              <Button onClick={handleCreate} className="w-full">
                <Plus className="w-4 h-4 mr-2" />
                Create Task
              </Button>
            </>
          )}

          {/* Comments — only for existing tasks */}
          {!isNew && (
            <>
              <Separator />
              <div className="space-y-4">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Comments {comments.length > 0 && `(${comments.length})`}
                </p>

                {loadingComments ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                  </div>
                ) : comments.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No comments yet.</p>
                ) : (
                  <div className="space-y-4">
                    {comments.map(c => (
                      <CommentItem
                        key={c.id}
                        comment={c}
                        currentUserEmail={currentEmail}
                        onEdit={handleEditComment}
                        onDelete={handleDeleteComment}
                      />
                    ))}
                  </div>
                )}

                {/* Add comment */}
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-accent/20 text-accent flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5">
                      {initials(currentEmail)}
                    </div>
                    <Textarea
                      ref={commentRef}
                      value={commentInput}
                      onChange={e => setCommentInput(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAddComment(); }}
                      placeholder="Write a comment… (⌘↵ to post)"
                      className="resize-none text-sm min-h-[80px] flex-1"
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={handleAddComment}
                      disabled={!commentInput.trim() || postingComment}
                      className="gap-1.5"
                    >
                      {postingComment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                      Post
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Bottom padding */}
          <div className="h-4" />
        </div>
      </ScrollArea>
    </div>
  );
}
