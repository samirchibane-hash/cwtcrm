import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Building2, MapPin, Phone, Mail, Linkedin, Plus, FileText, MessageSquare, Calendar, Upload } from 'lucide-react';
import { getProspectById, Contact, Engagement, CompanyType, MarketType } from '@/data/prospects';
import StageBadge from '@/components/crm/StageBadge';
import TypeBadge from '@/components/crm/TypeBadge';
import MarketTypeBadge from '@/components/crm/MarketTypeBadge';
import AddContactDialog from '@/components/crm/AddContactDialog';
import EditCompanyDetailsDialog from '@/components/crm/EditCompanyDetailsDialog';
import EditNoteDialog from '@/components/crm/EditNoteDialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useState, useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

const CompanyPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newNote, setNewNote] = useState('');
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [companyType, setCompanyType] = useState<CompanyType>('');
  const [marketType, setMarketType] = useState<MarketType>('');
  const [state, setState] = useState('');
  const [stage, setStage] = useState('');
  const [linkedIn, setLinkedIn] = useState('');
  
  const prospect = id ? getProspectById(id) : null;

  // Initialize state from prospect data
  useEffect(() => {
    if (prospect) {
      setCompanyName(prospect.companyName);
      setContacts(prospect.contacts);
      setEngagements(prospect.engagements);
      setCompanyType(prospect.type);
      setMarketType(prospect.marketType);
      setState(prospect.state);
      setStage(prospect.stage);
      setLinkedIn(prospect.linkedIn);
    }
  }, [prospect]);

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

  const handleAddContact = (newContact: Contact) => {
    setContacts(prev => [...prev, newContact]);
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
    
    setEngagements(prev => [newEngagement, ...prev]);
    toast({
      title: 'Note saved',
      description: 'Your note has been added to engagements.',
    });
    setNewNote('');
  };

  const handleEditNote = (engagementId: string, newDetails: string) => {
    setEngagements(prev => prev.map(eng => 
      eng.id === engagementId 
        ? { 
            ...eng, 
            details: newDetails,
            summary: newDetails.length > 60 ? newDetails.slice(0, 60) + '...' : newDetails,
          }
        : eng
    ));
  };

  const handleDeleteNote = (engagementId: string) => {
    setEngagements(prev => prev.filter(eng => eng.id !== engagementId));
  };

  const handleUpdateCompanyDetails = (details: {
    companyName: string;
    companyType: CompanyType;
    marketType: MarketType;
    state: string;
    stage: string;
    linkedIn: string;
  }) => {
    setCompanyName(details.companyName);
    setCompanyType(details.companyType);
    setMarketType(details.marketType);
    setState(details.state);
    setStage(details.stage);
    setLinkedIn(details.linkedIn);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <button 
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">Back</span>
          </button>
          
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
                  state,
                  stage,
                  linkedIn,
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
              <Button size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Log Activity
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Company Details & Contacts */}
          <div className="lg:col-span-1 space-y-6">
            {/* Company Details */}
            <section className="content-card p-6 animate-fade-in">
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">Company Details</h2>
                <EditCompanyDetailsDialog
                  currentDetails={{
                    companyName,
                    companyType,
                    marketType,
                    state,
                    stage,
                    linkedIn,
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
                  <label className="text-xs text-muted-foreground">Company Type</label>
                  <div className="flex items-center gap-2 mt-1">
                    {companyType ? (
                      <TypeBadge type={companyType} />
                    ) : (
                      <span className="text-sm text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Market Type</label>
                  <div className="mt-1">
                    {marketType ? (
                      <MarketTypeBadge marketType={marketType} />
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
              </div>
            </section>

            {/* Contacts */}
            <section className="content-card p-6 animate-fade-in" style={{ animationDelay: '100ms' }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="section-header mb-0">Contacts</h2>
                <AddContactDialog onAddContact={handleAddContact} />
              </div>
              
              {contacts.length > 0 ? (
                <div className="space-y-4">
                  {contacts.map((contact) => (
                    <ContactCard key={contact.id} contact={contact} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
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

          {/* Right Column - Engagements */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick Add Note */}
            <section className="content-card p-6 animate-fade-in" style={{ animationDelay: '150ms' }}>
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
            <section className="content-card animate-fade-in" style={{ animationDelay: '200ms' }}>
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
        </div>
      </main>
    </div>
  );
};

const ContactCard = ({ contact }: { contact: Contact }) => {
  return (
    <div className="p-4 bg-muted/30 rounded-xl hover:bg-muted/50 transition-colors">
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium text-sm">{contact.name}</p>
          {contact.role && (
            <p className="text-xs text-muted-foreground mt-0.5">{contact.role}</p>
          )}
        </div>
      </div>
      {(contact.email || contact.phone) && (
        <div className="mt-3 space-y-1.5">
          {contact.email && (
            <a 
              href={`mailto:${contact.email}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-3.5 h-3.5" />
              {contact.email}
            </a>
          )}
          {contact.phone && (
            <a 
              href={`tel:${contact.phone}`}
              className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {contact.phone}
            </a>
          )}
        </div>
      )}
      {contact.linkedIn && (
        <div className="mt-2">
          <a 
            href={contact.linkedIn} 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-xs text-accent hover:text-accent/80 transition-colors"
          >
            <Linkedin className="w-3.5 h-3.5" />
            LinkedIn Profile
          </a>
        </div>
      )}
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
