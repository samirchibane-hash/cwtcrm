import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Linkedin, Plus, FileText, MessageSquare, Package, Truck, Star, ChevronRight, ChevronUp, ChevronDown, Globe, Trash2, CheckCircle, XCircle, Pencil, Copy, Check, CheckSquare, Zap, Pause, Play, Square as SquareIcon, MoreHorizontal, CalendarDays, type LucideIcon } from 'lucide-react';
import { format } from 'date-fns';
import { Contact, Engagement, CompanyType, MarketType, REPS, getRepConfig } from '@/data/prospects';
import { getProspectLastContactLabel } from '@/lib/prospect-last-contact';
import { parseDateLoose, formatMmDdYyyy } from '@/lib/date';
import { Order, formatCurrency } from '@/data/orders';
import OrderStatusBadge, { ShipmentProgressText } from '@/components/crm/OrderStatusBadge';
import { useProspects } from '@/context/ProspectsContext';
import StageBadge from '@/components/crm/StageBadge';
import TypeBadge from '@/components/crm/TypeBadge';
import MarketTypeBadge from '@/components/crm/MarketTypeBadge';
import ContactDetailsPanel from '@/components/crm/ContactDetailsPanel';
import EditCompanyDetailsPanel from '@/components/crm/EditCompanyDetailsPanel';
import EnrollInAutomationPanel from '@/components/crm/EnrollInAutomationPanel';
import { useEnrollments, type Enrollment } from '@/hooks/useWorkflows';
import EditNoteDialog from '@/components/crm/EditNoteDialog';
import { EmailVerificationDialog } from '@/components/crm/EmailVerificationDialog';
import AddOrderDialog from '@/components/crm/AddOrderDialog';
import OrderDetail from '@/components/OrderDetail';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { keepLocalEscape } from '@/lib/escape-scope';
import { useOrders } from '@/context/OrdersContext';
import { useTasks, Task } from '@/context/TasksContext';
import { useAuth } from '@/hooks/useAuth';
import { TaskCard, TaskDetailSheet, useToggleTaskDone } from '@/components/crm/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
import { useState, useEffect, useMemo, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useProspectActivityLog } from '@/hooks/useActivityLog';

const normalizeUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

// Newest first. Engagement dates arrive in mixed formats (ISO from scripts, M/D/YYYY
// from the composer) and some legacy rows have none at all — undated entries sort last
// rather than throwing.
const byDateDesc = (a: { date?: string }, b: { date?: string }) => {
  const at = parseDateLoose(a.date ?? '')?.getTime();
  const bt = parseDateLoose(b.date ?? '')?.getTime();
  if (at === undefined && bt === undefined) return 0;
  if (at === undefined) return 1;
  if (bt === undefined) return -1;
  return bt - at;
};

