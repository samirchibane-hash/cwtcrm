import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import { Search, Filter, Download, X, CalendarIcon, ChevronRight, Bookmark, Building2, Star, CornerDownRight, Network } from 'lucide-react';
import { toast } from 'sonner';
import { Calendar } from '@/components/ui/calendar';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { exportToCSV } from '@/lib/export-csv';
import { useProspects } from '@/context/ProspectsContext';
import { Prospect, COMPANY_TYPES } from '@/data/prospects';
import { useProductVerticals } from '@/hooks/useProductVerticals';
import { useStageOptions } from '@/hooks/useStageOptions';
import { getProspectLastContactLabel, getProspectLastContactSortValue, getProspectLastContactDate } from '@/lib/prospect-last-contact';
import { buildChildrenIndex, matchesOwnership, OWNERSHIP_OPTIONS, type OwnershipFilter } from '@/lib/company-hierarchy';
import StageBadge from './StageBadge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import AddProspectPanel from './AddProspectPanel';
import SortableTh, { type SortDirection } from './SortableTh';

interface FilterPreset {
  id: string;
  name: string;
  params: Record<string, string>;
  lastContactFrom?: string;
  lastContactTo?: string;
}

const FILTER_PRESETS_KEY = 'cwt_prospect_filter_presets';

interface ProspectsTableProps {
  onSelectProspect: (prospect: Prospect) => void;
}

type SortField = 'companyName' | 'contacts' | 'state' | 'type' | 'stage' | 'lastContact' | 'engagements';

interface ExportColumn {
  key: string;
  label: string;
  getValue: (p: Prospect, parentName: (id?: string | null) => string) => string;
}

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: 'company', label: 'Company', getValue: p => p.companyName },
  { key: 'parent', label: 'Parent Company', getValue: (p, parentName) => parentName(p.parentId) },
  { key: 'state', label: 'State', getValue: p => p.state || '' },
  { key: 'type', label: 'Business Model', getValue: p => p.type || '' },
  { key: 'marketType', label: 'Product Vertical', getValue: p => p.marketType || '' },
  { key: 'stage', label: 'Stage', getValue: p => p.stage || '' },
  { key: 'lastContact', label: 'Last Contact', getValue: p => p.lastContact || '' },
  { key: 'contacts', label: 'Contacts', getValue: p => (p.contacts || []).map(c => `${c.name} (${c.email || ''})`).join('; ') },
  { key: 'website', label: 'Website', getValue: p => p.website || '' },
  { key: 'linkedIn', label: 'LinkedIn', getValue: p => p.linkedIn || '' },
  { key: 'street', label: 'Street', getValue: p => p.street || '' },
  { key: 'city', label: 'City', getValue: p => p.city || '' },
  { key: 'zip', label: 'Zip', getValue: p => p.zip || '' },
  { key: 'country', label: 'Country', getValue: p => p.country || '' },
  { key: 'notes', label: 'Notes', getValue: p => p.engagementNotes || '' },
];

const DEFAULT_EXPORT_KEYS = ['company', 'parent', 'state', 'type', 'marketType', 'stage', 'lastContact', 'contacts', 'website', 'linkedIn'];

const ExportColumnsPopover = ({ data, parentName }: { data: Prospect[]; parentName: (id?: string | null) => string }) => {
  const [selectedKeys, setSelectedKeys] = useState<string[]>(DEFAULT_EXPORT_KEYS);

  const toggleKey = (key: string, checked: boolean) => {
    setSelectedKeys(prev => checked ? [...prev, key] : prev.filter(k => k !== key));
  };

  const handleExport = () => {
    const cols = EXPORT_COLUMNS.filter(c => selectedKeys.includes(c.key));
    const headers = cols.map(c => c.label);
    const rows = data.map(p => cols.map(c => c.getValue(p, parentName)));
    exportToCSV(`prospects-${new Date().toISOString().slice(0, 10)}`, headers, rows);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 rounded-xl h-11 px-4">
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0 rounded-xl" sideOffset={8}>
        <div className="p-3 border-b border-border flex items-center justify-between">
          <span className="text-sm font-semibold">Export Columns</span>
          <button
            onClick={() => setSelectedKeys(
              selectedKeys.length === EXPORT_COLUMNS.length ? DEFAULT_EXPORT_KEYS : EXPORT_COLUMNS.map(c => c.key)
            )}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {selectedKeys.length === EXPORT_COLUMNS.length ? 'Reset' : 'Select all'}
          </button>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2 space-y-0.5">
          {EXPORT_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2 text-sm py-1.5 px-2 rounded hover:bg-muted/50 cursor-pointer">
              <Checkbox
                checked={selectedKeys.includes(col.key)}
                onCheckedChange={(checked) => toggleKey(col.key, !!checked)}
              />
              <span>{col.label}</span>
            </label>
          ))}
        </div>
        <div className="p-2 border-t border-border">
          <Button size="sm" className="w-full" onClick={handleExport} disabled={selectedKeys.length === 0}>
            <Download className="h-4 w-4 mr-1" />
            Export {data.length} rows
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

