import { useMemo, useState } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { REPS, getRepConfig } from '@/data/prospects';
import MetricCard from '@/components/crm/MetricCard';
import { Phone, Mail, Building2, Activity, Plus, Trash2, Loader2 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// Parse M/D/YYYY or YYYY-MM-DD or any date string into a Date
const parseEngagementDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // ISO date (from activity_log)
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      return new Date(year, month - 1, day);
    }
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

type Period = 'daily' | 'weekly';

// Today in YYYY-MM-DD for the date input max
const todayISO = new Date().toISOString().slice(0, 10);

const ActivityDashboard = () => {
  const { prospects } = useProspects();
  const { entries: logEntries, isLoading: logLoading, addEntry, deleteEntry } = useActivityLog();
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>('daily');

  // Bulk log form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(todayISO);
  const [formRep, setFormRep] = useState<string>('Samir');
  const [formCalls, setFormCalls] = useState<number>(0);
  const [formEmails, setFormEmails] = useState<number>(0);
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddEntry = async () => {
    if (formCalls + formEmails === 0) return;
    setSaving(true);
    const result = await addEntry({
      date: formDate,
      loggedBy: formRep,
      calls: formCalls,
      emails: formEmails,
      note: formNote.trim() || undefined,
    });
    setSaving(false);
    if (result) {
      toast({ title: 'Activity logged', description: `Added ${formCalls} calls and ${formEmails} emails for ${formRep}.` });
      setFormCalls(0);
      setFormEmails(0);
      setFormNote('');
      setShowForm(false);
    } else {
      toast({ title: 'Error', description: 'Failed to save activity.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    toast({ title: 'Entry deleted' });
  };

  // Flatten prospect engagements
  const prospectActivities = useMemo(() =>
    prospects.flatMap(p =>
      p.engagements.map(e => ({
        date: e.date,
        calls: e.activity?.calls || 0,
        emails: e.activity?.emails || 0,
        prospectId: p.id,
        source: 'prospect' as const,
      }))
    ), [prospects]);

  // Flatten activity log entries
  const logActivities = useMemo(() =>
    logEntries.map(e => ({
      date: e.date,
      calls: e.calls,
      emails: e.emails,
      prospectId: null,
      source: 'log' as const,
    })), [logEntries]);

  const allActivities = useMemo(() => [...prospectActivities, ...logActivities], [prospectActivities, logActivities]);

  // Summary metrics
  const totalCalls = useMemo(() => allActivities.reduce((s, e) => s + e.calls, 0), [allActivities]);
  const totalEmails = useMemo(() => allActivities.reduce((s, e) => s + e.emails, 0), [allActivities]);
  const companiesContacted = useMemo(() => {
    const ids = new Set(
      prospectActivities.filter(e => e.calls + e.emails > 0).map(e => e.prospectId)
    );
    return ids.size;
  }, [prospectActivities]);
  const totalActivities = totalCalls + totalEmails;

  // Chart data
  const timeChartData = useMemo(() => {
    if (period === 'daily') {
      const map = new Map<string, { label: string; date: Date; calls: number; emails: number }>();
      allActivities.forEach(e => {
        if (e.calls + e.emails === 0) return;
        const d = parseEngagementDate(e.date);
        if (!d) return;
        const key = d.toISOString().slice(0, 10);
        const label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = map.get(key) || { label, date: d, calls: 0, emails: 0 };
        map.set(key, { ...existing, calls: existing.calls + e.calls, emails: existing.emails + e.emails });
      });
      return Array.from(map.values())
        .sort((a, b) => a.date.getTime() - b.date.getTime())
        .map(({ label, calls, emails }) => ({ label, calls, emails }));
    } else {
      const map = new Map<string, { label: string; weekStart: Date; calls: number; emails: number }>();
      allActivities.forEach(e => {
        if (e.calls + e.emails === 0) return;
        const d = parseEngagementDate(e.date);
        if (!d) return;
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - d.getDay());
        const key = weekStart.toISOString().slice(0, 10);
        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = map.get(key) || { label, weekStart, calls: 0, emails: 0 };
        map.set(key, { ...existing, calls: existing.calls + e.calls, emails: existing.emails + e.emails });
      });
      return Array.from(map.values())
        .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
        .map(({ label, calls, emails }) => ({ label, calls, emails }));
    }
  }, [allActivities, period]);

  const hasData = totalActivities > 0;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Calls Made" value={totalCalls} icon={Phone} />
        <MetricCard title="Total Emails Sent" value={totalEmails} icon={Mail} />
        <MetricCard title="Companies Contacted" value={companiesContacted} icon={Building2} />
        <MetricCard title="Total Activities" value={totalActivities} icon={Activity} />
      </div>

      {/* Bulk Activity Log */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Log Bulk Activity</CardTitle>
            <Button
              size="sm"
              variant={showForm ? 'outline' : 'default'}
              onClick={() => setShowForm(v => !v)}
              className="gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              {showForm ? 'Cancel' : 'Add Entry'}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Date */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date"
                  max={todayISO}
                  value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Rep */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rep</label>
                <div className="flex gap-2">
                  {REPS.map(rep => (
                    <button
                      key={rep.name}
                      type="button"
                      onClick={() => setFormRep(rep.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formRep === rep.name
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

              {/* Calls */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Calls made
                </label>
                <input
                  type="number"
                  min={0}
                  value={formCalls || ''}
                  onChange={e => setFormCalls(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {/* Emails */}
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Emails sent
                </label>
                <input
                  type="number"
                  min={0}
                  value={formEmails || ''}
                  onChange={e => setFormEmails(Math.max(0, parseInt(e.target.value) || 0))}
                  placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
            </div>

            {/* Note */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <textarea
                value={formNote}
                onChange={e => setFormNote(e.target.value)}
                placeholder="e.g. Cold calls from HubSpot — water treatment vertical"
                rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>

            <div className="flex justify-end">
              <Button
                size="sm"
                onClick={handleAddEntry}
                disabled={saving || formCalls + formEmails === 0}
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : null}
                Save Activity
              </Button>
            </div>
          </CardContent>
        )}

        {/* Log history */}
        {logEntries.length > 0 && (
          <CardContent className={showForm ? 'pt-0 border-t border-border' : 'pt-0'}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Previously Logged</p>
            <div className="space-y-2">
              {logLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : (
                logEntries.map(entry => {
                  const rep = getRepConfig(entry.loggedBy);
                  const d = parseEngagementDate(entry.date);
                  const dateLabel = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : entry.date;
                  return (
                    <div key={entry.id} className="flex items-start justify-between gap-3 rounded-lg bg-muted/40 px-3 py-2.5 group">
                      <div className="flex items-start gap-2.5">
                        <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${rep.avatarClass}`}>
                          {rep.initials}
                        </span>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium">{rep.name}</span>
                            <span className="text-xs text-muted-foreground">{dateLabel}</span>
                            {entry.calls > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-chart-1/10 text-chart-1">
                                <Phone className="w-3 h-3" />
                                {entry.calls} call{entry.calls !== 1 ? 's' : ''}
                              </span>
                            )}
                            {entry.emails > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-chart-2/10 text-chart-2">
                                <Mail className="w-3 h-3" />
                                {entry.emails} email{entry.emails !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {entry.note && (
                            <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => handleDelete(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Chart */}
      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No activity logged yet</p>
            <p className="text-xs mt-1">Log bulk activity above or open a company and log calls in the "Log Activity" panel.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-semibold">Activity Over Time</CardTitle>
              <div className="flex gap-1 rounded-lg overflow-hidden border border-border">
                <button
                  onClick={() => setPeriod('daily')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${period === 'daily' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => setPeriod('weekly')}
                  className={`px-3 py-1 text-xs font-medium transition-colors ${period === 'weekly' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                >
                  Weekly
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={timeChartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: 'hsl(var(--foreground))' }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="calls" name="Calls" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="emails" name="Emails" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ActivityDashboard;