// Small inline copy-to-clipboard affordance; swaps to a check on success
const CopyButton = ({ value, label }: { value: string; label: string }) => {
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

const CompanyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { getProspectById, updateProspect, deleteProspect, isLoading } = useProspects();
  const { orders } = useOrders();
  const [newNote, setNewNote] = useState('');
  const [newNoteCalls, setNewNoteCalls] = useState<number>(0);
  const [newNoteEmails, setNewNoteEmails] = useState<number>(0);
  const [newNoteLinkedIn, setNewNoteLinkedIn] = useState<number>(0);
  const [newNoteLoggedBy, setNewNoteLoggedBy] = useState<string>('Samir');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>('');
  const [marketType, setMarketType] = useState<MarketType>('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [country, setCountry] = useState('');
  const [zip, setZip] = useState('');
  const [stage, setStage] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [website, setWebsite] = useState('');
  const [googleMapsUrl, setGoogleMapsUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [lastContact, setLastContact] = useState('');
  const [engagementNotes, setEngagementNotes] = useState('');
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [enrollPanelOpen, setEnrollPanelOpen] = useState(false);
  const [enrollContactId, setEnrollContactId] = useState<string | undefined>();
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  // undefined = adding a new contact, otherwise the contact being edited
  const [editingContact, setEditingContact] = useState<Contact | undefined>();
  // The enroll panel and the rail's list hold separate hook state; bump this so
  // a new enrollment shows up in the rail immediately.
  const [enrollmentsVersion, setEnrollmentsVersion] = useState(0);

  const prospect = id ? getProspectById(id) : null;
  const { prospects } = useProspects();
  const { entries: activityLogEntries } = useProspectActivityLog(id);
  const [searchParams, setSearchParams] = useSearchParams();
  const { tasks } = useTasks();
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const tabParam = searchParams.get('tab');
  const tab = tabParam === 'tasks' || tabParam === 'orders' ? tabParam : 'activity';
  const openTaskCount = useMemo(
    () => tasks.filter(t => t.prospect_id === id && t.status !== 'done' && t.status !== 'cancelled').length,
    [tasks, id]
  );

  // Merge activity_log entries (from scripts) with JSONB engagements, deduplicated by id, sorted by date
  const allEngagements = useMemo(() => {
    const logAsEngagements: Engagement[] = activityLogEntries.map(e => ({
      id: `alog-${e.id}`,
      date: e.date,
      type: (e.emails > 0 ? 'email' : e.calls > 0 ? 'call' : e.linkedin > 0 ? 'linkedin' : 'note') as Engagement['type'],
      summary: e.note || [e.calls > 0 && `${e.calls} call${e.calls !== 1 ? 's' : ''}`, e.emails > 0 && `${e.emails} email${e.emails !== 1 ? 's' : ''}`, e.linkedin > 0 && `${e.linkedin} LinkedIn`].filter(Boolean).join(', '),
      details: e.note || undefined,
      loggedBy: e.loggedBy,
      activity: { calls: e.calls || undefined, emails: e.emails || undefined, linkedin: e.linkedin || undefined },
    }));
    const merged = [...engagements, ...logAsEngagements];
    // Deduplicate by id and sort descending by date
    const seen = new Set<string>();
    return merged
      .filter(e => { if (seen.has(e.id)) return false; seen.add(e.id); return true; })
      .sort(byDateDesc);
  }, [engagements, activityLogEntries]);

  const companyOrders = useMemo(
    () => orders.filter(o => o.customer === companyName),
    [orders, companyName]
  );
  const lifetimeValue = companyOrders.reduce((sum, o) => sum + o.totalValue, 0);

  // Use passed prospect IDs from navigation state (sorted/filtered order) or fallback to default
  const prospectIds: string[] = (location.state as { prospectIds?: string[] } | null)?.prospectIds
    || prospects.map(p => p.id);

  // Get previous and next prospect for navigation based on the passed order
  const currentIndex = prospectIds.findIndex(pId => pId === id);
  const previousProspectId = currentIndex > 0 ? prospectIds[currentIndex - 1] : null;
  const nextProspectId = currentIndex >= 0 && currentIndex < prospectIds.length - 1 ? prospectIds[currentIndex + 1] : null;

  // Keep the open tab when stepping through records
  const goTo = (targetId: string | null) => {
    if (targetId) navigate(`/company/${targetId}${location.search}`, { state: location.state });
  };

  // J / K step through the list the user came from (skipped while typing or with an overlay open)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"]')) return;
      const target = e.key === 'j' ? nextProspectId : e.key === 'k' ? previousProspectId : null;
      if (target) navigate(`/company/${target}${location.search}`, { state: location.state });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextProspectId, previousProspectId, navigate, location.search, location.state]);
  // Initialize state from prospect data
  useEffect(() => {
    if (prospect) {
      setCompanyName(prospect.companyName);
      // ids are guaranteed by the context's row normalizer
      setContacts(prospect.contacts);
      setEngagements([...prospect.engagements].sort(byDateDesc));
      setCompanyType(prospect.type);
      setMarketType(prospect.marketType);
      setStreet(prospect.street || '');
      setCity(prospect.city || '');
      setState(prospect.state);
      setCountry(prospect.country || '');
      setZip(prospect.zip || '');
      setStage(prospect.stage);
      setLinkedIn(prospect.linkedIn);
      setWebsite(prospect.website || '');
      setGoogleMapsUrl(prospect.googleMapsUrl || '');
      setPhone(prospect.phone || '');
      setLastContact(prospect.lastContact);
      setEngagementNotes(prospect.engagementNotes);
    }
  }, [prospect]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading company">
        <div className="border-b border-border h-12" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6">
          <div className="flex items-center gap-3">
            <Skeleton className="h-11 w-11 rounded-xl" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-56" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6">
            <div className="space-y-4">
              <Skeleton className="h-28 w-full rounded-2xl" />
              <Skeleton className="h-64 w-full rounded-2xl" />
            </div>
            <div className="space-y-4">
              <Skeleton className="h-32 w-full rounded-2xl" />
              <Skeleton className="h-80 w-full rounded-2xl" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold">Company not found</h1>
          <p className="text-sm text-muted-foreground">It may have been deleted, or the link is out of date.</p>
          <Button variant="outline" onClick={() => navigate('/?view=pipeline')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Pipeline
          </Button>
        </div>
      </div>
    );
  }

  const saveProspect = (updates: Partial<{
    contacts: Contact[];
    engagements: Engagement[];
    companyName: string;
    companyType: CompanyType;
    marketType: MarketType;
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    stage: string;
    linkedIn: string;
    website: string;
    googleMapsUrl: string;
    phone: string;
  }>) => {
    const updatedEngagements = updates.engagements ?? engagements;
    let derivedLastContact = lastContact;
    if (updates.engagements && updates.engagements.length > 0) {
      // Find the most recent engagement date and convert to M/D/YYYY
      const mostRecent = parseDateLoose([...updates.engagements].sort(byDateDesc)[0].date ?? '');
      if (mostRecent) {
        derivedLastContact = mostRecent.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
        setLastContact(derivedLastContact);
      }
    }
    updateProspect({
      id: prospect.id,
      companyName: updates.companyName ?? companyName,
      contacts: updates.contacts ?? contacts,
      engagements: updatedEngagements,
      type: updates.companyType ?? companyType,
      marketType: updates.marketType ?? marketType,
      street: updates.street ?? street,
      city: updates.city ?? city,
      state: updates.state ?? state,
      country: updates.country ?? country,
      zip: updates.zip ?? zip,
      stage: updates.stage ?? stage,
      linkedIn: updates.linkedIn ?? linkedIn,
      website: updates.website ?? website,
      googleMapsUrl: updates.googleMapsUrl ?? googleMapsUrl,
      phone: updates.phone ?? phone,
      lastContact: derivedLastContact,
      engagementNotes: engagementNotes,
    });
  };

  const handleDeleteCompany = async () => {
    await deleteProspect(prospect.id);
    toast({
      title: 'Company deleted',
      description: `${companyName} has been removed.`,
    });
    navigate('/?view=pipeline');
  };

  const openAddContact = () => {
    setEditingContact(undefined);
    setContactPanelOpen(true);
  };

  const openEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setContactPanelOpen(true);
  };

  // The panel handles both modes; route to add or update by whether we know the contact.
  const handleSaveContact = (saved: Contact) => {
    const exists = contacts.some(c => c.id === saved.id);
    const updatedContacts = exists
      ? contacts.map(c => (c.id === saved.id ? saved : c))
      : [...contacts, saved];
    setContacts(updatedContacts);
    saveProspect({ contacts: updatedContacts });
  };

  const handleDeleteContact = (contactId: string) => {
    const updatedContacts = contacts.filter(c => c.id !== contactId);
    setContacts(updatedContacts);
    saveProspect({ contacts: updatedContacts });
  };

  const handleToggleChampion = (contactId: string) => {
    const updatedContacts = contacts.map(c => ({
      ...c,
      isChampion: c.id === contactId ? !c.isChampion : false,
    }));
    setContacts(updatedContacts);
    saveProspect({ contacts: updatedContacts });

    const contact = contacts.find(c => c.id === contactId);
    const isNowChampion = !contact?.isChampion;
    toast({
      title: isNowChampion ? 'Champion set' : 'Champion removed',
      description: isNowChampion
        ? `${contact?.name} is now the company champion.`
        : `${contact?.name} is no longer the champion.`,
    });
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const activity: Engagement['activity'] = {};
    if (newNoteCalls > 0) activity.calls = newNoteCalls;
    if (newNoteEmails > 0) activity.emails = newNoteEmails;
    if (newNoteLinkedIn > 0) activity.linkedin = newNoteLinkedIn;

    const newEngagement: Engagement = {
      id: `eng-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      type: 'note',
      summary: newNote.length > 60 ? newNote.slice(0, 60) + '...' : newNote,
      details: newNote,
      loggedBy: newNoteLoggedBy,
      ...(Object.keys(activity).length > 0 ? { activity } : {}),
    };

    const updatedEngagements = [newEngagement, ...engagements];
    setEngagements(updatedEngagements);
    saveProspect({ engagements: updatedEngagements });
    toast({
      title: 'Activity logged',
      description: 'Your note has been added to engagements.',
    });
    setNewNote('');
    setNewNoteCalls(0);
    setNewNoteEmails(0);
    setNewNoteLinkedIn(0);
  };

  const handleEditNote = (engagementId: string, newDetails: string, activity?: { calls?: number; emails?: number; linkedin?: number }, loggedBy?: string) => {
    const updatedEngagements = engagements.map(eng =>
      eng.id === engagementId
        ? {
            ...eng,
            details: newDetails,
            summary: newDetails.length > 60 ? newDetails.slice(0, 60) + '...' : newDetails,
            activity: activity,
            loggedBy: loggedBy ?? eng.loggedBy,
          }
        : eng
    );
    setEngagements(updatedEngagements);
    saveProspect({ engagements: updatedEngagements });
  };

  const handleDeleteNote = (engagementId: string) => {
    const updatedEngagements = engagements.filter(eng => eng.id !== engagementId);
    setEngagements(updatedEngagements);
    saveProspect({ engagements: updatedEngagements });
  };

  const handleUpdateCompanyDetails = (details: {
    companyName: string;
    companyType: CompanyType;
    marketType: MarketType;
    street: string;
    city: string;
    state: string;
    country: string;
    zip: string;
    stage: string;
    linkedIn: string;
    website?: string;
    googleMapsUrl?: string;
    phone?: string;
  }) => {
    setCompanyName(details.companyName);
    setCompanyType(details.companyType);
    setMarketType(details.marketType);
    setStreet(details.street);
    setCity(details.city);
    setState(details.state);
    setCountry(details.country);
    setZip(details.zip);
    setStage(details.stage);
    setLinkedIn(details.linkedIn);
    setWebsite(details.website || '');
    setGoogleMapsUrl(details.googleMapsUrl || '');
    setPhone(details.phone || '');
    saveProspect(details);
  };

  const lastContactLabel = getProspectLastContactLabel(prospect);
  const cityStateZip = [[city, state].filter(Boolean).join(', '), zip].filter(Boolean).join(' ');
  const addressLine = [street, cityStateZip, country].filter(Boolean).join(', ');
  const initials = companyName.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const canEnroll = contacts.some(c => c.email);

  const focusComposer = () => {
    composerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    composerRef.current?.focus({ preventScroll: true });
  };

  const setTab = (next: string) => {
    const params = new URLSearchParams(searchParams);
    if (next === 'activity') params.delete('tab');
    else params.set('tab', next);
    setSearchParams(params, { replace: true, state: location.state });
  };

  // Group the timeline by month, newest first (allEngagements is already sorted)
  const engagementGroups: { label: string; items: Engagement[] }[] = [];
  for (const engagement of allEngagements) {
    const d = parseDateLoose(engagement.date ?? '');
    const label = d ? format(d, 'MMMM yyyy') : 'Undated';
    const last = engagementGroups[engagementGroups.length - 1];
    if (last && last.label === label) last.items.push(engagement);
    else engagementGroups.push({ label, items: [engagement] });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Record bar: breadcrumb + position in the list the user came from */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <button
              onClick={() => navigate(location.state?.from || '/?view=pipeline')}
              className="flex shrink-0 items-center gap-1.5 rounded text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="w-4 h-4" />
              Pipeline
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium" aria-current="page">{companyName}</span>
          </nav>

          <div className="flex shrink-0 items-center gap-1">
            {currentIndex >= 0 && (
              <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums mr-1">
                {(currentIndex + 1).toLocaleString()} of {prospectIds.length.toLocaleString()}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(previousProspectId)} disabled={!previousProspectId} aria-label="Previous company">
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous company <kbd className="ml-1 text-[10px] text-muted-foreground">K</kbd></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(nextProspectId)} disabled={!nextProspectId} aria-label="Next company">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next company <kbd className="ml-1 text-[10px] text-muted-foreground">J</kbd></TooltipContent>
            </Tooltip>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-6 py-6 space-y-6 animate-fade-in">
        {/* Identity + primary actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-sm font-semibold text-muted-foreground" aria-hidden="true">
              {initials}
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold tracking-tight truncate">{companyName}</h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <StageBadge stage={stage} maxVisible={3} />
                {companyType && <TypeBadge type={companyType} />}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="gap-1.5" onClick={focusComposer}>
              <Plus className="w-4 h-4" />
              Log activity
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditPanelOpen(true)}>
              <Pencil className="w-4 h-4" />
              Edit
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="More actions">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem disabled={!canEnroll} onSelect={() => { setEnrollContactId(undefined); setEnrollPanelOpen(true); }}>
                  <Zap className="w-4 h-4 mr-2" />
                  Add to automation
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete company
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          {/* Left rail: who they are */}
          <aside className="space-y-4">
            {/* At a glance */}
            <section aria-label="At a glance" className="content-card grid grid-cols-2 gap-px bg-border">
              <StatTile label="Lifetime value" value={formatCurrency(lifetimeValue)} />
              <StatTile label="Orders" value={companyOrders.length} />
              <StatTile label="Engagements" value={allEngagements.length} />
              <StatTile label="Last contact" value={lastContactLabel || '—'} />
            </section>

            {/* Details */}
            <section className="content-card">
              <RailHeader title="Details">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditPanelOpen(true)} aria-label="Edit company details">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </RailHeader>
              <dl className="px-4 py-2">
                <PropertyRow icon={Building2} label="Business model" onAdd={() => setEditPanelOpen(true)}>
                  {companyType ? <TypeBadge type={companyType} /> : null}
                </PropertyRow>
                <PropertyRow icon={Package} label="Vertical" onAdd={() => setEditPanelOpen(true)}>
                  {marketType ? <MarketTypeBadge marketType={marketType} /> : null}
                </PropertyRow>
                <PropertyRow icon={MapPin} label="Address" onAdd={() => setEditPanelOpen(true)}>
                  {addressLine || googleMapsUrl ? (
                    <span className="flex items-start gap-1">
                      {googleMapsUrl ? (
                        <a href={normalizeUrl(googleMapsUrl)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline break-words">
                          {addressLine || 'View on Maps'}
                        </a>
                      ) : (
                        <span className="break-words">{addressLine}</span>
                      )}
                      {addressLine && <CopyButton value={addressLine} label="address" />}
                    </span>
                  ) : null}
                </PropertyRow>
                <PropertyRow icon={Phone} label="Phone" onAdd={() => setEditPanelOpen(true)}>
                  {phone ? (
                    <span className="flex items-center gap-1">
                      <a href={`tel:${phone}`} className="font-mono hover:underline">{phone}</a>
                      <CopyButton value={phone} label="phone" />
                    </span>
                  ) : null}
                </PropertyRow>
                <PropertyRow icon={Globe} label="Website" onAdd={() => setEditPanelOpen(true)}>
                  {website ? (
                    <span className="flex items-center gap-1 min-w-0">
                      <a href={normalizeUrl(website)} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:underline">
                        {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                      <CopyButton value={normalizeUrl(website)} label="website" />
                    </span>
                  ) : null}
                </PropertyRow>
                <PropertyRow icon={Linkedin} label="LinkedIn" onAdd={() => setEditPanelOpen(true)}>
                  {linkedIn ? (
                    <a href={normalizeUrl(linkedIn)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Company page
                    </a>
                  ) : null}
                </PropertyRow>
              </dl>
            </section>

            {/* Contacts */}
            <section className="content-card">
              <RailHeader title="Contacts" count={contacts.length}>
                <EmailVerificationDialog
                  companyWebsite={website}
                  onEmailVerified={(email) => {
                    toast({
                      title: 'Email verified',
                      description: `Add a contact with email: ${email}`,
                    });
                  }}
                />
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openAddContact} aria-label="Add contact">
                  <Plus className="w-4 h-4" />
                </Button>
              </RailHeader>
              {contacts.length > 0 ? (
                <div className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onToggleChampion={handleToggleChampion}
                      onEdit={openEditContact}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">Add the people you sell to here.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openAddContact}>
                    <Plus className="w-4 h-4" />
                    Add contact
                  </Button>
                </div>
              )}
            </section>

            {/* Email automations running for this company */}
            <CompanyAutomationsSection
              prospectId={prospect.id}
              refreshKey={enrollmentsVersion}
              onEnroll={(contactId) => {
                setEnrollContactId(contactId);
                setEnrollPanelOpen(true);
              }}
              canEnroll={canEnroll}
            />
          </aside>

          {/* Main: what's happening */}
          <div className="space-y-4 min-w-0">
            {/* Log activity composer */}
            <section className="content-card p-4" aria-labelledby="log-activity-heading">
              <h2 id="log-activity-heading" className="sr-only">Log activity</h2>
              <form onSubmit={e => { e.preventDefault(); handleAddNote(); }} className="space-y-3">
                <Textarea
                  ref={composerRef}
                  aria-label="Activity note"
                  placeholder="Log a call, email, or note about this company…"
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                      e.preventDefault();
                      handleAddNote();
                    }
                  }}
                  className="min-h-[72px] resize-y border-0 bg-muted/50 focus-visible:bg-card rounded-lg"
                />
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <CountField id="note-calls" icon={Phone} label="Calls" value={newNoteCalls} onChange={setNewNoteCalls} />
                  <CountField id="note-emails" icon={Mail} label="Emails" value={newNoteEmails} onChange={setNewNoteEmails} />
                  <CountField id="note-linkedin" icon={Linkedin} label="LinkedIn" value={newNoteLinkedIn} onChange={setNewNoteLinkedIn} />
                  <div className="space-y-1" role="radiogroup" aria-label="Logged by">
                    <span className="block text-xs font-medium text-muted-foreground">Logged by</span>
                    <div className="flex gap-1">
                      {REPS.map(rep => (
                        <button
                          key={rep.name}
                          type="button"
                          role="radio"
                          aria-checked={newNoteLoggedBy === rep.name}
                          onClick={() => setNewNoteLoggedBy(rep.name)}
                          className={`flex h-8 items-center gap-1.5 px-2 rounded-md text-xs font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            newNoteLoggedBy === rep.name
                              ? 'border-foreground/20 bg-muted text-foreground'
                              : 'border-transparent text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`} aria-hidden="true">
                            {rep.initials}
                          </span>
                          {rep.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline text-[11px] text-muted-foreground">⌘↵ to save</span>
                    <Button type="submit" size="sm" disabled={!newNote.trim()}>
                      Save activity
                    </Button>
                  </div>
                </div>
              </form>
            </section>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent p-0">
                {[
                  { value: 'activity', label: 'Activity', count: allEngagements.length },
                  { value: 'tasks', label: 'Tasks', count: openTaskCount },
                  { value: 'orders', label: 'Orders', count: companyOrders.length },
                ].map(t => (
                  <TabsTrigger
                    key={t.value}
                    value={t.value}
                    className="-mb-px gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-0 pb-2.5 pt-0 text-sm text-muted-foreground shadow-none data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
                  >
                    {t.label}
                    {t.count > 0 && <span className="rounded-full bg-muted px-1.5 text-[11px] tabular-nums text-muted-foreground">{t.count}</span>}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="activity" className="mt-4">
                <section className="content-card">
                  {allEngagements.length > 0 ? (
                    <div className="px-4 py-2">
                      {engagementGroups.map(group => (
                        <div key={group.label}>
                          <h3 className="pt-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{group.label}</h3>
                          <ol className="relative">
                            {group.items.map((engagement, i) => (
                              <EngagementCard
                                key={engagement.id}
                                engagement={engagement}
                                isLast={i === group.items.length - 1}
                                onEdit={engagement.id.startsWith('alog-') ? undefined : handleEditNote}
                                onDelete={engagement.id.startsWith('alog-') ? undefined : handleDeleteNote}
                              />
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">No activity yet. Log your first call, email or note.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={focusComposer}>
                        Log activity
                      </Button>
                    </div>
                  )}

                  {prospect.engagementNotes && (
                    <div className="px-4 py-4 bg-muted/30 border-t border-border">
                      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Original notes</h3>
                      <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{prospect.engagementNotes}</p>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <CompanyTasksSection companyId={prospect.id} companyName={companyName} />
              </TabsContent>

              <TabsContent value="orders" className="mt-4">
                <OrderHistorySection companyName={companyName} companyId={prospect.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {companyName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the company with all of its contacts and engagement history. It can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteCompany} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete company
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit company details slide-over — keeps the user on the company profile */}
      <Sheet open={editPanelOpen} onOpenChange={setEditPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {editPanelOpen && (
            <EditCompanyDetailsPanel
              currentDetails={{
                companyName,
                companyType,
                marketType,
                street,
                city,
                state,
                country,
                zip,
                stage,
                linkedIn,
                website,
                googleMapsUrl,
                phone,
              }}
              onSave={handleUpdateCompanyDetails}
              onClose={() => setEditPanelOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add / edit a contact — same slide-over treatment as company details */}
      <Sheet open={contactPanelOpen} onOpenChange={setContactPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {contactPanelOpen && (
            <ContactDetailsPanel
              // remount on target change so the form re-seeds its defaults
              key={editingContact?.id ?? 'new-contact'}
              contact={editingContact}
              onSave={handleSaveContact}
              onDelete={handleDeleteContact}
              onClose={() => setContactPanelOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Add a contact to an email automation, editing the emails for this company */}
      <Sheet open={enrollPanelOpen} onOpenChange={setEnrollPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {enrollPanelOpen && (
            <EnrollInAutomationPanel
              prospectId={prospect.id}
              prospectName={companyName}
              contacts={contacts}
              initialContactId={enrollContactId}
              onClose={() => setEnrollPanelOpen(false)}
              onEnrolled={() => setEnrollmentsVersion(v => v + 1)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

// Live email sequences for this company. Mirrors the Automations page controls
// so a sequence can be paused or stopped without leaving the profile.
const AUTOMATION_STATUS: Record<Enrollment['status'], { label: string; className: string }> = {
  active: { label: 'Active', className: 'bg-success/10 text-success-foreground' },
  paused: { label: 'Paused', className: 'bg-warning/10 text-warning-foreground' },
  completed: { label: 'Done', className: 'bg-muted text-muted-foreground' },
  replied: { label: 'Replied', className: 'bg-info/10 text-info-foreground' },
  stopped: { label: 'Stopped', className: 'bg-muted text-muted-foreground' },
  failed: { label: 'Failed', className: 'bg-destructive/10 text-destructive' },
};

const CompanyAutomationsSection = ({
  prospectId,
  refreshKey,
  onEnroll,
  canEnroll,
}: {
  prospectId: string;
  refreshKey: number;
  onEnroll: (contactId?: string) => void;
  canEnroll: boolean;
}) => {
  const { enrollments, reload, setStatus } = useEnrollments(prospectId);
  const [confirmStop, setConfirmStop] = useState<Enrollment | null>(null);

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  const live = enrollments.filter(e => e.status === 'active' || e.status === 'paused');
  const finished = enrollments.filter(e => e.status !== 'active' && e.status !== 'paused');

  return (
    <section className="content-card">
      <RailHeader title="Automations" count={live.length}>
        {canEnroll && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEnroll()} aria-label="Add a contact to an automation">
            <Plus className="w-4 h-4" />
          </Button>
        )}
      </RailHeader>

      {enrollments.length === 0 ? (
        <div className="px-4 py-6 text-center">
          <p className="text-sm text-muted-foreground">No sequences running.</p>
          {canEnroll ? (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => onEnroll()}>
              <Zap className="w-4 h-4" />
              Add to automation
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground mt-1">Add a contact with an email address to start one.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-border">
          {[...live, ...finished].map(e => {
            const status = AUTOMATION_STATUS[e.status];
            const nextRun = e.nextRunAt ? parseDateLoose(e.nextRunAt) : null;
            return (
              <div key={e.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{e.contactName || e.contactEmail}</p>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{e.templateName}</p>
                  </div>
                  <span className={`badge-soft shrink-0 ${status.className}`}>{status.label}</span>
                </div>

                <div className="flex items-center justify-between gap-2 mt-2">
                  <p className="text-xs text-muted-foreground">
                    Step {Math.min(e.currentStep + 1, e.steps.length)} of {e.steps.length}
                    {e.status === 'active' && (
                      <> · next {nextRun ? formatMmDdYyyy(nextRun) : 'soon'}</>
                    )}
                  </p>
                  {(e.status === 'active' || e.status === 'paused') && (
                    <div className="flex items-center gap-0.5 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => setStatus(e.id, e.status === 'active' ? 'paused' : 'active')}
                        aria-label={`${e.status === 'active' ? 'Pause' : 'Resume'} sequence for ${e.contactName || e.contactEmail}`}
                      >
                        {e.status === 'active' ? (
                          <Pause className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => setConfirmStop(e)}
                        aria-label={`Stop sequence for ${e.contactName || e.contactEmail}`}
                      >
                        <SquareIcon className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  )}
                </div>

                {e.lastError && (
                  <p className="text-xs text-destructive mt-1.5 line-clamp-2">{e.lastError}</p>
                )}
              </div>
            );
          })}
        </div>
      )}

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
    </section>
  );
};

const StatTile = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-card px-4 py-3 min-w-0">
    <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
    <div className="mt-1 truncate text-base font-semibold leading-tight tabular-nums">{value}</div>
  </div>
);

const RailHeader = ({ title, count, children }: { title: string; count?: number; children?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-2 px-4 h-11 border-b border-border">
    <h2 className="flex items-center gap-1.5 text-sm font-semibold">
      {title}
      {!!count && <span className="text-xs font-normal text-muted-foreground tabular-nums">{count}</span>}
    </h2>
    <div className="flex items-center gap-1">{children}</div>
  </div>
);

// Label/value pair in the Details card. Empty values become an "Add …" affordance (Attio-style)
const PropertyRow = ({ icon: Icon, label, onAdd, children }: {
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

const CountField = ({ id, icon: Icon, label, value, onChange }: {
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

// Company-scoped task list — mirrors the Tasks page interface, filtered to this company
const CompanyTasksSection = ({ companyId, companyName }: { companyId: string; companyName: string }) => {
  const { tasks, getComments } = useTasks();
  const { user } = useAuth();

  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isNewTask, setIsNewTask] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const companyTasks = useMemo(() => {
    const active = tasks.filter(t => t.prospect_id === companyId);
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
  }, [tasks, companyId]);

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
            defaultProspect={isNewTask ? { id: companyId, name: companyName } : null}
          />
        </SheetContent>
      </Sheet>
    </section>
  );
};

const ContactRow =({ contact, onToggleChampion, onEdit }: {
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

const OrderHistorySection = ({ companyName, companyId }: { companyName: string; companyId: string }) => {
  const { orders } = useOrders();
  const companyOrders = orders.filter(o => o.customer === companyName);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  const addOrderButton = (
    <AddOrderDialog
      defaultCompanyName={companyName}
      defaultCompanyId={companyId}
      trigger={
        <Button size="sm" className="gap-2">
          <Plus className="w-4 h-4" />
          New Order
        </Button>
      }
    />
  );

  if (companyOrders.length === 0) {
    return (
      <section className="content-card">
        <div className="px-6 py-12 text-center">
          <Package className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">No orders yet. Record the first one when a PO comes in.</p>
          <div className="mt-3 flex justify-center">{addOrderButton}</div>
        </div>
      </section>
    );
  }

  const totalUnits = companyOrders.reduce((sum, o) => sum + o.units, 0);
  const totalOrders = companyOrders.length;
  const lifetimeValue = companyOrders.reduce((sum, o) => sum + o.totalValue, 0);

  return (
    <section className="content-card">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground tabular-nums">{totalOrders}</span> order{totalOrders !== 1 ? 's' : ''}
          {' · '}<span className="font-semibold text-foreground tabular-nums">{totalUnits}</span> units
          {' · '}<span className="font-semibold text-foreground tabular-nums">{formatCurrency(lifetimeValue)}</span> lifetime
        </p>
        {addOrderButton}
      </div>

      {/* Mobile: cards */}
      <ul className="md:hidden divide-y divide-border">
        {companyOrders.map(order => (
          <li key={order.id}>
            <button
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className="w-full text-left px-4 py-3 space-y-1.5 active:bg-muted/50 outline-none focus-visible:bg-muted/50"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{order.modelType || 'Order'}</span>
                <span className="text-sm font-semibold tabular-nums">{order.totalValue > 0 ? formatCurrency(order.totalValue) : '—'}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">{order.placed}</span>
                <span>· {order.units} units</span>
                <OrderStatusBadge status={order.status} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Date</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Units</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Model</th>
              <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Total</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Status</th>
              <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-4 py-2.5">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {companyOrders.map((order) => {
              return (
                <tr
                  key={order.id}
                  tabIndex={0}
                  onClick={() => setSelectedOrderId(order.id)}
                  onKeyDown={(e) => { if (e.key === 'Enter') setSelectedOrderId(order.id); }}
                  className="hover:bg-muted/30 transition-colors group cursor-pointer outline-none focus-visible:bg-muted/50"
                >
                  <td className="px-4 py-2.5">
                    <span className="text-sm font-mono text-foreground group-hover:text-accent transition-colors">{order.placed}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <span className="text-sm font-mono tabular-nums">{order.units}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="text-sm">{order.modelType}</span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {order.totalValue > 0 ? (
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(order.totalValue)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {order.orderType && order.orderType !== 'Standard' ? order.orderType : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <OrderStatusBadge status={order.status} />
                      <ShipmentProgressText order={order} />
                    </div>
                  </td>
                  <td className="px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {order.invoice && order.invoice.startsWith('http') && (
                        <a
                          href={order.invoice}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open invoice"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="View Invoice"
                        >
                          <FileText className="w-4 h-4" />
                        </a>
                      )}
                      {order.tracking && (
                        <a
                          href={order.tracking}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Track shipment"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                          title="Track Shipment"
                        >
                          <Truck className="w-4 h-4" />
                        </a>
                      )}
                      {!order.invoice?.startsWith('http') && !order.tracking && (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Order detail slide-over — keeps the user on the company profile */}
      <Sheet open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col" onEscapeKeyDown={keepLocalEscape}>
          {selectedOrderId && (
            <OrderDetail
              orderId={selectedOrderId}
              variant="panel"
              linkCustomer={false}
              onDeleted={() => setSelectedOrderId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </section>
  );
};

interface EngagementCardProps {
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

const EngagementCard = ({ engagement, isLast, onEdit, onDelete }: EngagementCardProps) => {
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

export default CompanyPage;
