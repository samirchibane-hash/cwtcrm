import { useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Landmark, Plus, Search, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useInvestors } from '@/context/InvestorsContext';
import { Investor, INVESTOR_STAGES, INVESTOR_TYPES, emptyInvestor } from '@/data/investors';
import { getProspectLastContactLabel, getProspectLastContactSortValue } from '@/lib/prospect-last-contact';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import InvestorStageBadge from './InvestorStageBadge';
import InvestorFormPanel, { type InvestorFormData } from './InvestorFormPanel';
import SortableTh, { type SortDirection } from './SortableTh';

type SortField = 'name' | 'investorType' | 'stage' | 'contacts' | 'location' | 'lastContact' | 'engagements';
const SORT_FIELDS: SortField[] = ['name', 'investorType', 'stage', 'contacts', 'location', 'lastContact', 'engagements'];
const ALL = 'all';

const locationOf = (i: Investor) => [i.city, i.state].filter(Boolean).join(', ') || i.country;

const InvestorsTable = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { investors, isLoading, addInvestor } = useInvestors();
  const [addOpen, setAddOpen] = useState(false);

  // Filter/sort state lives in the URL (shareable, survives refresh)
  const query = searchParams.get('q') ?? '';
  const stageFilter = (INVESTOR_STAGES as readonly string[]).includes(searchParams.get('stage') ?? '') ? searchParams.get('stage')! : ALL;
  const typeFilter = (INVESTOR_TYPES as readonly string[]).includes(searchParams.get('type') ?? '') ? searchParams.get('type')! : ALL;
  const sortField = SORT_FIELDS.includes(searchParams.get('sortField') as SortField) ? (searchParams.get('sortField') as SortField) : null;
  const sortDirection: SortDirection = searchParams.get('sortDir') === 'asc' || searchParams.get('sortDir') === 'desc' ? (searchParams.get('sortDir') as SortDirection) : null;

  const updateParams = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(searchParams);
    for (const [k, v] of Object.entries(changes)) {
      if (v === null || v === '' || v === ALL) next.delete(k);
      else next.set(k, v);
    }
    setSearchParams(next, { replace: true });
  };

  const handleSort = (field: SortField) => {
    if (sortField !== field) updateParams({ sortField: field, sortDir: 'asc' });
    else if (sortDirection === 'asc') updateParams({ sortDir: 'desc' });
    else updateParams({ sortField: null, sortDir: null });
  };
  const sortProps = { sortField, sortDirection, onSort: handleSort };

  const stageCounts = useMemo(() => {
    const counts: Record<string, number> = { [ALL]: investors.length };
    for (const i of investors) if (i.stage) counts[i.stage] = (counts[i.stage] ?? 0) + 1;
    return counts;
  }, [investors]);

  const rows = useMemo(() => {
    const q = query.toLowerCase();
    const list = investors.filter(i =>
      (stageFilter === ALL || i.stage === stageFilter) &&
      (typeFilter === ALL || i.investorType === typeFilter) &&
      (!q ||
        i.name.toLowerCase().includes(q) ||
        i.contacts.some(c => c.name.toLowerCase().includes(q)) ||
        locationOf(i).toLowerCase().includes(q) ||
        i.notes.toLowerCase().includes(q)),
    );
    if (!sortField || !sortDirection) return list;
    const value = (i: Investor): string | number => {
      switch (sortField) {
        case 'name': return i.name.toLowerCase();
        case 'investorType': return i.investorType.toLowerCase();
        // Funnel order, not alphabetical
        case 'stage': return i.stage ? (INVESTOR_STAGES as readonly string[]).indexOf(i.stage) : 99;
        case 'contacts': return i.contacts.length;
        case 'location': return locationOf(i).toLowerCase();
        case 'lastContact': return getProspectLastContactSortValue(i);
        case 'engagements': return i.engagements.length;
      }
    };
    const dir = sortDirection === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => (value(a) < value(b) ? -dir : value(a) > value(b) ? dir : 0));
  }, [investors, query, stageFilter, typeFilter, sortField, sortDirection]);

  const hasFilters = !!query || stageFilter !== ALL || typeFilter !== ALL;
  const clearFilters = () => updateParams({ q: null, stage: null, type: null });

  const openInvestor = (investor: Investor) => {
    navigate(`/investor/${investor.id}`, {
      state: { from: `/${location.search || '?view=investors'}`, investorIds: rows.map(r => r.id) },
    });
  };

  const handleAdd = async (data: InvestorFormData) => {
    const created = await addInvestor({ ...emptyInvestor(), ...data });
    if (created) toast.success(`Added ${created.name}`, { action: { label: 'Open', onClick: () => openInvestor(created) } });
    return !!created;
  };

  const champion = (i: Investor) => i.contacts.find(c => c.isChampion);
  const renderContacts = (i: Investor) => {
    const c = champion(i);
    if (c) {
      return (
        <span className="flex items-center gap-1.5 min-w-0">
          <Star className="h-3.5 w-3.5 shrink-0 fill-champion text-champion" aria-hidden="true" />
          <span className="sr-only">Champion: </span>
          <span className="truncate font-medium text-foreground">{c.name}</span>
        </span>
      );
    }
    return i.contacts.length > 0 ? `${i.contacts.length} contact${i.contacts.length === 1 ? '' : 's'}` : '—';
  };

  const addButton = (
    <Button className="gap-2 h-10" onClick={() => setAddOpen(true)}>
      <Plus className="h-4 w-4" />
      New investor
    </Button>
  );

  if (isLoading) {
    return (
      <div className="content-card" aria-busy="true" aria-label="Loading investors">
        <div className="p-3 border-b border-border flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-lg" />
          <Skeleton className="h-10 w-40 rounded-lg hidden sm:block" />
          <Skeleton className="h-10 w-36 rounded-lg" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-6 px-3 py-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-20 hidden md:block" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-28 hidden md:block" />
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
            aria-label="Search investors"
            placeholder="Search investors, contacts, notes…"
            value={query}
            onChange={e => updateParams({ q: e.target.value })}
            className="pl-9 h-10 border-0 bg-muted/50 rounded-lg"
          />
        </div>
        <div className="flex gap-2">
          <Select value={typeFilter} onValueChange={v => updateParams({ type: v })}>
            <SelectTrigger className="h-10 w-full sm:w-[180px] rounded-lg text-sm" aria-label="Filter by investor type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All investor types</SelectItem>
              {INVESTOR_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
          {addButton}
        </div>
      </div>

      {/* Stage tabs */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border overflow-x-auto" role="group" aria-label="Filter by stage">
        {[ALL, ...INVESTOR_STAGES].map(stage => {
          const active = stageFilter === stage;
          return (
            <button
              key={stage}
              type="button"
              aria-pressed={active}
              onClick={() => updateParams({ stage })}
              className={cn(
                'flex h-7 shrink-0 items-center gap-1.5 px-2.5 rounded-md text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted/50',
              )}
            >
              {stage === ALL ? 'All' : stage}
              <span className="tabular-nums text-muted-foreground">{stageCounts[stage] ?? 0}</span>
            </button>
          );
        })}
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="ml-auto flex h-7 shrink-0 items-center gap-1 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <X className="w-3 h-3" aria-hidden="true" />
            Clear filters
          </button>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
            <Landmark className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
          </div>
          {investors.length === 0 ? (
            <>
              <p className="text-sm text-muted-foreground">No investors yet. Add the first firm or angel you’re talking to.</p>
              {addButton}
            </>
          ) : (
            <>
              <p className="text-sm text-muted-foreground">No investors match {query ? `“${query}” with ` : ''}these filters.</p>
              <Button variant="outline" size="sm" onClick={clearFilters}>Clear search and filters</Button>
            </>
          )}
        </div>
      ) : (
        <>
          {/* Mobile: cards */}
          <ul className="md:hidden divide-y divide-border">
            {rows.map(i => (
              <li key={i.id}>
                <button
                  type="button"
                  onClick={() => openInvestor(i)}
                  className="w-full text-left px-3 py-3 space-y-1.5 active:bg-muted/50 outline-none focus-visible:bg-muted/50"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium text-sm leading-snug">{i.name}</span>
                    <InvestorStageBadge stage={i.stage} />
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {i.investorType && <span className="shrink-0">{i.investorType}</span>}
                    <span className="min-w-0 truncate">{renderContacts(i)}</span>
                    <span className="ml-auto shrink-0 font-mono">{getProspectLastContactLabel(i) || '—'}</span>
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
                  <SortableTh field="name" label="Investor" {...sortProps} />
                  <SortableTh field="investorType" label="Type" {...sortProps} />
                  <SortableTh field="stage" label="Stage" {...sortProps} />
                  <SortableTh field="contacts" label="Contacts" {...sortProps} />
                  <SortableTh field="location" label="Location" {...sortProps} />
                  <SortableTh field="lastContact" label="Last Contact" {...sortProps} />
                  <SortableTh field="engagements" label="Engagements" align="right" {...sortProps} />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map(i => (
                  <tr
                    key={i.id}
                    tabIndex={0}
                    className="table-row-hover cursor-pointer outline-none focus-visible:bg-muted/50 focus-visible:shadow-[inset_2px_0_0_hsl(var(--ring))]"
                    onClick={() => openInvestor(i)}
                    onKeyDown={e => { if (e.key === 'Enter') openInvestor(i); }}
                  >
                    <td className="px-3 py-2.5 text-sm font-medium">{i.name}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{i.investorType || '—'}</td>
                    <td className="px-3 py-2.5"><InvestorStageBadge stage={i.stage} /></td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground max-w-[12rem]">{renderContacts(i)}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{locationOf(i) || '—'}</td>
                    <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground whitespace-nowrap">{getProspectLastContactLabel(i) || '—'}</td>
                    <td className="px-3 py-2.5 text-sm font-mono text-muted-foreground text-right tabular-nums">{i.engagements.length || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <div className="px-3 py-2.5 border-t border-border text-xs text-muted-foreground">
        Showing {rows.length.toLocaleString()} of {investors.length.toLocaleString()} investors
      </div>

      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-6 flex flex-col">
          {addOpen && <InvestorFormPanel onSubmit={handleAdd} onClose={() => setAddOpen(false)} />}
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default InvestorsTable;
