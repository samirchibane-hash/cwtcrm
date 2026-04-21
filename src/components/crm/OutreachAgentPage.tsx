import { useState, useEffect, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  Bot, Loader2, CheckCircle2, Clock, Mail, FilePen,
  Send, Eye, EyeOff, ChevronLeft, RefreshCw, MailCheck,
  AlertCircle, Ban, Users, Building2, ExternalLink, Linkedin, MapPin, Star, Phone,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiscoveredContact {
  apolloId: string;
  name: string;
  title: string;
  email: string;
  emailStatus: 'valid' | 'catch-all' | 'unverified' | 'no_email';
  verified: boolean;
  catchAll: boolean;
  linkedIn: string;
  alreadyInCrm: boolean;
}

interface OutreachSession {
  id: string;
  prospect_id: string | null;
  prospect_name: string;
  discovered_contacts: DiscoveredContact[];
  hook: string | null;
  body_template: string | null;
  wqa_body_template: string | null;
  status: string;
  approved_import_ids: string[];
  approved_email_ids: string[];
  email_subject: string | null;
  email_body: string | null;
  email_mode: string;
  created_at: string;
}

interface DiscoveredCompany {
  apolloId: string;
  name: string;
  website: string;
  linkedin: string;
  industry: string;
  employees: number | string;
  city: string;
  state: string;
  shortDescription: string;
  score: number;
  matchLabel: string;
  // Google Maps fields (present for scraper-sourced suggestions)
  googleMapsUrl?: string;
  phone?: string;
  address?: string;
  reviews?: number;
  rating?: number | null;
}

interface ProspectSuggestion {
  id: string;
  status: string;
  run_label: string;
  discovered_companies: DiscoveredCompany[];
  approved_company_ids: string[];
  declined_company_ids: string[];
  decline_reasons: Record<string, string>;
  created_at: string;
  updated_at: string;
}

// ── Email status badge ────────────────────────────────────────────────────────

function EmailStatusBadge({ status, alreadyInCrm }: { status: string; alreadyInCrm: boolean }) {
  if (alreadyInCrm) return <Badge variant="secondary" className="text-xs font-normal">In CRM</Badge>;
  switch (status) {
    case 'valid':
      return <Badge className="text-xs font-normal bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Valid</Badge>;
    case 'catch-all':
      return <Badge className="text-xs font-normal bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Catch-all</Badge>;
    case 'no_email':
      return <Badge variant="secondary" className="text-xs font-normal">No email</Badge>;
    default:
      return <Badge variant="outline" className="text-xs font-normal">Unverified</Badge>;
  }
}

// ── Session list item ─────────────────────────────────────────────────────────

function SessionCard({ session, onClick }: { session: OutreachSession; onClick: () => void }) {
  const newCount = session.discovered_contacts.filter(c => !c.alreadyInCrm).length;
  const isApproved = session.status === 'approved';
  const isCompleted = session.status === 'completed';
  const date = new Date(session.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <button
      onClick={onClick}
      className="w-full text-left border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-4"
    >
      <div className="flex items-center gap-3 min-w-0">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          isCompleted ? 'bg-green-100' : isApproved ? 'bg-blue-100' : 'bg-amber-100'
        }`}>
          {isCompleted
            ? <CheckCircle2 className="w-5 h-5 text-green-600" />
            : isApproved
            ? <CheckCircle2 className="w-5 h-5 text-blue-600" />
            : <Clock className="w-5 h-5 text-amber-600" />}
        </div>
        <div className="min-w-0">
          <p className="font-medium truncate">{session.prospect_name}</p>
          <p className="text-xs text-muted-foreground">{newCount} new contact(s) · {date}</p>
        </div>
      </div>
      <Badge
        variant="outline"
        className={`shrink-0 text-xs capitalize ${
          isCompleted ? 'border-green-300 text-green-700' :
          isApproved  ? 'border-blue-300 text-blue-700' :
          'border-amber-300 text-amber-700'
        }`}
      >
        {session.status}
      </Badge>
    </button>
  );
}

// ── Prospect Suggestions component ───────────────────────────────────────────

function ProspectSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<ProspectSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ProspectSuggestion | null>(null);
  const [saving, setSaving] = useState(false);
  // 'approved' | 'declined' per apolloId; undefined = undecided (treated as approved)
  const [decisions, setDecisions] = useState<Record<string, 'approved' | 'declined'>>({});
  const [declineReasons, setDeclineReasons] = useState<Record<string, string>>({});

  const loadSuggestions = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('prospect_suggestions')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Failed to load suggestions');
    else setSuggestions((data || []) as ProspectSuggestion[]);
    setLoading(false);
  };

  useEffect(() => { loadSuggestions(); }, []);

  const openSuggestion = (s: ProspectSuggestion) => {
    setSelected(s);
    // Rebuild decisions from saved approved/declined lists
    const d: Record<string, 'approved' | 'declined'> = {};
    const hasSavedDecisions =
      (s.approved_company_ids?.length ?? 0) > 0 ||
      (s.declined_company_ids?.length ?? 0) > 0;
    if (hasSavedDecisions) {
      s.discovered_companies.forEach(c => {
        if (s.declined_company_ids?.includes(c.apolloId)) d[c.apolloId] = 'declined';
        else d[c.apolloId] = 'approved';
      });
    }
    // If no prior decisions, default all to approved
    setDecisions(d);
    setDeclineReasons(s.decline_reasons ?? {});
  };

  const setDecision = (apolloId: string, decision: 'approved' | 'declined') => {
    setDecisions(prev => ({ ...prev, [apolloId]: decision }));
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    const companies = selected.discovered_companies;
    const approvedIds = companies
      .filter(c => decisions[c.apolloId] !== 'declined')
      .map(c => c.apolloId);
    const declinedIds = companies
      .filter(c => decisions[c.apolloId] === 'declined')
      .map(c => c.apolloId);

    const { error } = await (supabase as any)
      .from('prospect_suggestions')
      .update({
        status: 'approved',
        approved_company_ids: approvedIds,
        declined_company_ids: declinedIds,
        decline_reasons: declineReasons,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) {
      toast.error('Failed to save review');
    } else {
      toast.success(`Saved — ${approvedIds.length} approved, ${declinedIds.length} declined`);
      await loadSuggestions();
      setSelected(null);
    }
    setSaving(false);
  };

  const isReadOnly = selected?.status === 'added_to_crm';

  // ── List view ───────────────────────────────────────────────────────────────
  if (!selected) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground">
              Run discovery in Claude Code, then review and approve companies here
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSuggestions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="border rounded-xl p-10 text-center space-y-3 bg-card">
            <Building2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-muted-foreground">No discovery runs yet</p>
            <p className="text-sm text-muted-foreground">Start a run in Claude Code:</p>
            <code className="block text-xs bg-muted rounded-lg px-4 py-3 text-left mt-2 leading-relaxed">
              node scripts/apollo-prospect-similar.mjs
            </code>
          </div>
        ) : (
          <div className="space-y-2">
            {suggestions.map(s => {
              const total = s.discovered_companies.length;
              const approved = s.approved_company_ids?.length ?? 0;
              const isApproved = s.status === 'approved';
              const isAdded = s.status === 'added_to_crm';
              const date = new Date(s.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
              return (
                <button
                  key={s.id}
                  onClick={() => openSuggestion(s)}
                  className="w-full text-left border rounded-xl p-4 bg-card hover:bg-muted/30 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isAdded ? 'bg-green-100' : isApproved ? 'bg-blue-100' : 'bg-amber-100'
                    }`}>
                      {isAdded
                        ? <CheckCircle2 className="w-5 h-5 text-green-600" />
                        : isApproved
                        ? <CheckCircle2 className="w-5 h-5 text-blue-600" />
                        : <Clock className="w-5 h-5 text-amber-600" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.run_label || 'Discovery run'}</p>
                      <p className="text-xs text-muted-foreground">
                        {isApproved || isAdded ? `${approved} approved` : `${total} companies`} · {date}
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={`shrink-0 text-xs capitalize ${
                      isAdded    ? 'border-green-300 text-green-700' :
                      isApproved ? 'border-blue-300 text-blue-700' :
                                   'border-amber-300 text-amber-700'
                    }`}
                  >
                    {s.status.replace('_', ' ')}
                  </Badge>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ── Detail view ─────────────────────────────────────────────────────────────
  const companies = selected.discovered_companies;
  const isMapsScrape = companies.length > 0 && !!(companies[0] as any).googleMapsUrl;

  return (
    <div className="space-y-5 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Suggestions
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{selected.run_label || 'Discovery run'}</span>
        <Badge variant="outline" className={`capitalize text-xs ml-1 ${
          selected.status === 'added_to_crm' ? 'border-green-300 text-green-700' :
          selected.status === 'approved'     ? 'border-blue-300 text-blue-700' :
                                               'border-amber-300 text-amber-700'
        }`}>
          {selected.status.replace('_', ' ')}
        </Badge>
      </div>

      {isReadOnly && (
        <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
          These companies have been added to the CRM.
        </div>
      )}

      {/* Summary row */}
      {!isReadOnly && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {companies.filter(c => decisions[c.apolloId] !== 'declined').length} approved ·{' '}
            {companies.filter(c => decisions[c.apolloId] === 'declined').length} declined ·{' '}
            {companies.length} total
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setDecisions(Object.fromEntries(companies.map(c => [c.apolloId, 'approved'])))}
              className="text-accent hover:underline"
            >
              Approve all
            </button>
            <span>·</span>
            <button
              onClick={() => setDecisions(Object.fromEntries(companies.map(c => [c.apolloId, 'declined'])))}
              className="text-accent hover:underline"
            >
              Decline all
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border rounded-lg overflow-hidden bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40">
              {!isReadOnly && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-36">Decision</th>}
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Company</th>
              <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Website</th>
              {isMapsScrape ? (
                <>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Maps</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Phone</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden xl:table-cell">Reviews</th>
                </>
              ) : (
                <>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">LinkedIn</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Employees</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden xl:table-cell">Industry</th>
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y">
            {companies.map(c => {
              const decision = decisions[c.apolloId];
              const isDeclined = decision === 'declined';
              const isApprovedDecision = decision === 'approved';
              const domain = c.website ? c.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null;
              const dimRow = isReadOnly && selected.declined_company_ids?.includes(c.apolloId);

              return (
                <tr key={c.apolloId} className={`transition-colors ${dimRow ? 'opacity-40' : 'hover:bg-muted/20'}`}>
                  {!isReadOnly && (
                    <td className="px-3 py-2.5 align-top">
                      <div className="flex gap-1">
                        <button
                          onClick={() => setDecision(c.apolloId, 'approved')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            isApprovedDecision
                              ? 'bg-green-100 text-green-700 ring-1 ring-green-300'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" /> Add
                        </button>
                        <button
                          onClick={() => setDecision(c.apolloId, 'declined')}
                          className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                            isDeclined
                              ? 'bg-red-100 text-red-700 ring-1 ring-red-300'
                              : 'text-muted-foreground hover:bg-muted'
                          }`}
                        >
                          <Ban className="w-3 h-3" /> Skip
                        </button>
                      </div>
                      {isDeclined && (
                        <input
                          type="text"
                          placeholder="Reason (optional)"
                          value={declineReasons[c.apolloId] ?? ''}
                          onChange={e => setDeclineReasons(prev => ({ ...prev, [c.apolloId]: e.target.value }))}
                          className="mt-1.5 w-full text-xs px-2 py-1 rounded border border-red-200 bg-red-50 placeholder:text-red-300 text-red-800 outline-none focus:ring-1 focus:ring-red-300"
                        />
                      )}
                    </td>
                  )}
                  <td className={`px-3 py-2.5 align-top ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                    <p className="font-medium leading-snug">{c.name}</p>
                    {c.shortDescription && (
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{c.shortDescription}</p>
                    )}
                    {isMapsScrape && (c.city || c.state) && (
                      <p className="text-xs text-muted-foreground mt-0.5">{[c.city, c.state].filter(Boolean).join(', ')}</p>
                    )}
                  </td>
                  <td className={`px-3 py-2.5 hidden md:table-cell align-top ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                    {domain ? (
                      <a href={c.website} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-accent hover:underline text-xs">
                        {domain} <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    ) : <span className="text-muted-foreground text-xs">—</span>}
                  </td>
                  {isMapsScrape ? (
                    <>
                      <td className={`px-3 py-2.5 hidden lg:table-cell align-top ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {c.googleMapsUrl ? (
                          <a href={c.googleMapsUrl} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-accent hover:underline text-xs">
                            <MapPin className="w-3 h-3 shrink-0" /> Maps
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className={`px-3 py-2.5 hidden lg:table-cell align-top text-xs text-muted-foreground ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {c.phone ? (
                          <span className="flex items-center gap-1"><Phone className="w-3 h-3 shrink-0" />{c.phone}</span>
                        ) : '—'}
                      </td>
                      <td className={`px-3 py-2.5 hidden xl:table-cell align-top ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {(c.reviews ?? 0) > 0 ? (
                          <span className="flex items-center gap-1 text-xs">
                            <Star className="w-3 h-3 text-yellow-500 shrink-0" />
                            {c.reviews?.toLocaleString()}
                            {c.rating ? <span className="text-muted-foreground ml-0.5">({c.rating})</span> : null}
                          </span>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                    </>
                  ) : (
                    <>
                      <td className={`px-3 py-2.5 hidden lg:table-cell align-top ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {c.linkedin ? (
                          <a href={c.linkedin} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-accent hover:underline text-xs">
                            <Linkedin className="w-3 h-3 shrink-0" /> Profile
                          </a>
                        ) : <span className="text-muted-foreground text-xs">—</span>}
                      </td>
                      <td className={`px-3 py-2.5 hidden lg:table-cell align-top text-xs text-muted-foreground ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {c.employees || '—'}
                      </td>
                      <td className={`px-3 py-2.5 hidden xl:table-cell align-top text-xs text-muted-foreground max-w-[160px] truncate ${isDeclined && !isReadOnly ? 'opacity-50' : ''}`}>
                        {c.industry || '—'}
                      </td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!isReadOnly && (
        <div className="flex items-center gap-3">
          <Button
            onClick={handleSave}
            disabled={saving}
            className="w-44"
          >
            {saving
              ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
              : <><CheckCircle2 className="w-4 h-4 mr-2" />Save review</>
            }
          </Button>
          {selected.status === 'approved' && (
            <p className="text-xs text-muted-foreground">
              Tell Claude to add the approved companies to the CRM.
            </p>
          )}
        </div>
      )}

      {selected.status === 'approved' && (
        <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-xs text-blue-700 space-y-1">
          <p className="font-medium">Review saved — ready to import</p>
          {isMapsScrape
            ? <p>Tell Claude: <span className="italic">"Import approved companies from suggestion {selected.id} to GHL"</span></p>
            : <p>Tell Claude: <span className="italic">"Add the approved companies from suggestion {selected.id} to the CRM"</span></p>
          }
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function OutreachAgentPage() {
  const [activeTab, setActiveTab] = useState<'outreach' | 'suggestions'>('outreach');
  const [sessions, setSessions] = useState<OutreachSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OutreachSession | null>(null);
  const [saving, setSaving] = useState(false);

  // Per-session editing state
  const [importIds, setImportIds] = useState<Set<string>>(new Set());
  const [emailIds, setEmailIds] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState<'standard' | 'wqa'>('standard');
  const [mode, setMode] = useState<'draft' | 'send'>('draft');
  const [showPreview, setShowPreview] = useState(false);

  // ── Load sessions ───────────────────────────────────────────────────────────

  const loadSessions = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from('outreach_sessions')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Failed to load sessions');
    } else {
      setSessions((data || []) as OutreachSession[]);
    }
    setLoading(false);
  };

  useEffect(() => { loadSessions(); }, []);

  // ── Open session ────────────────────────────────────────────────────────────

  const openSession = (s: OutreachSession) => {
    setSelected(s);
    setImportIds(new Set(s.approved_import_ids?.length ? s.approved_import_ids : s.discovered_contacts.filter(c => !c.alreadyInCrm).map(c => c.apolloId)));
    setEmailIds(new Set(s.approved_email_ids?.length ? s.approved_email_ids : s.discovered_contacts.filter(c => !c.alreadyInCrm && c.email && c.emailStatus !== 'no_email').map(c => c.apolloId)));
    setSubject(s.email_subject || `LED UVs for ${s.prospect_name}`);
    setBody(s.email_body || s.body_template || '');
    setTemplate('standard');
    setMode((s.email_mode as 'draft' | 'send') || 'draft');
    setShowPreview(false);
  };

  // ── Toggle helpers ──────────────────────────────────────────────────────────

  const toggleImport = (id: string) => {
    setImportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setEmailIds(e => { const en = new Set(e); en.delete(id); return en; });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleEmail = (id: string, contact: DiscoveredContact) => {
    if (!contact.email || contact.emailStatus === 'no_email') return;
    setEmailIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // ── Save approval ───────────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!selected) return;
    setSaving(true);
    const { error } = await (supabase as any)
      .from('outreach_sessions')
      .update({
        status: 'approved',
        approved_import_ids: [...importIds],
        approved_email_ids: [...emailIds],
        email_subject: subject,
        email_body: body,
        email_mode: mode,
        updated_at: new Date().toISOString(),
      })
      .eq('id', selected.id);

    if (error) {
      toast.error('Failed to save approval');
    } else {
      toast.success('Approved — tell Claude Code to proceed');
      await loadSessions();
      setSelected(null);
    }
    setSaving(false);
  };

  // ── Preview ─────────────────────────────────────────────────────────────────

  const previewHtml = useMemo(() => {
    if (!selected) return '';
    const firstTarget = selected.discovered_contacts.find(c => emailIds.has(c.apolloId) && c.email);
    const firstName = firstTarget ? firstTarget.name.split(' ')[0] : 'Alex';
    const currentBody = template === 'wqa' ? (selected.wqa_body_template || body) : body;
    return currentBody
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{companyName\}/g, selected.prospect_name)
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
  }, [body, template, emailIds, selected]);

  // ── Stats ───────────────────────────────────────────────────────────────────

  const stats = useMemo(() => {
    if (!selected) return null;
    const c = selected.discovered_contacts;
    return {
      valid: c.filter(x => x.emailStatus === 'valid' && !x.alreadyInCrm).length,
      catchAll: c.filter(x => x.emailStatus === 'catch-all' && !x.alreadyInCrm).length,
      unverified: c.filter(x => x.emailStatus === 'unverified' && !x.alreadyInCrm).length,
      noEmail: c.filter(x => x.emailStatus === 'no_email' && !x.alreadyInCrm).length,
      inCrm: c.filter(x => x.alreadyInCrm).length,
    };
  }, [selected]);

  // ── Render ───────────────────────────────────────────────────────────────────

  const tabBar = (
    <div className="flex gap-1 border-b mb-6 w-fit">
      <button
        onClick={() => setActiveTab('outreach')}
        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
          activeTab === 'outreach'
            ? 'border-accent text-accent'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        Outreach Sessions
      </button>
      <button
        onClick={() => setActiveTab('suggestions')}
        className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
          activeTab === 'suggestions'
            ? 'border-accent text-accent'
            : 'border-transparent text-muted-foreground hover:text-foreground'
        }`}
      >
        Company Suggestions
      </button>
    </div>
  );

  if (activeTab === 'suggestions') {
    return (
      <div>
        {tabBar}
        <ProspectSuggestionsPage />
      </div>
    );
  }

  if (!selected) {
    return (
      <div className="max-w-2xl space-y-6">
        {tabBar}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
              <Bot className="w-5 h-5 text-accent" />
            </div>
            <p className="text-sm text-muted-foreground">
              Run discovery in Claude Code, then review and approve sessions here
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={loadSessions} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="border rounded-xl p-10 text-center space-y-3 bg-card">
            <Bot className="w-10 h-10 text-muted-foreground/40 mx-auto" />
            <p className="font-medium text-muted-foreground">No sessions yet</p>
            <p className="text-sm text-muted-foreground">
              Start a discovery run in Claude Code:
            </p>
            <code className="block text-xs bg-muted rounded-lg px-4 py-3 text-left mt-2 leading-relaxed">
              node scripts/outreach-agent.mjs "Company Name" \<br />
              {'  '}--prospect-id &lt;uuid&gt; --market-type "&lt;market&gt;" --type "OEM"<br />
              {'  '}--contacts &lt;b64&gt; --engagements &lt;b64&gt;
            </code>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map(s => (
              <SessionCard key={s.id} session={s} onClick={() => openSession(s)} />
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Render: session detail (approval UI) ─────────────────────────────────────

  const contacts = selected.discovered_contacts;
  const newContacts = contacts.filter(c => !c.alreadyInCrm);
  const isReadOnly = selected.status === 'completed';

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSelected(null)} className="-ml-2">
          <ChevronLeft className="w-4 h-4 mr-1" />
          Sessions
        </Button>
        <span className="text-muted-foreground">/</span>
        <span className="font-medium">{selected.prospect_name}</span>
        <Badge variant="outline" className={`capitalize text-xs ml-1 ${
          selected.status === 'completed' ? 'border-green-300 text-green-700' :
          selected.status === 'approved'  ? 'border-blue-300 text-blue-700' :
          'border-amber-300 text-amber-700'
        }`}>
          {selected.status}
        </Badge>
      </div>

      {isReadOnly && (
        <div className="border border-green-200 bg-green-50 rounded-lg px-4 py-3 text-sm text-green-700">
          This session has been completed. Contact import and emails were handled by Claude Code.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left: Contact table */}
        <div className="lg:col-span-2 space-y-3">
          {/* Stats */}
          {stats && (
            <div className="grid grid-cols-5 gap-2">
              {[
                { icon: MailCheck, label: 'Valid', value: stats.valid, color: 'text-green-600' },
                { icon: AlertCircle, label: 'Catch-all', value: stats.catchAll, color: 'text-yellow-600' },
                { icon: Mail, label: 'Unverified', value: stats.unverified, color: 'text-muted-foreground' },
                { icon: Ban, label: 'No Email', value: stats.noEmail, color: 'text-muted-foreground' },
                { icon: Users, label: 'In CRM', value: stats.inCrm, color: 'text-muted-foreground' },
              ].map(s => (
                <div key={s.label} className="border rounded-lg p-2 bg-card text-center">
                  <p className="text-base font-semibold">{s.value}</p>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Bulk controls */}
          {!isReadOnly && (
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{importIds.size} to import · {emailIds.size} to email</span>
              <div className="flex gap-2">
                <button onClick={() => setImportIds(new Set(newContacts.map(c => c.apolloId)))} className="text-accent hover:underline">Import all</button>
                <span>·</span>
                <button onClick={() => { setImportIds(new Set()); setEmailIds(new Set()); }} className="text-accent hover:underline">Import none</button>
                <span>·</span>
                <button onClick={() => setEmailIds(new Set(contacts.filter(c => c.email && c.emailStatus !== 'no_email').map(c => c.apolloId)))} className="text-accent hover:underline">Email all</button>
                <span>·</span>
                <button onClick={() => setEmailIds(new Set())} className="text-accent hover:underline">Email none</button>
              </div>
            </div>
          )}

          {/* Table */}
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  {!isReadOnly && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-16">Import</th>}
                  {!isReadOnly && <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs w-16">Email</th>}
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Name</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden md:table-cell">Role</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs hidden lg:table-cell">Email</th>
                  <th className="text-left px-3 py-2.5 font-medium text-muted-foreground text-xs">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {contacts.map(c => {
                  const isImported = importIds.has(c.apolloId);
                  const isEmailed = emailIds.has(c.apolloId);
                  return (
                    <tr key={c.apolloId} className={`transition-colors ${c.alreadyInCrm && !isEmailed ? 'opacity-40' : 'hover:bg-muted/20'}`}>
                      {!isReadOnly && (
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isImported}
                            onCheckedChange={() => !c.alreadyInCrm && toggleImport(c.apolloId)}
                            disabled={c.alreadyInCrm}
                          />
                        </td>
                      )}
                      {!isReadOnly && (
                        <td className="px-3 py-2">
                          <Checkbox
                            checked={isEmailed}
                            onCheckedChange={() => toggleEmail(c.apolloId, c)}
                            disabled={!c.email || c.emailStatus === 'no_email'}
                          />
                        </td>
                      )}
                      <td className="px-3 py-2 font-medium text-sm">{c.name}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden md:table-cell max-w-[180px] truncate">{c.title || '—'}</td>
                      <td className="px-3 py-2 text-muted-foreground text-xs hidden lg:table-cell">{c.email || '—'}</td>
                      <td className="px-3 py-2">
                        <EmailStatusBadge status={c.emailStatus} alreadyInCrm={c.alreadyInCrm} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right: Email config */}
        <div className="space-y-4">
          <Label className="text-base font-medium">Email Configuration</Label>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Subject</Label>
            <Input
              value={subject}
              onChange={e => setSubject(e.target.value)}
              disabled={isReadOnly}
              placeholder="Email subject..."
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Template</Label>
              <Select
                value={template}
                onValueChange={(v: 'standard' | 'wqa') => {
                  setTemplate(v);
                  if (v === 'wqa' && selected.wqa_body_template) setBody(selected.wqa_body_template);
                  else if (selected.body_template) setBody(selected.body_template);
                }}
                disabled={isReadOnly}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="standard">Standard</SelectItem>
                  <SelectItem value="wqa">WQA Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Mode</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v: 'draft' | 'send') => setMode(v)}
                className="flex gap-3 pt-1.5"
                disabled={isReadOnly}
              >
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="draft" id="mode-draft" />
                  <Label htmlFor="mode-draft" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <FilePen className="w-3 h-3" /> Draft
                  </Label>
                </div>
                <div className="flex items-center gap-1.5">
                  <RadioGroupItem value="send" id="mode-send" />
                  <Label htmlFor="mode-send" className="text-sm font-normal cursor-pointer flex items-center gap-1">
                    <Send className="w-3 h-3" /> Send
                  </Label>
                </div>
              </RadioGroup>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">Body</Label>
              {!isReadOnly && (
                <button
                  onClick={() => setShowPreview(p => !p)}
                  className="flex items-center gap-1 text-xs text-accent hover:underline"
                >
                  {showPreview ? <><EyeOff className="w-3 h-3" /> Edit</> : <><Eye className="w-3 h-3" /> Preview</>}
                </button>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Use <code className="bg-muted px-1 rounded">{'{firstName}'}</code> and{' '}
              <code className="bg-muted px-1 rounded">{'{companyName}'}</code> — signature auto-appended.
            </p>
            {showPreview ? (
              <div
                className="border rounded-lg p-3 bg-card text-xs leading-relaxed min-h-[180px]"
                dangerouslySetInnerHTML={{ __html: previewHtml }}
              />
            ) : (
              <Textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                rows={10}
                className="font-mono text-xs resize-none"
                disabled={isReadOnly}
                placeholder="Email body..."
              />
            )}
          </div>

          {!isReadOnly && (
            <Button
              className="w-full"
              onClick={handleApprove}
              disabled={saving || (importIds.size === 0 && emailIds.size === 0)}
            >
              {saving
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving...</>
                : <><CheckCircle2 className="w-4 h-4 mr-2" />Save & Approve</>
              }
            </Button>
          )}

          {!isReadOnly && selected.status === 'approved' && (
            <div className="border border-blue-200 bg-blue-50 rounded-lg px-3 py-2.5 text-xs text-blue-700 space-y-1">
              <p className="font-medium">Approved — ready to execute</p>
              <p>Tell Claude Code to proceed, or run:</p>
              <code className="block bg-blue-100 rounded px-2 py-1 mt-1 break-all">
                node scripts/outreach-agent.mjs --session {selected.id}
              </code>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
