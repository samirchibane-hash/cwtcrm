import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Linkedin, Plus, FileText, MessageSquare, Package, Truck, Loader2, Star, ChevronLeft, ChevronRight, Globe, Trash2, CheckCircle, XCircle, Pencil, Copy, Check, CheckSquare, Zap, Pause, Play, Square as SquareIcon } from 'lucide-react';
import { Contact, Engagement, CompanyType, MarketType, LeadTier, REPS, getRepConfig } from '@/data/prospects';
import { getProspectLastContactLabel } from '@/lib/prospect-last-contact';
import { parseDateLoose, formatMmDdYyyy } from '@/lib/date';
import { Order, getStatusColor, formatCurrency } from '@/data/orders';
import { useProspects } from '@/context/ProspectsContext';
import StageBadge from '@/components/crm/StageBadge';
import TypeBadge from '@/components/crm/TypeBadge';
import MarketTypeBadge from '@/components/crm/MarketTypeBadge';
import AddContactDialog from '@/components/crm/AddContactDialog';
import EditContactDialog from '@/components/crm/EditContactDialog';
import EditCompanyDetailsPanel from '@/components/crm/EditCompanyDetailsPanel';
import EnrollInAutomationPanel from '@/components/crm/EnrollInAutomationPanel';
import { useEnrollments, type Enrollment } from '@/hooks/useWorkflows';
import EditNoteDialog from '@/components/crm/EditNoteDialog';
import { EmailVerificationDialog } from '@/components/crm/EmailVerificationDialog';
import AddOrderDialog from '@/components/crm/AddOrderDialog';
import OrderDetail from '@/components/OrderDetail';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useOrders } from '@/context/OrdersContext';
import { useTasks, Task, TaskStatus } from '@/context/TasksContext';
import { useAuth } from '@/hooks/useAuth';
import { TaskCard, TaskDetailSheet } from '@/components/crm/TaskDetailSheet';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useState, useEffect, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useProspectActivityLog } from '@/hooks/useActivityLog';

