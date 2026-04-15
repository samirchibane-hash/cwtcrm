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
  AlertCircle, Ban, Users,
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

// ── Main component ────────────────────────────────────────────────────────────

export function OutreachAgentPage() {
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

  // ── Render: session list ─────────────────────────────────────────────────────

  if (!selected) {
    return (
      <div className="max-w-2xl space-y-6">
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
                <button onClick={() => setEmailIds(new Set(newContacts.filter(c => c.email && c.emailStatus !== 'no_email').map(c => c.apolloId)))} className="text-accent hover:underline">Email all</button>
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
                    <tr key={c.apolloId} className={`transition-colors ${c.alreadyInCrm ? 'opacity-40' : 'hover:bg-muted/20'}`}>
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
                            disabled={!c.email || c.emailStatus === 'no_email' || c.alreadyInCrm}
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
