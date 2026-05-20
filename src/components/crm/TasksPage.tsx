import { useState, useMemo, useEffect, useRef, KeyboardEvent } from 'react';
import { format, isPast, isToday, parseISO } from 'date-fns';
import {
  Plus, Search, Trash2, Pencil, X, ExternalLink, MessageSquare,
  ChevronDown, Calendar, Building2, ShoppingCart, User, Tag,
  CheckCircle2, Circle, Clock, AlertCircle, Loader2, Send,
  ArrowUp, ArrowRight, ArrowDown, Minus, Check
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarPicker } from '@/components/ui/calendar';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { useTasks, Task, TaskComment, ContactTag, TaskStatus, TaskPriority } from '@/context/TasksContext';
import { useProspects } from '@/context/ProspectsContext';
import { useOrders } from '@/context/OrdersContext';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

// ─── Config ──────────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; dot: string; icon: typeof ArrowUp }> = {
  urgent: { label: 'Urgent', color: 'text-red-600', dot: 'bg-red-500', icon: ArrowUp },
  high:   { label: 'High',   color: 'text-orange-500', dot: 'bg-orange-400', icon: ArrowUp },
  medium: { label: 'Medium', color: 'text-blue-500', dot: 'bg-blue-400', icon: ArrowRight },
  low:    { label: 'Low',    color: 'text-slate-400', dot: 'bg-slate-300', icon: ArrowDown },
};

const STATUS_CONFIG: Record<TaskStatus, { label: string; icon: typeof Circle; color: string }> = {
  todo:        { label: 'To Do',       icon: Circle,       color: 'text-slate-400' },
  in_progress: { label: 'In Progress', icon: Clock,        color: 'text-blue-500' },
  done:        { label: 'Done',        icon: CheckCircle2, color: 'text-green-500' },
  cancelled:   { label: 'Cancelled',   icon: X,            color: 'text-slate-400' },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dueDateDisplay(due: string | null, status: TaskStatus) {
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

function TaskCard({ task, commentCounts, onClick, onToggleDone }: {
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

function TaskDetailSheet({ task, isNew, onClose, user }: {
  task: Task | null;
  isNew: boolean;
  onClose: () => void;
  user: { email?: string } | null;
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
      setDueDate(null); setProspectId(null); setProspectName(null);
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

  const saveField = async (field: Partial<Task>) => {
    if (!task) return;
    await updateTask({ ...task, title, description: description || null, status, priority, due_date: dueDate, prospect_id: prospectId, prospect_name: prospectName, order_id: orderId, order_name: orderName, contact_tags: contactTags, labels, ...field });
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
    let list = tasks.filter(t => {
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
