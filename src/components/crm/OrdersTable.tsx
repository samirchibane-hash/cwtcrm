import { useState, useMemo, useEffect } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Search, Package, Truck, FileText, Filter, Building2, ExternalLink, ChevronUp, ChevronDown, ArrowUpDown } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Order, getStatusColor, formatCurrency } from '@/data/orders';
import { useOrders } from '@/context/OrdersContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DollarSign } from 'lucide-react';
import ProductModelsDialog from './ProductModelsDialog';
import AddOrderDialog from './AddOrderDialog';

type OrderSortField = 'id' | 'customer' | 'placed' | 'units' | 'modelType' | 'totalValue' | 'status';
type SortDirection = 'asc' | 'desc' | null;

const NONE_VALUE = '__none__';

const OrdersTable = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState(() => searchParams.get('q') || '');
  const [statusFilter, setStatusFilter] = useState<string>(() => searchParams.get('status') || NONE_VALUE);
  const { orders } = useOrders();

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
    const pending = orders.filter(o => o.status === 'Partially Shipped' || o.status === 'Paid' || o.status === 'PO/Invoice').length;
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

  const getSortIcon = (field: OrderSortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ChevronUp className="w-3 h-3 ml-1" />;
    return <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const filteredAndSortedOrders = useMemo(() => {
    let result = orders.filter((order) => {
      const matchesSearch =
        order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.modelType.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = statusFilter === NONE_VALUE || order.status === statusFilter;
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
            aVal = a.placed || '';
            bVal = b.placed || '';
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
            aVal = a.status.toLowerCase();
            bVal = b.status.toLowerCase();
            break;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [orders, searchTerm, statusFilter, sortField, sortDirection]);

  const StatusBadge = ({ status }: { status: Order['status'] }) => {
    const colors = getStatusColor(status);
    return (
      <Badge variant="secondary" className={`${colors.bg} ${colors.text} border-0`}>
        {status}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalOrders}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Units</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUnits}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              Total Value
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatCurrency(stats.totalValue)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Delivered</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.delivered}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by customer or model..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <Filter className="h-4 w-4 mr-2" />
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE_VALUE}>All Statuses</SelectItem>
            <SelectItem value="Delivered">Delivered</SelectItem>
            <SelectItem value="Partially Shipped">Partially Shipped</SelectItem>
            <SelectItem value="Paid">Paid</SelectItem>
            <SelectItem value="PO/Invoice">PO/Invoice</SelectItem>
            <SelectItem value="Loaner">Loaner</SelectItem>
          </SelectContent>
        </Select>
        <AddOrderDialog />
        <ProductModelsDialog />
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('id')}>
                <span className="flex items-center">Order{getSortIcon('id')}</span>
              </TableHead>
              <TableHead className="font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('customer')}>
                <span className="flex items-center">Customer{getSortIcon('customer')}</span>
              </TableHead>
              <TableHead className="font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('placed')}>
                <span className="flex items-center">Date Placed{getSortIcon('placed')}</span>
              </TableHead>
              <TableHead className="font-semibold text-center cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('units')}>
                <span className="flex items-center justify-center">Units{getSortIcon('units')}</span>
              </TableHead>
              <TableHead className="font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('modelType')}>
                <span className="flex items-center">Model Type{getSortIcon('modelType')}</span>
              </TableHead>
              <TableHead className="font-semibold text-right cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('totalValue')}>
                <span className="flex items-center justify-end">Total Value{getSortIcon('totalValue')}</span>
              </TableHead>
              <TableHead className="font-semibold cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort('status')}>
                <span className="flex items-center">Status{getSortIcon('status')}</span>
              </TableHead>
              <TableHead className="font-semibold">Links</TableHead>
              <TableHead className="font-semibold">Order Updates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedOrders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/30 transition-colors group">
                <TableCell>
                  <Link
                    to={`/order/${order.id}`}
                    state={{ from: `${location.pathname}${location.search}` }}
                    className="font-medium text-accent hover:underline flex items-center gap-1.5"
                  >
                    #{order.id}
                    <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </Link>
                </TableCell>
                <TableCell className="font-medium">
                  {order.companyId ? (
                    <Link 
                      to={`/company/${order.companyId}`}
                      state={{ from: `${location.pathname}${location.search}` }}
                      className="flex items-center gap-1.5 text-foreground hover:text-accent transition-colors"
                    >
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {order.customer}
                    </Link>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
                      {order.customer}
                    </span>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground">{order.placed}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-mono">
                    {order.units}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">
                    {order.modelItems.map(item => item.modelName).join(', ')}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <span className="font-medium text-accent">
                    {order.totalValue > 0 ? formatCurrency(order.totalValue) : '—'}
                  </span>
                </TableCell>
                <TableCell>
                  <StatusBadge status={order.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {order.invoice && order.invoice.startsWith('http') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={order.invoice} target="_blank" rel="noopener noreferrer" title="View Invoice">
                          <FileText className="h-4 w-4 text-blue-500" />
                        </a>
                      </Button>
                    )}
                    {order.tracking && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        asChild
                      >
                        <a href={order.tracking} target="_blank" rel="noopener noreferrer" title="Track Shipment">
                          <Truck className="h-4 w-4 text-green-500" />
                        </a>
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground line-clamp-2">
                    {order.orderUpdates || '—'}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {filteredAndSortedOrders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orders found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default OrdersTable;
