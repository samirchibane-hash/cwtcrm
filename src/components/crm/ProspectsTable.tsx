import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { Search, ExternalLink, Filter, ChevronDown, ChevronUp, Loader2, ArrowUpDown, Download, X } from 'lucide-react';
import { exportToCSV } from '@/lib/export-csv';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect, COMPANY_TYPES, PIPELINE_STAGES, LEAD_TIERS } from '@/data/prospects';
import { useProductVerticals } from '@/hooks/useProductVerticals';
import { getProspectLastContactLabel, getProspectLastContactSortValue } from '@/lib/prospect-last-contact';
import StageBadge from './StageBadge';
import TypeBadge from './TypeBadge';
import LeadTierBadge from './LeadTierBadge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import AddProspectDialog from './AddProspectDialog';
import { AIRecommendationsDialog } from './AIRecommendationsDialog';

interface ProspectsTableProps {
  onSelectProspect: (prospect: Prospect) => void;
}

type SortField = 'companyName' | 'contacts' | 'state' | 'type' | 'leadTier' | 'stage' | 'lastContact';
type SortDirection = 'asc' | 'desc' | null;

interface FilterSectionProps {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string, checked: boolean) => void;
  mode: 'include' | 'exclude';
  onModeChange: (mode: 'include' | 'exclude') => void;
}

const FilterSection = ({ label, items, selected, onToggle, mode, onModeChange }: FilterSectionProps) => (
  <div className="p-3 space-y-2">
    <div className="flex items-center justify-between">
      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
      <div className="flex gap-1">
        <button onClick={() => onModeChange('include')} className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${mode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Include</button>
        <button onClick={() => onModeChange('exclude')} className={`text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors ${mode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>Exclude</button>
      </div>
    </div>
    <div className="space-y-1">
      {items.map((item) => (
        <label key={item} className="flex items-center gap-2 text-sm py-1 px-1 rounded hover:bg-muted/50 cursor-pointer">
          <Checkbox
            checked={selected.includes(item)}
            onCheckedChange={(checked) => onToggle(item, !!checked)}
          />
          <span>{item}</span>
        </label>
      ))}
    </div>
  </div>
);

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

  const totalActiveFilters = typeFilter.length + stageFilter.length + leadTierFilter.length + verticalFilter.length;
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
        <div className="flex gap-2 flex-wrap">
          {/* Consolidated Filters Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
                <Filter className="w-4 h-4" />
                Filters
                {totalActiveFilters > 0 && (
                  <span className="text-xs px-1.5 rounded-full bg-accent text-accent-foreground">
                    {totalActiveFilters}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-80 p-0 rounded-xl" sideOffset={8}>
              <div className="p-3 border-b border-border flex items-center justify-between">
                <span className="text-sm font-semibold">Filters</span>
                {totalActiveFilters > 0 && (
                  <button
                    onClick={() => {
                      setTypeFilter([]);
                      setStageFilter([]);
                      setLeadTierFilter([]);
                      setVerticalFilter([]);
                      setTypeFilterMode('include');
                      setStageFilterMode('include');
                      setLeadTierFilterMode('include');
                      setVerticalFilterMode('include');
                    }}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto divide-y divide-border">
                {/* Business Model */}
                <FilterSection
                  label="Business Model"
                  items={types}
                  selected={typeFilter}
                  onToggle={(item, checked) => setTypeFilter(prev => checked ? [...prev, item] : prev.filter(t => t !== item))}
                  mode={typeFilterMode}
                  onModeChange={setTypeFilterMode}
                />
                {/* Stage */}
                <FilterSection
                  label="Stage"
                  items={stages}
                  selected={stageFilter}
                  onToggle={(item, checked) => setStageFilter(prev => checked ? [...prev, item] : prev.filter(s => s !== item))}
                  mode={stageFilterMode}
                  onModeChange={setStageFilterMode}
                />
                {/* Lead Tier */}
                <FilterSection
                  label="Lead Tier"
                  items={leadTiers}
                  selected={leadTierFilter}
                  onToggle={(item, checked) => setLeadTierFilter(prev => checked ? [...prev, item] : prev.filter(t => t !== item))}
                  mode={leadTierFilterMode}
                  onModeChange={setLeadTierFilterMode}
                />
                {/* Product Vertical */}
                <FilterSection
                  label="Product Vertical"
                  items={allVerticals}
                  selected={verticalFilter}
                  onToggle={(item, checked) => setVerticalFilter(prev => checked ? [...prev, item] : prev.filter(v => v !== item))}
                  mode={verticalFilterMode}
                  onModeChange={setVerticalFilterMode}
                />
              </div>
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ['Company', 'State', 'Type', 'Market Type', 'Lead Tier', 'Stage', 'Last Contact', 'Contacts', 'Website', 'LinkedIn'];
              const rows = filteredAndSortedProspects.map(p => [
                p.companyName,
                p.state || '',
                p.type || '',
                p.marketType || '',
                p.leadTier || '',
                p.stage || '',
                p.lastContact || '',
                (p.contacts || []).map(c => `${c.name} (${c.email || ''})`).join('; '),
                p.website || '',
                p.linkedIn || '',
              ]);
              exportToCSV(`prospects-${new Date().toISOString().slice(0, 10)}`, headers, rows);
            }}
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">Export</span>
          </Button>
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
