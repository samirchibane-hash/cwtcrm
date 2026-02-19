import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, ExternalLink, Filter, ChevronDown, ChevronUp, Loader2, ArrowUpDown } from 'lucide-react';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect, COMPANY_TYPES, PIPELINE_STAGES, LEAD_TIERS } from '@/data/prospects';
import { useProductVerticals } from '@/hooks/useProductVerticals';
import { getProspectLastContactLabel, getProspectLastContactSortValue } from '@/lib/prospect-last-contact';
import StageBadge from './StageBadge';
import TypeBadge from './TypeBadge';
import LeadTierBadge from './LeadTierBadge';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuCheckboxItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import AddProspectDialog from './AddProspectDialog';
import { AIRecommendationsDialog } from './AIRecommendationsDialog';

interface ProspectsTableProps {
  onSelectProspect: (prospect: Prospect) => void;
}

type SortField = 'companyName' | 'contacts' | 'state' | 'type' | 'leadTier' | 'stage' | 'lastContact';
type SortDirection = 'asc' | 'desc' | null;

const ProspectsTable = ({ onSelectProspect }: ProspectsTableProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { prospects, isLoading } = useProspects();
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [typeFilter, setTypeFilter] = useState<string[]>(() => {
    const val = searchParams.get('type');
    return val ? val.split(',') : [];
  });
  const [stageFilter, setStageFilter] = useState<string[]>(() => {
    const val = searchParams.get('stage');
    return val ? val.split(',') : [];
  });
  const [leadTierFilter, setLeadTierFilter] = useState<string[]>(() => {
    const val = searchParams.get('tier');
    return val ? val.split(',') : [];
  });
  const [verticalFilter, setVerticalFilter] = useState<string[]>(() => {
    const val = searchParams.get('vertical');
    return val ? val.split(',') : [];
  });
  const [typeFilterMode, setTypeFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('typeMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [stageFilterMode, setStageFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('stageMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [leadTierFilterMode, setLeadTierFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('tierMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [verticalFilterMode, setVerticalFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('verticalMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [sortField, setSortField] = useState<SortField | null>(() => {
    const field = searchParams.get('sortField');
    if (field && ['companyName', 'contacts', 'state', 'type', 'leadTier', 'stage', 'lastContact'].includes(field)) {
      return field as SortField;
    }
    return null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('sortDir');
    if (dir === 'asc' || dir === 'desc') return dir;
    return null;
  });

  useEffect(() => {
    const currentView = searchParams.get('view');
    if (currentView && currentView !== 'pipeline') return;
    
    const newParams = new URLSearchParams(searchParams);
    
    if (searchQuery) newParams.set('q', searchQuery);
    else newParams.delete('q');
    
    if (typeFilter.length > 0) newParams.set('type', typeFilter.join(','));
    else newParams.delete('type');
    
    if (stageFilter.length > 0) newParams.set('stage', stageFilter.join(','));
    else newParams.delete('stage');
    
    if (leadTierFilter.length > 0) newParams.set('tier', leadTierFilter.join(','));
    else newParams.delete('tier');

    if (verticalFilter.length > 0) newParams.set('vertical', verticalFilter.join(','));
    else newParams.delete('vertical');

    if (typeFilterMode === 'exclude') newParams.set('typeMode', 'exclude');
    else newParams.delete('typeMode');

    if (stageFilterMode === 'exclude') newParams.set('stageMode', 'exclude');
    else newParams.delete('stageMode');

    if (leadTierFilterMode === 'exclude') newParams.set('tierMode', 'exclude');
    else newParams.delete('tierMode');

    if (verticalFilterMode === 'exclude') newParams.set('verticalMode', 'exclude');
    else newParams.delete('verticalMode');
    
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
  }, [searchQuery, typeFilter, stageFilter, leadTierFilter, verticalFilter, typeFilterMode, stageFilterMode, leadTierFilterMode, verticalFilterMode, sortField, sortDirection, searchParams, setSearchParams]);

  // Filter options: merge static constants with any custom stages present in actual data
  const types = COMPANY_TYPES.filter(t => t !== '');
  const stages = useMemo(() => {
    const stagesFromData = prospects.flatMap(p =>
      p.stage ? p.stage.split(',').map(s => s.trim()).filter(Boolean) : []
    );
    const merged = Array.from(new Set([...PIPELINE_STAGES, ...stagesFromData]));
    return merged;
  }, [prospects]);
  const leadTiers = LEAD_TIERS;
  const { allVerticals } = useProductVerticals();

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
      
      const matchesType = typeFilter.length === 0 || (
        typeFilterMode === 'include' ? typeFilter.includes(prospect.type) : !typeFilter.includes(prospect.type)
      );
      
      const matchesStage = stageFilter.length === 0 || (
        stageFilterMode === 'include'
          ? stageFilter.some(s => prospect.stage.toLowerCase().includes(s.toLowerCase()))
          : !stageFilter.some(s => prospect.stage.toLowerCase().includes(s.toLowerCase()))
      );

      const matchesLeadTier = leadTierFilter.length === 0 || (
        leadTierFilterMode === 'include' ? leadTierFilter.includes(prospect.leadTier) : !leadTierFilter.includes(prospect.leadTier)
      );
      const matchesVertical = verticalFilter.length === 0 || (
        verticalFilterMode === 'include' ? verticalFilter.includes(prospect.marketType || '') : !verticalFilter.includes(prospect.marketType || '')
      );

      return matchesSearch && matchesType && matchesStage && matchesLeadTier && matchesVertical;
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
          case 'leadTier':
            aVal = (a.leadTier || '').toLowerCase();
            bVal = (b.leadTier || '').toLowerCase();
            break;
          case 'stage':
            aVal = (a.stage || '').toLowerCase();
            bVal = (b.stage || '').toLowerCase();
            break;
          case 'lastContact':
            aVal = getProspectLastContactSortValue(a);
            bVal = getProspectLastContactSortValue(b);
            break;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [prospects, searchQuery, typeFilter, stageFilter, leadTierFilter, verticalFilter, typeFilterMode, stageFilterMode, leadTierFilterMode, verticalFilterMode, sortField, sortDirection]);

  const handleRowClick = (prospect: Prospect) => {
    const prospectIds = filteredAndSortedProspects.map(p => p.id);
    navigate(`/company/${prospect.id}`, {
      state: { 
        from: `/${location.search ? location.search : '?view=pipeline'}`,
        prospectIds,
      },
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
          {/* Business Model filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Business Model
                {typeFilter.length > 0 && (
                  <span className={`text-xs px-1.5 rounded-full ${typeFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {typeFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <div className="flex gap-1 p-2 pb-1">
                <button onClick={() => setTypeFilterMode('include')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${typeFilterMode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Include</button>
                <button onClick={() => setTypeFilterMode('exclude')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${typeFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Exclude</button>
              </div>
              <div className="border-t border-border my-1" />
              {types.map((type) => (
                <DropdownMenuCheckboxItem
                  key={type}
                  checked={typeFilter.includes(type)}
                  onCheckedChange={(checked) => {
                    setTypeFilter(prev => checked ? [...prev, type] : prev.filter(t => t !== type));
                  }}
                >
                  {type}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Stage filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Stage
                {stageFilter.length > 0 && (
                  <span className={`text-xs px-1.5 rounded-full ${stageFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {stageFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <div className="flex gap-1 p-2 pb-1">
                <button onClick={() => setStageFilterMode('include')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${stageFilterMode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Include</button>
                <button onClick={() => setStageFilterMode('exclude')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${stageFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Exclude</button>
              </div>
              <div className="border-t border-border my-1" />
              {stages.map((stage) => (
                <DropdownMenuCheckboxItem
                  key={stage}
                  checked={stageFilter.includes(stage)}
                  onCheckedChange={(checked) => {
                    setStageFilter(prev => checked ? [...prev, stage] : prev.filter(s => s !== stage));
                  }}
                >
                  {stage}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Lead Tier filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Lead Tier
                {leadTierFilter.length > 0 && (
                  <span className={`text-xs px-1.5 rounded-full ${leadTierFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {leadTierFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <div className="flex gap-1 p-2 pb-1">
                <button onClick={() => setLeadTierFilterMode('include')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${leadTierFilterMode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Include</button>
                <button onClick={() => setLeadTierFilterMode('exclude')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${leadTierFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Exclude</button>
              </div>
              <div className="border-t border-border my-1" />
              {leadTiers.map((tier) => (
                <DropdownMenuCheckboxItem
                  key={tier}
                  checked={leadTierFilter.includes(tier)}
                  onCheckedChange={(checked) => {
                    setLeadTierFilter(prev => checked ? [...prev, tier] : prev.filter(t => t !== tier));
                  }}
                >
                  {tier}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Product Vertical filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Product Vertical
                {verticalFilter.length > 0 && (
                  <span className={`text-xs px-1.5 rounded-full ${verticalFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-accent text-accent-foreground'}`}>
                    {verticalFilter.length}
                  </span>
                )}
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <div className="flex gap-1 p-2 pb-1">
                <button onClick={() => setVerticalFilterMode('include')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${verticalFilterMode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Include</button>
                <button onClick={() => setVerticalFilterMode('exclude')} className={`flex-1 text-xs px-2 py-1 rounded-md font-medium transition-colors ${verticalFilterMode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Exclude</button>
              </div>
              <div className="border-t border-border my-1" />
              {allVerticals.map((vertical) => (
                <DropdownMenuCheckboxItem
                  key={vertical}
                  checked={verticalFilter.includes(vertical)}
                  onCheckedChange={(checked) => {
                    setVerticalFilter(prev => checked ? [...prev, vertical] : prev.filter(v => v !== vertical));
                  }}
                >
                  {vertical}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <AIRecommendationsDialog />
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
                <span className="flex items-center">Business Model{getSortIcon('type')}</span>
              </th>
              <th 
                className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                onClick={() => handleSort('leadTier')}
              >
                <span className="flex items-center">Lead Tier{getSortIcon('leadTier')}</span>
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
                  <LeadTierBadge leadTier={prospect.leadTier} />
                </td>
                <td className="p-4">
                  <StageBadge stage={prospect.stage} />
                </td>
                <td className="p-4 text-sm font-mono text-muted-foreground">
                  {getProspectLastContactLabel(prospect) || '—'}
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
        Showing {filteredAndSortedProspects.length} of {prospects.length} companies
      </div>
    </div>
  );
};

export default ProspectsTable;