interface FilterSectionProps {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (item: string, checked: boolean) => void;
  mode: 'include' | 'exclude';
  onModeChange: (mode: 'include' | 'exclude') => void;
}

const FilterSection = ({ label, items, selected, onToggle, mode, onModeChange }: FilterSectionProps) => {
  const [open, setOpen] = useState(false);
  const activeCount = selected.length;
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          {label}
          {activeCount > 0 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium normal-case">
              {activeCount}
            </span>
          )}
        </span>
        <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button type="button" onClick={() => onModeChange('include')} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors", mode === 'include' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Include</button>
          <button type="button" onClick={() => onModeChange('exclude')} className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium transition-colors", mode === 'exclude' ? 'bg-destructive text-destructive-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80')}>Exclude</button>
        </div>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-1">
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
      )}
    </div>
  );
};

const LastContactFilterSection = ({
  lastContactFrom, lastContactTo, setLastContactFrom, setLastContactTo,
  lastContactCalendarOpen, setLastContactCalendarOpen, hasLastContactFilter,
}: {
  lastContactFrom?: Date; lastContactTo?: Date;
  setLastContactFrom: (d: Date | undefined) => void; setLastContactTo: (d: Date | undefined) => void;
  lastContactCalendarOpen: 'from' | 'to' | null; setLastContactCalendarOpen: (v: 'from' | 'to' | null) => void;
  hasLastContactFilter: boolean;
}) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          Last Contact
          {hasLastContactFilter && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium normal-case">1</span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Popover open={lastContactCalendarOpen === 'from'} onOpenChange={(o) => setLastContactCalendarOpen(o ? 'from' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs h-8", !lastContactFrom && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {lastContactFrom ? format(lastContactFrom, 'MM/dd/yyyy') : 'From'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="bottom">
                <Calendar mode="single" selected={lastContactFrom} onSelect={(date) => { setLastContactFrom(date ?? undefined); setLastContactCalendarOpen(null); }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
            <span className="text-xs text-muted-foreground">–</span>
            <Popover open={lastContactCalendarOpen === 'to'} onOpenChange={(o) => setLastContactCalendarOpen(o ? 'to' : null)}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className={cn("flex-1 justify-start text-left text-xs h-8", !lastContactTo && "text-muted-foreground")}>
                  <CalendarIcon className="mr-1 h-3 w-3" />
                  {lastContactTo ? format(lastContactTo, 'MM/dd/yyyy') : 'To'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start" side="bottom">
                <Calendar mode="single" selected={lastContactTo} onSelect={(date) => { setLastContactTo(date ?? undefined); setLastContactCalendarOpen(null); }} initialFocus className={cn("p-3 pointer-events-auto")} />
              </PopoverContent>
            </Popover>
          </div>
          {hasLastContactFilter && (
            <button onClick={() => { setLastContactFrom(undefined); setLastContactTo(undefined); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Clear dates
            </button>
          )}
        </div>
      )}
    </div>
  );
};

const EngagementsFilterSection = ({
  engagementsMin, engagementsMax, setEngagementsMin, setEngagementsMax, hasEngagementsFilter,
}: {
  engagementsMin: string; engagementsMax: string;
  setEngagementsMin: (v: string) => void; setEngagementsMax: (v: string) => void;
  hasEngagementsFilter: boolean;
}) => {
  const [open, setOpen] = useState(false);
  const sanitize = (v: string) => v.replace(/[^0-9]/g, '');
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full p-3 hover:bg-muted/30 transition-colors"
      >
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <ChevronRight className={cn("h-3 w-3 transition-transform", open && "rotate-90")} />
          # of Engagements
          {hasEngagementsFilter && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground font-medium normal-case">1</span>
          )}
        </span>
      </button>
      {open && (
        <div className="px-3 pb-3 space-y-2">
          <div className="flex items-center gap-2">
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Min"
              value={engagementsMin}
              onChange={(e) => setEngagementsMin(sanitize(e.target.value))}
              className="flex-1 h-8 text-xs"
            />
            <span className="text-xs text-muted-foreground">–</span>
            <Input
              type="number"
              min={0}
              inputMode="numeric"
              placeholder="Max"
              value={engagementsMax}
              onChange={(e) => setEngagementsMax(sanitize(e.target.value))}
              className="flex-1 h-8 text-xs"
            />
          </div>
          {hasEngagementsFilter && (
            <button onClick={() => { setEngagementsMin(''); setEngagementsMax(''); }} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              Clear range
            </button>
          )}
        </div>
      )}
    </div>
  );
};

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
    // Lead Tier values are now ordinary stages; merge any legacy `tier` param in
    // so old bookmarks and saved presets keep working.
    const stageVal = searchParams.get('stage');
    const tierVal = searchParams.get('tier');
    const merged = [
      ...(stageVal ? stageVal.split(',') : []),
      ...(tierVal ? tierVal.split(',') : []),
    ];
    return Array.from(new Set(merged));
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
  const [verticalFilterMode, setVerticalFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('verticalMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [ownershipFilter, setOwnershipFilter] = useState<OwnershipFilter[]>(() => {
    const valid = OWNERSHIP_OPTIONS.map(o => o.value);
    return (searchParams.get('ownership')?.split(',') ?? []).filter((v): v is OwnershipFilter => valid.includes(v as OwnershipFilter));
  });
  const [ownershipFilterMode, setOwnershipFilterMode] = useState<'include' | 'exclude'>(() =>
    searchParams.get('ownershipMode') === 'exclude' ? 'exclude' : 'include'
  );
  const [lastContactFrom, setLastContactFrom] = useState<Date | undefined>(() => {
    const val = searchParams.get('lastContactFrom');
    return val ? new Date(val) : undefined;
  });
  const [lastContactTo, setLastContactTo] = useState<Date | undefined>(() => {
    const val = searchParams.get('lastContactTo');
    return val ? new Date(val) : undefined;
  });
  const [lastContactCalendarOpen, setLastContactCalendarOpen] = useState<'from' | 'to' | null>(null);
  const [engagementsMin, setEngagementsMin] = useState<string>(() => searchParams.get('engMin') || '');
  const [engagementsMax, setEngagementsMax] = useState<string>(() => searchParams.get('engMax') || '');
  const [sortField, setSortField] = useState<SortField | null>(() => {
    const field = searchParams.get('sortField');
    if (field && ['companyName', 'contacts', 'state', 'type', 'stage', 'lastContact', 'engagements'].includes(field)) {
      return field as SortField;
    }
    return null;
  });
  const [sortDirection, setSortDirection] = useState<SortDirection>(() => {
    const dir = searchParams.get('sortDir');
    if (dir === 'asc' || dir === 'desc') return dir;
    return null;
  });

  const [savedPresets, setSavedPresets] = useState<FilterPreset[]>(() => {
    try { return JSON.parse(localStorage.getItem(FILTER_PRESETS_KEY) || '[]'); }
    catch { return []; }
  });
  const [savePresetName, setSavePresetName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [presetToDelete, setPresetToDelete] = useState<FilterPreset | null>(null);

  const savePreset = () => {
    const name = savePresetName.trim();
    if (!name) return;
    const preset: FilterPreset = { id: Date.now().toString(), name, ...presetPayload() };
    const updated = [...savedPresets, preset];
    setSavedPresets(updated);
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updated));
    setSavePresetName('');
    setShowSaveInput(false);
    toast.success(`Saved view “${name}”`);
  };

  const loadPreset = (preset: FilterPreset) => {
    setSearchQuery(preset.params.q || '');
    setTypeFilter(preset.params.type ? preset.params.type.split(',') : []);
    setStageFilter(Array.from(new Set([
      ...(preset.params.stage ? preset.params.stage.split(',') : []),
      ...(preset.params.tier ? preset.params.tier.split(',') : []),
    ])));
    setVerticalFilter(preset.params.vertical ? preset.params.vertical.split(',') : []);
    setTypeFilterMode(preset.params.typeMode === 'exclude' ? 'exclude' : 'include');
    setStageFilterMode(preset.params.stageMode === 'exclude' ? 'exclude' : 'include');
    setVerticalFilterMode(preset.params.verticalMode === 'exclude' ? 'exclude' : 'include');
    setOwnershipFilter(preset.params.ownership ? preset.params.ownership.split(',') as OwnershipFilter[] : []);
    setOwnershipFilterMode(preset.params.ownershipMode === 'exclude' ? 'exclude' : 'include');
    setLastContactFrom(preset.lastContactFrom ? new Date(preset.lastContactFrom) : undefined);
    setLastContactTo(preset.lastContactTo ? new Date(preset.lastContactTo) : undefined);
    setEngagementsMin(preset.params.engMin || '');
    setEngagementsMax(preset.params.engMax || '');
  };

  const deletePreset = (id: string) => {
    const updated = savedPresets.filter(p => p.id !== id);
    setSavedPresets(updated);
    localStorage.setItem(FILTER_PRESETS_KEY, JSON.stringify(updated));
  };

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
    // Legacy `tier` param is folded into `stage`; clear it so it can't linger.
    newParams.delete('tier');
    newParams.delete('tierMode');

    if (verticalFilter.length > 0) newParams.set('vertical', verticalFilter.join(','));
    else newParams.delete('vertical');

    if (typeFilterMode === 'exclude') newParams.set('typeMode', 'exclude');
    else newParams.delete('typeMode');

    if (stageFilterMode === 'exclude') newParams.set('stageMode', 'exclude');
    else newParams.delete('stageMode');

    if (verticalFilterMode === 'exclude') newParams.set('verticalMode', 'exclude');
    else newParams.delete('verticalMode');

    if (ownershipFilter.length > 0) newParams.set('ownership', ownershipFilter.join(','));
    else newParams.delete('ownership');

    if (ownershipFilterMode === 'exclude') newParams.set('ownershipMode', 'exclude');
    else newParams.delete('ownershipMode');

    if (lastContactFrom) newParams.set('lastContactFrom', lastContactFrom.toISOString());
    else newParams.delete('lastContactFrom');

    if (lastContactTo) newParams.set('lastContactTo', lastContactTo.toISOString());
    else newParams.delete('lastContactTo');

    if (engagementsMin) newParams.set('engMin', engagementsMin);
    else newParams.delete('engMin');

    if (engagementsMax) newParams.set('engMax', engagementsMax);
    else newParams.delete('engMax');

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
  }, [searchQuery, typeFilter, stageFilter, verticalFilter, typeFilterMode, stageFilterMode, verticalFilterMode, ownershipFilter, ownershipFilterMode, lastContactFrom, lastContactTo, engagementsMin, engagementsMax, sortField, sortDirection, searchParams, setSearchParams]);

  // Filter options: merge static constants with any custom stages present in actual data
  const types = COMPANY_TYPES.filter(t => t !== '');
  const { allStages: stages } = useStageOptions();
  const { allVerticals } = useProductVerticals();

  const hasLastContactFilter = lastContactFrom !== undefined || lastContactTo !== undefined;
  const hasEngagementsFilter = engagementsMin !== '' || engagementsMax !== '';
  const totalActiveFilters = typeFilter.length + stageFilter.length + verticalFilter.length + ownershipFilter.length + (hasLastContactFilter ? 1 : 0) + (hasEngagementsFilter ? 1 : 0);

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

  // Ownership lookups, built once per data change
  const prospectNameById = useMemo(() => new Map(prospects.map(p => [p.id, p.companyName])), [prospects]);
  const childrenIndex = useMemo(() => buildChildrenIndex(prospects), [prospects]);
  const parentName = (id?: string | null) => (id ? prospectNameById.get(id) ?? '' : '');

  const filteredAndSortedProspects = useMemo(() => {
    const q = searchQuery.toLowerCase();
    let result = prospects.filter((prospect) => {
      const matchesSearch = 
        prospect.companyName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        // Searching "A.O. Smith" also surfaces the companies it owns
        (!!prospect.parentId && (prospectNameById.get(prospect.parentId) ?? '').toLowerCase().includes(q)) ||
        prospect.contacts.some(c => c.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        prospect.state.toLowerCase().includes(searchQuery.toLowerCase()) ||
        prospect.engagementNotes.toLowerCase().includes(searchQuery.toLowerCase());
      
      const matchesType = typeFilter.length === 0 || (
        typeFilterMode === 'include' ? typeFilter.includes(prospect.type) : !typeFilter.includes(prospect.type)
      );
      
      const matchesStageValue = (value: string) =>
        prospect.stage.toLowerCase().includes(value.toLowerCase());
      const matchesStage = stageFilter.length === 0 || (
        stageFilterMode === 'include'
          ? stageFilter.some(matchesStageValue)
          : !stageFilter.some(matchesStageValue)
      );

      const matchesVertical = verticalFilter.length === 0 || (
        verticalFilterMode === 'include' ? verticalFilter.includes(prospect.marketType || '') : !verticalFilter.includes(prospect.marketType || '')
      );

      const matchesOwnershipFilter = ownershipFilter.length === 0 || (
        ownershipFilterMode === 'include'
          ? ownershipFilter.some(f => matchesOwnership(prospect, f, childrenIndex))
          : !ownershipFilter.some(f => matchesOwnership(prospect, f, childrenIndex))
      );

      let matchesLastContact = true;
      if (lastContactFrom || lastContactTo) {
        const lastContactDate = getProspectLastContactDate(prospect);
        if (!lastContactDate) {
          matchesLastContact = false;
        } else {
          if (lastContactFrom && lastContactDate < lastContactFrom) matchesLastContact = false;
          if (lastContactTo) {
            const endOfDay = new Date(lastContactTo);
            endOfDay.setHours(23, 59, 59, 999);
            if (lastContactDate > endOfDay) matchesLastContact = false;
          }
        }
      }

      let matchesEngagements = true;
      if (engagementsMin !== '' || engagementsMax !== '') {
        const engagementCount = (prospect.engagements || []).length;
        const min = engagementsMin !== '' ? parseInt(engagementsMin, 10) : null;
        const max = engagementsMax !== '' ? parseInt(engagementsMax, 10) : null;
        if (min !== null && !Number.isNaN(min) && engagementCount < min) matchesEngagements = false;
        if (max !== null && !Number.isNaN(max) && engagementCount > max) matchesEngagements = false;
      }

      return matchesSearch && matchesType && matchesStage && matchesVertical && matchesOwnershipFilter && matchesLastContact && matchesEngagements;
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
            aVal = getProspectLastContactSortValue(a);
            bVal = getProspectLastContactSortValue(b);
            break;
          case 'engagements':
            aVal = (a.engagements || []).length;
            bVal = (b.engagements || []).length;
            break;
        }

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return result;
  }, [prospects, prospectNameById, childrenIndex, searchQuery, typeFilter, stageFilter, verticalFilter, typeFilterMode, stageFilterMode, verticalFilterMode, ownershipFilter, ownershipFilterMode, lastContactFrom, lastContactTo, engagementsMin, engagementsMax, sortField, sortDirection]);

  const presetPayload = (): Omit<FilterPreset, 'id' | 'name'> => ({
    params: {
      ...(searchQuery && { q: searchQuery }),
      ...(typeFilter.length && { type: typeFilter.join(',') }),
      ...(stageFilter.length && { stage: stageFilter.join(',') }),
      ...(verticalFilter.length && { vertical: verticalFilter.join(',') }),
      ...(typeFilterMode === 'exclude' && { typeMode: 'exclude' }),
      ...(stageFilterMode === 'exclude' && { stageMode: 'exclude' }),
      ...(verticalFilterMode === 'exclude' && { verticalMode: 'exclude' }),
      ...(ownershipFilter.length && { ownership: ownershipFilter.join(',') }),
      ...(ownershipFilterMode === 'exclude' && { ownershipMode: 'exclude' }),
      ...(engagementsMin && { engMin: engagementsMin }),
      ...(engagementsMax && { engMax: engagementsMax }),
    },
    ...(lastContactFrom && { lastContactFrom: lastContactFrom.toISOString() }),
    ...(lastContactTo && { lastContactTo: lastContactTo.toISOString() }),
  });

  const presetSignature = (p: Omit<FilterPreset, 'id' | 'name'>) =>
    JSON.stringify([Object.entries(p.params).sort(), p.lastContactFrom ?? '', p.lastContactTo ?? '']);
  const currentSignature = presetSignature(presetPayload());
  const activePresetId = savedPresets.find(p => presetSignature(p) === currentSignature)?.id;

  const clearAllFilters = () => {
    setTypeFilter([]);
    setStageFilter([]);
    setVerticalFilter([]);
    setTypeFilterMode('include');
    setStageFilterMode('include');
    setVerticalFilterMode('include');
    setOwnershipFilter([]);
    setOwnershipFilterMode('include');
    setLastContactFrom(undefined);
    setLastContactTo(undefined);
    setEngagementsMin('');
    setEngagementsMax('');
  };

  const isUnfiltered = totalActiveFilters === 0 && !searchQuery;

  const fmtDate = (d: Date) => format(d, 'MMM d, yyyy');
  const activeChips: { key: string; label: string; negated?: boolean; value: string; clear: () => void }[] = [];
  if (typeFilter.length) activeChips.push({ key: 'type', label: 'Business model', negated: typeFilterMode === 'exclude', value: typeFilter.join(', '), clear: () => { setTypeFilter([]); setTypeFilterMode('include'); } });
  if (stageFilter.length) activeChips.push({ key: 'stage', label: 'Stage', negated: stageFilterMode === 'exclude', value: stageFilter.join(', '), clear: () => { setStageFilter([]); setStageFilterMode('include'); } });
  if (verticalFilter.length) activeChips.push({ key: 'vertical', label: 'Vertical', negated: verticalFilterMode === 'exclude', value: verticalFilter.join(', '), clear: () => { setVerticalFilter([]); setVerticalFilterMode('include'); } });
  const ownershipLabel = (v: OwnershipFilter) => OWNERSHIP_OPTIONS.find(o => o.value === v)?.label ?? v;
  if (ownershipFilter.length) activeChips.push({ key: 'ownership', label: 'Ownership', negated: ownershipFilterMode === 'exclude', value: ownershipFilter.map(ownershipLabel).join(', '), clear: () => { setOwnershipFilter([]); setOwnershipFilterMode('include'); } });
  if (hasLastContactFilter) activeChips.push({
    key: 'lastContact',
    label: 'Last contact',
    value: lastContactFrom && lastContactTo ? `${fmtDate(lastContactFrom)} – ${fmtDate(lastContactTo)}` : lastContactFrom ? `after ${fmtDate(lastContactFrom)}` : `before ${fmtDate(lastContactTo!)}`,
    clear: () => { setLastContactFrom(undefined); setLastContactTo(undefined); },
  });
  if (hasEngagementsFilter) activeChips.push({
    key: 'engagements',
    label: 'Engagements',
    value: engagementsMin && engagementsMax ? `${engagementsMin}–${engagementsMax}` : engagementsMin ? `≥ ${engagementsMin}` : `≤ ${engagementsMax}`,
    clear: () => { setEngagementsMin(''); setEngagementsMax(''); },
  });

  const renderContacts = (prospect: Prospect) => {
    const champion = prospect.contacts.find(c => c.isChampion);
    if (champion) {
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <Star className="h-3.5 w-3.5 shrink-0 fill-champion text-champion" aria-hidden="true" />
          <span className="sr-only">Champion: </span>
          <span className="truncate font-medium text-foreground">{champion.name}</span>
        </span>
      );
    }
    const count = prospect.contacts.length;
    return count > 0 ? `${count} contact${count === 1 ? '' : 's'}` : '—';
  };

  // Second line under the company name: who owns it and/or how many it owns
  const renderOwnership = (prospect: Prospect) => {
    const owner = parentName(prospect.parentId);
    const subsidiaryCount = childrenIndex.get(prospect.id)?.length ?? 0;
    if (!owner && subsidiaryCount === 0) return null;
    return (
      <span className="mt-0.5 flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
        {owner && (
          <span className="flex min-w-0 items-center gap-1" title={`Owned by ${owner}`}>
            <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="sr-only">Owned by </span>
            <span className="truncate">{owner}</span>
          </span>
        )}
        {subsidiaryCount > 0 && (
          <span className="flex shrink-0 items-center gap-1">
            <Network className="h-3 w-3" aria-hidden="true" />
            {subsidiaryCount} {subsidiaryCount === 1 ? 'subsidiary' : 'subsidiaries'}
          </span>
        )}
      </span>
    );
  };

  const sortProps = { sortField, sortDirection, onSort: handleSort };

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
      <div className="content-card" aria-busy="true" aria-label="Loading pipeline">
        <div className="p-3 border-b border-border flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg" />
          <Skeleton className="h-10 w-24 rounded-lg hidden sm:block" />
          <Skeleton className="h-10 w-36 rounded-lg hidden sm:block" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-3 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-28 hidden md:block" />
              <Skeleton className="h-4 w-10 hidden md:block" />
              <Skeleton className="h-4 w-20 hidden md:block" />
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-20 hidden md:block ml-auto" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="content-card animate-fade-in">
      {/* Toolbar */}
      <div className="p-3 border-b border-border flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
          <Input
            type="search"
            aria-label="Search companies"
            placeholder="Search companies, contacts, notes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 border-0 bg-muted/50 rounded-lg"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {/* Consolidated Filters Popover */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2 rounded-lg h-10 px-3">
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
                    onClick={clearAllFilters}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Clear all
                  </button>
                )}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
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
                {/* Product Vertical */}
                <FilterSection
                  label="Product Vertical"
                  items={allVerticals}
                  selected={verticalFilter}
                  onToggle={(item, checked) => setVerticalFilter(prev => checked ? [...prev, item] : prev.filter(v => v !== item))}
                  mode={verticalFilterMode}
                  onModeChange={setVerticalFilterMode}
                />
                {/* Ownership (parent / subsidiary) */}
                <FilterSection
                  label="Ownership"
                  items={OWNERSHIP_OPTIONS.map(o => o.label)}
                  selected={ownershipFilter.map(ownershipLabel)}
                  onToggle={(label, checked) => {
                    const value = OWNERSHIP_OPTIONS.find(o => o.label === label)?.value;
                    if (!value) return;
                    setOwnershipFilter(prev => checked ? [...prev, value] : prev.filter(v => v !== value));
                  }}
                  mode={ownershipFilterMode}
                  onModeChange={setOwnershipFilterMode}
                />
                {/* Last Contact Date Range - collapsible */}
                <LastContactFilterSection
                  lastContactFrom={lastContactFrom}
                  lastContactTo={lastContactTo}
                  setLastContactFrom={setLastContactFrom}
                  setLastContactTo={setLastContactTo}
                  lastContactCalendarOpen={lastContactCalendarOpen}
                  setLastContactCalendarOpen={setLastContactCalendarOpen}
                  hasLastContactFilter={hasLastContactFilter}
                />
                {/* # of Engagements Range - collapsible */}
                <EngagementsFilterSection
                  engagementsMin={engagementsMin}
                  engagementsMax={engagementsMax}
                  setEngagementsMin={setEngagementsMin}
                  setEngagementsMax={setEngagementsMax}
                  hasEngagementsFilter={hasEngagementsFilter}
                />
              </div>
            </PopoverContent>
          </Popover>

          <ExportColumnsPopover data={filteredAndSortedProspects} parentName={parentName} />
          <AddProspectPanel />
        </div>
      </div>

      {/* Saved views */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto" role="group" aria-label="Saved views">
        <button
          type="button"
          aria-pressed={isUnfiltered}
          onClick={() => { clearAllFilters(); setSearchQuery(''); }}
          className={cn(
            'h-7 shrink-0 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
            isUnfiltered ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
          )}
        >
          All companies
        </button>
        {savedPresets.map(preset => {
          const active = preset.id === activePresetId;
          return (
            <div
              key={preset.id}
              className={cn(
                'group flex h-7 shrink-0 items-center rounded-md transition-colors',
                active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              <button
                type="button"
                aria-pressed={active}
                onClick={() => loadPreset(preset)}
                className="h-full pl-2.5 pr-1 rounded-md text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {preset.name}
              </button>
              <button
                type="button"
                aria-label={`Delete view ${preset.name}`}
                onClick={() => setPresetToDelete(preset)}
                className="mr-1 rounded p-0.5 text-muted-foreground hover:text-destructive outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 border-b border-border bg-muted/20">
          {activeChips.map(chip => (
            <span key={chip.key} className="inline-flex max-w-full items-center gap-1 h-7 pl-2.5 pr-1 rounded-md border border-border bg-card text-xs">
              <span className="text-muted-foreground shrink-0">{chip.label} {chip.negated ? 'is not' : chip.key === 'lastContact' || chip.key === 'engagements' ? '' : 'is'}</span>
              <span className="truncate max-w-[16rem] font-medium" title={chip.value}>{chip.value}</span>
              <button
                type="button"
                aria-label={`Remove ${chip.label} filter`}
                onClick={chip.clear}
                className="ml-0.5 rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            onClick={clearAllFilters}
            className="h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Clear all
          </button>
          <div className="ml-auto flex items-center gap-1.5">
            {showSaveInput ? (
              <form
                className="flex items-center gap-1.5"
                onSubmit={e => { e.preventDefault(); savePreset(); }}
              >
                <Input
                  autoFocus
                  aria-label="View name"
                  placeholder="View name…"
                  value={savePresetName}
                  onChange={e => setSavePresetName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') { setShowSaveInput(false); setSavePresetName(''); } }}
                  className="h-7 w-40 text-xs"
                />
                <Button type="submit" size="sm" className="h-7 px-2.5 text-xs" disabled={!savePresetName.trim()}>Save</Button>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setShowSaveInput(false); setSavePresetName(''); }}>Cancel</Button>
              </form>
            ) : !activePresetId && (
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 px-2 text-xs" onClick={() => setShowSaveInput(true)}>
                <Bookmark className="h-3 w-3" />
                Save as view
              </Button>
            )}
          </div>
        </div>
      )}

      {filteredAndSortedProspects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Building2 className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {prospects.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">Your pipeline is empty. Add the first company you’re working.</p>
              <AddProspectPanel />
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No companies match {searchQuery ? `“${searchQuery}” with ` : ''}these filters.</p>
              <Button variant="outline" size="sm" onClick={() => { clearAllFilters(); setSearchQuery(''); }}>
                Clear search and filters
              </Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards instead of a sideways-scrolling table */}
          <ul className="md:hidden divide-y divide-border">
            {filteredAndSortedProspects.map(prospect => (
              <li key={prospect.id}>
                <button
                  type="button"
                  onClick={() => handleRowClick(prospect)}
                  className="w-full text-left px-3 py-3 space-y-1.5 active:bg-muted/50 outline-none focus-visible:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="min-w-0">
                      <span className="block font-medium text-sm leading-snug">{prospect.companyName}</span>
                      {renderOwnership(prospect)}
                    </span>
                    <StageBadge stage={prospect.stage} maxVisible={1} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="min-w-0 truncate">{renderContacts(prospect)}</span>
                    {prospect.state && <span className="shrink-0">· {prospect.state}</span>}
                    <span className="ml-auto shrink-0 font-mono">{getProspectLastContactLabel(prospect) || '—'}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Desktop table */}
          <div className="hidden md:block max-h-[calc(100dvh-19rem)] overflow-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <SortableTh field="companyName" label="Company" {...sortProps} />
                  <SortableTh field="contacts" label="Contacts" {...sortProps} />
                  <SortableTh field="state" label="Location" {...sortProps} />
                  <SortableTh field="type" label="Business Model" {...sortProps} />
                  <SortableTh field="stage" label="Stage" {...sortProps} />
                  <SortableTh field="lastContact" label="Last Contact" {...sortProps} />
                  <SortableTh field="engagements" label="Engagements" align="right" {...sortProps} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredAndSortedProspects.map((prospect) => {
                  const engagementCount = (prospect.engagements || []).length;
                  return (
                    <tr
                      key={prospect.id}
                      tabIndex={0}
                      className="table-row-hover cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:shadow-[inset_2px_0_0_hsl(var(--ring))]"
                      onClick={() => handleRowClick(prospect)}
                      onKeyDown={e => { if (e.key === 'Enter') handleRowClick(prospect); }}
                    >
                      <td className="px-3 py-2.5 max-w-[18rem]">
                        <span className="block truncate font-medium text-sm">{prospect.companyName}</span>
                        {renderOwnership(prospect)}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[12rem]">
                        {renderContacts(prospect)}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground">
                        {prospect.state || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm text-muted-foreground">
                        {prospect.type || '—'}
                      </td>
                      <td className="px-3 py-2.5">
                        <StageBadge stage={prospect.stage} />
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground whitespace-nowrap">
                        {getProspectLastContactLabel(prospect) || '—'}
                      </td>
                      <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground text-right tabular-nums">
                        {engagementCount > 0 ? engagementCount : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Footer */}
      <div className="px-3 py-2.5 border-t border-border text-xs text-muted-foreground">
        Showing {filteredAndSortedProspects.length.toLocaleString()} of {prospects.length.toLocaleString()} companies
      </div>

      <AlertDialog open={!!presetToDelete} onOpenChange={open => { if (!open) setPresetToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the “{presetToDelete?.name}” view?</AlertDialogTitle>
            <AlertDialogDescription>
              The saved filters are removed from this browser. Companies in the pipeline aren’t affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (presetToDelete) deletePreset(presetToDelete.id); setPresetToDelete(null); }}
            >
              Delete view
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProspectsTable;
