import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  ArrowLeft, ChevronDown, ChevronRight, ChevronUp, Globe, Landmark, Linkedin, Mail, MapPin, MessageSquare,
  MoreHorizontal, Pencil, Phone, Plus, Trash2,
} from 'lucide-react';
import { Contact, Engagement, REPS } from '@/data/prospects';
import { INVESTOR_STAGES } from '@/data/investors';
import { useInvestors } from '@/context/InvestorsContext';
import { useTasks } from '@/context/TasksContext';
import { getProspectLastContactLabel } from '@/lib/prospect-last-contact';
import { parseDateLoose } from '@/lib/date';
import {
  byDateDesc, normalizeUrl, CopyButton, StatTile, RailHeader, PropertyRow, CountField,
  RecordTasksSection, ContactRow, EngagementCard,
} from '@/components/crm/RecordParts';
import ContactDetailsPanel from '@/components/crm/ContactDetailsPanel';
import InvestorStageBadge from '@/components/crm/InvestorStageBadge';
import InvestorFormPanel, { type InvestorFormData } from '@/components/crm/InvestorFormPanel';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';

const InvestorPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { investors, isLoading, getInvestorById, updateInvestor, deleteInvestor } = useInvestors();
  const { tasks } = useTasks();
  const [searchParams, setSearchParams] = useSearchParams();
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const [newNote, setNewNote] = useState('');
  const [newNoteCalls, setNewNoteCalls] = useState(0);
  const [newNoteEmails, setNewNoteEmails] = useState(0);
  const [newNoteLinkedIn, setNewNoteLinkedIn] = useState(0);
  const [newNoteLoggedBy, setNewNoteLoggedBy] = useState<string>('Samir');
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [contactPanelOpen, setContactPanelOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | undefined>();

  const investor = id ? getInvestorById(id) : undefined;
  const tab = searchParams.get('tab') === 'tasks' ? 'tasks' : 'activity';

  const engagements = useMemo(() => [...(investor?.engagements ?? [])].sort(byDateDesc), [investor]);
  const openTaskCount = useMemo(
    () => tasks.filter(t => t.prospect_id === id && t.status !== 'done' && t.status !== 'cancelled').length,
    [tasks, id],
  );

  // Step through the list the user came from (falls back to all investors)
  const investorIds: string[] = (location.state as { investorIds?: string[] } | null)?.investorIds || investors.map(i => i.id);
  const currentIndex = investorIds.findIndex(x => x === id);
  const previousId = currentIndex > 0 ? investorIds[currentIndex - 1] : null;
  const nextId = currentIndex >= 0 && currentIndex < investorIds.length - 1 ? investorIds[currentIndex + 1] : null;
  const goTo = (target: string | null) => {
    if (target) navigate(`/investor/${target}${location.search}`, { state: location.state });
  };

  // J / K between investors, ignored while typing or with an overlay open
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement;
      if (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return;
      if (document.querySelector('[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]')) return;
      const target = e.key === 'j' ? nextId : e.key === 'k' ? previousId : null;
      if (target) navigate(`/investor/${target}${location.search}`, { state: location.state });
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [nextId, previousId, navigate, location.search, location.state]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background" aria-busy="true" aria-label="Loading investor">
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

  if (!investor) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-semibold">Investor not found</h1>
          <p className="text-sm text-muted-foreground">It may have been deleted, or the link is out of date.</p>
          <Button variant="outline" onClick={() => navigate('/?view=investors')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Investors
          </Button>
        </div>
      </div>
    );
  }

  const save = (changes: Partial<typeof investor>) => {
    const next = { ...investor, ...changes };
    // Keep the legacy last-contact field in step with the newest engagement
    if (changes.engagements) {
      const newest = parseDateLoose([...changes.engagements].sort(byDateDesc)[0]?.date ?? '');
      next.lastContact = newest ? newest.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' }) : investor.lastContact;
    }
    return updateInvestor(next);
  };

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    const activity: Engagement['activity'] = {};
    if (newNoteCalls > 0) activity.calls = newNoteCalls;
    if (newNoteEmails > 0) activity.emails = newNoteEmails;
    if (newNoteLinkedIn > 0) activity.linkedin = newNoteLinkedIn;
    const engagement: Engagement = {
      id: `eng-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      type: 'note',
      summary: newNote.length > 60 ? newNote.slice(0, 60) + '...' : newNote,
      details: newNote,
      loggedBy: newNoteLoggedBy,
      ...(Object.keys(activity).length > 0 ? { activity } : {}),
    };
    const draft = { note: newNote, calls: newNoteCalls, emails: newNoteEmails, linkedin: newNoteLinkedIn };
    setNewNote(''); setNewNoteCalls(0); setNewNoteEmails(0); setNewNoteLinkedIn(0);
    if (await save({ engagements: [engagement, ...investor.engagements] })) {
      toast({ title: 'Activity logged' });
    } else {
      // Put the draft back so nothing typed is lost
      setNewNote(draft.note); setNewNoteCalls(draft.calls); setNewNoteEmails(draft.emails); setNewNoteLinkedIn(draft.linkedin);
    }
  };

  const handleEditNote = (engagementId: string, details: string, activity?: Engagement['activity'], loggedBy?: string) => {
    save({
      engagements: investor.engagements.map(e => e.id === engagementId
        ? { ...e, details, summary: details.length > 60 ? details.slice(0, 60) + '...' : details, activity, loggedBy: loggedBy ?? e.loggedBy }
        : e),
    });
  };

  const handleDeleteNote = (engagementId: string) => {
    save({ engagements: investor.engagements.filter(e => e.id !== engagementId) });
  };

  const handleSaveContact = (saved: Contact) => {
    const exists = investor.contacts.some(c => c.id === saved.id);
    save({ contacts: exists ? investor.contacts.map(c => (c.id === saved.id ? saved : c)) : [...investor.contacts, saved] });
  };

  const handleToggleChampion = (contactId: string) => {
    const contact = investor.contacts.find(c => c.id === contactId);
    save({ contacts: investor.contacts.map(c => ({ ...c, isChampion: c.id === contactId ? !c.isChampion : false })) });
    toast({ title: contact?.isChampion ? 'Champion removed' : `${contact?.name} is now the champion` });
  };

  const handleEdit = async (data: InvestorFormData) => {
    const ok = await save({ ...data });
    if (ok) toast({ title: 'Investor updated' });
    return ok;
  };

  const handleDelete = async () => {
    if (await deleteInvestor(investor.id)) {
      toast({ title: 'Investor deleted', description: `${investor.name} has been removed.` });
      navigate('/?view=investors');
    }
  };

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

  const lastContactLabel = getProspectLastContactLabel(investor);
  const locationLine = [[investor.city, investor.state].filter(Boolean).join(', '), investor.country].filter(Boolean).join(', ');
  const initials = investor.name.split(/\s+/).filter(w => /^[a-z0-9]/i.test(w)).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
  const openEdit = () => setEditOpen(true);

  const engagementGroups: { label: string; items: Engagement[] }[] = [];
  for (const engagement of engagements) {
    const d = parseDateLoose(engagement.date ?? '');
    const label = d ? format(d, 'MMMM yyyy') : 'Undated';
    const last = engagementGroups[engagementGroups.length - 1];
    if (last && last.label === label) last.items.push(engagement);
    else engagementGroups.push({ label, items: [engagement] });
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Record bar */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-6 h-12 flex items-center justify-between gap-4">
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5 text-sm">
            <button
              onClick={() => navigate(location.state?.from || '/?view=investors')}
              className="flex shrink-0 items-center gap-1.5 rounded text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft className="w-4 h-4" />
              Investors
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="truncate font-medium" aria-current="page">{investor.name}</span>
          </nav>
          <div className="flex shrink-0 items-center gap-1">
            {currentIndex >= 0 && (
              <span className="hidden sm:inline text-xs text-muted-foreground tabular-nums mr-1">
                {(currentIndex + 1).toLocaleString()} of {investorIds.length.toLocaleString()}
              </span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(previousId)} disabled={!previousId} aria-label="Previous investor">
                  <ChevronUp className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Previous investor <kbd className="ml-1 text-[10px] text-muted-foreground">K</kbd></TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => goTo(nextId)} disabled={!nextId} aria-label="Next investor">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Next investor <kbd className="ml-1 text-[10px] text-muted-foreground">J</kbd></TooltipContent>
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
              <h1 className="text-xl font-semibold tracking-tight truncate">{investor.name}</h1>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                {/* Stage is the most-changed field, so it's one click from the header */}
                <Select value={investor.stage || undefined} onValueChange={v => { save({ stage: v }); toast({ title: `Moved to ${v}` }); }}>
                  <SelectTrigger
                    aria-label={`Stage: ${investor.stage || 'not set'}. Change stage`}
                    className="h-auto w-auto gap-1 border-0 bg-transparent p-0 shadow-none focus:ring-2 focus:ring-ring focus:ring-offset-1 rounded-full [&>svg]:h-3.5 [&>svg]:w-3.5"
                  >
                    {investor.stage ? <InvestorStageBadge stage={investor.stage} /> : <span className="text-xs text-muted-foreground">Set stage</span>}
                  </SelectTrigger>
                  <SelectContent>
                    {INVESTOR_STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
                {investor.investorType && <span className="type-badge bg-muted text-muted-foreground">{investor.investorType}</span>}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="gap-1.5" onClick={focusComposer}>
              <Plus className="w-4 h-4" />
              Log activity
            </Button>
            <Button variant="outline" size="sm" className="gap-1.5" onClick={openEdit}>
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
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteOpen(true)}>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete investor
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)] gap-6 items-start">
          {/* Left rail */}
          <aside className="space-y-4">
            <section aria-label="At a glance" className="content-card grid grid-cols-2 gap-px bg-border">
              <StatTile label="Engagements" value={engagements.length} />
              <StatTile label="Contacts" value={investor.contacts.length} />
              <StatTile label="Open tasks" value={openTaskCount} />
              <StatTile label="Last contact" value={lastContactLabel || '—'} />
            </section>

            <section className="content-card">
              <RailHeader title="Details">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEdit} aria-label="Edit investor details">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </RailHeader>
              <dl className="px-4 py-2">
                <PropertyRow icon={Landmark} label="Type" onAdd={openEdit}>
                  {investor.investorType || null}
                </PropertyRow>
                <PropertyRow icon={MapPin} label="Location" onAdd={openEdit}>
                  {locationLine || null}
                </PropertyRow>
                <PropertyRow icon={Phone} label="Phone" onAdd={openEdit}>
                  {investor.phone ? (
                    <span className="flex items-center gap-1">
                      <a href={`tel:${investor.phone}`} className="font-mono hover:underline">{investor.phone}</a>
                      <CopyButton value={investor.phone} label="phone" />
                    </span>
                  ) : null}
                </PropertyRow>
                <PropertyRow icon={Globe} label="Website" onAdd={openEdit}>
                  {investor.website ? (
                    <span className="flex items-center gap-1 min-w-0">
                      <a href={normalizeUrl(investor.website)} target="_blank" rel="noopener noreferrer" className="truncate text-accent hover:underline">
                        {investor.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                      </a>
                      <CopyButton value={normalizeUrl(investor.website)} label="website" />
                    </span>
                  ) : null}
                </PropertyRow>
                <PropertyRow icon={Linkedin} label="LinkedIn" onAdd={openEdit}>
                  {investor.linkedIn ? (
                    <a href={normalizeUrl(investor.linkedIn)} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                      Profile
                    </a>
                  ) : null}
                </PropertyRow>
              </dl>
            </section>

            <section className="content-card">
              <RailHeader title="Contacts" count={investor.contacts.length}>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { setEditingContact(undefined); setContactPanelOpen(true); }} aria-label="Add contact">
                  <Plus className="w-4 h-4" />
                </Button>
              </RailHeader>
              {investor.contacts.length > 0 ? (
                <div className="divide-y divide-border">
                  {investor.contacts.map(contact => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onToggleChampion={handleToggleChampion}
                      onEdit={c => { setEditingContact(c); setContactPanelOpen(true); }}
                    />
                  ))}
                </div>
              ) : (
                <div className="px-4 py-6 text-center">
                  <p className="text-sm text-muted-foreground">Add the partners and associates you talk to.</p>
                  <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={() => { setEditingContact(undefined); setContactPanelOpen(true); }}>
                    <Plus className="w-4 h-4" />
                    Add contact
                  </Button>
                </div>
              )}
            </section>

            {investor.notes && (
              <section className="content-card">
                <RailHeader title="Notes">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openEdit} aria-label="Edit notes">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                </RailHeader>
                <p className="px-4 py-3 text-sm text-muted-foreground leading-relaxed whitespace-pre-line">{investor.notes}</p>
              </section>
            )}
          </aside>

          {/* Main */}
          <div className="space-y-4 min-w-0">
            <section className="content-card p-4" aria-labelledby="log-activity-heading">
              <h2 id="log-activity-heading" className="sr-only">Log activity</h2>
              <form onSubmit={e => { e.preventDefault(); handleAddNote(); }} className="space-y-3">
                <Textarea
                  ref={composerRef}
                  aria-label="Activity note"
                  placeholder="Log a meeting, call, email or update…"
                  value={newNote}
                  onChange={e => setNewNote(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); handleAddNote(); }
                  }}
                  className="min-h-[72px] resize-y border-0 bg-muted/50 focus-visible:bg-card rounded-lg"
                />
                <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                  <CountField id="inv-note-calls" icon={Phone} label="Calls" value={newNoteCalls} onChange={setNewNoteCalls} />
                  <CountField id="inv-note-emails" icon={Mail} label="Emails" value={newNoteEmails} onChange={setNewNoteEmails} />
                  <CountField id="inv-note-linkedin" icon={Linkedin} label="LinkedIn" value={newNoteLinkedIn} onChange={setNewNoteLinkedIn} />
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
                            newNoteLoggedBy === rep.name ? 'border-foreground/20 bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/50'
                          }`}
                        >
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`} aria-hidden="true">{rep.initials}</span>
                          {rep.name}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="ml-auto flex items-center gap-2">
                    <span className="hidden sm:inline text-[11px] text-muted-foreground">⌘↵ to save</span>
                    <Button type="submit" size="sm" disabled={!newNote.trim()}>Save activity</Button>
                  </div>
                </div>
              </form>
            </section>

            <Tabs value={tab} onValueChange={setTab}>
              <TabsList className="h-auto w-full justify-start gap-5 rounded-none border-b border-border bg-transparent p-0">
                {[
                  { value: 'activity', label: 'Activity', count: engagements.length },
                  { value: 'tasks', label: 'Tasks', count: openTaskCount },
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
                  {engagements.length > 0 ? (
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
                                onEdit={handleEditNote}
                                onDelete={handleDeleteNote}
                              />
                            ))}
                          </ol>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-6 py-12 text-center">
                      <MessageSquare className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">No activity yet. Log your first meeting, call or email.</p>
                      <Button variant="outline" size="sm" className="mt-3" onClick={focusComposer}>Log activity</Button>
                    </div>
                  )}
                </section>
              </TabsContent>

              <TabsContent value="tasks" className="mt-4">
                <RecordTasksSection recordId={investor.id} recordName={investor.name} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      <Sheet open={editOpen} onOpenChange={setEditOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {editOpen && <InvestorFormPanel investor={investor} onSubmit={handleEdit} onClose={() => setEditOpen(false)} />}
        </SheetContent>
      </Sheet>

      <Sheet open={contactPanelOpen} onOpenChange={setContactPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {contactPanelOpen && (
            <ContactDetailsPanel
              key={editingContact?.id ?? 'new-contact'}
              contact={editingContact}
              onSave={handleSaveContact}
              onDelete={contactId => save({ contacts: investor.contacts.filter(c => c.id !== contactId) })}
              onClose={() => setContactPanelOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {investor.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              This removes the investor with all of its contacts and activity history. It can’t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Delete investor
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default InvestorPage;
