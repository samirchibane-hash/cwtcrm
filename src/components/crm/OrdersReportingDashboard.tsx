import { useMemo, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { format, isValid, parseISO } from 'date-fns';
import DateRangeFilter, { DateRange, getYTDRange } from '@/components/crm/DateRangeFilter';
import { useOrders } from '@/context/OrdersContext';
import { formatCurrency } from '@/data/orders';
import { parseDateLoose } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowDown, ArrowUp, BarChart2 } from 'lucide-react';

const formatMonth = (year: number, month: number): string =>
  new Date(year, month).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

const compactCurrency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 1 });

const LIST_LIMIT = 8;

// Ranked list with an inline magnitude bar: easier to read and compare than a pie
const RankedList = ({ title, rows, valueLabel, metaLabel }: {
  title: string;
  rows: { key: string; name: React.ReactNode; value: number; meta: string }[];
  valueLabel: string;
  metaLabel: string;
}) => {
  const [expanded, setExpanded] = useState(false);
  const max = rows[0]?.value || 1;
  const visible = expanded ? rows : rows.slice(0, LIST_LIMIT);
  return (
    <section className="content-card" aria-label={title}>
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3 pb-2">
        <h2 className="text-sm font-semibold">{title}</h2>
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground">{metaLabel} · {valueLabel}</span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 pb-6 pt-2 text-sm text-muted-foreground">Nothing in this date range.</p>
      ) : (
        <>
          <ol className="divide-y divide-border border-t border-border">
            {visible.map((row, i) => (
              <li key={row.key} className="relative px-4 py-2">
                <div className="relative flex items-center gap-3 text-sm">
                  <span className="w-5 shrink-0 text-xs text-muted-foreground tabular-nums">{i + 1}</span>
                  <span className="min-w-0 flex-1 truncate font-medium">{row.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground tabular-nums">{row.meta}</span>
                  <span className="w-24 shrink-0 text-right font-mono tabular-nums">{formatCurrency(row.value)}</span>
                </div>
                <div className="ml-8 mt-1 h-1 rounded-full bg-muted" aria-hidden="true">
                  <div className="h-1 rounded-full bg-chart-1" style={{ width: `${Math.max(2, (row.value / max) * 100)}%` }} />
                </div>
              </li>
            ))}
          </ol>
          {rows.length > LIST_LIMIT && (
            <div className="border-t border-border px-4 py-2">
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setExpanded(v => !v)} aria-expanded={expanded}>
                {expanded ? 'Show top 8' : `Show all ${rows.length}`}
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
};

const OrdersReportingDashboard = () => {
  const { orders, isLoading } = useOrders();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  // Range lives in the URL: ?range=all, or ?from=&to=; absent means year to date
  const dateRange: DateRange = useMemo(() => {
    if (searchParams.get('range') === 'all') return { from: undefined, to: undefined };
    const from = searchParams.get('from') ? parseISO(searchParams.get('from')!) : undefined;
    const to = searchParams.get('to') ? parseISO(searchParams.get('to')!) : undefined;
    if ((from && isValid(from)) || (to && isValid(to))) {
      return { from: from && isValid(from) ? from : undefined, to: to && isValid(to) ? to : undefined };
    }
    return getYTDRange();
  }, [searchParams]);

  const setDateRange = (range: DateRange) => {
    const next = new URLSearchParams(searchParams);
    ['range', 'from', 'to'].forEach(k => next.delete(k));
    if (!range.from && !range.to) next.set('range', 'all');
    else {
      if (range.from) next.set('from', format(range.from, 'yyyy-MM-dd'));
      if (range.to) next.set('to', format(range.to, 'yyyy-MM-dd'));
    }
    setSearchParams(next, { replace: true });
  };

  const datedOrders = useMemo(
    () => orders.map(o => ({ order: o, date: parseDateLoose(o.placed) })),
    [orders],
  );

  const filteredOrders = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return orders;
    const end = dateRange.to ? new Date(dateRange.to) : null;
    end?.setHours(23, 59, 59, 999);
    return datedOrders
      .filter(({ date }) => !!date && (!dateRange.from || date >= dateRange.from) && (!end || date <= end))
      .map(({ order }) => order);
  }, [orders, datedOrders, dateRange]);

  // Revenue by month - every month between first and last order, gaps included
  const revenueByMonth = useMemo(() => {
    const monthMap = new Map<string, number>();
    let minDate: Date | null = null;
    let maxDate: Date | null = null;

    filteredOrders.forEach(order => {
      const date = parseDateLoose(order.placed);
      if (!date) return;
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      monthMap.set(key, (monthMap.get(key) ?? 0) + order.totalValue);
    });

    if (!minDate || !maxDate) return [];
    const result: { name: string; revenue: number }[] = [];
    const current = new Date((minDate as Date).getFullYear(), (minDate as Date).getMonth(), 1);
    const end = new Date((maxDate as Date).getFullYear(), (maxDate as Date).getMonth(), 1);
    while (current <= end) {
      result.push({
        name: formatMonth(current.getFullYear(), current.getMonth()),
        revenue: monthMap.get(`${current.getFullYear()}-${current.getMonth()}`) ?? 0,
      });
      current.setMonth(current.getMonth() + 1);
    }
    return result;
  }, [filteredOrders]);

  // Revenue by product model (order total split evenly across its units)
  const revenueByProduct = useMemo(() => {
    const productMap = new Map<string, { revenue: number; units: number }>();
    filteredOrders.forEach(order => {
      order.modelItems.forEach(item => {
        const existing = productMap.get(item.modelName) || { revenue: 0, units: 0 };
        existing.revenue += order.units > 0 ? (order.totalValue / order.units) * item.quantity : 0;
        existing.units += item.quantity;
        productMap.set(item.modelName, existing);
      });
    });
    return Array.from(productMap.entries())
      .map(([name, data]) => ({ name, revenue: Math.round(data.revenue), units: data.units }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Revenue by customer (all of them; the list caps what it shows)
  const revenueByCustomer = useMemo(() => {
    const customerMap = new Map<string, { revenue: number; orders: number; companyId?: string }>();
    filteredOrders.forEach(order => {
      const existing = customerMap.get(order.customer) || { revenue: 0, orders: 0, companyId: order.companyId };
      existing.revenue += order.totalValue;
      existing.orders += 1;
      existing.companyId = existing.companyId || order.companyId;
      customerMap.set(order.customer, existing);
    });
    return Array.from(customerMap.entries())
      .map(([name, data]) => ({ name, ...data }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  const summary = useMemo(() => {
    const revenue = filteredOrders.reduce((sum, o) => sum + o.totalValue, 0);
    const units = filteredOrders.reduce((sum, o) => sum + o.units, 0);
    const paidOrders = filteredOrders.filter(o => o.totalValue > 0);
    return {
      revenue,
      units,
      orders: filteredOrders.length,
      customers: revenueByCustomer.filter(c => c.revenue > 0).length,
      avgOrder: paidOrders.length ? revenue / paidOrders.length : 0,
    };
  }, [filteredOrders, revenueByCustomer]);

  // Month-over-month always uses all orders, independent of the selected range
  const monthOverMonth = useMemo(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    let current = 0;
    let previous = 0;
    for (const { order, date } of datedOrders) {
      if (!date) continue;
      if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) current += order.totalValue;
      else if (date.getFullYear() === last.getFullYear() && date.getMonth() === last.getMonth()) previous += order.totalValue;
    }
    const change = previous > 0 ? ((current - previous) / previous) * 100 : null;
    return { current, previous, change };
  }, [datedOrders]);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading reports">
        <div className="flex justify-end"><Skeleton className="h-9 w-40 rounded-lg" /></div>
        <Skeleton className="h-[68px] w-full rounded-2xl" />
        <Skeleton className="h-[360px] w-full rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-[320px] rounded-2xl" />
          <Skeleton className="h-[320px] rounded-2xl" />
        </div>
      </div>
    );
  }

  const tiles = [
    { label: 'Revenue', value: formatCurrency(summary.revenue) },
    { label: 'Orders', value: summary.orders.toLocaleString() },
    { label: 'Units', value: summary.units.toLocaleString() },
    { label: 'Customers', value: summary.customers.toLocaleString() },
    { label: 'Avg order value', value: formatCurrency(Math.round(summary.avgOrder)) },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">Figures below follow the selected date range.</p>
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary */}
      <section aria-label="Summary" className="content-card grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-px bg-border">
        {tiles.map(tile => (
          <div key={tile.label} className="bg-card px-4 py-3 min-w-0">
            <div className="text-[11px] font-medium text-muted-foreground">{tile.label}</div>
            <div className="mt-1 truncate text-lg font-semibold leading-tight tabular-nums">{tile.value}</div>
          </div>
        ))}
        <div className="bg-card px-4 py-3 min-w-0">
          <div className="text-[11px] font-medium text-muted-foreground">This month</div>
          <div className="mt-1 truncate text-lg font-semibold leading-tight tabular-nums">{formatCurrency(monthOverMonth.current)}</div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
            {monthOverMonth.change === null ? (
              'No sales last month'
            ) : (
              <>
                {monthOverMonth.change >= 0
                  ? <ArrowUp className="h-3 w-3 text-success-foreground" aria-hidden="true" />
                  : <ArrowDown className="h-3 w-3 text-danger-foreground" aria-hidden="true" />}
                <span className={monthOverMonth.change >= 0 ? 'text-success-foreground' : 'text-danger-foreground'}>
                  {Math.abs(monthOverMonth.change).toFixed(0)}%
                </span>
                vs {compactCurrency.format(monthOverMonth.previous)} last month
              </>
            )}
          </div>
        </div>
      </section>

      {filteredOrders.length === 0 ? (
        <div className="content-card flex flex-col items-center gap-3 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <BarChart2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          <p className="text-sm text-muted-foreground">
            {orders.length === 0 ? 'No orders yet. Reports fill in as orders are logged.' : 'No orders in this date range.'}
          </p>
          {orders.length > 0 && (
            <Button variant="outline" size="sm" onClick={() => setDateRange({ from: undefined, to: undefined })}>Show all time</Button>
          )}
        </div>
      ) : (
        <>
          {/* Revenue by month */}
          <section className="content-card" aria-labelledby="rev-month-heading">
            <h2 id="rev-month-heading" className="px-4 pt-3 pb-2 text-sm font-semibold">Revenue by month</h2>
            <div className="h-[300px] px-2 pb-3">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickLine={false} axisLine={{ stroke: 'hsl(var(--border))' }} />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tickFormatter={(value: number) => compactCurrency.format(value)}
                  />
                  <Tooltip
                    cursor={{ fill: 'hsl(var(--muted))', opacity: 0.5 }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                    contentStyle={{ background: 'hsl(var(--popover))', border: '1px solid hsl(var(--border))', borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
            <RankedList
              title="Top customers"
              metaLabel="Orders"
              valueLabel="Revenue"
              rows={revenueByCustomer.map(c => ({
                key: c.name,
                value: c.revenue,
                meta: `${c.orders} order${c.orders !== 1 ? 's' : ''}`,
                name: c.companyId ? (
                  <Link
                    to={`/company/${c.companyId}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    className="rounded hover:text-accent hover:underline outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {c.name}
                  </Link>
                ) : c.name,
              }))}
            />
            <RankedList
              title="Revenue by product"
              metaLabel="Units"
              valueLabel="Est. revenue"
              rows={revenueByProduct.map(p => ({ key: p.name, name: p.name, value: p.revenue, meta: `${p.units.toLocaleString()} units` }))}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default OrdersReportingDashboard;