const normalizeUrl = (url: string) => (url.startsWith('http') ? url : `https://${url}`);

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
      className={`p-0.5 rounded transition-colors ${copied ? 'text-green-500' : 'text-muted-foreground/50 hover:text-foreground hover:bg-muted'}`}
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
  const [leadTier, setLeadTier] = useState<LeadTier>('');
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
  // The enroll panel and the rail's list hold separate hook state; bump this so
  // a new enrollment shows up in the rail immediately.
  const [enrollmentsVersion, setEnrollmentsVersion] = useState(0);

  const prospect = id ? getProspectById(id) : null;
  const { prospects } = useProspects();
  const { entries: activityLogEntries } = useProspectActivityLog(id);

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
      .sort((a, b) => b.date.localeCompare(a.date));
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
  const nextProspectId = currentIndex < prospectIds.length - 1 ? prospectIds[currentIndex + 1] : null;
  // Initialize state from prospect data
  useEffect(() => {
    if (prospect) {
      setCompanyName(prospect.companyName);
      // Ensure all contacts have unique IDs
      const contactsWithIds = prospect.contacts.map((c, idx) => ({
        ...c,
        id: c.id || `contact-${Date.now()}-${idx}`,
      }));
      setContacts(contactsWithIds);
      setEngagements([...prospect.engagements].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
      setCompanyType(prospect.type);
      setMarketType(prospect.marketType);
      setLeadTier(prospect.leadTier);
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!prospect) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-semibold mb-2">Company not found</h1>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Dashboard
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
    leadTier: LeadTier;
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
      const sorted = [...updates.engagements].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      const mostRecent = sorted[0].date;
      derivedLastContact = new Date(mostRecent + (mostRecent.includes('T') ? '' : 'T00:00:00'))
        .toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
      setLastContact(derivedLastContact);
    }
    updateProspect({
      id: prospect.id,
      companyName: updates.companyName ?? companyName,
      contacts: updates.contacts ?? contacts,
      engagements: updatedEngagements,
      type: updates.companyType ?? companyType,
      marketType: updates.marketType ?? marketType,
      leadTier: updates.leadTier ?? leadTier,
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
    navigate('/?view=prospects');
  };

  const handleAddContact = (newContact: Contact) => {
    const updatedContacts = [...contacts, newContact];
    setContacts(updatedContacts);
    saveProspect({ contacts: updatedContacts });
  };

  const handleUpdateContact = (updatedContact: Contact) => {
    const updatedContacts = contacts.map(c =>
      c.id === updatedContact.id ? updatedContact : c
    );
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
    leadTier: LeadTier;
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
    setLeadTier(details.leadTier);
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
  const hasRecord = Boolean(addressLine || googleMapsUrl || phone || website || linkedIn || lastContactLabel);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6">
          {/* Nav row */}
          <div className="flex items-center justify-between py-3">
            <button
              onClick={() => {
                const from = location.state?.from;
                navigate(from || '/?view=pipeline');
              }}
              className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>

            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => previousProspectId && navigate(`/company/${previousProspectId}`, { state: location.state })}
                disabled={!previousProspectId}
                className="gap-1 text-muted-foreground"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => nextProspectId && navigate(`/company/${nextProspectId}`, { state: location.state })}
                disabled={!nextProspectId}
                className="gap-1 text-muted-foreground"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Identity row */}
          <div className="flex items-start justify-between gap-6 pb-5">
            {/* Identity + company record, side by side */}
            <div className="flex items-center gap-5 min-w-0 flex-wrap">
              <div className="min-w-0">
                <h1 className="text-2xl font-semibold tracking-tight truncate">{companyName}</h1>
                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                  <TypeBadge type={companyType} />
                  <MarketTypeBadge marketType={marketType} />
                  <StageBadge stage={stage} leadTier={leadTier} maxVisible={3} />
                </div>
              </div>

              {/* Company record — address+phone / links / last contact */}
              {hasRecord && (
                <div className="flex flex-col gap-1 pl-5 border-l border-border text-xs text-muted-foreground">
                  {(addressLine || googleMapsUrl || phone) && (
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                      {(addressLine || googleMapsUrl) && (
                        <span className="flex items-center gap-1">
                          {googleMapsUrl ? (
                            <a href={normalizeUrl(googleMapsUrl)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              {addressLine || 'View on Maps'}
                            </a>
                          ) : (
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 shrink-0" />
                              {addressLine}
                            </span>
                          )}
                          {addressLine && <CopyButton value={addressLine} label="address" />}
                        </span>
                      )}
                      {phone && (
                        <span className="flex items-center gap-1">
                          <a href={`tel:${phone}`} className="flex items-center gap-1 hover:text-foreground transition-colors">
                            <Phone className="w-3.5 h-3.5 shrink-0" />
                            {phone}
                          </a>
                          <CopyButton value={phone} label="phone" />
                        </span>
                      )}
                    </div>
                  )}
                  {(website || linkedIn) && (
                    <div className="flex items-center gap-x-4 gap-y-1 flex-wrap">
                      {website && (
                        <span className="flex items-center gap-1">
                          <a href={normalizeUrl(website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                            <Globe className="w-3.5 h-3.5 shrink-0" />
                            {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                          </a>
                          <CopyButton value={normalizeUrl(website)} label="website" />
                        </span>
                      )}
                      {linkedIn && (
                        <a href={normalizeUrl(linkedIn)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-accent hover:underline">
                          <Linkedin className="w-3.5 h-3.5 shrink-0" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  )}
                  {lastContactLabel && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      Last contact <span className="font-medium text-foreground">{lastContactLabel}</span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setEditPanelOpen(true)}>
                <Pencil className="w-4 h-4" />
                Edit
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent className="rounded-2xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Company</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete <strong>{companyName}</strong>? This action cannot be undone and will remove all contacts and engagement history.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteCompany} className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Delete Company
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        {/* At-a-glance stat strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fade-in">
          <StatTile label="Contacts" value={contacts.length} />
          <StatTile label="Orders" value={companyOrders.length} />
          <StatTile label="Engagements" value={allEngagements.length} />
          <StatTile label="Lifetime Value" value={formatCurrency(lifetimeValue)} accent />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Contacts */}
            <section className="content-card animate-fade-in" style={{ animationDelay: '60ms' }}>
              <div className="flex items-center justify-between p-5 border-b border-border">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <Building2 className="w-4 h-4" />
                  Contacts
                  {contacts.length > 0 && <span className="text-muted-foreground/60 font-normal">{contacts.length}</span>}
                </h2>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl"
                    disabled={!contacts.some(c => c.email)}
                    title={
                      contacts.some(c => c.email)
                        ? 'Add a contact to an email automation'
                        : 'Add a contact with an email address first'
                    }
                    onClick={() => {
                      setEnrollContactId(undefined);
                      setEnrollPanelOpen(true);
                    }}
                  >
                    <Zap className="w-4 h-4 mr-2" />
                    Automate
                  </Button>
                  <EmailVerificationDialog
                    companyWebsite={website}
                    onEmailVerified={(email) => {
                      toast({
                        title: 'Email Verified',
                        description: `Add a contact with email: ${email}`,
                      });
                    }}
                  />
                  <AddContactDialog onAddContact={handleAddContact} />
                </div>
              </div>

              {contacts.length > 0 ? (
                <div className="divide-y divide-border">
                  {contacts.map((contact) => (
                    <ContactRow
                      key={contact.id}
                      contact={contact}
                      onToggleChampion={handleToggleChampion}
                      onUpdate={handleUpdateContact}
                      onDelete={handleDeleteContact}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <p className="text-sm">No contacts added yet</p>
                  <AddContactDialog
                    onAddContact={handleAddContact}
                    trigger={
                      <Button variant="outline" size="sm" className="mt-3">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Contact
                      </Button>
                    }
                  />
                </div>
              )}
            </section>

            {/* Engagement History */}
            <section className="content-card animate-fade-in" style={{ animationDelay: '120ms' }}>
              <div className="p-5 border-b border-border flex items-center justify-between">
                <h2 className="section-header mb-0 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  Recent Engagements
                </h2>
              </div>

              {allEngagements.length > 0 ? (
                <div className="divide-y divide-border">
                  {allEngagements.map((engagement) => (
                    <EngagementCard
                      key={engagement.id}
                      engagement={engagement}
                      onEdit={engagement.id.startsWith('alog-') ? undefined : handleEditNote}
                      onDelete={engagement.id.startsWith('alog-') ? undefined : handleDeleteNote}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-12 text-center text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p className="text-sm">No engagements recorded yet</p>
                  <p className="text-xs mt-1">Use the composer to start tracking interactions</p>
                </div>
              )}

              {prospect.engagementNotes && (
                <div className="p-5 bg-muted/30 border-t border-border">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Original Notes</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{prospect.engagementNotes}</p>
                </div>
              )}
            </section>
          </div>

          {/* Right rail */}
          <div className="space-y-6">
            {/* Email automations running for this company */}
            <CompanyAutomationsSection
              prospectId={prospect.id}
              refreshKey={enrollmentsVersion}
              onEnroll={(contactId) => {
                setEnrollContactId(contactId);
                setEnrollPanelOpen(true);
              }}
              canEnroll={contacts.some(c => c.email)}
            />

            {/* Tasks for this company */}
            <CompanyTasksSection companyId={prospect.id} companyName={companyName} />

            {/* Log Activity composer */}
            <section className="content-card p-5 animate-fade-in" style={{ animationDelay: '60ms' }}>
              <h2 className="section-header flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Log Activity
              </h2>
              <div className="space-y-3">
                <Textarea
                  placeholder="Add a note about this company..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  className="min-h-[90px] resize-none border-0 bg-muted/50 focus:bg-card focus:ring-2 focus:ring-accent rounded-xl"
                />
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Phone className="w-3 h-3" /> Calls
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newNoteCalls || ''}
                      onChange={(e) => setNewNoteCalls(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full h-9 rounded-lg border border-input bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Mail className="w-3 h-3" /> Emails
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newNoteEmails || ''}
                      onChange={(e) => setNewNoteEmails(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full h-9 rounded-lg border border-input bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Linkedin className="w-3 h-3" /> LinkedIn messages
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={newNoteLinkedIn || ''}
                      onChange={(e) => setNewNoteLinkedIn(Math.max(0, parseInt(e.target.value) || 0))}
                      placeholder="0"
                      className="w-full h-9 rounded-lg border border-input bg-muted/50 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Logged by</label>
                  <div className="flex gap-2 flex-wrap">
                    {REPS.map(rep => (
                      <button
                        key={rep.name}
                        type="button"
                        onClick={() => setNewNoteLoggedBy(rep.name)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          newNoteLoggedBy === rep.name
                            ? `${rep.activeClass} border-current`
                            : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`}>
                          {rep.initials}
                        </span>
                        {rep.name}
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()} className="w-full">
                  Save Activity
                </Button>
              </div>
            </section>
          </div>
        </div>

        {/* Order History Section */}
        <OrderHistorySection companyName={companyName} companyId={prospect.id} />
      </main>

      {/* Edit company details slide-over — keeps the user on the company profile */}
      <Sheet open={editPanelOpen} onOpenChange={setEditPanelOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {editPanelOpen && (
            <EditCompanyDetailsPanel
              currentDetails={{
                companyName,
                companyType,
                marketType,
                leadTier,
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
  active: { label: 'Active', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
  paused: { label: 'Paused', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  completed: { label: 'Done', className: 'bg-muted text-muted-foreground' },
  replied: { label: 'Replied', className: 'bg-blue-500/10 text-blue-600 dark:text-blue-400' },
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

  useEffect(() => {
    if (refreshKey > 0) reload();
  }, [refreshKey, reload]);

  const live = enrollments.filter(e => e.status === 'active' || e.status === 'paused');
  const finished = enrollments.filter(e => e.status !== 'active' && e.status !== 'paused');

  return (
    <section className="content-card animate-fade-in">
      <div className="flex items-center justify-between p-5 border-b border-border">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Automations
          {live.length > 0 && <span className="text-muted-foreground/60 font-normal">{live.length}</span>}
        </h2>
        {canEnroll && (
          <Button variant="ghost" size="sm" className="rounded-xl" onClick={() => onEnroll()}>
            <Plus className="w-4 h-4 mr-1" />
            Add
          </Button>
        )}
      </div>

      {enrollments.length === 0 ? (
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">No sequences running</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Enroll a contact to start an automated email sequence.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {[...live, ...finished].map(e => {
            const status = AUTOMATION_STATUS[e.status];
            const nextRun = e.nextRunAt ? parseDateLoose(e.nextRunAt) : null;
            return (
              <div key={e.id} className="p-4">
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
                        aria-label={e.status === 'active' ? 'Pause sequence' : 'Resume sequence'}
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
                        onClick={() => setStatus(e.id, 'stopped')}
                        aria-label="Stop sequence"
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
    </section>
  );
};

const StatTile = ({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) => (
  <div className="content-card px-4 py-3">
    <div className={`text-xl font-semibold leading-none tabular-nums ${accent ? 'text-accent' : ''}`}>{value}</div>
    <div className="mt-1.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</div>
  </div>
);

// Company-scoped task list — mirrors the Tasks page interface, filtered to this company
const CompanyTasksSection = ({ companyId, companyName }: { companyId: string; companyName: string }) => {
  const { tasks, updateTask, getComments } = useTasks();
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

  const toggleDone = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const next: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    await updateTask({ ...task, status: next });
  };

  return (
    <section className="content-card p-5 animate-fade-in" style={{ animationDelay: '40ms' }}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <CheckSquare className="w-4 h-4" />
          Tasks
          {openCount > 0 && <span className="text-muted-foreground/60 font-normal">{openCount}</span>}
        </h2>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={openNewTask}>
          <Plus className="w-4 h-4" />
          Add Task
        </Button>
      </div>

      {companyTasks.length > 0 ? (
        <div className="space-y-2">
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
      ) : (
        <div className="text-center py-8 text-muted-foreground">
          <CheckSquare className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No tasks for this company yet</p>
          <Button variant="outline" size="sm" className="mt-3 gap-1.5" onClick={openNewTask}>
            <Plus className="w-4 h-4" />
            Add Task
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

const ContactRow =({ contact, onToggleChampion, onUpdate, onDelete }: {
  contact: Contact;
  onToggleChampion: (id: string) => void;
  onUpdate: (contact: Contact) => void;
  onDelete: (id: string) => void;
}) => {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5 hover:bg-muted/30 transition-colors group">
      <button
        onClick={() => onToggleChampion(contact.id)}
        className={`p-1.5 rounded-lg transition-colors shrink-0 ${
          contact.isChampion
            ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20'
            : 'text-muted-foreground/40 hover:text-amber-500 hover:bg-muted'
        }`}
        title={contact.isChampion ? 'Remove as champion' : 'Set as champion'}
      >
        <Star className={`w-4 h-4 ${contact.isChampion ? 'fill-current' : ''}`} />
      </button>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-medium text-sm truncate">{contact.name}</p>
          {contact.role && <span className="text-xs text-muted-foreground truncate">· {contact.role}</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {contact.email ? (
            <span className="flex items-center gap-1">
              <a href={`mailto:${contact.email}`} className="text-xs text-accent hover:underline flex items-center gap-1">
                {contact.emailVerified === true && <CheckCircle className="w-3 h-3 text-green-500 shrink-0" />}
                {contact.emailVerified === false && <XCircle className="w-3 h-3 text-red-500 shrink-0" />}
                <Mail className="w-3 h-3" />
                {contact.email}
              </a>
              <CopyButton value={contact.email} label="email" />
            </span>
          ) : null}
          {contact.phone && (
            <span className="flex items-center gap-1">
              <a href={`tel:${contact.phone}`} className="text-xs font-mono text-muted-foreground hover:text-foreground flex items-center gap-1">
                <Phone className="w-3 h-3" />
                {contact.phone}
              </a>
              <CopyButton value={contact.phone} label="phone" />
            </span>
          )}
        </div>
      </div>

      {contact.linkedIn && (
        <a
          href={contact.linkedIn}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors shrink-0"
        >
          <Linkedin className="w-4 h-4" />
        </a>
      )}
      <div className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <EditContactDialog
          contact={contact}
          onUpdateContact={onUpdate}
          onDeleteContact={onDelete}
        />
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
      <section className="content-card animate-fade-in" style={{ animationDelay: '180ms' }}>
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h2 className="section-header mb-0 flex items-center gap-2">
            <Package className="w-4 h-4" />
            Order History
          </h2>
          {addOrderButton}
        </div>
        <div className="p-12 text-center text-muted-foreground">
          <Package className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p className="text-sm">No orders found for this company</p>
          <p className="text-xs mt-1">Create your first order above</p>
        </div>
      </section>
    );
  }

  const totalUnits = companyOrders.reduce((sum, o) => sum + o.units, 0);
  const totalOrders = companyOrders.length;
  const lifetimeValue = companyOrders.reduce((sum, o) => sum + o.totalValue, 0);

  return (
    <section className="content-card animate-fade-in" style={{ animationDelay: '180ms' }}>
      <div className="p-5 border-b border-border flex flex-wrap items-center justify-between gap-4">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <Package className="w-4 h-4" />
          Order History
        </h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center divide-x divide-border rounded-xl border border-border bg-muted/30 overflow-hidden">
            <div className="px-4 py-2 text-center">
              <div className="text-base font-semibold leading-none tabular-nums">{totalOrders}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Orders</div>
            </div>
            <div className="px-4 py-2 text-center">
              <div className="text-base font-semibold leading-none tabular-nums">{totalUnits}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Units</div>
            </div>
            <div className="px-4 py-2 text-center">
              <div className="text-base font-semibold leading-none tabular-nums text-accent">{formatCurrency(lifetimeValue)}</div>
              <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lifetime Value</div>
            </div>
          </div>
          {addOrderButton}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Date</th>
              <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Units</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Model</th>
              <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Total</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Status</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {companyOrders.map((order) => {
              const statusColors = getStatusColor(order.status);
              return (
                <tr
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className="hover:bg-muted/30 transition-colors group cursor-pointer"
                >
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-foreground group-hover:text-accent transition-colors">{order.placed}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant="outline" className="font-mono">{order.units}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{order.modelType}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {order.totalValue > 0 ? (
                      <span className="text-sm font-semibold tabular-nums">{formatCurrency(order.totalValue)}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {order.orderType && order.orderType !== 'Standard' ? order.orderType : '—'}
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-2">
                      {order.invoice && order.invoice.startsWith('http') && (
                        <a
                          href={order.invoice}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 transition-colors"
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
                          className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10 text-green-500 hover:bg-green-500/20 transition-colors"
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
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
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
  onEdit?: (id: string, details: string, activity?: { calls?: number; emails?: number; linkedin?: number }, loggedBy?: string) => void;
  onDelete?: (id: string) => void;
}

const EngagementCard = ({ engagement, onEdit, onDelete }: EngagementCardProps) => {
  const hasCalls = (engagement.activity?.calls || 0) > 0;
  const hasEmails = (engagement.activity?.emails || 0) > 0;
  const hasLinkedIn = (engagement.activity?.linkedin || 0) > 0;
  const rep = getRepConfig(engagement.loggedBy);

  return (
    <div className="px-5 py-3 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start gap-3">
        {engagement.loggedBy && (
          <div className="flex-shrink-0 pt-0.5">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`}
              title={rep.name}
            >
              {rep.initials}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm">{engagement.details || engagement.summary}</p>
              {(hasCalls || hasEmails || hasLinkedIn) && (
                <div className="flex items-center gap-2 mt-1.5">
                  {hasCalls && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-chart-1/10 text-chart-1">
                      <Phone className="w-3 h-3" />
                      {engagement.activity!.calls} call{engagement.activity!.calls !== 1 ? 's' : ''}
                    </span>
                  )}
                  {hasEmails && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-chart-2/10 text-chart-2">
                      <Mail className="w-3 h-3" />
                      {engagement.activity!.emails} email{engagement.activity!.emails !== 1 ? 's' : ''}
                    </span>
                  )}
                  {hasLinkedIn && (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,119,181,0.1)', color: '#0077b5' }}>
                      <Linkedin className="w-3 h-3" />
                      {engagement.activity!.linkedin} LinkedIn
                    </span>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className="text-xs text-muted-foreground font-mono whitespace-nowrap">
                {(() => { const d = parseDateLoose(engagement.date); return d ? formatMmDdYyyy(d) : engagement.date; })()}
              </span>
              {onEdit && onDelete && (
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <EditNoteDialog
                    engagement={engagement}
                    onSave={onEdit}
                    onDelete={onDelete}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
