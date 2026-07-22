import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ChevronUp, ChevronDown, Building2, User, Filter } from 'lucide-react';
import { CompanyType, Prospect } from '@/data/prospects';
import { useProspects } from '@/context/ProspectsContext';
import { useOrders } from '@/context/OrdersContext';
import { useStageOptions } from '@/hooks/useStageOptions';
import { getProspectLastContactSortValue, getProspectLastContactLabel } from '@/lib/prospect-last-contact';
import StageBadge from './StageBadge';
import AddProspectPanel from './AddProspectPanel';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

// This view keys off a "Customer" business model that predates the CompanyType
// union, so the value has to be asserted in rather than added to COMPANY_TYPES.
const CUSTOMER_TYPE = 'Customer' as unknown as CompanyType;

type SortField = 'companyName' | 'state' | 'lastContact' | 'orderCount' | 'ltv' | 'stage';
type SortDirection = 'asc' | 'desc';

const CustomersTable = ({ onSelectProspect }: CustomersTableProps) => {
  const navigate = useNavigate();
  const { prospects, isLoading } = useProspects();
  const { orders } = useOrders();
  const { allStages } = useStageOptions();
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('companyName');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [stageFilter, setStageFilter] = useState<string[]>([]);

  const customers = useMemo(() => {
    return prospects.filter(p => p.type === CUSTOMER_TYPE);
  }, [prospects]);

  const getOrderCount = (companyName: string) => {
    return orders.filter(o => o.customer === companyName).length;
  };

  const getCustomerLTV = (companyName: string) => {
    return orders
      .filter(o => o.customer === companyName)
      .reduce((sum, o) => sum + (o.totalValue || 0), 0);
  };

  const filteredAndSortedCustomers = useMemo(() => {
    const result = customers.filter(customer => {
      const matchesSearch = customer.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.state.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStage = stageFilter.length === 0 ||
        stageFilter.some(s => customer.stage.toLowerCase().includes(s.toLowerCase()));
      return matchesSearch && matchesStage;
    });

    result.sort((a, b) => {
      let aValue: string | number;
      let bValue: string | number;

      if (sortField === 'orderCount') {
        aValue = getOrderCount(a.companyName);
        bValue = getOrderCount(b.companyName);
      } else if (sortField === 'ltv') {
        aValue = getCustomerLTV(a.companyName);
        bValue = getCustomerLTV(b.companyName);
      } else if (sortField === 'lastContact') {
        aValue = getProspectLastContactSortValue(a);
        bValue = getProspectLastContactSortValue(b);
      } else if (sortField === 'stage') {
        aValue = a.stage || '';
        bValue = b.stage || '';
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
  }, [customers, searchQuery, sortField, sortDirection, stageFilter, orders]);

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

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUp className="w-4 h-4 inline ml-1" />
      : <ChevronDown className="w-4 h-4 inline ml-1" />;
  };

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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <Filter className="w-4 h-4" />
                Stage
                {stageFilter.length > 0 && (
                  <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full">
                    {stageFilter.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
              {allStages.map((stage) => (
                <DropdownMenuCheckboxItem
                  key={stage}
                  checked={stageFilter.includes(stage)}
                  onCheckedChange={(checked) => {
                    setStageFilter(prev =>
                      checked ? [...prev, stage] : prev.filter(s => s !== stage)
                    );
                  }}
                >
                  {stage}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <AddProspectPanel defaultType={CUSTOMER_TYPE} />
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
              <TableHead 
                className="cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('companyName')}
              >
                Company <SortIcon field="companyName" />
              </TableHead>
              <TableHead>Contacts</TableHead>
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
                onClick={() => handleSort('ltv')}
              >
                Customer LTV <SortIcon field="ltv" />
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
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <div className="flex flex-col items-center gap-2">
                    <Building2 className="w-8 h-8 opacity-50" />
                    {searchQuery || stageFilter.length > 0 ? (
                      <>
                        <span>No customers match these filters.</span>
                        <Button
                          variant="link"
                          size="sm"
                          onClick={() => { setSearchQuery(''); setStageFilter([]); }}
                        >
                          Clear filters
                        </Button>
                      </>
                    ) : (
                      <>
                        <span>No customers yet. Add one to start tracking orders and LTV.</span>
                        <AddProspectPanel defaultType={CUSTOMER_TYPE} />
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSortedCustomers.map((customer) => {
                const orderCount = getOrderCount(customer.companyName);
                const ltv = getCustomerLTV(customer.companyName);
                const contactCount = customer.contacts?.length || 0;
                const primaryContact = customer.contacts?.[0];
                
                return (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectCustomer(customer)}
                  >
                    <TableCell className="font-medium">{customer.companyName}</TableCell>
                    <TableCell>
                      {contactCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted">
                            <User className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{primaryContact?.name || 'Unknown'}</span>
                            {contactCount > 1 && (
                              <span className="text-xs text-muted-foreground">+{contactCount - 1} more</span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
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
                    <TableCell className="font-medium">
                      {ltv > 0 ? (
                        <span className="text-accent">
                          ${ltv.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground font-mono text-sm">
                      {getProspectLastContactLabel(customer) || '—'}
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
