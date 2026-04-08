import { useMemo, useState } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { REPS, getRepConfig } from '@/data/prospects';
import MetricCard from '@/components/crm/MetricCard';
import { Phone, Mail, Building2, Activity, Plus, Trash2, Loader2, BarChart2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

// ── helpers ──────────────────────────────────────────────────────────────────

const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts.map(Number);
    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) return new Date(year, month - 1, day);
  }
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
};

const todayISO = new Date().toISOString().slice(0, 10);

type DateRange = '7d' | '30d' | '90d' | 'all';
type MetricFilter = 'all' | 'calls' | 'emails';
type ChartType = 'bar' | 'line';
type Period = 'daily' | 'weekly';

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'All', value: 'all' },
];

// Colors per rep and per metric
const REP_CHART_COLORS: Record<string, { calls: string; emails: string }> = {
  'Samir':      { calls: '#3b82f6', emails: '#93c5fd' },
  'Deondre B.': { calls: '#f97316', emails: '#fed7aa' },
  'all':        { calls: 'hsl(var(--chart-1))', emails: 'hsl(var(--chart-2))' },
};

function getChartColors(repFilter: string) {
  return REP_CHART_COLORS[repFilter] ?? REP_CHART_COLORS['all'];
}

// Simple segmented control
function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-medium transition-colors ${
            value === opt.value
              ? 'bg-accent text-accent-foreground'
              : 'bg-card text-muted-foreground hover:bg-muted'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

const ActivityDashboard = () => {
  const { prospects } = useProspects();
  const { entries: logEntries, isLoading: logLoading, addEntry, deleteEntry } = useActivityLog();
  const { toast } = useToast();

  // Chart/filter state
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [repFilter, setRepFilter] = useState<string>('all');
  const [metricFilter, setMetricFilter] = useState<MetricFilter>('all');
  const [chartType, setChartType] = useState<ChartType>('bar');
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
    const result = await addEntry({ date: formDate, loggedBy: formRep, calls: formCalls, emails: formEmails, note: formNote.trim() || undefined });
    setSaving(false);
    if (result) {
      toast({ title: 'Activity logged', description: `Added ${formCalls} calls and ${formEmails} emails for ${formRep}.` });
      setFormCalls(0); setFormEmails(0); setFormNote(''); setShowForm(false);
    } else {
      toast({ title: 'Error', description: 'Failed to save activity.', variant: 'destructive' });
    }
  };

  const handleDelete = async (id: string) => {
    await deleteEntry(id);
    toast({ title: 'Entry deleted' });
  };

  // ── data ───────────────────────────────────────────────────────────────────

  // All activities with loggedBy (unattributed prospect engagements default to Samir)
  const allActivities = useMemo(() => [
    ...prospects.flatMap(p =>
      p.engagements.map(e => ({
        date: e.date,
        calls: e.activity?.calls || 0,
        emails: e.activity?.emails || 0,
        loggedBy: e.loggedBy || 'Samir',
        prospectId: p.id as string | null,
      }))
    ),
    ...logEntries.map(e => ({
      date: e.date,
      calls: e.calls,
      emails: e.emails,
      loggedBy: e.loggedBy,
      prospectId: null as string | null,
    })),
  ], [prospects, logEntries]);

  // Cutoff date for range filter
  const cutoffDate = useMemo(() => {
    if (dateRange === 'all') return null;
    const days = { '7d': 7, '30d': 30, '90d': 90 }[dateRange];
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateRange]);

  // Filtered activities
  const filtered = useMemo(() => allActivities.filter(e => {
    if (cutoffDate) {
      const d = parseDate(e.date);
      if (!d || d < cutoffDate) return false;
    }
    if (repFilter !== 'all' && e.loggedBy !== repFilter) return false;
    return true;
  }), [allActivities, cutoffDate, repFilter]);

  // Summary metrics (respect metricFilter for display only in chart, but totals show both)
  const totalCalls  = useMemo(() => filtered.reduce((s, e) => s + e.calls, 0), [filtered]);
  const totalEmails = useMemo(() => filtered.reduce((s, e) => s + e.emails, 0), [filtered]);
  const companiesContacted = useMemo(() => {
    const ids = new Set(filtered.filter(e => e.prospectId && (e.calls + e.emails) > 0).map(e => e.prospectId!));
    return ids.size;
  }, [filtered]);
  const totalActivities = totalCalls + totalEmails;

  // Per-rep breakdown (always uses full filtered set, ignores repFilter for this)
  const repBreakdown = useMemo(() => REPS.map(rep => {
    const repActivities = allActivities.filter(e => {
      if (cutoffDate) {
        const d = parseDate(e.date);
        if (!d || d < cutoffDate) return false;
      }
      return e.loggedBy === rep.name;
    });
    return {
      ...rep,
      calls: repActivities.reduce((s, e) => s + e.calls, 0),
      emails: repActivities.reduce((s, e) => s + e.emails, 0),
    };
  }), [allActivities, cutoffDate]);

  // Chart data — bucket by period
  const chartData = useMemo(() => {
    type Bucket = { label: string; sortKey: number; calls: number; emails: number };
    const map = new Map<string, Bucket>();

    filtered.forEach(e => {
      if (e.calls + e.emails === 0) return;
      const d = parseDate(e.date);
      if (!d) return;

      let key: string;
      let label: string;
      let sortKey: number;

      if (period === 'daily') {
        key = d.toISOString().slice(0, 10);
        label = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        sortKey = d.getTime();
      } else {
        const ws = new Date(d);
        ws.setDate(d.getDate() - d.getDay());
        key = ws.toISOString().slice(0, 10);
        label = ws.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        sortKey = ws.getTime();
      }

      const existing = map.get(key) || { label, sortKey, calls: 0, emails: 0 };
      map.set(key, { ...existing, calls: existing.calls + e.calls, emails: existing.emails + e.emails });
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  }, [filtered, period]);

  const colors = getChartColors(repFilter);
  const hasData = totalActivities > 0;

  const ChartComponent = chartType === 'bar' ? BarChart : LineChart;
  const commonAxisProps = {
    xAxis: <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />,
    yAxis: <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />,
  };

  return (
    <div className="space-y-6">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Date range */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Period</span>
          <SegmentedControl options={DATE_RANGES} value={dateRange} onChange={setDateRange} />
        </div>

        {/* Rep filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Rep</span>
          <div className="flex gap-1.5">
            <button
              onClick={() => setRepFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                repFilter === 'all'
                  ? 'bg-accent text-accent-foreground border-transparent'
                  : 'bg-card border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              All
            </button>
            {REPS.map(rep => (
              <button
                key={rep.name}
                onClick={() => setRepFilter(repFilter === rep.name ? 'all' : rep.name)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${
                  repFilter === rep.name
                    ? `${rep.activeClass} border-current`
                    : 'bg-card border-border text-muted-foreground hover:bg-muted'
                }`}
              >
                <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold ${rep.avatarClass}`}>
                  {rep.initials}
                </span>
                {rep.name}
              </button>
            ))}
          </div>
        </div>

        {/* Metric filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium">Show</span>
          <SegmentedControl
            options={[{ label: 'All', value: 'all' }, { label: 'Calls', value: 'calls' }, { label: 'Emails', value: 'emails' }]}
            value={metricFilter}
            onChange={setMetricFilter}
          />
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard title="Total Calls" value={metricFilter === 'emails' ? 0 : totalCalls} icon={Phone} />
        <MetricCard title="Total Emails" value={metricFilter === 'calls' ? 0 : totalEmails} icon={Mail} />
        <MetricCard title="Companies Touched" value={companiesContacted} icon={Building2} />
        <MetricCard title="Total Activities" value={metricFilter === 'calls' ? totalCalls : metricFilter === 'emails' ? totalEmails : totalActivities} icon={Activity} />
      </div>

      {/* ── Rep breakdown ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {repBreakdown.map(rep => (
          <Card key={rep.name} className={`border ${repFilter === rep.name ? 'ring-1 ring-current ' + rep.activeClass : ''}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${rep.avatarClass}`}>
                  {rep.initials}
                </span>
                <span className="font-medium text-sm">{rep.name}</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                    <Phone className="w-3 h-3" /> Calls
                  </p>
                  <p className="text-xl font-semibold">{rep.calls}</p>
                </div>
                <div className="rounded-lg bg-muted/40 px-3 py-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mb-0.5">
                    <Mail className="w-3 h-3" /> Emails
                  </p>
                  <p className="text-xl font-semibold">{rep.emails}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Chart ── */}
      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No activity matches these filters</p>
            <p className="text-xs mt-1">Try a different date range or rep, or log activity below.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base font-semibold">Activity Over Time</CardTitle>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Chart type */}
                <div className="flex rounded-lg overflow-hidden border border-border">
                  <button
                    onClick={() => setChartType('bar')}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${chartType === 'bar' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    <BarChart2 className="w-3 h-3" /> Bar
                  </button>
                  <button
                    onClick={() => setChartType('line')}
                    className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${chartType === 'line' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    <TrendingUp className="w-3 h-3" /> Line
                  </button>
                </div>
                {/* Period */}
                <SegmentedControl
                  options={[{ label: 'Daily', value: 'daily' }, { label: 'Weekly', value: 'weekly' }]}
                  value={period}
                  onChange={setPeriod}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  {commonAxisProps.xAxis}
                  {commonAxisProps.yAxis}
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {metricFilter !== 'emails' && (
                    <Bar dataKey="calls" name="Calls" fill={colors.calls} radius={[4, 4, 0, 0]} />
                  )}
                  {metricFilter !== 'calls' && (
                    <Bar dataKey="emails" name="Emails" fill={colors.emails} radius={[4, 4, 0, 0]} />
                  )}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  {commonAxisProps.xAxis}
                  {commonAxisProps.yAxis}
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  {metricFilter !== 'emails' && (
                    <Line type="monotone" dataKey="calls" name="Calls" stroke={colors.calls} strokeWidth={2} dot={{ r: 3, fill: colors.calls }} activeDot={{ r: 5 }} />
                  )}
                  {metricFilter !== 'calls' && (
                    <Line type="monotone" dataKey="emails" name="Emails" stroke={colors.emails} strokeWidth={2} dot={{ r: 3, fill: colors.emails }} activeDot={{ r: 5 }} />
                  )}
                </LineChart>
              )}
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* ── Bulk Activity Log ── */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Log Bulk Activity</CardTitle>
            <Button size="sm" variant={showForm ? 'outline' : 'default'} onClick={() => setShowForm(v => !v)} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              {showForm ? 'Cancel' : 'Add Entry'}
            </Button>
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Date</label>
                <input
                  type="date" max={todayISO} value={formDate}
                  onChange={e => setFormDate(e.target.value)}
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Rep</label>
                <div className="flex gap-2">
                  {REPS.map(rep => (
                    <button key={rep.name} type="button" onClick={() => setFormRep(rep.name)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        formRep === rep.name ? `${rep.activeClass} border-current` : 'bg-muted/50 border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`}>{rep.initials}</span>
                      {rep.name}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> Calls made</label>
                <input type="number" min={0} value={formCalls || ''} onChange={e => setFormCalls(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> Emails sent</label>
                <input type="number" min={0} value={formEmails || ''} onChange={e => setFormEmails(Math.max(0, parseInt(e.target.value) || 0))} placeholder="0"
                  className="w-full h-9 rounded-lg border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Note (optional)</label>
              <textarea value={formNote} onChange={e => setFormNote(e.target.value)}
                placeholder="e.g. Cold calls from HubSpot — water treatment vertical" rows={2}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none"
              />
            </div>
            <div className="flex justify-end">
              <Button size="sm" onClick={handleAddEntry} disabled={saving || formCalls + formEmails === 0}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Save Activity
              </Button>
            </div>
          </CardContent>
        )}

        {logEntries.length > 0 && (
          <CardContent className={showForm ? 'pt-0 border-t border-border' : 'pt-0'}>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Previously Logged</p>
            {logLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /></div>
            ) : (
              <div className="space-y-2">
                {logEntries.map(entry => {
                  const rep = getRepConfig(entry.loggedBy);
                  const d = parseDate(entry.date);
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
                                <Phone className="w-3 h-3" />{entry.calls} call{entry.calls !== 1 ? 's' : ''}
                              </span>
                            )}
                            {entry.emails > 0 && (
                              <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-chart-2/10 text-chart-2">
                                <Mail className="w-3 h-3" />{entry.emails} email{entry.emails !== 1 ? 's' : ''}
                              </span>
                            )}
                          </div>
                          {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                        </div>
                      </div>
                      <button onClick={() => handleDelete(entry.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
};

export default ActivityDashboard;
