import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Package, Download } from 'lucide-react';
import { exportToCSV } from '@/lib/export-csv';
import { parseDateLoose } from '@/lib/date';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ORDER_STATUSES, ORDER_STATUS_META, OPEN_ORDER_STATUSES, formatCurrency, getShipmentProgress, isOrderStatus } from '@/data/orders';
import OrderStatusBadge, { ShipmentProgressText } from './OrderStatusBadge';
import { useOrders } from '@/context/OrdersContext';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { keepLocalEscape } from '@/lib/escape-scope';
import OrderDetail from '@/components/OrderDetail';
import ProductModelsDialog from './ProductModelsDialog';
import AddOrderDialog from './AddOrderDialog';
import SortableTh, { type SortDirection } from './SortableTh';

type OrderSortField = 'id' | 'customer' | 'placed' | 'units' | 'modelType' | 'totalValue' | 'status';
const NONE_VALUE = '__none__';
// Virtual status: everything not yet delivered (see OPEN_ORDER_STATUSES)
const OPEN_VALUE = 'open';

const OrdersTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  // Unknown values (e.g. old links to the retired "PO/Invoice" status) fall back to all statuses
  const [statusFilter, setStatusFilter] = useState<string>(() => {
    const status = searchParams.get('status');
    if (status === OPEN_VALUE) return OPEN_VALUE;
    return isOrderStatus(status) ? status : NONE_VALUE;
  });
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const { orders, isLoading } = useOrders();

  // Initialize sort state from URL params
  const [sortField, setSortField] = useState<OrderSortField | null>(() => {
    const field = searchParams.get('sortField');
    if (field && ['id', 'customer', 'placed', 'units', 'modelType', 'totalValue', 'status'].includes(field)) {
      return field as OrderSortField;
    }
    return null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('sortDir');
    if (dir === 'asc' || dir === 'desc') return dir;
    return null;
  });

  // Sync all filter/sort state to URL
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
    
    if (searchTerm) newParams.set('q', searchTerm);
    else newParams.delete('q');
    
    if (statusFilter && statusFilter !== NONE_VALUE) newParams.set('status', statusFilter);
    else newParams.delete('status');
    
    if (sortField && sortDirection) {
      newParams.set('sortField', sortField);
      newParams.set('sortDir', sortDirection);
    } else {
      newParams.delete('sortField');
      newParams.delete('sortDir');
    }
    if (newParams.toString() !== searchParams.toString()) {
      setSearchParams(newParams, { replace: true });
    }
  }, [searchTerm, statusFilter, sortField, sortDirection, searchParams, setSearchParams]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalUnits = orders.reduce((sum, o) => sum + o.units, 0);
    const totalValue = orders.reduce((sum, o) => sum + o.totalValue, 0);
    const delivered = orders.filter(o => o.status === 'Delivered').length;
    const pending = orders.filter(o => OPEN_ORDER_STATUSES.includes(o.status)).length;
    return { totalOrders, totalUnits, totalValue, delivered, pending };
  }, [orders]);

  const handleSort = (field: OrderSortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortProps = { sortField, sortDirection, onSort: handleSort };

  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((order) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        order.customer.toLowerCase().includes(term) ||
        order.modelType.toLowerCase().includes(term) ||
        (order.poNumber ?? '').toLowerCase().includes(term);
      const matchesStatus =
        statusFilter === NONE_VALUE ||
        (statusFilter === OPEN_VALUE ? OPEN_ORDER_STATUSES.includes(order.status) : order.status === statusFilter);
      return matchesSearch && matchesStatus;
    });

    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sortField) {
          case 'id':
            aVal = a.id.toLowerCase();
            bVal = b.id.toLowerCase();
            break;
          case 'customer':
            aVal = a.customer.toLowerCase();
            bVal = b.customer.toLowerCase();
            break;
          case 'placed':
            aVal = parseDateLoose(a.placed)?.getTime() ?? 0;
            bVal = parseDateLoose(b.placed)?.getTime() ?? 0;
            break;
          case 'units':
            aVal = a.units;
            bVal = b.units;
            break;
          case 'modelType':
            aVal = a.modelType.toLowerCase();
            bVal = b.modelType.toLowerCase();
            break;
          case 'totalValue':
            aVal = a.totalValue;
            bVal = b.totalValue;
            break;
          case 'status':
            // Lifecycle order (PO Received → Delivered), not alphabetical
            aVal = ORDER_STATUSES.indexOf(a.status);
            bVal = ORDER_STATUSES.indexOf(b.status);
            break;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    } else {
      // Default: most recent order dates first
      result = [...result].sort(
        (a, b) =>
          (parseDateLoose(b.placed)?.getTime() ?? 0) -
          (parseDateLoose(a.placed)?.getTime() ?? 0)
      );
    }

    return result;
  }, [orders, searchTerm, statusFilter, sortField, sortDirection]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { [NONE_VALUE]: orders.length, [OPEN_VALUE]: 0 };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] ?? 0) + 1;
      if (OPEN_ORDER_STATUSES.includes(o.status)) counts[OPEN_VALUE] += 1;
    }
    return counts;
  }, [orders]);

  const statusTabs = [
    { value: NONE_VALUE, label: 'All' },
    { value: OPEN_VALUE, label: 'Open' },
    ...ORDER_STATUSES.map(s => ({ value: s as string, label: s as string })),
  ];

  const hasFilters = !!searchTerm || statusFilter !== NONE_VALUE;
  const clearFilters = () => { setSearchTerm(''); setStatusFilter(NONE_VALUE); };

  const handleExport = () => {
    const headers = ['Customer', 'Date Placed', 'Units', 'Units Shipped', 'Model Type', 'Total Value', 'PO #', 'Invoice', 'Status', 'Order Type', 'Tracking'];
    const rows = filteredAndSortedOrders.map(o => [
      o.customer,
      o.placed,
      String(o.units),
      String(getShipmentProgress(o).shipped),
      o.modelType,
      String(o.totalValue),
      o.poNumber || '',
      o.invoice || '',
      o.status,
      o.orderType || 'Standard',
      o.tracking || '',
    ]);
    exportToCSV(`orders-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  const modelLabel = (order: typeof orders[number]) =>
    order.modelItems.map(item => item.modelName).join(', ') || order.modelType || '—';

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading orders">
        <Skeleton className="h-[68px] w-full rounded-2xl" />
        <div className="content-card">
          <div className="p-3 border-b border-border flex gap-2">
            <Skeleton className="h-10 flex-1 rounded-lg" />
            <Skeleton className="h-10 w-28 rounded-lg" />
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-center gap-6 px-3 py-3">
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-4 w-44" />
                <Skeleton className="h-4 w-10 hidden md:block" />
                <Skeleton className="h-4 w-32 hidden md:block" />
                <Skeleton className="h-4 w-16 ml-auto" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Summary strip */}
      <section aria-label="Order summary" className="content-card grid grid-cols-2 sm:grid-cols-5 gap-px bg-border">
        {[
          { label: 'Open', value: stats.pending.toLocaleString() },
          { label: 'Delivered', value: stats.delivered.toLocaleString() },
          { label: 'Total orders', value: stats.totalOrders.toLocaleString() },
          { label: 'Units', value: stats.totalUnits.toLocaleString() },
          { label: 'Total value', value: formatCurrency(stats.totalValue) },
        ].map((stat, i) => (
          <div key={stat.label} className={cn('bg-card px-4 py-3 min-w-0', i === 4 && 'col-span-2 sm:col-span-1')}>
            <div className="text-[11px] font-medium text-muted-foreground">{stat.label}</div>
            <div className="mt-1 truncate text-lg font-semibold leading-tight tabular-nums">{stat.value}</div>
          </div>
        ))}
      </section>

      <div className="content-card">
        {/* Toolbar */}
        <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <Input
              type="search"
              aria-label="Search orders"
              placeholder="Search customer, model, or PO #..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-0 bg-muted/50 rounded-lg"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="gap-2 rounded-lg h-10 px-3" onClick={handleExport} disabled={filteredAndSortedOrders.length === 0}>
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">Export</span>
              <span className="sr-only sm:hidden">Export orders</span>
            </Button>
            <ProductModelsDialog />
            <AddOrderDialog />
          </div>
        </div>

        {/* Status tabs */}
        <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto" role="group" aria-label="Filter by status">
          {statusTabs.map(tab => {
            const active = statusFilter === tab.value;
            const count = statusCounts[tab.value] ?? 0;
            return (
              <button
                key={tab.value}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(tab.value)}
                className={cn(
                  'flex h-7 shrink-0 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
                )}
              >
                {isOrderStatus(tab.value) && (
                  <span className={cn('h-1.5 w-1.5 rounded-full', ORDER_STATUS_META[tab.value].dot)} aria-hidden="true" />
                )}
                {tab.label}
                <span className="tabular-nums text-muted-foreground">{count}</span>
              </button>
            );
          })}
        </div>

        {filteredAndSortedOrders.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <Package className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
            </div>
            {hasFilters ? (
              <>
                <p className="text-sm text-muted-foreground">No orders match {searchTerm ? `“${searchTerm}” in ` : ''}this view.</p>
                <Button variant="outline" size="sm" onClick={clearFilters}>Clear search and filters</Button>
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">No orders yet. Log the first one when a PO comes in.</p>
                <AddOrderDialog />
              </>
            )}
          </div>
        ) : (
          <>
            {/* Mobile: cards */}
            <ul className="md:hidden divide-y divide-border">
              {filteredAndSortedOrders.map(order => (
                <li key={order.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderId(order.id)}
                    className="w-full text-left px-3 py-3 space-y-1.5 active:bg-muted/50 outline-none focus-visible:bg-muted/50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium leading-snug">{order.customer}</span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">{order.totalValue > 0 ? formatCurrency(order.totalValue) : '—'}</span>
                    </div>
                    <p className="truncate text-xs text-muted-foreground">{order.units} × {modelLabel(order)}</p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <OrderStatusBadge status={order.status} />
                      <ShipmentProgressText order={order} />
                      <span className="ml-auto font-mono">{order.placed}</span>
                    </div>
                  </button>
                </li>
              ))}
            </ul>

            {/* Desktop table */}
            <div className="hidden md:block max-h-[calc(100dvh-22rem)] overflow-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <SortableTh field="placed" label="Date Placed" {...sortProps} />
                    <SortableTh field="customer" label="Customer" {...sortProps} />
                    <SortableTh field="units" label="Units" align="right" {...sortProps} />
                    <SortableTh field="modelType" label="Model" {...sortProps} />
                    <SortableTh field="totalValue" label="Total Value" align="right" {...sortProps} />
                    <SortableTh field="status" label="Status" {...sortProps} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredAndSortedOrders.map((order) => (
                    <tr
                      key={order.id}
                      tabIndex={0}
                      className="table-row-hover cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:shadow-[inset_2px_0_0_hsl(var(--ring))]"
                      onClick={() => setSelectedOrderId(order.id)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && e.target === e.currentTarget) setSelectedOrderId(order.id); }}
                    >
                      <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground whitespace-nowrap">{order.placed}</td>
                      <td className="px-3 py-2.5 text-sm font-medium">
                        {order.companyId ? (
                          <Link
                            to={`/company/${order.companyId}`}
                            state={{ from: `${location.pathname}${location.search}` }}
                            className="rounded text-foreground hover:text-accent hover:underline transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {order.customer}
                          </Link>
                        ) : (
                          order.customer
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-right tabular-nums">{order.units}</td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[16rem] truncate" title={modelLabel(order)}>{modelLabel(order)}</td>
                      <td className="px-3 py-2.5 text-sm font-medium text-right tabular-nums">
                        {order.totalValue > 0 ? formatCurrency(order.totalValue) : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <OrderStatusBadge status={order.status} />
                          <ShipmentProgressText order={order} />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-3 py-2.5 border-t border-border text-xs text-muted-foreground">
          Showing {filteredAndSortedOrders.length.toLocaleString()} of {orders.length.toLocaleString()} orders
        </div>
      </div>

      {/* Order detail slide-over — view/edit without leaving the Orders page */}
      <Sheet open={!!selectedOrderId} onOpenChange={(open) => !open && setSelectedOrderId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col" onEscapeKeyDown={keepLocalEscape}>
          {selectedOrderId && (
            <OrderDetail
              orderId={selectedOrderId}
              variant="panel"
              onDeleted={() => setSelectedOrderId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default OrdersTable;
