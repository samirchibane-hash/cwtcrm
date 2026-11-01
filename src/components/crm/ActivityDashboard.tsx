import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProspects } from '@/context/ProspectsContext';
import { useActivityLog, type ActivityLogEntry } from '@/hooks/useActivityLog';
import { REPS, getRepConfig } from '@/data/prospects';
import { Phone, Mail, Linkedin, Activity, Plus, Trash2, Loader2, BarChart2, TrendingUp } from 'lucide-react';
import {
  BarChart, Bar,
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
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
type MetricFilter = 'all' | 'calls' | 'emails' | 'linkedin';
type ChartType = 'bar' | 'line';
type Period = 'daily' | 'weekly';

const DATE_RANGES: { label: string; value: DateRange }[] = [
  { label: '7D', value: '7d' },
  { label: '30D', value: '30d' },
  { label: '90D', value: '90d' },
  { label: 'All', value: 'all' },
];
const METRICS: { label: string; value: MetricFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Calls', value: 'calls' },
  { label: 'Emails', value: 'emails' },
  { label: 'LinkedIn', value: 'linkedin' },
];

// Categorical chart slots (see --chart-* in index.css). Colour follows the entity:
// reps keep their slot in REPS order; metrics keep theirs in Calls/Emails/LinkedIn order.
const SERIES_COLORS = ['hsl(var(--chart-1))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))'];
const repColor = (name: string) => SERIES_COLORS[Math.max(0, REPS.findIndex(r => r.name === name)) % SERIES_COLORS.length];
const METRIC_SERIES = [
  { key: 'Calls', metric: 'calls', color: SERIES_COLORS[0] },
  { key: 'Emails', metric: 'emails', color: SERIES_COLORS[1] },
  { key: 'LinkedIn', metric: 'linkedin', color: SERIES_COLORS[2] },
] as const;

const pick = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;

function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex rounded-lg border border-border bg-card p-0.5">
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          aria-pressed={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            'h-7 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === opt.value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

// ── component ─────────────────────────────────────────────────────────────────

const ActivityDashboard = () => {
  const { prospects, isLoading: prospectsLoading } = useProspects();
  const { entries: logEntries, isLoading: logLoading, addEntry, deleteEntry } = useActivityLog();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  // Chart/filter state lives in the URL so a view can be shared
  const dateRange = pick(searchParams.get('range'), ['7d', '30d', '90d', 'all'] as const, 'all');
  const repFilter = REPS.some(r => r.name === searchParams.get('rep')) ? searchParams.get('rep')! : 'all';
  const metricFilter = pick(searchParams.get('metric'), ['all', 'calls', 'emails', 'linkedin'] as const, 'all');
  const chartType = pick(searchParams.get('chart'), ['bar', 'line'] as const, 'bar');
  const period = pick(searchParams.get('period'), ['daily', 'weekly'] as const, 'daily');

  const setParam = (key: string, value: string, defaultValue: string) => {
    const next = new URLSearchParams(searchParams);
    if (value === defaultValue) next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  // Bulk log form state
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState(todayISO);
  const [formRep, setFormRep] = useState<string>('Samir');
  const [formCalls, setFormCalls] = useState<number>(0);
  const [formEmails, setFormEmails] = useState<number>(0);
  const [formLinkedIn, setFormLinkedIn] = useState<number>(0);
  const [formNote, setFormNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [entryToDelete, setEntryToDelete] = useState<ActivityLogEntry | null>(null);

  const formTotal = formCalls + formEmails + formLinkedIn;

  const handleAddEntry = async () => {
    if (formTotal === 0) return;
    setSaving(true);
    const result = await addEntry({ date: formDate, loggedBy: formRep, calls: formCalls, emails: formEmails, linkedin: formLinkedIn, note: formNote.trim() || undefined });
    setSaving(false);
    if (result) {
      const parts = [formCalls > 0 && `${formCalls} calls`, formEmails > 0 && `${formEmails} emails`, formLinkedIn > 0 && `${formLinkedIn} LinkedIn`].filter(Boolean).join(', ');
      toast({ title: 'Activity logged', description: `Added ${parts} for ${formRep}.` });
      setFormCalls(0); setFormEmails(0); setFormLinkedIn(0); setFormNote(''); setShowForm(false);
    } else {
      toast({ title: 'Couldn’t save activity', description: 'Check your connection and try again.', variant: 'destructive' });
    }
  };

  const handleDelete = async (entry: ActivityLogEntry) => {
    const ok = await deleteEntry(entry.id);
    toast(ok
      ? { title: 'Entry deleted' }
      : { title: 'Couldn’t delete entry', description: 'Check your connection and try again.', variant: 'destructive' });
  };

  // ── data ───────────────────────────────────────────────────────────────────

  // All activities with loggedBy (unattributed prospect engagements default to Samir)
  const allActivities = useMemo(() => [
    ...prospects.flatMap(p =>
      p.engagements.map(e => ({
        date: e.date,
        calls: e.activity?.calls || 0,
        emails: e.activity?.emails || 0,
        linkedin: e.activity?.linkedin || 0,
        loggedBy: e.loggedBy || 'Samir',
        prospectId: p.id as string | null,
      }))
    ),
    ...logEntries.map(e => ({
      date: e.date,
      calls: e.calls,
      emails: e.emails,
      linkedin: e.linkedin,
      loggedBy: e.loggedBy,
      prospectId: null as string | null,
    })),
  ], [prospects, logEntries]);

  const cutoffDate = useMemo(() => {
    if (dateRange === 'all') return null;
    const days = { '7d': 7, '30d': 30, '90d': 90 }[dateRange];
    const d = new Date();
    d.setDate(d.getDate() - days);
    d.setHours(0, 0, 0, 0);
    return d;
  }, [dateRange]);

  const inRange = useMemo(() => allActivities.filter(e => {
    if (!cutoffDate) return true;
    const d = parseDate(e.date);
    return !!d && d >= cutoffDate;
  }), [allActivities, cutoffDate]);

  const filtered = useMemo(
    () => (repFilter === 'all' ? inRange : inRange.filter(e => e.loggedBy === repFilter)),
    [inRange, repFilter],
  );

  // Totals always show real numbers; the metric filter only shapes the chart
  const totals = useMemo(() => {
    const t = { calls: 0, emails: 0, linkedin: 0 };
    for (const e of filtered) { t.calls += e.calls; t.emails += e.emails; t.linkedin += e.linkedin; }
    return t;
  }, [filtered]);
  const totalActivities = totals.calls + totals.emails + totals.linkedin;
  const companiesContacted = useMemo(
    () => new Set(filtered.filter(e => e.prospectId && (e.calls + e.emails + e.linkedin) > 0).map(e => e.prospectId!)).size,
    [filtered],
  );

  // Per-rep breakdown for the selected range (ignores the rep filter)
  const repBreakdown = useMemo(() => REPS.map(rep => {
    const mine = inRange.filter(e => e.loggedBy === rep.name);
    const calls = mine.reduce((s, e) => s + e.calls, 0);
    const emails = mine.reduce((s, e) => s + e.emails, 0);
    const linkedin = mine.reduce((s, e) => s + e.linkedin, 0);
    return { ...rep, calls, emails, linkedin, total: calls + emails + linkedin };
  }), [inRange]);

  const metricValue = (e: { calls: number; emails: number; linkedin: number }) =>
    metricFilter === 'calls' ? e.calls
      : metricFilter === 'emails' ? e.emails
      : metricFilter === 'linkedin' ? e.linkedin
      : e.calls + e.emails + e.linkedin;

  // Chart data, bucketed by period.
  // All reps: one series per rep. Single rep: one series per metric.
  const chartData = useMemo(() => {
    type Bucket = Record<string, number | string> & { label: string; sortKey: number };
    const map = new Map<string, Bucket>();

    filtered.forEach(e => {
      if (e.calls + e.emails + e.linkedin === 0) return;
      const d = parseDate(e.date);
      if (!d) return;

      const start = new Date(d);
      if (period === 'weekly') start.setDate(d.getDate() - d.getDay());
      const key = start.toISOString().slice(0, 10);
      const bucket: Bucket = map.get(key) ?? {
        label: start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sortKey: start.getTime(),
      };

      if (repFilter === 'all') {
        const value = metricValue(e);
        if (value > 0) bucket[e.loggedBy] = ((bucket[e.loggedBy] as number) || 0) + value;
      } else {
        for (const s of METRIC_SERIES) {
          if (metricFilter !== 'all' && metricFilter !== s.metric) continue;
          const value = e[s.metric];
          if (value > 0) bucket[s.key] = ((bucket[s.key] as number) || 0) + value;
        }
      }
      map.set(key, bucket);
    });

    return Array.from(map.values()).sort((a, b) => a.sortKey - b.sortKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, period, repFilter, metricFilter]);

  const series = repFilter === 'all'
    ? REPS.map(rep => ({ key: rep.name as string, color: repColor(rep.name) }))
    : METRIC_SERIES.filter(s => metricFilter === 'all' || metricFilter === s.metric).map(s => ({ key: s.key as string, color: s.color }));

  if (prospectsLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading activity">
        <Skeleton className="h-10 w-full max-w-xl rounded-lg" />
        <Skeleton className="h-[68px] w-full rounded-2xl" />
        <Skeleton className="h-[120px] w-full rounded-2xl" />
        <Skeleton className="h-[360px] w-full rounded-2xl" />
      </div>
    );
  }

  const axisTick = { fontSize: 11, fill: 'hsl(var(--muted-foreground))' };
  const tooltipProps = {
    contentStyle: { background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12, color: 'hsl(var(--popover-foreground))' },
    labelStyle: { color: 'hsl(var(--foreground))', fontWeight: 600 },
    itemStyle: { color: 'hsl(var(--foreground))' },
    cursor: { fill: 'hsl(var(--muted))', opacity: 0.5 },
  };

  return (
    <div className="space-y-4 animate-fade-in">

      {/* ── Filters (one row above everything they affect) ── */}
      <div className="flex flex-wrap items-center gap-2">
        <SegmentedControl label="Date range" options={DATE_RANGES} value={dateRange} onChange={v => setParam('range', v, 'all')} />
        <div role="group" aria-label="Rep" className="flex rounded-lg border border-border bg-card p-0.5">
          {[{ name: 'all', label: 'All reps' }, ...REPS.map(r => ({ name: r.name as string, label: r.name as string }))].map(opt => (
            <button
              key={opt.name}
              type="button"
              aria-pressed={repFilter === opt.name}
              onClick={() => setParam('rep', opt.name, 'all')}
              className={cn(
                'flex h-7 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                repFilter === opt.name ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {opt.name !== 'all' && <span className="h-2 w-2 rounded-full" style={{ background: repColor(opt.name) }} aria-hidden="true" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Totals ── */}
      <section aria-label="Totals" className="content-card grid grid-cols-2 sm:grid-cols-5 gap-px bg-border">
        {[
          { label: 'Calls', value: totals.calls, icon: Phone },
          { label: 'Emails', value: totals.emails, icon: Mail },
          { label: 'LinkedIn', value: totals.linkedin, icon: Linkedin },
          { label: 'Companies touched', value: companiesContacted },
          { label: 'Total activities', value: totalActivities },
        ].map((stat, i) => (
          <div key={stat.label} className={cn('bg-card px-4 py-3 min-w-0', i === 4 && 'col-span-2 sm:col-span-1')}>
            <div className="flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
              {stat.icon && <stat.icon className="h-3 w-3" aria-hidden="true" />}
              {stat.label}
            </div>
            <div className="mt-1 text-lg font-semibold leading-tight tabular-nums">{stat.value.toLocaleString()}</div>
          </div>
        ))}
      </section>

      {/* ── By rep (doubles as the table view of the chart) ── */}
      <section className="content-card overflow-x-auto" aria-labelledby="by-rep-heading">
        <h2 id="by-rep-heading" className="px-4 pt-3 pb-2 text-sm font-semibold">By rep</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground">
              <th scope="col" className="px-4 py-2 text-left font-semibold">Rep</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Calls</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Emails</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">LinkedIn</th>
              <th scope="col" className="px-4 py-2 text-right font-semibold">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border border-t border-border">
            {repBreakdown.map(rep => (
              <tr
                key={rep.name}
                className={cn('cursor-pointer transition-colors hover:bg-muted/30', repFilter === rep.name && 'bg-muted/40')}
                onClick={() => setParam('rep', repFilter === rep.name ? 'all' : rep.name, 'all')}
              >
                <th scope="row" className="px-4 py-2.5 text-left font-medium">
                  <span className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: repColor(rep.name) }} aria-hidden="true" />
                    {rep.name}
                  </span>
                </th>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{rep.calls.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{rep.emails.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono tabular-nums">{rep.linkedin.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-right font-mono font-semibold tabular-nums">{rep.total.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ── Chart ── */}
      <section className="content-card" aria-labelledby="activity-chart-heading">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
          <h2 id="activity-chart-heading" className="text-sm font-semibold">Activity over time</h2>
          <div className="flex items-center gap-2 flex-wrap">
            <SegmentedControl label="Metric" options={METRICS} value={metricFilter} onChange={v => setParam('metric', v, 'all')} />
            <SegmentedControl label="Period" options={[{ label: 'Daily', value: 'daily' as Period }, { label: 'Weekly', value: 'weekly' as Period }]} value={period} onChange={v => setParam('period', v, 'daily')} />
            <div role="group" aria-label="Chart type" className="flex rounded-lg border border-border bg-card p-0.5">
              {([['bar', BarChart2, 'Bar chart'], ['line', TrendingUp, 'Line chart']] as const).map(([value, Icon, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={chartType === value}
                  aria-label={label}
                  onClick={() => setParam('chart', value, 'bar')}
                  className={cn(
                    'flex h-7 w-8 items-center justify-center rounded-md transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    chartType === value ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <Activity className="w-8 h-8 mx-auto mb-3 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm text-muted-foreground">No activity in this range. Widen the date range or log activity below.</p>
            {dateRange !== 'all' && (
              <Button variant="outline" size="sm" className="mt-3" onClick={() => setParam('range', 'all', 'all')}>Show all time</Button>
            )}
          </div>
        ) : (
          <div className="px-2 pb-3">
            <ResponsiveContainer width="100%" height={300}>
              {chartType === 'bar' ? (
                <BarChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }} barCategoryGap="20%">
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipProps} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} iconType="circle" iconSize={8} />
                  {series.map(s => (
                    <Bar
                      key={s.key}
                      dataKey={s.key}
                      name={s.key}
                      fill={s.color}
                      // Stacked by rep; grouped by metric. A 2px card-colored stroke separates fills.
                      stackId={repFilter === 'all' ? 'rep' : undefined}
                      stroke="hsl(var(--card))"
                      strokeWidth={repFilter === 'all' ? 2 : 0}
                      radius={repFilter === 'all' ? 0 : [4, 4, 0, 0]}
                      maxBarSize={28}
                    />
                  ))}
                </BarChart>
              ) : (
                <LineChart data={chartData} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis tick={axisTick} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip {...tooltipProps} cursor={{ stroke: 'hsl(var(--muted-foreground))', strokeDasharray: '3 3' }} />
                  <Legend wrapperStyle={{ fontSize: 12, color: 'hsl(var(--muted-foreground))' }} iconType="circle" iconSize={8} />
                  {series.map(s => (
                    <Line
                      key={s.key}
                      type="monotone"
                      dataKey={s.key}
                      name={s.key}
                      stroke={s.color}
                      strokeWidth={2}
                      connectNulls
                      dot={{ r: 4, fill: s.color, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                      activeDot={{ r: 5, stroke: 'hsl(var(--card))', strokeWidth: 2 }}
                    />
                  ))}
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* ── Bulk activity log ── */}
      <section className="content-card" aria-labelledby="bulk-log-heading">
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
          <div>
            <h2 id="bulk-log-heading" className="text-sm font-semibold">Bulk activity log</h2>
            <p className="text-xs text-muted-foreground">Calls and emails not tied to a single company, e.g. a cold-calling block.</p>
          </div>
          {!showForm && (
            <Button size="sm" onClick={() => setShowForm(true)} className="gap-1.5 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              Add entry
            </Button>
          )}
        </div>

        {showForm && (
          <form
            className="px-4 py-4 space-y-4 border-b border-border"
            onSubmit={e => { e.preventDefault(); handleAddEntry(); }}
            onKeyDown={e => { if (e.key === 'Escape') setShowForm(false); }}
          >
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label htmlFor="bulk-date" className="text-xs text-muted-foreground">Date</Label>
                <Input id="bulk-date" type="date" max={todayISO} value={formDate} onChange={e => setFormDate(e.target.value)} className="h-9" autoFocus />
              </div>
              {([
                ['bulk-calls', 'Calls', Phone, formCalls, setFormCalls],
                ['bulk-emails', 'Emails', Mail, formEmails, setFormEmails],
                ['bulk-linkedin', 'LinkedIn', Linkedin, formLinkedIn, setFormLinkedIn],
              ] as const).map(([id, label, Icon, value, set]) => (
                <div key={id} className="space-y-1.5">
                  <Label htmlFor={id} className="text-xs text-muted-foreground flex items-center gap-1"><Icon className="w-3 h-3" aria-hidden="true" /> {label}</Label>
                  <Input id={id} type="number" min={0} inputMode="numeric" value={value || ''} placeholder="0" onChange={e => set(Math.max(0, parseInt(e.target.value) || 0))} className="h-9 tabular-nums" />
                </div>
              ))}
              <div className="space-y-1.5" role="radiogroup" aria-label="Rep">
                <span className="block text-xs font-medium text-muted-foreground">Rep</span>
                <div className="flex gap-1">
                  {REPS.map(rep => (
                    <button
                      key={rep.name}
                      type="button"
                      role="radio"
                      aria-checked={formRep === rep.name}
                      onClick={() => setFormRep(rep.name)}
                      title={rep.name}
                      className={cn(
                        'flex h-9 items-center gap-1.5 px-2 rounded-md text-xs font-medium border transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                        formRep === rep.name ? 'border-foreground/20 bg-muted text-foreground' : 'border-transparent text-muted-foreground hover:bg-muted/50',
                      )}
                    >
                      <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${rep.avatarClass}`} aria-hidden="true">{rep.initials}</span>
                      <span className="sr-only sm:not-sr-only">{rep.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="bulk-note" className="text-xs text-muted-foreground">Note (optional)</Label>
              <Textarea id="bulk-note" value={formNote} onChange={e => setFormNote(e.target.value)} placeholder="e.g. Cold calls from HubSpot — water treatment vertical" rows={2} className="resize-none" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit" size="sm" disabled={saving || formTotal === 0}>
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />}
                Save activity
              </Button>
            </div>
          </form>
        )}

        {logLoading ? (
          <div className="divide-y divide-border" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <Skeleton className="h-6 w-6 rounded-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : logEntries.length === 0 ? (
          !showForm && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Nothing logged in bulk yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {logEntries.map(entry => {
              const rep = getRepConfig(entry.loggedBy);
              const d = parseDate(entry.date);
              const dateLabel = d ? d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : entry.date;
              const chips = [
                entry.calls > 0 && { icon: Phone, label: `${entry.calls} call${entry.calls !== 1 ? 's' : ''}` },
                entry.emails > 0 && { icon: Mail, label: `${entry.emails} email${entry.emails !== 1 ? 's' : ''}` },
                entry.linkedin > 0 && { icon: Linkedin, label: `${entry.linkedin} LinkedIn` },
              ].filter(Boolean) as { icon: typeof Phone; label: string }[];
              return (
                <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-2.5 group">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${rep.avatarClass}`} aria-hidden="true">
                      {rep.initials}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-medium">{rep.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">{dateLabel}</span>
                        {chips.map(chip => (
                          <span key={chip.label} className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium">
                            <chip.icon className="w-3 h-3 text-muted-foreground" aria-hidden="true" />{chip.label}
                          </span>
                        ))}
                      </div>
                      {entry.note && <p className="text-xs text-muted-foreground mt-0.5">{entry.note}</p>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setEntryToDelete(entry)}
                    aria-label={`Delete ${rep.name}’s entry from ${dateLabel}`}
                    className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive opacity-100 lg:opacity-0 lg:group-hover:opacity-100 lg:focus-visible:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <AlertDialog open={!!entryToDelete} onOpenChange={open => { if (!open) setEntryToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this activity entry?</AlertDialogTitle>
            <AlertDialogDescription>
              {entryToDelete && `${getRepConfig(entryToDelete.loggedBy).name}’s entry from ${entryToDelete.date} is removed from all activity totals.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (entryToDelete) handleDelete(entryToDelete); setEntryToDelete(null); }}
            >
              Delete entry
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ActivityDashboard;
