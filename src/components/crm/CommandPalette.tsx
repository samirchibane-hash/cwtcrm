import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Landmark } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useProspects } from '@/context/ProspectsContext';
import { useInvestors } from '@/context/InvestorsContext';
import InvestorStageBadge from './InvestorStageBadge';
import { NAV_ITEMS } from './nav-items';
import StageBadge from './StageBadge';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: string) => void;
}

const MAX_COMPANY_RESULTS = 8;

const CommandPalette = ({ open, onOpenChange, onNavigate }: CommandPaletteProps) => {
  const navigate = useNavigate();
  const { prospects } = useProspects();
  const { investors } = useInvestors();
  const [query, setQuery] = useState('');

  // ⌘K / Ctrl+K toggles from anywhere
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const q = query.trim().toLowerCase();

  const views = useMemo(
    () => (q ? NAV_ITEMS.filter(item => item.label.toLowerCase().includes(q)) : NAV_ITEMS),
    [q],
  );

  // Filter ourselves (cmdk's fuzzy filter is slow on thousands of rows and can't see contact names)
  const companies = useMemo(() => {
    if (!q) return [];
    const matches = [];
    for (const p of prospects) {
      if (
        p.companyName.toLowerCase().includes(q) ||
        p.contacts.some(c => c.name.toLowerCase().includes(q)) ||
        (p.state || '').toLowerCase() === q
      ) {
        matches.push(p);
        if (matches.length >= MAX_COMPANY_RESULTS) break;
      }
    }
    return matches;
  }, [prospects, q]);

  const matchingInvestors = useMemo(() => {
    if (!q) return [];
    return investors
      .filter(i => i.name.toLowerCase().includes(q) || i.contacts.some(c => c.name.toLowerCase().includes(q)))
      .slice(0, MAX_COMPANY_RESULTS);
  }, [investors, q]);

  const run = (action: () => void) => {
    onOpenChange(false);
    action();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0 shadow-lg top-[20%] translate-y-0 sm:max-w-xl">
        <DialogTitle className="sr-only">Search CRM</DialogTitle>
        <Command shouldFilter={false} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-input]]:h-12">
          <CommandInput
            placeholder="Search companies, investors, contacts, or jump to a view…"
            value={query}
            onValueChange={setQuery}
          />
          <CommandList className="max-h-[min(60vh,420px)]">
            <CommandEmpty>
              Nothing matches “{query}”.
            </CommandEmpty>
            {companies.length > 0 && (
              <CommandGroup heading="Companies">
                {companies.map(p => (
                  <CommandItem
                    key={p.id}
                    value={`company-${p.id}`}
                    onSelect={() => run(() => navigate(`/company/${p.id}`, { state: { from: '/?view=pipeline' } }))}
                    className="gap-3"
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{p.companyName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[p.contacts[0]?.name, p.state].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <StageBadge stage={p.stage} maxVisible={1} />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {matchingInvestors.length > 0 && (
              <CommandGroup heading="Investors">
                {matchingInvestors.map(i => (
                  <CommandItem
                    key={i.id}
                    value={`investor-${i.id}`}
                    onSelect={() => run(() => navigate(`/investor/${i.id}`, { state: { from: '/?view=investors' } }))}
                    className="gap-3"
                  >
                    <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{i.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {[i.investorType, i.contacts[0]?.name].filter(Boolean).join(' · ') || '—'}
                      </p>
                    </div>
                    <div className="hidden shrink-0 sm:block">
                      <InvestorStageBadge stage={i.stage} />
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            {views.length > 0 && (
              <CommandGroup heading="Go to">
                {views.map(item => (
                  <CommandItem key={item.id} value={`view-${item.id}`} onSelect={() => run(() => onNavigate(item.id))} className="gap-3">
                    <item.icon className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{item.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
};

export default CommandPalette;
