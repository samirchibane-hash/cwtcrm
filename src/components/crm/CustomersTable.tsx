import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Star, ChevronUp, ChevronDown, Building2 } from 'lucide-react';
import { Prospect } from '@/data/prospects';
import { useProspects } from '@/context/ProspectsContext';
import { useOrders } from '@/context/OrdersContext';
import AddProspectDialog from './AddProspectDialog';
import StageBadge from './StageBadge';
import { Input } from '@/components/ui/input';
import { Toggle } from '@/components/ui/toggle';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

interface CustomersTableProps {
  onSelectProspect?: (prospect: Prospect) => void;
}

type SortField = 'companyName' | 'state' | 'stage' | 'lastContact' | 'orderCount';
type SortDirection = 'asc' | 'desc';

const CustomersTable = ({ onSelectProspect }: CustomersTableProps) => {
  const navigate = useNavigate();
  const { prospects, updateProspect, isLoading } = useProspects();
  const { orders } = useOrders();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('companyName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [starredOnly, setStarredOnly] = useState(false);

  // Filter only customers (type === 'Customer')
  const customers = useMemo(() => {
    return prospects.filter(p => p.type === 'Customer');
  }, [prospects]);

  // Get order count for each customer
  const getOrderCount = (companyName: string) => {
    return orders.filter(o => o.customer === companyName).length;
  };

  const filteredAndSortedCustomers = useMemo(() => {
    let result = customers.filter(customer => {
      const matchesSearch = customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.stage.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStarred = !starredOnly || customer.starred;
      return matchesSearch && matchesStarred;
    });

    result.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'orderCount') {
        aValue = getOrderCount(a.companyName);
        bValue = getOrderCount(b.companyName);
      } else {
        aValue = a[sortField] || '';
        bValue = b[sortField] || '';
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      if (typeof aValue === 'number' && typeof bValue === 'number') {
        return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
      }

      return 0;
    });

    return result;
  }, [customers, searchQuery, sortField, sortDirection, starredOnly, orders]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleSelectCustomer = (customer: Prospect) => {
    const customerIds = filteredAndSortedCustomers.map(c => c.id);
    navigate(`/company/${customer.id}`, { 
      state: { prospectIds: customerIds, from: '/?view=customers' } 
    });
  };

  const handleToggleStar = async (e: React.MouseEvent, customer: Prospect) => {
    e.stopPropagation();
    updateProspect({
      ...customer,
      starred: !customer.starred,
    });
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

  const starredCount = customers.filter(c => c.starred).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search customers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Toggle
            pressed={starredOnly}
            onPressedChange={setStarredOnly}
            aria-label="Show starred only"
            className="gap-2"
          >
            <Star className={`w-4 h-4 ${starredOnly ? 'fill-yellow-500 text-yellow-500' : ''}`} />
            Starred {starredCount > 0 && `(${starredCount})`}
          </Toggle>
          <AddProspectDialog defaultType="Customer" />
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{filteredAndSortedCustomers.length} customers</span>
        <span>•</span>
        <span>{orders.filter(o => customers.some(c => c.companyName === o.customer)).length} total orders</span>
      </div>

      {/* Table */}
      <div className="content-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12"></TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('companyName')}
              >
                Company <SortIcon field="companyName" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('state')}
              >
                Location <SortIcon field="state" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('stage')}
              >
                Stage <SortIcon field="stage" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('orderCount')}
              >
                Orders <SortIcon field="orderCount" />
              </TableHead>
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('lastContact')}
              >
                Last Contact <SortIcon field="lastContact" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSortedCustomers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 opacity-50" />
                    <span>No customers found</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCustomers.map((customer) => {
                const orderCount = getOrderCount(customer.companyName);
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <TableCell>
                      <button
                        onClick={(e) => handleToggleStar(e, customer)}
                        className="p-1 hover:bg-muted rounded transition-colors"
                      >
                        <Star 
                          className={`w-4 h-4 ${customer.starred ? 'fill-yellow-500 text-yellow-500' : 'text-muted-foreground'}`} 
                        />
                      </button>
                    </TableCell>
                    <TableCell className="font-medium">{customer.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">{customer.state || '—'}</TableCell>
                    <TableCell>
                      <StageBadge stage={customer.stage} />
                    </TableCell>
                    <TableCell>
                      {orderCount > 0 ? (
                        <Badge variant="secondary">{orderCount}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {customer.lastContact || '—'}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
};

export default CustomersTable;
