import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, ExternalLink, Filter, ChevronDown, ChevronUp, Loader2, ArrowUpDown } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect } from '@/data/prospects';
import StageBadge from './StageBadge';
import TypeBadge from './TypeBadge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import AddProspectDialog from './AddProspectDialog';

interface ProspectsTableProps {
  onSelectProspect: (prospect: Prospect) => void;
}

type SortField = 'companyName' | 'contacts' | 'state' | 'type' | 'stage' | 'lastContact';
type SortDirection = 'asc' | 'desc' | null;

const ProspectsTable = ({ onSelectProspect }: ProspectsTableProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { prospects, isLoading } = useProspects();
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [stageFilter, setStageFilter] = useState<string[]>([]);
  
  // Initialize sort state from URL params
  const [sortField, setSortField] = useState<SortField | null>(() => {
    const field = searchParams.get('sortField');
    if (field && ['companyName', 'contacts', 'state', 'type', 'stage', 'lastContact'].includes(field)) {
      return field as SortField;
    }
    return null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('sortDir');
    if (dir === 'asc' || dir === 'desc') return dir;
    return null;
  });

  // Sync sort state to URL
  useEffect(() => {
    const newParams = new URLSearchParams(searchParams);
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
  }, [sortField, sortDirection, searchParams, setSearchParams]);

  const types = ['OEM', 'Distributor', 'eCommerce'];
  const stages = ['Quotes', 'Contact Made', 'No Current Interest'];

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'asc') setSortDirection('desc');
      else if (sortDirection === 'desc') { setSortField(null); setSortDirection(null); }
      else setSortDirection('asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-50" />;
    if (sortDirection === 'asc') return <ChevronUp className="w-3 h-3 ml-1" />;
    return <ChevronDown className="w-3 h-3 ml-1" />;
  };

  const filteredAndSortedProspects = useMemo(() => {
    let result = prospects.filter((prospect) => {
      const matchesSearch = 
        prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.contacts.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        prospect.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.engagementNotes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter.length === 0 || typeFilter.includes(prospect.type);
      
      const matchesStage = stageFilter.length === 0 || 
        stageFilter.some(s => prospect.stage.toLowerCase().includes(s.toLowerCase()));

      return matchesSearch && matchesType && matchesStage;
    });

    if (sortField && sortDirection) {
      result = [...result].sort((a, b) => {
        let aVal: string | number = '';
        let bVal: string | number = '';

        switch (sortField) {
          case 'companyName':
            aVal = a.companyName.toLowerCase();
            bVal = b.companyName.toLowerCase();
            break;
          case 'contacts':
            aVal = a.contacts.length > 0 ? a.contacts[0].name.toLowerCase() : '';
            bVal = b.contacts.length > 0 ? b.contacts[0].name.toLowerCase() : '';
            break;
          case 'state':
            aVal = (a.state || '').toLowerCase();
            bVal = (b.state || '').toLowerCase();
            break;
          case 'type':
            aVal = (a.type || '').toLowerCase();
            bVal = (b.type || '').toLowerCase();
            break;
          case 'stage':
            aVal = (a.stage || '').toLowerCase();
            bVal = (b.stage || '').toLowerCase();
            break;
          case 'lastContact':
            aVal = a.lastContact || '';
            bVal = b.lastContact || '';
            break;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [prospects, searchQuery, typeFilter, stageFilter, sortField, sortDirection]);

  const handleRowClick = (prospect: Prospect) => {
    navigate(`/company/${prospect.id}`, {
      state: { from: `${location.pathname}${location.search}` },
    });
  };

  if (isLoading) {
    return (
      <div className="content-card p-12 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="content-card overflow-hidden animate-fade-in">
      {/* Header */}
      <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search companies, contacts, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-11 h-11 border-0 bg-muted/50 rounded-xl"
          />
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Type
                {typeFilter.length > 0 && (
                  <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full">
                    {typeFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {types.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilter.includes(type)}
                  onCheckedChange={(checked) => {
                    setTypeFilter(prev => 
                      checked ? [...prev, type] : prev.filter(t => t !== type)
                    );
                  }}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Stage
                {stageFilter.length > 0 && (
                  <span className="bg-accent text-accent-foreground text-xs px-1.5 rounded-full">
                    {stageFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              {stages.map((stage) => (
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
          <AddProspectDialog />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-muted/30">
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('companyName')}
              >
                <span className="flex items-center">Company{getSortIcon('companyName')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('contacts')}
              >
                <span className="flex items-center">Contacts{getSortIcon('contacts')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('state')}
              >
                <span className="flex items-center">Location{getSortIcon('state')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('type')}
              >
                <span className="flex items-center">Type{getSortIcon('type')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('stage')}
              >
                <span className="flex items-center">Stage{getSortIcon('stage')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('lastContact')}
              >
                <span className="flex items-center">Last Contact{getSortIcon('lastContact')}</span>
              </th>
              <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">LinkedIn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filteredAndSortedProspects.map((prospect) => (
              <tr 
                key={prospect.id} 
                className="table-row-hover cursor-pointer"
                onClick={() => handleRowClick(prospect)}
              >
                <td className="p-4">
                  <span className="font-medium">{prospect.companyName}</span>
                </td>
                <td className="p-4 text-sm text-muted-foreground">
                  {(() => {
                    const champion = prospect.contacts.find(c => c.isChampion);
                    if (champion) {
                      return (
                        <span className="flex items-center gap-1.5">
                          <span className="text-amber-500">★</span>
                          <span className="font-medium text-foreground">{champion.name}</span>
                        </span>
                      );
                    }
                    return prospect.contacts.length > 0 
                      ? `${prospect.contacts.length} contact${prospect.contacts.length > 1 ? 's' : ''}`
                      : '—';
                  })()}
                </td>
                <td className="p-4 text-sm font-mono text-muted-foreground">
                  {prospect.state || '—'}
                </td>
                <td className="p-4">
                  <TypeBadge type={prospect.type} />
                </td>
                <td className="p-4">
                  <StageBadge stage={prospect.stage} />
                </td>
                <td className="p-4 text-sm font-mono text-muted-foreground">
                  {prospect.lastContact || '—'}
                </td>
                <td className="p-4">
                  {prospect.linkedIn ? (
                    <a 
                      href={prospect.linkedIn} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="text-accent hover:text-accent/80 transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-border text-sm text-muted-foreground">
        Showing {filteredAndSortedProspects.length} of {prospects.length} prospects
      </div>
    </div>
  );
};

export default ProspectsTable;
