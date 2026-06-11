import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  Phone, Mail, Linkedin, Building2, RefreshCw, CheckCircle2,
  Clock, X, AlertCircle, ChevronRight, Loader2, MessageSquare,
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
  // Joined
  prospect_name?: string;
}

const ACTION_CONFIG = {
  call:            { icon: Phone,        label: 'Call',           color: 'text-blue-600',   bg: 'bg-blue-50' },
  email:           { icon: Mail,         label: 'Email',          color: 'text-indigo-600', bg: 'bg-indigo-50' },
  linkedin:        { icon: Linkedin,     label: 'LinkedIn',       color: 'text-sky-600',    bg: 'bg-sky-50' },
  customer_checkin:{ icon: Building2,    label: 'Check-in',       color: 'text-emerald-600',bg: 'bg-emerald-50' },
  replenishment:   { icon: RefreshCw,    label: 'Replenishment',  color: 'text-orange-600', bg: 'bg-orange-50' },
  quote_followup:  { icon: MessageSquare,label: 'Quote Follow-up',color: 'text-violet-600', bg: 'bg-violet-50' },
  none:            { icon: CheckCircle2, label: 'None',           color: 'text-slate-400',  bg: 'bg-slate-50' },
};

const PRIORITY_CONFIG = {
  urgent: { label: 'Urgent', dot: 'bg-red-500',    badge: 'bg-red-100 text-red-800 border-red-200' },
  high:   { label: 'High',   dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-800 border-orange-200' },
  normal: { label: 'Normal', dot: 'bg-blue-400',   badge: 'bg-blue-50 text-blue-700 border-blue-200' },
};

const TODAY = new Date().toISOString().split('T')[0];

export function DailyBriefingPage() {
  const navigate = useNavigate();
  const [recs, setRecs] = useState<DailyRecommendation[]>([]);
  const [prospects, setProspects] = useState<Record<string, string>>({});
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
        .order('priority', { ascending: true }) // urgent first via custom order below
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Load prospect names
      const ids = [...new Set((data || []).map(r => r.prospect_id).filter(Boolean))];
      if (ids.length > 0) {
        const { data: pData } = await supabase
          .from('prospects')
          .select('id, company_name')
          .in('id', ids as string[]);
        const map: Record<string, string> = {};
        pData?.forEach(p => { map[p.id] = p.company_name; });
        setProspects(map);
      }

      // Sort: urgent → high → normal, but snoozed items at the bottom
      const sorted = (data || []).sort((a, b) => {
        if (a.status === 'snoozed' && b.status !== 'snoozed') return 1;
        if (b.status === 'snoozed' && a.status !== 'snoozed') return -1;
        const order = { urgent: 0, high: 1, normal: 2 };
        return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
      });

      setRecs(sorted);
      if (sorted.length > 0) setGeneratedAt(sorted[0].created_at);
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

    const { error } = await supabase
      .from('daily_recommendations')
      .update(update)
      .eq('id', id);

    if (error) { toast.error('Update failed'); return; }
    setRecs(prev => prev.filter(r => r.id !== id));
  };

  const handleDone = (r: DailyRecommendation) => updateStatus(r.id, 'acted');
  const handleDismiss = (r: DailyRecommendation) => updateStatus(r.id, 'dismissed');

  const handleSnooze = (r: DailyRecommendation) => {
    const snoozeDate = new Date();
    snoozeDate.setDate(snoozeDate.getDate() + 3);
    updateStatus(r.id, 'snoozed', snoozeDate.toISOString().split('T')[0]);
    toast.success(`Snoozed ${prospects[r.prospect_id!] || 'company'} for 3 days`);
  };

  const openCompany = (r: DailyRecommendation) => {
    if (r.prospect_id) navigate(`/company/${r.prospect_id}`);
  };

  const openMethod = (method: string | null) => {
    if (!method) return;
    if (method.startsWith('http') || method.includes('linkedin.com')) {
      window.open(method, '_blank');
    } else if (method.includes('@')) {
      window.location.href = `mailto:${method}`;
    }
    // Phone numbers are just displayed — tap-to-call on mobile
  };

  const pending = recs.filter(r => r.status === 'pending');
  const snoozed = recs.filter(r => r.status === 'snoozed');

  const timeAgo = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      {/* Status bar */}
      <div className="flex items-center justify-between text-sm text-muted-foreground">
        <span>
          {generatedAt ? `Generated ${timeAgo(generatedAt)}` : 'No briefing yet today'}
          {pending.length > 0 && ` · ${pending.length} action${pending.length !== 1 ? 's' : ''} pending`}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs">To regenerate:</span>
          <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">node scripts/daily-briefing.mjs</code>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={loadRecs} title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {recs.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-500" />
          <p className="font-medium">You're all caught up!</p>
          <p className="text-sm mt-1">No pending actions for today. Run the briefing script to refresh.</p>
        </div>
      )}

      {/* Pending actions */}
      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map(r => (
            <RecommendationCard
              key={r.id}
              rec={r}
              companyName={r.prospect_id ? (prospects[r.prospect_id] || 'Unknown Company') : 'Unknown Company'}
              onDone={() => handleDone(r)}
              onSnooze={() => handleSnooze(r)}
              onDismiss={() => handleDismiss(r)}
              onOpenCompany={() => openCompany(r)}
              onOpenMethod={() => openMethod(r.contact_method)}
            />
          ))}
        </div>
      )}

      {/* Snoozed */}
      {snoozed.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Snoozed</p>
          {snoozed.map(r => (
            <RecommendationCard
              key={r.id}
              rec={r}
              companyName={r.prospect_id ? (prospects[r.prospect_id] || 'Unknown Company') : 'Unknown Company'}
              onDone={() => handleDone(r)}
              onSnooze={() => handleSnooze(r)}
              onDismiss={() => handleDismiss(r)}
              onOpenCompany={() => openCompany(r)}
              onOpenMethod={() => openMethod(r.contact_method)}
              muted
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card component ───────────────────────────────────────────────────────────

interface CardProps {
  rec: DailyRecommendation;
  companyName: string;
  onDone: () => void;
  onSnooze: () => void;
  onDismiss: () => void;
  onOpenCompany: () => void;
  onOpenMethod: () => void;
  muted?: boolean;
}

function RecommendationCard({ rec, companyName, onDone, onSnooze, onDismiss, onOpenCompany, onOpenMethod, muted }: CardProps) {
  const action = ACTION_CONFIG[rec.action_type] ?? ACTION_CONFIG.none;
  const priority = PRIORITY_CONFIG[rec.priority] ?? PRIORITY_CONFIG.normal;
  const ActionIcon = action.icon;

  const isClickableMethod = rec.contact_method &&
    (rec.contact_method.startsWith('http') || rec.contact_method.includes('@') || rec.contact_method.includes('linkedin'));

  return (
    <Card className={`border ${muted ? 'opacity-60' : ''}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Action icon */}
          <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${action.bg}`}>
            <ActionIcon className={`w-4 h-4 ${action.color}`} />
          </div>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button onClick={onOpenCompany} className="font-semibold text-sm hover:underline">
                {companyName}
              </button>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${priority.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${priority.dot}`} />
                {priority.label}
              </Badge>
              <Badge variant="outline" className={`text-xs px-2 py-0 ${action.bg} ${action.color} border-transparent`}>
                {action.label}
              </Badge>
            </div>

            <p className="text-sm text-muted-foreground mt-1">{rec.reason}</p>

            {/* Contact + method */}
            {rec.contact_name && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs font-medium">{rec.contact_name}</span>
                {rec.contact_method && (
                  <>
                    <span className="text-muted-foreground">·</span>
                    {isClickableMethod ? (
                      <button onClick={onOpenMethod} className="text-xs text-primary hover:underline flex items-center gap-1">
                        {rec.contact_method.includes('linkedin') ? (
                          <><Linkedin className="w-3 h-3" /> Connect on LinkedIn</>
                        ) : rec.contact_method.includes('@') ? (
                          <><Mail className="w-3 h-3" /> {rec.contact_method}</>
                        ) : (
                          <><ChevronRight className="w-3 h-3" /> {rec.contact_method}</>
                        )}
                      </button>
                    ) : (
                      <span className="text-xs font-mono text-foreground flex items-center gap-1">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        {rec.contact_method}
                      </span>
                    )}
                  </>
                )}
              </div>
            )}

            {/* Talking point */}
            {rec.talking_point && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted rounded px-2 py-1.5 italic">
                "{rec.talking_point}"
              </div>
            )}
          </div>

          {/* Open company arrow */}
          <button onClick={onOpenCompany} className="flex-shrink-0 text-muted-foreground hover:text-foreground mt-1">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Actions row */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
          <Button size="sm" variant="default" className="h-7 text-xs gap-1" onClick={onDone}>
            <CheckCircle2 className="w-3 h-3" /> Done
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={onSnooze}>
            <Clock className="w-3 h-3" /> Snooze 3 days
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground ml-auto" onClick={onDismiss}>
            <X className="w-3 h-3" /> Dismiss
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
