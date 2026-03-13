import { useMemo, useState } from 'react';
import DateRangeFilter, { DateRange } from '@/components/crm/DateRangeFilter';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrders } from '@/context/OrdersContext';
import { formatCurrency } from '@/data/orders';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { TrendingUp, Package, Users } from 'lucide-react';

// Parse date string (M/D/YYYY) to Date object
const parseDate = (dateStr: string): Date | null => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  if (parts.length !== 3) return null;
  const [month, day, year] = parts.map(Number);
  if (isNaN(month) || isNaN(day) || isNaN(year)) return null;
  return new Date(year, month - 1, day);
};

// Format month for display
const formatMonth = (year: number, month: number): string => {
  const date = new Date(year, month);
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
};

// Colors for charts
const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
  '#8884d8',
  '#82ca9d',
  '#ffc658',
  '#ff7300',
  '#00C49F',
];

const OrdersReportingDashboard = () => {
  const { orders } = useOrders();
  const [dateRange, setDateRange] = useState<DateRange>({ from: undefined, to: undefined });

  // Filter orders by date range
  const filteredOrders = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return orders;
    return orders.filter(order => {
      const date = parseDate(order.placed);
      if (!date) return false;
      if (dateRange.from && date < dateRange.from) return false;
      if (dateRange.to) {
        const endOfDay = new Date(dateRange.to);
        endOfDay.setHours(23, 59, 59, 999);
        if (date > endOfDay) return false;
      }
      return true;
    });
  }, [orders, dateRange]);

  // Revenue by month - show all months between first and last order
  const revenueByMonth = useMemo(() => {
    const monthMap = new Map<string, { year: number; month: number; revenue: number; units: number }>();
    
    // Find date range from orders
    let minDate: Date | null = null;
    let maxDate: Date | null = null;
    
    filteredOrders.forEach(order => {
      const date = parseDate(order.placed);
      if (!date) return;
      
      if (!minDate || date < minDate) minDate = date;
      if (!maxDate || date > maxDate) maxDate = date;
      
      const key = `${date.getFullYear()}-${date.getMonth()}`;
      const existing = monthMap.get(key) || { year: date.getFullYear(), month: date.getMonth(), revenue: 0, units: 0 };
      existing.revenue += order.totalValue;
      existing.units += order.units;
      monthMap.set(key, existing);
    });

    // If no orders with dates, return empty
    if (!minDate || !maxDate) return [];

    // Generate all months between min and max date
    const result: { name: string; revenue: number; units: number }[] = [];
    const current = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const end = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    
    while (current <= end) {
      const key = `${current.getFullYear()}-${current.getMonth()}`;
      const data = monthMap.get(key);
      result.push({
        name: formatMonth(current.getFullYear(), current.getMonth()),
        revenue: data?.revenue || 0,
        units: data?.units || 0,
      });
      current.setMonth(current.getMonth() + 1);
    }

    return result;
  }, [filteredOrders]);

  // Revenue by product model
  const revenueByProduct = useMemo(() => {
    const productMap = new Map<string, { revenue: number; units: number }>();
    
    filteredOrders.forEach(order => {
      order.modelItems.forEach(item => {
        const key = item.modelName;
        const existing = productMap.get(key) || { revenue: 0, units: 0 };
        // Estimate revenue per item (total / units * item quantity)
        const itemRevenue = order.units > 0 ? (order.totalValue / order.units) * item.quantity : 0;
        existing.revenue += itemRevenue;
        existing.units += item.quantity;
        productMap.set(key, existing);
      });
    });

    return Array.from(productMap.entries())
      .map(([name, data]) => ({
        name,
        revenue: Math.round(data.revenue),
        units: data.units,
      }))
      .sort((a, b) => b.revenue - a.revenue);
  }, [filteredOrders]);

  // Revenue by customer
  const revenueByCustomer = useMemo(() => {
    const customerMap = new Map<string, { revenue: number; orders: number; units: number }>();
    
    filteredOrders.forEach(order => {
      const key = order.customer;
      const existing = customerMap.get(key) || { revenue: 0, orders: 0, units: 0 };
      existing.revenue += order.totalValue;
      existing.orders += 1;
      existing.units += order.units;
      customerMap.set(key, existing);
    });

    return Array.from(customerMap.entries())
      .map(([name, data]) => ({
        name,
        revenue: data.revenue,
        orders: data.orders,
        units: data.units,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10); // Top 10 customers
  }, [orders]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalRevenue = orders.reduce((sum, o) => sum + o.totalValue, 0);
    const currentDate = new Date();
    const currentMonth = orders.filter(o => {
      const date = parseDate(o.placed);
      return date && date.getMonth() === currentDate.getMonth() && date.getFullYear() === currentDate.getFullYear();
    }).reduce((sum, o) => sum + o.totalValue, 0);
    
    const lastMonth = orders.filter(o => {
      const date = parseDate(o.placed);
      if (!date) return false;
      const lastMonthDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 1);
      return date.getMonth() === lastMonthDate.getMonth() && date.getFullYear() === lastMonthDate.getFullYear();
    }).reduce((sum, o) => sum + o.totalValue, 0);

    return { totalRevenue, currentMonth, lastMonth };
  }, [orders]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border rounded-lg shadow-lg p-3">
          <p className="font-medium">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: {(() => {
                const isRevenue =
                  entry?.dataKey === 'revenue' ||
                  (typeof entry?.name === 'string' && entry.name.toLowerCase().includes('revenue'));

                return isRevenue ? formatCurrency(Number(entry.value) || 0) : entry.value;
              })()}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="flex justify-end">
        <DateRangeFilter value={dateRange} onChange={setDateRange} />
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-stage-closed/10 to-transparent border-stage-closed/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Revenue</CardTitle>
            <div className="h-8 w-8 rounded-full bg-stage-closed/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-stage-closed" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stage-closed">{formatCurrency(summaryStats.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground mt-1">All time</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-stage-quotes/10 to-transparent border-stage-quotes/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">This Month</CardTitle>
            <div className="h-8 w-8 rounded-full bg-stage-quotes/20 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-stage-quotes" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stage-quotes">{formatCurrency(summaryStats.currentMonth)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summaryStats.lastMonth > 0 
                ? `vs ${formatCurrency(summaryStats.lastMonth)} last month`
                : 'No data last month'}
            </p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-stage-contact/10 to-transparent border-stage-contact/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unique Customers</CardTitle>
            <div className="h-8 w-8 rounded-full bg-stage-contact/20 flex items-center justify-center">
              <Users className="h-4 w-4 text-stage-contact" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-stage-contact">{revenueByCustomer.length}</div>
            <p className="text-xs text-muted-foreground mt-1">With revenue</p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Month */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Revenue by Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByMonth} margin={{ top: 10, right: 30, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="name" 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis 
                    tick={{ fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                    tickFormatter={(value) => formatCurrency(value)}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--stage-closed))" 
                    radius={[4, 4, 0, 0]}
                    name="Revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Revenue by Product Model */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Revenue by Product
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={revenueByProduct}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="revenue"
                  >
                    {revenueByProduct.map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top Customers by Revenue
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  data={revenueByCustomer} 
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis 
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}`}
                  />
                  <YAxis 
                    type="category"
                    dataKey="name" 
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    width={75}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar 
                    dataKey="revenue" 
                    fill="hsl(var(--stage-contact))" 
                    radius={[0, 4, 4, 0]}
                    name="Revenue"
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OrdersReportingDashboard;
