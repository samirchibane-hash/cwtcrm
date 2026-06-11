import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, Linkedin, Building2, RefreshCw, CheckCircle2,
  Clock, X, ChevronRight, Loader2, MessageSquare, Copy, Check,
  Zap, TrendingUp, Minus,
} from 'lucide-react';

interface DailyRecommendation {
  id: string;
  prospect_id: string | null;
  date: string;
  action_type: 'email' | 'call' | 'linkedin' | 'customer_checkin' | 'replenishment' | 'quote_followup' | 'none';
  priority: 'urgent' | 'high' | 'normal';
  contact_name: string | null;
  contact_method: string | null;
  reason: string;
  talking_point: string | null;
  status: 'pending' | 'acted' | 'dismissed' | 'snoozed';
  snooze_until: string | null;
  created_at: string;
}

interface EmailCadence {
  total: number;
  responded: boolean;
  lastSentAt: string | null;
}

const ACTION_CONFIG = {
  call:             { icon: Phone,         label: 'Call',            color: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  email:            { icon: Mail,          label: 'Email',           color: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-200' },
  linkedin:         { icon: Linkedin,      label: 'LinkedIn',        color: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-sky-200' },
  customer_checkin: { icon: Building2,     label: 'Check-in',        color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  replenishment:    { icon: RefreshCw,     label: 'Replenishment',   color: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-orange-200' },
  quote_followup:   { icon: MessageSquare, label: 'Quote Follow-up', color: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-violet-200' },
  none:             { icon: CheckCircle2,  label: 'None',            color: 'text-slate-400',   bg: 'bg-slate-50',   border: 'border-slate-200' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', accent: 'bg-red-500',    badge: 'bg-red-100 text-red-800 border-red-200',       icon: Zap,         iconColor: 'text-red-500' },
  high:   { label: 'High',   accent: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200', icon: TrendingUp,  iconColor: 'text-orange-500' },
  normal: { label: 'Normal', accent: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200',     icon: Minus,       iconColor: 'text-blue-400' },
};

const TODAY = new Date().toISOString().split('T')[0];

function timeAgo(iso: string) {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function daysSince(iso: string | null) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

// ── Main page ────────────────────────────────────────────────────────────────

export function DailyBriefingPage() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<DailyRecommendation[]>([]);
  const [prospects, setProspects] = useState<Record<string, string>>({});
  const [cadence, setCadence] = useState<Record<string, EmailCadence>>({});
  const [loading, setLoading] = useState(true);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);

  const loadRecs = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('daily_recommendations')
        .select('*')
        .eq('date', TODAY)
        .in('status', ['pending', 'snoozed'])
        .order('created_at', { ascending: true });

      if (error) throw error;

      const sorted = (data || []).sort((a, b) => {
        if (a.status === 'snoozed' && b.status !== 'snoozed') return 1;
        if (b.status === 'snoozed' && a.status !== 'snoozed') return -1;
        const order = { urgent: 0, high: 1, normal: 2 };
        return (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2);
      });

      setRecs(sorted);
      if (sorted.length > 0) setGeneratedAt(sorted[0].created_at);

      // Load prospect names
      const ids = [...new Set(sorted.map(r => r.prospect_id).filter(Boolean))] as string[];
      if (ids.length > 0) {
        const { data: pData } = await supabase.from('prospects').select('id, company_name').in('id', ids);
        const map: Record<string, string> = {};
        pData?.forEach(p => { map[p.id] = p.company_name; });
        setProspects(map);

        // Load email cadence for these prospects
        const { data: threads } = await supabase
          .from('email_threads')
          .select('prospect_id, responded, sent_at')
          .in('prospect_id', ids)
          .order('sent_at', { ascending: false });

        const cmap: Record<string, EmailCadence> = {};
        for (const t of (threads || [])) {
          if (!cmap[t.prospect_id]) cmap[t.prospect_id] = { total: 0, responded: false, lastSentAt: t.sent_at };
          cmap[t.prospect_id].total++;
          if (t.responded) cmap[t.prospect_id].responded = true;
        }
        setCadence(cmap);
      }
    } catch (e: any) {
      toast.error('Failed to load briefing: ' + e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadRecs(); }, [loadRecs]);

  const updateStatus = async (id: string, status: 'acted' | 'dismissed' | 'snoozed', snoozeUntil?: string) => {
    const update: Record<string, unknown> = { status };
    if (snoozeUntil) update.snooze_until = snoozeUntil;
    const { error } = await supabase.from('daily_recommendations').update(update).eq('id', id);
    if (error) { toast.error('Update failed'); return; }
    setRecs(prev => prev.filter(r => r.id !== id));
  };

  const handleDone    = (r: DailyRecommendation) => updateStatus(r.id, 'acted');
  const handleDismiss = (r: DailyRecommendation) => updateStatus(r.id, 'dismissed');
  const handleSnooze  = (r: DailyRecommendation) => {
    const d = new Date(); d.setDate(d.getDate() + 3);
    updateStatus(r.id, 'snoozed', d.toISOString().split('T')[0]);
    toast.success(`Snoozed ${prospects[r.prospect_id!] || 'company'} for 3 days`);
  };

  const openCompany = (r: DailyRecommendation) => { if (r.prospect_id) navigate(`/company/${r.prospect_id}`); };
  const openMethod  = (method: string | null) => {
    if (!method) return;
    if (method.startsWith('http') || method.includes('linkedin.com')) window.open(method, '_blank');
    else if (method.includes('@')) window.location.href = `mailto:${method}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = recs.filter(r => r.status === 'pending');
  const snoozed = recs.filter(r => r.status === 'snoozed');
  const urgent  = pending.filter(r => r.priority === 'urgent');
  const high    = pending.filter(r => r.priority === 'high');
  const normal  = pending.filter(r => r.priority === 'normal');

  const cardProps = (r: DailyRecommendation) => ({
    rec: r,
    companyName: r.prospect_id ? (prospects[r.prospect_id] || 'Unknown Company') : 'Unknown Company',
    emailCadence: r.prospect_id ? cadence[r.prospect_id] : undefined,
    onDone: () => handleDone(r),
    onSnooze: () => handleSnooze(r),
    onDismiss: () => handleDismiss(r),
    onOpenCompany: () => openCompany(r),
    onOpenMethod: () => openMethod(r.contact_method),
  });

  return (
    <div className="max-w-3xl space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {generatedAt ? `Briefing generated ${timeAgo(generatedAt)}` : 'No briefing generated yet today'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {pending.length > 0 && (
            <div className="flex items-center gap-2 text-sm">
              {urgent.length > 0  && <span className="font-medium text-red-600">{urgent.length} urgent</span>}
              {high.length > 0    && <span className="font-medium text-orange-500">{high.length} high</span>}
              {normal.length > 0  && <span className="text-muted-foreground">{normal.length} normal</span>}
            </div>
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={loadRecs} title="Refresh">
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Regenerate hint */}
      <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 flex items-center gap-2">
        <span>To regenerate with email context:</span>
        <code className="font-mono bg-background px-1.5 py-0.5 rounded border text-[11px]">node scripts/daily-briefing.mjs</code>
      </div>

      {/* Empty state */}
      {recs.length === 0 && (
        <div className="text-center py-20 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-medium text-foreground">You're all caught up!</p>
          <p className="text-sm mt-1">No pending actions for today. Run the briefing script to refresh.</p>
        </div>
      )}

      {/* Priority sections */}
      {urgent.length > 0 && (
        <PrioritySection label="Urgent" priority="urgent" recs={urgent} cardProps={cardProps} />
      )}
      {high.length > 0 && (
        <PrioritySection label="High Priority" priority="high" recs={high} cardProps={cardProps} />
      )}
      {normal.length > 0 && (
        <PrioritySection label="Normal" priority="normal" recs={normal} cardProps={cardProps} />
      )}

      {/* Snoozed */}
      {snoozed.length > 0 && (
        <div className="space-y-2 opacity-50">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Snoozed</p>
          {snoozed.map(r => (
            <RecommendationCard key={r.id} {...cardProps(r)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Priority section ─────────────────────────────────────────────────────────

function PrioritySection({
  label, priority, recs, cardProps,
}: {
  label: string;
  priority: 'urgent' | 'high' | 'normal';
  recs: DailyRecommendation[];
  cardProps: (r: DailyRecommendation) => object;
}) {
  const cfg = PRIORITY_CONFIG[priority];
  const PIcon = cfg.icon;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PIcon className={`w-3.5 h-3.5 ${cfg.iconColor}`} />
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">({recs.length})</span>
      </div>
      {recs.map(r => <RecommendationCard key={r.id} {...(cardProps(r) as any)} />)}
    </div>
  );
}

// ── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  rec: DailyRecommendation;
  companyName: string;
  emailCadence?: EmailCadence;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onOpenCompany: () => void;
  onOpenMethod: () => void;
}

function RecommendationCard({
  rec, companyName, emailCadence, onDone, onSnooze, onDismiss, onOpenCompany, onOpenMethod,
}: CardProps) {
  const [copied, setCopied] = useState(false);
  const action   = ACTION_CONFIG[rec.action_type] ?? ACTION_CONFIG.none;
  const priority = PRIORITY_CONFIG[rec.priority]  ?? PRIORITY_CONFIG.normal;
  const ActionIcon = action.icon;

  const isClickableMethod = rec.contact_method &&
    (rec.contact_method.startsWith('http') || rec.contact_method.includes('@') || rec.contact_method.includes('linkedin'));

  const copyTalkingPoint = () => {
    if (!rec.talking_point) return;
    navigator.clipboard.writeText(rec.talking_point);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lastSentDays = emailCadence?.lastSentAt ? daysSince(emailCadence.lastSentAt) : null;

  return (
    <Card className="border overflow-hidden">
      {/* Priority accent bar */}
      <div className={`h-0.5 w-full ${priority.accent}`} />

      <CardContent className="p-4 space-y-3">
        {/* Top row: action icon + company + badges */}
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${action.bg} border ${action.border}`}>
            <ActionIcon className={`w-4 h-4 ${action.color}`} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={onOpenCompany} className="font-semibold text-sm hover:underline leading-tight">
                {companyName}
              </button>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${action.bg} ${action.color} border-transparent`}>
                {action.label}
              </Badge>
              {emailCadence && emailCadence.total > 0 && (
                <span className="text-xs text-muted-foreground">
                  Touch {emailCadence.total}
                  {emailCadence.responded && <span className="text-emerald-600 ml-1">· replied</span>}
                  {lastSentDays !== null && !emailCadence.responded && (
                    <span className="ml-1">· {lastSentDays}d ago</span>
                  )}
                </span>
              )}
            </div>

            {/* Reason */}
            <p className="text-sm text-muted-foreground mt-1 leading-snug">{rec.reason}</p>
          </div>

          <button onClick={onOpenCompany} className="flex-shrink-0 text-muted-foreground hover:text-foreground">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Contact row */}
        {rec.contact_name && (
          <div className="flex items-center gap-2 text-xs pl-12">
            <span className="font-medium text-foreground">{rec.contact_name}</span>
            {rec.contact_method && (
              <>
                <span className="text-muted-foreground">·</span>
                {isClickableMethod ? (
                  <button onClick={onOpenMethod} className="text-primary hover:underline flex items-center gap-1">
                    {rec.contact_method.includes('linkedin') ? (
                      <><Linkedin className="w-3 h-3" /> LinkedIn</>
                    ) : rec.contact_method.includes('@') ? (
                      <><Mail className="w-3 h-3" /> {rec.contact_method}</>
                    ) : (
                      rec.contact_method
                    )}
                  </button>
                ) : (
                  <span className="font-mono text-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    {rec.contact_method}
                  </span>
                )}
              </>
            )}
          </div>
        )}

        {/* Talking point — prominent "Suggested script" block */}
        {rec.talking_point && (
          <div className="ml-12 bg-muted/60 rounded-lg px-3 py-2.5 relative group">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground mb-1">Suggested script</p>
                <p className="text-sm text-foreground leading-relaxed">{rec.talking_point}</p>
              </div>
              <button
                onClick={copyTalkingPoint}
                className="flex-shrink-0 mt-0.5 text-muted-foreground hover:text-foreground transition-colors opacity-0 group-hover:opacity-100"
                title="Copy to clipboard"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-2 pt-1 ml-12">
          <Button size="sm" variant="default" className="h-7 text-xs gap-1 px-3" onClick={onDone}>
            <CheckCircle2 className="w-3 h-3" /> Done
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1 px-3" onClick={onSnooze}>
            <Clock className="w-3 h-3" /> Snooze 3 days
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 px-3 text-muted-foreground ml-auto" onClick={onDismiss}>
            <X className="w-3 h-3" /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
