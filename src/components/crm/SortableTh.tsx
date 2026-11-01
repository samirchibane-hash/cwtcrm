import { ArrowUpDown, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

export type SortDirection = 'asc' | 'desc' | null;

interface SortableThProps<F extends string> {
  field: F;
  label: string;
  sortField: F | null;
  sortDirection: SortDirection;
  onSort: (field: F) => void;
  align?: 'left' | 'right';
  className?: string;
}

// Sticky, keyboard-operable column header shared by the CRM tables
const SortableTh = <F extends string>({ field, label, sortField, sortDirection, onSort, align = 'left', className }: SortableThProps<F>) => {
  const active = sortField === field && !!sortDirection;
  const Icon = !active ? ArrowUpDown : sortDirection === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn(
        'sticky top-0 z-10 bg-card px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shadow-[inset_0_-1px_0_hsl(var(--border))]',
        align === 'right' ? 'text-right' : 'text-left',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn(
          'inline-flex items-center gap-1 rounded uppercase tracking-wider hover:text-foreground transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground',
        )}
      >
        {label}
        <Icon className={cn('w-3 h-3', !active && 'opacity-50')} aria-hidden="true" />
      </button>
    </th>
  );
};

export default SortableTh;
