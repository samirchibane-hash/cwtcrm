import { useState } from 'react';
import { Search, ExternalLink, Package, Truck, FileText, Filter } from 'lucide-react';
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
import { orders, Order, getStatusColor, getOrderStats } from '@/data/orders';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const NONE_VALUE = '__none__';

const OrdersTable = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(NONE_VALUE);

  const stats = getOrderStats();

  const filteredOrders = orders.filter((order) => {
    const matchesSearch =
      order.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.modelType.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === NONE_VALUE || order.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="font-semibold">Customer</TableHead>
              <TableHead className="font-semibold">Date Placed</TableHead>
              <TableHead className="font-semibold text-center">Units</TableHead>
              <TableHead className="font-semibold">Model Type</TableHead>
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Links</TableHead>
              <TableHead className="font-semibold">Order Updates</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredOrders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-medium">{order.customer}</TableCell>
                <TableCell className="text-muted-foreground">{order.placed}</TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="font-mono">
                    {order.units}
                  </Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm">{order.modelType}</span>
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

      {filteredOrders.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>No orders found matching your criteria.</p>
        </div>
      )}
    </div>
  );
};

export default OrdersTable;
