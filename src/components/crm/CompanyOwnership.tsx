import { useMemo, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Check, CornerDownRight, Network, Plus, Unlink, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from '@/components/ui/command';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useProspects } from '@/context/ProspectsContext';
import type { Prospect } from '@/data/prospects';
import { buildChildrenIndex, eligibleParents, eligibleSubsidiaries } from '@/lib/company-hierarchy';
import StageBadge from './StageBadge';
import { RailHeader } from './RecordParts';

/* ------------------------------------------------------------------ */
/* Searchable company list in a popover (shadcn combobox pattern)      */
/* ------------------------------------------------------------------ */

const CompanyPicker = ({
  trigger, options, selectedId, onSelect, onClear, clearLabel, placeholder, label,
}: {
  trigger: ReactNode;
  options: Prospect[];
  selectedId?: string | null;
  onSelect: (company: Prospect) => void;
  onClear?: () => void;
  clearLabel?: string;
  placeholder: string;
  label: string;
}) => {
  const [open, setOpen] = useState(false);
  const sorted = useMemo(
    () => [...options].sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [options],
  );
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0" aria-label={label}>
        <Command>
          <CommandInput placeholder={placeholder} autoFocus />
          <CommandList>
            <CommandEmpty>No company with that name. Add it to the pipeline first.</CommandEmpty>
            <CommandGroup>
              {sorted.map(c => (
                <CommandItem
                  key={c.id}
                  // Include the id so two companies with the same name stay distinct.
                  value={`${c.companyName} ${c.id}`}
                  onSelect={() => { setOpen(false); onSelect(c); }}
                  className="gap-2"
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', selectedId === c.id ? 'opacity-100' : 'opacity-0')} aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{c.companyName}</span>
                  {c.state && <span className="shrink-0 font-mono text-xs text-muted-foreground">{c.state}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
            {onClear && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem value="__clear__" onSelect={() => { setOpen(false); onClear(); }} className="gap-2 text-muted-foreground">
                    <X className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {clearLabel}
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
};

/** Shared mutation + undo toast so both entry points read the same. */
const useOwnershipActions = () => {
  const { prospects, setParentCompany } = useProspects();
  const nameOf = (id: string | null | undefined) => prospects.find(p => p.id === id)?.companyName;

  const assign = async (child: Prospect, parentId: string | null) => {
    const previous = child.parentId ?? null;
    const ok = await setParentCompany(child.id, parentId);
    if (!ok) return;
    const message = parentId
      ? `${child.companyName} is now owned by ${nameOf(parentId)}`
      : `${child.companyName} is no longer linked to ${nameOf(previous) ?? 'a parent company'}`;
    toast.success(message, {
      action: { label: 'Undo', onClick: () => { void setParentCompany(child.id, previous); } },
    });
  };

  return { prospects, assign };
};

/* ------------------------------------------------------------------ */
/* "Owned by" value in the company Details card                        */
/* ------------------------------------------------------------------ */

export const OwnedByField = ({ company }: { company: Prospect }) => {
  const { prospects, assign } = useOwnershipActions();
  const location = useLocation();
  const parent = company.parentId ? prospects.find(p => p.id === company.parentId) : undefined;
  const options = useMemo(() => eligibleParents(company.id, prospects), [company.id, prospects]);

  const picker = (trigger: ReactNode) => (
    <CompanyPicker
      label="Choose parent company"
      placeholder="Search parent company…"
      options={options}
      selectedId={company.parentId}
      onSelect={c => assign(company, c.id)}
      onClear={parent ? () => assign(company, null) : undefined}
      clearLabel="Remove parent company"
      trigger={trigger}
    />
  );

  if (!parent) {
    return picker(
      <button type="button" className="rounded text-muted-foreground hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring">
        Add parent company…
      </button>,
    );
  }

  return (
    <span className="flex min-w-0 items-center gap-1">
      <Link
        to={`/company/${parent.id}`}
        state={{ from: (location.state as { from?: string } | null)?.from }}
        className="truncate text-accent hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {parent.companyName}
      </Link>
      {picker(
        <Button variant="ghost" size="sm" className="h-6 shrink-0 px-1.5 text-xs text-muted-foreground" aria-label={`Change parent company of ${company.companyName}`}>
          Change
        </Button>,
      )}
    </span>
  );
};

/* ------------------------------------------------------------------ */
/* Subtitle under the company name: "Subsidiary of A.O. Smith"         */
/* ------------------------------------------------------------------ */

export const ParentLine = ({ company }: { company: Prospect }) => {
  const { prospects } = useProspects();
  const location = useLocation();
  const parent = company.parentId ? prospects.find(p => p.id === company.parentId) : undefined;
  if (!parent) return null;
  return (
    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
      <CornerDownRight className="h-3 w-3 shrink-0" aria-hidden="true" />
      Subsidiary of
      <Link
        to={`/company/${parent.id}`}
        state={{ from: (location.state as { from?: string } | null)?.from }}
        className="truncate font-medium text-foreground hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {parent.companyName}
      </Link>
    </p>
  );
};

/* ------------------------------------------------------------------ */
/* Subsidiaries card in the company rail (HubSpot associations card)    */
/* ------------------------------------------------------------------ */

export const SubsidiariesSection = ({ company }: { company: Prospect }) => {
  const { prospects, assign } = useOwnershipActions();
  const location = useLocation();
  const children = useMemo(
    () => (buildChildrenIndex(prospects).get(company.id) ?? [])
      .slice()
      .sort((a, b) => a.companyName.localeCompare(b.companyName)),
    [prospects, company.id],
  );
  const options = useMemo(() => eligibleSubsidiaries(company.id, prospects), [company.id, prospects]);

  const addPicker = (trigger: ReactNode) => (
    <CompanyPicker
      label={`Add a subsidiary to ${company.companyName}`}
      placeholder="Search companies…"
      options={options}
      onSelect={c => assign(c, company.id)}
      trigger={trigger}
    />
  );

  return (
    <section className="content-card">
      <RailHeader title="Subsidiaries" count={children.length}>
        {addPicker(
          <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={`Add a subsidiary to ${company.companyName}`}>
            <Plus className="w-4 h-4" />
          </Button>,
        )}
      </RailHeader>
      {children.length > 0 ? (
        <ul className="divide-y divide-border">
          {children.map(child => (
            <li key={child.id} className="group flex items-center gap-2 px-4 py-2">
              <Link
                to={`/company/${child.id}`}
                state={{ from: (location.state as { from?: string } | null)?.from }}
                className="min-w-0 flex-1 truncate text-sm font-medium hover:underline rounded outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {child.companyName}
              </Link>
              <StageBadge stage={child.stage} maxVisible={1} />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    // Visible on touch / keyboard focus; dimmed until row hover on desktop.
                    className="h-7 w-7 shrink-0 text-muted-foreground md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={`Unlink ${child.companyName} from ${company.companyName}`}
                    onClick={() => assign(child, null)}
                  >
                    <Unlink className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Unlink subsidiary</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-start gap-3 px-4 py-4">
          <Network className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 space-y-2">
            <p className="text-sm text-muted-foreground">Link the brands or divisions {company.companyName} owns.</p>
            {addPicker(
              <Button variant="outline" size="sm" className="gap-1.5">
                <Plus className="w-4 h-4" />
                Add subsidiary
              </Button>,
            )}
          </div>
        </div>
      )}
    </section>
  );
};
