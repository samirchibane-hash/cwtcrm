import { useMemo, useState } from 'react';
import { useProspects } from '@/context/ProspectsContext';
import MetricCard from '@/components/crm/MetricCard';
import { Phone, Mail, Building2, Activity } from 'lucide-react';
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

// Parse M/D/YYYY or any date string into a Date
const parseEngagementDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  // Try M/D/YYYY
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

const formatMonth = (year: number, month: number) =>
  new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

type Period = 'monthly' | 'weekly';

const ActivityDashboard = () => {
  const { prospects } = useProspects();
  const [period, setPeriod] = useState<Period>('monthly');

  // Flatten all engagements with prospect info
  const allEngagements = useMemo(() => {
    return prospects.flatMap(p =>
      p.engagements.map(e => ({ ...e, prospectId: p.id, companyName: p.companyName }))
    );
  }, [prospects]);

  // Summary metrics
  const totalCalls = useMemo(
    () => allEngagements.reduce((sum, e) => sum + (e.activity?.calls || 0), 0),
    [allEngagements]
  );
  const totalEmails = useMemo(
    () => allEngagements.reduce((sum, e) => sum + (e.activity?.emails || 0), 0),
    [allEngagements]
  );
  const companiesContacted = useMemo(() => {
    const ids = new Set(
      allEngagements
        .filter(e => (e.activity?.calls || 0) + (e.activity?.emails || 0) > 0)
        .map(e => e.prospectId)
    );
    return ids.size;
  }, [allEngagements]);
  const totalActivities = totalCalls + totalEmails;

  // Activity over time chart data
  const timeChartData = useMemo(() => {
    if (period === 'monthly') {
      const map = new Map<string, { label: string; year: number; month: number; calls: number; emails: number }>();
      allEngagements.forEach(e => {
        const calls = e.activity?.calls || 0;
        const emails = e.activity?.emails || 0;
        if (calls + emails === 0) return;
        const d = parseEngagementDate(e.date);
        if (!d) return;
        const key = `${d.getFullYear()}-${d.getMonth()}`;
        const existing = map.get(key) || { label: formatMonth(d.getFullYear(), d.getMonth()), year: d.getFullYear(), month: d.getMonth(), calls: 0, emails: 0 };
        map.set(key, { ...existing, calls: existing.calls + calls, emails: existing.emails + emails });
      });
      return Array.from(map.values())
        .sort((a, b) => a.year !== b.year ? a.year - b.year : a.month - b.month)
        .map(({ label, calls, emails }) => ({ label, calls, emails }));
    } else {
      // Weekly
      const map = new Map<string, { label: string; weekStart: Date; calls: number; emails: number }>();
      allEngagements.forEach(e => {
        const calls = e.activity?.calls || 0;
        const emails = e.activity?.emails || 0;
        if (calls + emails === 0) return;
        const d = parseEngagementDate(e.date);
        if (!d) return;
        const dayOfWeek = d.getDay();
        const weekStart = new Date(d);
        weekStart.setDate(d.getDate() - dayOfWeek);
        const key = weekStart.toISOString().slice(0, 10);
        const label = weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const existing = map.get(key) || { label, weekStart, calls: 0, emails: 0 };
        map.set(key, { ...existing, calls: existing.calls + calls, emails: existing.emails + emails });
      });
      return Array.from(map.values())
        .sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime())
        .map(({ label, calls, emails }) => ({ label, calls, emails }));
    }
  }, [allEngagements, period]);

  // Activity by company (top 10)
  const companyChartData = useMemo(() => {
    const map = new Map<string, { company: string; calls: number; emails: number; total: number }>();
    allEngagements.forEach(e => {
      const calls = e.activity?.calls || 0;
      const emails = e.activity?.emails || 0;
      if (calls + emails === 0) return;
      const existing = map.get(e.prospectId) || { company: e.companyName, calls: 0, emails: 0, total: 0 };
      map.set(e.prospectId, {
        ...existing,
        calls: existing.calls + calls,
        emails: existing.emails + emails,
        total: existing.total + calls + emails,
      });
    });
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [allEngagements]);

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

      {!hasData ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No activity logged yet</p>
            <p className="text-xs mt-1">Open a company and log calls or emails in the "Log Activity" panel.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Activity over time */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Activity Over Time</CardTitle>
                <div className="flex gap-1 rounded-lg overflow-hidden border border-border">
                  <button
                    onClick={() => setPeriod('monthly')}
                    className={`px-3 py-1 text-xs font-medium transition-colors ${period === 'monthly' ? 'bg-accent text-accent-foreground' : 'bg-card text-muted-foreground hover:bg-muted'}`}
                  >
                    Monthly
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
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={timeChartData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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

          {/* Activity by Company */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base font-semibold">Activity by Company (Top 10)</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={companyChartData} layout="vertical" margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <YAxis
                    type="category"
                    dataKey="company"
                    width={110}
                    tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(v: string) => v.length > 14 ? v.slice(0, 13) + '…' : v}
                  />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="calls" name="Calls" fill="hsl(var(--chart-1))" radius={[0, 4, 4, 0]} stackId="a" />
                  <Bar dataKey="emails" name="Emails" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
};

export default ActivityDashboard;
