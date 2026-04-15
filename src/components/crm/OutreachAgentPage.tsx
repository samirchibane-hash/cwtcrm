import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useProspects } from '@/context/ProspectsContext';
import { toast } from 'sonner';
import {
  Loader2, Bot, Search, CheckCircle2, Mail, FileEdit,
  ChevronRight, Users, MailCheck, AlertCircle, Ban,
  Eye, EyeOff, Send, FilePen,
} from 'lucide-react';
import type { Prospect, Contact } from '@/data/prospects';

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

type Step = 'select' | 'discovering' | 'review' | 'compose' | 'executing' | 'done';

// ── Step progress bar ─────────────────────────────────────────────────────────

const STEPS = [
  { id: 'select', label: 'Select' },
  { id: 'review', label: 'Review' },
  { id: 'compose', label: 'Compose' },
  { id: 'done', label: 'Done' },
];

function StepBar({ current }: { current: Step }) {
  const idx = current === 'discovering' ? 0 : current === 'executing' ? 2 :
    STEPS.findIndex(s => s.id === current);
  return (
    <div className="flex items-center gap-0 mb-8">
      {STEPS.map((s, i) => (
        <div key={s.id} className="flex items-center">
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            i < idx ? 'text-muted-foreground' :
            i === idx ? 'bg-accent text-accent-foreground' :
            'text-muted-foreground'
          }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs border ${
              i < idx ? 'bg-muted border-muted text-muted-foreground' :
              i === idx ? 'bg-accent border-accent text-accent-foreground font-bold' :
              'border-border'
            }`}>{i < idx ? '✓' : i + 1}</span>
            {s.label}
          </div>
          {i < STEPS.length - 1 && (
            <ChevronRight className="w-4 h-4 text-muted-foreground mx-1" />
          )}
        </div>
      ))}
    </div>
  );
}

// ── Email status badge ────────────────────────────────────────────────────────

function EmailStatusBadge({ status, alreadyInCrm }: { status: string; alreadyInCrm: boolean }) {
  if (alreadyInCrm) return <Badge variant="secondary" className="text-xs">In CRM</Badge>;
  switch (status) {
    case 'valid':
      return <Badge className="text-xs bg-green-100 text-green-700 border-green-200 hover:bg-green-100">Valid</Badge>;
    case 'catch-all':
      return <Badge className="text-xs bg-yellow-100 text-yellow-700 border-yellow-200 hover:bg-yellow-100">Catch-all</Badge>;
    case 'no_email':
      return <Badge variant="secondary" className="text-xs">No email</Badge>;
    default:
      return <Badge variant="outline" className="text-xs">Unverified</Badge>;
  }
}

// ── Main component ────────────────────────────────────────────────────────────

export function OutreachAgentPage() {
  const { prospects, updateProspect } = useProspects();

  // Step
  const [step, setStep] = useState<Step>('select');

  // Step 1
  const [selectedProspectId, setSelectedProspectId] = useState<string>('');
  const [prospectSearch, setProspectSearch] = useState('');

  // Step 2/3
  const [discovered, setDiscovered] = useState<DiscoveredContact[]>([]);
  const [importIds, setImportIds] = useState<Set<string>>(new Set());
  const [emailIds, setEmailIds] = useState<Set<string>>(new Set());

  // Step 4
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [wqaBody, setWqaBody] = useState('');
  const [template, setTemplate] = useState<'standard' | 'wqa'>('standard');
  const [mode, setMode] = useState<'draft' | 'send'>('draft');
  const [showPreview, setShowPreview] = useState(false);

  // Step 5
  const [doneResult, setDoneResult] = useState({ imported: 0, emailed: 0, mode: 'draft' });

  const selectedProspect = useMemo(
    () => prospects.find(p => p.id === selectedProspectId) ?? null,
    [prospects, selectedProspectId]
  );

  const filteredProspects = useMemo(() => {
    if (!prospectSearch) return prospects.slice().sort((a, b) => a.companyName.localeCompare(b.companyName));
    const q = prospectSearch.toLowerCase();
    return prospects
      .filter(p => p.companyName.toLowerCase().includes(q))
      .sort((a, b) => a.companyName.localeCompare(b.companyName));
  }, [prospects, prospectSearch]);

  // ── Discovery ───────────────────────────────────────────────────────────────

  const handleDiscover = async () => {
    if (!selectedProspect) return;
    setStep('discovering');

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/discover-contacts`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            orgName: selectedProspect.companyName,
            existingIds: selectedProspect.contacts.map(c => c.id),
            existingLinkedIns: selectedProspect.contacts.map(c => c.linkedIn).filter(Boolean),
            marketType: selectedProspect.marketType,
            companyType: selectedProspect.type,
          }),
        }
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Discovery failed');
      }

      const data = await res.json();
      const contacts: DiscoveredContact[] = data.contacts;

      setDiscovered(contacts);

      // Pre-select: import all new contacts, email those with emails
      const newIds = new Set(contacts.filter(c => !c.alreadyInCrm).map(c => c.apolloId));
      const emailableIds = new Set(
        contacts.filter(c => !c.alreadyInCrm && c.email && c.emailStatus !== 'no_email').map(c => c.apolloId)
      );
      setImportIds(newIds);
      setEmailIds(emailableIds);

      // Set default email content
      setEmailBody(data.bodyTemplate);
      setWqaBody(data.wqaBodyTemplate);
      setEmailSubject(`LED UVs for ${selectedProspect.companyName}`);
      setTemplate('standard');

      setStep('review');
    } catch (err: any) {
      toast.error(err.message || 'Discovery failed');
      setStep('select');
    }
  };

  // ── Execute (import + email) ─────────────────────────────────────────────────

  const handleExecute = async () => {
    if (!selectedProspect) return;
    setStep('executing');

    let imported = 0;
    let emailed = 0;

    try {
      // 1. Import selected contacts to CRM
      const toImport = discovered.filter(c => importIds.has(c.apolloId) && !c.alreadyInCrm);
      if (toImport.length > 0) {
        const newContacts: Contact[] = toImport.map(c => ({
          id: `contact-apollo-${c.apolloId}`,
          name: c.name,
          role: c.title,
          email: c.email,
          phone: '',
          linkedIn: c.linkedIn,
          emailVerified: c.verified,
        }));
        const merged: Contact[] = [...(selectedProspect.contacts || []), ...newContacts];
        await updateProspect({ ...selectedProspect, contacts: merged });
        imported = newContacts.length;
      }

      // 2. Send/draft emails for selected email targets
      const toEmail = discovered.filter(c => emailIds.has(c.apolloId) && c.email);
      if (toEmail.length > 0) {
        const currentBody = template === 'wqa' ? wqaBody : emailBody;
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-outreach`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({
              contacts: toEmail.map(c => ({ name: c.name, email: c.email })),
              subject: emailSubject,
              bodyTemplate: currentBody,
              mode,
              companyName: selectedProspect.companyName,
            }),
          }
        );

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Email operation failed');
        }

        const result = await res.json();
        emailed = result.count;
        if (result.errors?.length > 0) {
          toast.warning(`${result.errors.length} email(s) failed`);
        }
      }

      setDoneResult({ imported, emailed, mode });
      setStep('done');
      toast.success(`Done — ${imported} imported, ${emailed} ${mode === 'draft' ? 'drafted' : 'sent'}`);
    } catch (err: any) {
      toast.error(err.message || 'Operation failed');
      setStep('compose');
    }
  };

  // ── Toggle helpers ───────────────────────────────────────────────────────────

  const toggleImport = (id: string) => {
    setImportIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // also remove from email
        setEmailIds(e => { const en = new Set(e); en.delete(id); return en; });
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleEmail = (id: string, contact: DiscoveredContact) => {
    if (!contact.email) return;
    setEmailIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const selectAllImport = () => {
    setImportIds(new Set(discovered.filter(c => !c.alreadyInCrm).map(c => c.apolloId)));
  };

  const selectNoneImport = () => {
    setImportIds(new Set());
    setEmailIds(new Set());
  };

  const selectAllEmail = () => {
    setEmailIds(new Set(
      discovered.filter(c => importIds.has(c.apolloId) && c.email && c.emailStatus !== 'no_email').map(c => c.apolloId)
    ));
  };

  const selectNoneEmail = () => setEmailIds(new Set());

  // ── Preview HTML ─────────────────────────────────────────────────────────────

  const previewHtml = useMemo(() => {
    const firstEmailTarget = discovered.find(c => emailIds.has(c.apolloId) && c.email);
    const firstName = firstEmailTarget ? firstEmailTarget.name.split(' ')[0] : 'Alex';
    const body = (template === 'wqa' ? wqaBody : emailBody)
      .replace(/\{firstName\}/g, firstName)
      .replace(/\{companyName\}/g, selectedProspect?.companyName ?? 'Company');
    return body.replace(/\n\n/g, '<br><br>').replace(/\n/g, '<br>');
  }, [template, emailBody, wqaBody, emailIds, discovered, selectedProspect]);

  // ── Stats (review step) ──────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    valid: discovered.filter(c => c.emailStatus === 'valid').length,
    catchAll: discovered.filter(c => c.emailStatus === 'catch-all').length,
    unverified: discovered.filter(c => c.emailStatus === 'unverified').length,
    noEmail: discovered.filter(c => c.emailStatus === 'no_email').length,
    alreadyInCrm: discovered.filter(c => c.alreadyInCrm).length,
    selected: importIds.size,
    toEmail: emailIds.size,
  }), [discovered, importIds, emailIds]);

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
          <Bot className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Apollo → Clearout → Gmail</p>
        </div>
      </div>

      {step !== 'done' && <StepBar current={step} />}

      {/* ── Step 1: Select Prospect ─────────────────────────────────────────── */}
      {step === 'select' && (
        <div className="max-w-xl space-y-6">
          <div className="space-y-3">
            <Label className="text-base font-medium">Select a prospect to run outreach for</Label>
            <Input
              placeholder="Search companies..."
              value={prospectSearch}
              onChange={e => setProspectSearch(e.target.value)}
              className="mb-2"
            />
            <div className="border rounded-lg divide-y max-h-72 overflow-y-auto bg-card">
              {filteredProspects.length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">No results</p>
              )}
              {filteredProspects.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedProspectId(p.id)}
                  className={`w-full text-left px-4 py-3 flex items-center justify-between hover:bg-muted/50 transition-colors ${
                    selectedProspectId === p.id ? 'bg-accent/10' : ''
                  }`}
                >
                  <div>
                    <p className={`text-sm font-medium ${selectedProspectId === p.id ? 'text-accent' : ''}`}>
                      {p.companyName}
                    </p>
                    <p className="text-xs text-muted-foreground">{p.type} · {p.marketType || '—'}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.contacts.length > 0 && (
                      <span className="text-xs text-muted-foreground">{p.contacts.length} contacts</span>
                    )}
                    {selectedProspectId === p.id && (
                      <CheckCircle2 className="w-4 h-4 text-accent" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedProspect && (
            <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
              <p className="font-medium">{selectedProspect.companyName}</p>
              <p className="text-sm text-muted-foreground">
                {selectedProspect.type} · {selectedProspect.marketType || 'No market type'} · {selectedProspect.contacts.length} existing contact(s)
              </p>
              {selectedProspect.contacts.length > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  Existing: {selectedProspect.contacts.slice(0, 3).map(c => c.name).join(', ')}
                  {selectedProspect.contacts.length > 3 && ` +${selectedProspect.contacts.length - 3} more`}
                </p>
              )}
            </div>
          )}

          <Button
            onClick={handleDiscover}
            disabled={!selectedProspect}
            className="w-full"
            size="lg"
          >
            <Search className="w-4 h-4 mr-2" />
            Discover Contacts
          </Button>
        </div>
      )}

      {/* ── Step 2: Discovering (loading) ───────────────────────────────────── */}
      {step === 'discovering' && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <div>
            <p className="text-lg font-medium">Searching {selectedProspect?.companyName}…</p>
            <p className="text-sm text-muted-foreground mt-1">
              Scanning Apollo · Enriching contacts · Verifying emails
            </p>
            <p className="text-xs text-muted-foreground mt-3">This usually takes 30–90 seconds</p>
          </div>
        </div>
      )}

      {/* ── Step 3: Review Contacts ─────────────────────────────────────────── */}
      {step === 'review' && (
        <div className="space-y-5">
          {/* Stats row */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { icon: MailCheck, label: 'Valid', value: stats.valid, color: 'text-green-600' },
              { icon: AlertCircle, label: 'Catch-all', value: stats.catchAll, color: 'text-yellow-600' },
              { icon: Mail, label: 'Unverified', value: stats.unverified, color: 'text-muted-foreground' },
              { icon: Ban, label: 'No Email', value: stats.noEmail, color: 'text-muted-foreground' },
              { icon: Users, label: 'In CRM', value: stats.alreadyInCrm, color: 'text-muted-foreground' },
            ].map(s => (
              <div key={s.label} className="border rounded-lg p-3 bg-card flex items-center gap-3">
                <s.icon className={`w-4 h-4 ${s.color}`} />
                <div>
                  <p className="text-lg font-semibold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Table header + bulk actions */}
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-muted-foreground">
              {discovered.length} contact(s) found · {stats.selected} selected to import · {stats.toEmail} to email
            </p>
            <div className="flex items-center gap-2 text-xs">
              <button onClick={selectAllImport} className="text-accent hover:underline">Import all</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={selectNoneImport} className="text-accent hover:underline">Import none</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={selectAllEmail} className="text-accent hover:underline">Email all</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={selectNoneEmail} className="text-accent hover:underline">Email none</button>
            </div>
          </div>

          {/* Contact table */}
          <div className="border rounded-lg overflow-hidden bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-10">Import</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-10">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden md:table-cell">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground hidden lg:table-cell">Email</th>
                  <th className="text-left px-4 py-2.5 font-medium text-muted-foreground w-24">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {discovered.map(c => (
                  <tr
                    key={c.apolloId}
                    className={`hover:bg-muted/30 transition-colors ${c.alreadyInCrm ? 'opacity-50' : ''}`}
                  >
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={importIds.has(c.apolloId)}
                        onCheckedChange={() => !c.alreadyInCrm && toggleImport(c.apolloId)}
                        disabled={c.alreadyInCrm}
                      />
                    </td>
                    <td className="px-4 py-2.5">
                      <Checkbox
                        checked={emailIds.has(c.apolloId)}
                        onCheckedChange={() => toggleEmail(c.apolloId, c)}
                        disabled={!c.email || c.alreadyInCrm}
                      />
                    </td>
                    <td className="px-4 py-2.5 font-medium">{c.name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden md:table-cell max-w-[200px] truncate">{c.title || '—'}</td>
                    <td className="px-4 py-2.5 text-muted-foreground hidden lg:table-cell text-xs">{c.email || '—'}</td>
                    <td className="px-4 py-2.5">
                      <EmailStatusBadge status={c.emailStatus} alreadyInCrm={c.alreadyInCrm} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 justify-end">
            <Button variant="outline" onClick={() => setStep('select')}>Back</Button>
            <Button
              onClick={() => setStep('compose')}
              disabled={importIds.size === 0 && emailIds.size === 0}
            >
              Continue to Email
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Compose Email ───────────────────────────────────────────── */}
      {step === 'compose' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left: Recipients */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Recipients</Label>
              <div className="flex gap-2 text-xs">
                <button onClick={selectAllEmail} className="text-accent hover:underline">All</button>
                <span className="text-muted-foreground">·</span>
                <button onClick={selectNoneEmail} className="text-accent hover:underline">None</button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{emailIds.size} selected</p>
            <div className="border rounded-lg divide-y max-h-[480px] overflow-y-auto bg-card">
              {discovered
                .filter(c => importIds.has(c.apolloId) && c.email)
                .map(c => (
                  <label
                    key={c.apolloId}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-muted/30 cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={emailIds.has(c.apolloId)}
                      onCheckedChange={() => toggleEmail(c.apolloId, c)}
                      className="mt-0.5"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{c.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{c.email}</p>
                      <div className="mt-1">
                        <EmailStatusBadge status={c.emailStatus} alreadyInCrm={false} />
                      </div>
                    </div>
                  </label>
                ))}
              {discovered.filter(c => importIds.has(c.apolloId) && c.email).length === 0 && (
                <p className="px-4 py-3 text-sm text-muted-foreground">
                  No contacts with emails selected for import.
                </p>
              )}
            </div>
          </div>

          {/* Right: Email editor */}
          <div className="lg:col-span-2 space-y-4">

            {/* Subject + template toggle */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>Subject</Label>
                <Input
                  value={emailSubject}
                  onChange={e => setEmailSubject(e.target.value)}
                  placeholder="Email subject..."
                />
              </div>
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={template} onValueChange={(v: 'standard' | 'wqa') => setTemplate(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="standard">Standard Intro</SelectItem>
                    <SelectItem value="wqa">WQA Event</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Mode</Label>
                <RadioGroup
                  value={mode}
                  onValueChange={(v: 'draft' | 'send') => setMode(v)}
                  className="flex gap-4 pt-2"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="draft" id="mode-draft" />
                    <Label htmlFor="mode-draft" className="font-normal cursor-pointer flex items-center gap-1.5">
                      <FilePen className="w-3.5 h-3.5" /> Draft
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="send" id="mode-send" />
                    <Label htmlFor="mode-send" className="font-normal cursor-pointer flex items-center gap-1.5">
                      <Send className="w-3.5 h-3.5" /> Send
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            </div>

            {/* Body editor / preview toggle */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Email Body</Label>
                <button
                  onClick={() => setShowPreview(p => !p)}
                  className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                >
                  {showPreview ? <><EyeOff className="w-3.5 h-3.5" /> Edit</> : <><Eye className="w-3.5 h-3.5" /> Preview</>}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{firstName}'}</code> and <code className="bg-muted px-1 rounded">{'{companyName}'}</code> as placeholders.
                Your email signature is appended automatically.
              </p>

              {showPreview ? (
                <div
                  className="border rounded-lg p-4 bg-card min-h-[240px] text-sm leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: previewHtml }}
                />
              ) : (
                <Textarea
                  value={template === 'wqa' ? wqaBody : emailBody}
                  onChange={e => template === 'wqa' ? setWqaBody(e.target.value) : setEmailBody(e.target.value)}
                  rows={10}
                  className="font-mono text-sm resize-none"
                  placeholder="Email body..."
                />
              )}
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end pt-2">
              <Button variant="outline" onClick={() => setStep('review')}>Back</Button>
              <Button
                onClick={handleExecute}
                disabled={emailIds.size === 0 && importIds.size === 0}
                className={mode === 'send' ? 'bg-destructive hover:bg-destructive/90' : ''}
              >
                {mode === 'draft' ? (
                  <><FilePen className="w-4 h-4 mr-2" />Create {emailIds.size} Draft{emailIds.size !== 1 ? 's' : ''}</>
                ) : (
                  <><Send className="w-4 h-4 mr-2" />Send to {emailIds.size} Recipient{emailIds.size !== 1 ? 's' : ''}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Executing ───────────────────────────────────────────────── */}
      {step === 'executing' && (
        <div className="flex flex-col items-center justify-center py-24 gap-5 text-center">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-accent animate-spin" />
          </div>
          <div>
            <p className="text-lg font-medium">
              {mode === 'draft' ? 'Creating drafts…' : 'Sending emails…'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Importing contacts · Creating Gmail messages</p>
          </div>
        </div>
      )}

      {/* ── Step 6: Done ────────────────────────────────────────────────────── */}
      {step === 'done' && (
        <div className="flex flex-col items-center justify-center py-20 gap-6 text-center max-w-md mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-9 h-9 text-green-600" />
          </div>
          <div>
            <h2 className="text-xl font-semibold">All done</h2>
            <p className="text-muted-foreground mt-2">
              <strong>{doneResult.imported}</strong> contact{doneResult.imported !== 1 ? 's' : ''} imported to CRM
              {doneResult.emailed > 0 && (
                <> · <strong>{doneResult.emailed}</strong> email{doneResult.emailed !== 1 ? 's' : ''} {doneResult.mode === 'draft' ? 'drafted' : 'sent'}</>
              )}
            </p>
            {doneResult.mode === 'draft' && doneResult.emailed > 0 && (
              <p className="text-sm text-muted-foreground mt-1">Check your Gmail Drafts folder.</p>
            )}
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => window.open('https://mail.google.com', '_blank')}>
              <Mail className="w-4 h-4 mr-2" />
              Open Gmail
            </Button>
            <Button onClick={() => {
              setStep('select');
              setSelectedProspectId('');
              setProspectSearch('');
              setDiscovered([]);
              setImportIds(new Set());
              setEmailIds(new Set());
            }}>
              <Bot className="w-4 h-4 mr-2" />
              Run Again
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
