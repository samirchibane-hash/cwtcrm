import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Linkedin, Plus, FileText, MessageSquare, Calendar, Upload, Package, Truck, ExternalLink, Loader2, Star, ChevronLeft, ChevronRight, Globe, Trash2 } from 'lucide-react';
import { Contact, Engagement, CompanyType, MarketType, LeadTier } from '@/data/prospects';
import { getOrdersByCustomer, Order, getStatusColor } from '@/data/orders';
import { useProspects } from '@/context/ProspectsContext';
import StageBadge from '@/components/crm/StageBadge';
import TypeBadge from '@/components/crm/TypeBadge';
import MarketTypeBadge from '@/components/crm/MarketTypeBadge';
import LeadTierBadge from '@/components/crm/LeadTierBadge';
import AddContactDialog from '@/components/crm/AddContactDialog';
import EditContactDialog from '@/components/crm/EditContactDialog';
import EditCompanyDetailsDialog from '@/components/crm/EditCompanyDetailsDialog';
import EditNoteDialog from '@/components/crm/EditNoteDialog';
import { EmailVerificationDialog } from '@/components/crm/EmailVerificationDialog';
import AddOrderDialog from '@/components/crm/AddOrderDialog';
import { useOrders } from '@/context/OrdersContext';
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
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const CompanyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const { getProspectById, updateProspect, deleteProspect, isLoading } = useProspects();
  const [newNote, setNewNote] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>('');
  const [marketType, setMarketType] = useState<MarketType>('');
  const [leadTier, setLeadTier] = useState<LeadTier>('');
  const [state, setState] = useState('');
  const [stage, setStage] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  const [website, setWebsite] = useState('');
  const [lastContact, setLastContact] = useState('');
  const [engagementNotes, setEngagementNotes] = useState('');
  
  const prospect = id ? getProspectById(id) : null;
  const { prospects } = useProspects();
  
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
      setEngagements(prospect.engagements);
      setCompanyType(prospect.type);
      setMarketType(prospect.marketType);
      setLeadTier(prospect.leadTier);
      setState(prospect.state);
      setStage(prospect.stage);
      setLinkedIn(prospect.linkedIn);
      setWebsite(prospect.website || '');
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
    state: string;
    stage: string;
    linkedIn: string;
    website: string;
  }>) => {
    updateProspect({
      id: prospect.id,
      companyName: updates.companyName ?? companyName,
      contacts: updates.contacts ?? contacts,
      engagements: updates.engagements ?? engagements,
      type: updates.companyType ?? companyType,
      marketType: updates.marketType ?? marketType,
      leadTier: updates.leadTier ?? leadTier,
      state: updates.state ?? state,
      stage: updates.stage ?? stage,
      linkedIn: updates.linkedIn ?? linkedIn,
      website: updates.website ?? website,
      lastContact: lastContact,
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
    
    const newEngagement: Engagement = {
      id: `eng-${Date.now()}`,
      date: new Date().toLocaleDateString(),
      type: 'note',
      summary: newNote.length > 60 ? newNote.slice(0, 60) + '...' : newNote,
      details: newNote,
    };
    
    const updatedEngagements = [newEngagement, ...engagements];
    setEngagements(updatedEngagements);
    saveProspect({ engagements: updatedEngagements });
    toast({
      title: 'Note saved',
      description: 'Your note has been added to engagements.',
    });
    setNewNote('');
  };

  const handleEditNote = (engagementId: string, newDetails: string) => {
    const updatedEngagements = engagements.map(eng => 
      eng.id === engagementId 
        ? { 
            ...eng, 
            details: newDetails,
            summary: newDetails.length > 60 ? newDetails.slice(0, 60) + '...' : newDetails,
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
    state: string;
    stage: string;
    linkedIn: string;
    website?: string;
  }) => {
    setCompanyName(details.companyName);
    setCompanyType(details.companyType);
    setMarketType(details.marketType);
    setLeadTier(details.leadTier);
    setState(details.state);
    setStage(details.stage);
    setLinkedIn(details.linkedIn);
    setWebsite(details.website || '');
    saveProspect(details);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <button 
              onClick={() => {
                const from = (location.state as { from?: string } | null)?.from;
                if (from) {
                  navigate(from);
                } else {
                  navigate(-1);
                }
              }}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm font-medium">
                {(() => {
                  const from = (location.state as { from?: string } | null)?.from;
                  if (from?.includes('view=customers')) return 'Back to Customers';
                  if (from?.includes('view=orders')) return 'Back to Orders';
                  return 'Back';
                })()}
              </span>
            </button>
            
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  previousProspectId &&
                  navigate(`/company/${previousProspectId}`, { state: location.state })
                }
                disabled={!previousProspectId}
                className="gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  nextProspectId &&
                  navigate(`/company/${nextProspectId}`, { state: location.state })
                }
                disabled={!nextProspectId}
                className="gap-1"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
                <Building2 className="w-8 h-8 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{companyName}</h1>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <TypeBadge type={companyType} />
                  <MarketTypeBadge marketType={marketType} />
                  <LeadTierBadge leadTier={leadTier} />
                  <StageBadge stage={stage} />
                  {state && (
                    <span className="flex items-center gap-1 text-sm text-muted-foreground">
                      <MapPin className="w-3.5 h-3.5" />
                      {state}
                    </span>
                  )}
                </div>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <EditCompanyDetailsDialog
                currentDetails={{
                  companyName,
                  companyType,
                  marketType,
                  leadTier,
                  state,
                  stage,
                  linkedIn,
                  website,
                }}
                onSave={handleUpdateCompanyDetails}
              />
              {linkedIn && (
                <Button variant="outline" size="sm" asChild>
                  <a href={linkedIn} target="_blank" rel="noopener noreferrer">
                    <Linkedin className="w-4 h-4 mr-2" />
                    LinkedIn
                  </a>
                </Button>
              )}
              {website && (
                <Button variant="outline" size="sm" asChild>
                  <a href={website.startsWith('http') ? website : `https://${website}`} target="_blank" rel="noopener noreferrer">
                    <Globe className="w-4 h-4 mr-2" />
                    Website
                  </a>
                </Button>
              )}
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Log Activity
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
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
      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Top Row - Company Details & Contacts side by side */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Company Details - Left */}
          <div className="lg:col-span-1">
            <section className="content-card p-6 animate-fade-in h-full">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">Company Details</h2>
                <EditCompanyDetailsDialog
                  currentDetails={{
                    companyName,
                    companyType,
                    marketType,
                    leadTier,
                    state,
                    stage,
                    linkedIn,
                    website,
                  }}
                  onSave={handleUpdateCompanyDetails}
                />
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">Company Name</label>
                  <p className="font-medium">{companyName}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Business Model</label>
                  <div className="flex items-center gap-2 mt-1">
                    {companyType ? (
                      <TypeBadge type={companyType} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Product Vertical</label>
                  <div className="mt-1">
                    {marketType ? (
                      <MarketTypeBadge marketType={marketType} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Lead Tier</label>
                  <div className="mt-1">
                    {leadTier ? (
                      <LeadTierBadge leadTier={leadTier} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Location</label>
                  <p className="font-medium">{state || 'Not specified'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Pipeline Stage</label>
                  <div className="mt-1">
                    {stage ? (
                      <StageBadge stage={stage} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not set</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Last Contact</label>
                  <p className="font-medium font-mono">{prospect.lastContact || 'Never'}</p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Website</label>
                  {website ? (
                    <a 
                      href={website.startsWith('http') ? website : `https://${website}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-accent hover:underline flex items-center gap-1"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      {website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  ) : (
                    <span className="text-sm text-muted-foreground">Not specified</span>
                  )}
                </div>
              </div>
            </section>
          </div>

          {/* Contacts - Right, expanded */}
          <div className="lg:col-span-2">
            <section className="content-card animate-fade-in h-full" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between p-6 border-b border-border">
                <h2 className="section-header mb-0">Contacts</h2>
                <div className="flex items-center gap-2">
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
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border bg-muted/30">
                        <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-3 py-3 w-12">★</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Name</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Role</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Email</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Cell Phone</th>
                        <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">LinkedIn</th>
                        <th className="text-right text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {contacts.map((contact) => (
                        <tr key={contact.id} className="hover:bg-muted/30 transition-colors">
                          <td className="px-3 py-4 text-center">
                            <button
                              onClick={() => handleToggleChampion(contact.id)}
                              className={`p-1.5 rounded-lg transition-colors ${
                                contact.isChampion 
                                  ? 'text-amber-500 bg-amber-500/10 hover:bg-amber-500/20' 
                                  : 'text-muted-foreground hover:text-amber-500 hover:bg-muted'
                              }`}
                              title={contact.isChampion ? 'Remove as champion' : 'Set as champion'}
                            >
                              <Star className={`w-4 h-4 ${contact.isChampion ? 'fill-current' : ''}`} />
                            </button>
                          </td>
                          <td className="px-6 py-4">
                            <p className="font-medium text-sm">{contact.name}</p>
                          </td>
                          <td className="px-6 py-4">
                            <p className="text-sm text-muted-foreground">{contact.role || '—'}</p>
                          </td>
                          <td className="px-6 py-4">
                            {contact.email ? (
                              <a 
                                href={`mailto:${contact.email}`}
                                className="text-sm text-accent hover:underline flex items-center gap-1.5"
                              >
                                <Mail className="w-3.5 h-3.5" />
                                {contact.email}
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {contact.phone ? (
                              <a 
                                href={`tel:${contact.phone}`}
                                className="text-sm font-mono text-foreground hover:text-accent flex items-center gap-1.5"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                {contact.phone}
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            {contact.linkedIn ? (
                              <a 
                                href={contact.linkedIn}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
                              >
                                <Linkedin className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-sm text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <EditContactDialog
                              contact={contact}
                              onUpdateContact={handleUpdateContact}
                              onDeleteContact={handleDeleteContact}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
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
          </div>
        </div>

        {/* Engagements Section */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Quick Add Note */}
          <section className="content-card p-6 animate-fade-in lg:col-span-1" style={{ animationDelay: '150ms' }}>
            <h2 className="section-header">Quick Note</h2>
            <div className="space-y-3">
              <Textarea
                placeholder="Add a note about this company..."
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                className="min-h-[100px] resize-none border-0 bg-muted/50 focus:bg-card focus:ring-2 focus:ring-accent rounded-xl"
              />
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm">
                  <Upload className="w-4 h-4 mr-2" />
                  Attach File
                </Button>
                <Button size="sm" onClick={handleAddNote} disabled={!newNote.trim()}>
                  Save Note
                </Button>
              </div>
            </div>
          </section>

          {/* Engagement History */}
          <section className="content-card animate-fade-in lg:col-span-2" style={{ animationDelay: '200ms' }}>
            <div className="p-6 border-b border-border">
              <h2 className="section-header mb-0">Recent Engagements</h2>
            </div>
            
            {engagements.length > 0 ? (
              <div className="divide-y divide-border">
                {engagements.map((engagement) => (
                  <EngagementCard 
                    key={engagement.id} 
                    engagement={engagement}
                    onEdit={handleEditNote}
                    onDelete={handleDeleteNote}
                  />
                ))}
              </div>
            ) : (
              <div className="p-12 text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p className="text-sm">No engagements recorded yet</p>
                <p className="text-xs mt-1">Add a note above to start tracking interactions</p>
              </div>
            )}

            {/* Original Notes */}
            {prospect.engagementNotes && (
              <div className="p-6 bg-muted/30 border-t border-border">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Original Notes</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{prospect.engagementNotes}</p>
              </div>
            )}
          </section>
        </div>

        {/* Order History Section */}
        <OrderHistorySection companyName={companyName} companyId={prospect.id} />
      </main>
    </div>
  );
};

const OrderHistorySection = ({ companyName, companyId }: { companyName: string; companyId: string }) => {
  const { orders } = useOrders();
  const companyOrders = orders.filter(o => o.customer === companyName);

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
      <section className="content-card animate-fade-in" style={{ animationDelay: '250ms' }}>
        <div className="p-6 border-b border-border flex items-center justify-between">
          <h2 className="section-header mb-0 flex items-center gap-2">
            <Package className="w-5 h-5" />
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

  return (
    <section className="content-card animate-fade-in" style={{ animationDelay: '250ms' }}>
      <div className="p-6 border-b border-border flex items-center justify-between">
        <h2 className="section-header mb-0 flex items-center gap-2">
          <Package className="w-5 h-5" />
          Order History
        </h2>
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            <strong className="text-foreground">{totalOrders}</strong> orders
          </span>
          <span className="text-muted-foreground">
            <strong className="text-foreground">{totalUnits}</strong> total units
          </span>
          {addOrderButton}
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Order</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Date</th>
              <th className="text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Units</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Model</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Status</th>
              <th className="text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground px-6 py-3">Links</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {companyOrders.map((order) => {
              const statusColors = getStatusColor(order.status);
              return (
                <tr key={order.id} className="hover:bg-muted/30 transition-colors group">
                  <td className="px-6 py-4">
                    <Link 
                      to={`/order/${order.id}`}
                      className="font-medium text-accent hover:underline flex items-center gap-1.5"
                    >
                      #{order.id}
                      <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm font-mono text-muted-foreground">{order.placed}</span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <Badge variant="outline" className="font-mono">{order.units}</Badge>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-sm">{order.modelType}</span>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className={`${statusColors.bg} ${statusColors.text} border-0`}>
                      {order.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4">
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
    </section>
  );
};

const ContactCard = ({ contact }: { contact: Contact }) => {
  return (
    <div className="p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="grid grid-cols-1 gap-3">
        {/* Name & Role */}
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-sm">{contact.name}</p>
            {contact.role && (
              <p className="text-xs text-muted-foreground mt-0.5">{contact.role}</p>
            )}
          </div>
          {contact.linkedIn && (
            <a 
              href={contact.linkedIn} 
              target="_blank" 
              rel="noopener noreferrer"
              className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <Linkedin className="w-4 h-4" />
            </a>
          )}
        </div>
        
        {/* Contact Details Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {/* Email */}
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
            <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Email</p>
              {contact.email ? (
                <a 
                  href={`mailto:${contact.email}`}
                  className="text-xs text-foreground hover:text-accent transition-colors truncate block"
                >
                  {contact.email}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground/60">Not provided</p>
              )}
            </div>
          </div>
          
          {/* Phone */}
          <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg">
            <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Cell Phone</p>
              {contact.phone ? (
                <a 
                  href={`tel:${contact.phone}`}
                  className="text-xs text-foreground hover:text-accent transition-colors font-mono"
                >
                  {contact.phone}
                </a>
              ) : (
                <p className="text-xs text-muted-foreground/60">Not provided</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

interface EngagementCardProps {
  engagement: Engagement;
  onEdit: (id: string, details: string) => void;
  onDelete: (id: string) => void;
}

const EngagementCard = ({ engagement, onEdit, onDelete }: EngagementCardProps) => {
  const Icon = engagement.type === 'call' ? Phone :
               engagement.type === 'email' ? Mail :
               engagement.type === 'meeting' ? Calendar : FileText;
  
  return (
    <div className="p-6 hover:bg-muted/30 transition-colors group">
      <div className="flex items-start gap-4">
        <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center flex-shrink-0">
          <Icon className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground capitalize">
              {engagement.type}
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground font-mono">{engagement.date}</span>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <EditNoteDialog 
                  engagement={engagement}
                  onSave={onEdit}
                  onDelete={onDelete}
                />
              </div>
            </div>
          </div>
          <p className="text-sm font-medium">{engagement.summary}</p>
          {engagement.details && engagement.details !== engagement.summary && (
            <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{engagement.details}</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompanyPage;
