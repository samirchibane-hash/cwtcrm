import { useState, useMemo } from 'react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DateRangeFilterProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

const PRESETS: { label: string; getRange: () => DateRange }[] = [
  { label: 'All Time', getRange: () => ({ from: undefined, to: undefined }) },
  { label: 'Last 30 Days', getRange: () => ({ from: subDays(new Date(), 30), to: new Date() }) },
  { label: 'Last 90 Days', getRange: () => ({ from: subDays(new Date(), 90), to: new Date() }) },
  { label: 'This Month', getRange: () => ({ from: startOfMonth(new Date()), to: new Date() }) },
  { label: 'Last Month', getRange: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
  { label: 'Last 6 Months', getRange: () => ({ from: subMonths(new Date(), 6), to: new Date() }) },
  { label: 'Year to Date', getRange: () => ({ from: startOfYear(new Date()), to: new Date() }) },
  { label: 'Last 12 Months', getRange: () => ({ from: subMonths(new Date(), 12), to: new Date() }) },
];

const getYTDRange = (): DateRange => ({ from: startOfYear(new Date()), to: new Date() });

const DateRangeFilter = ({ value, onChange }: DateRangeFilterProps) => {
  const [open, setOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Set default to Year to Date on mount
  if (!initialized) {
    setInitialized(true);
    onChange(getYTDRange());
  }

  const activePreset = useMemo(() => {
    if (!value.from && !value.to) return 'All Time';
    return null;
  }, [value]);

  const displayLabel = useMemo(() => {
    if (!value.from && !value.to) return 'All Time';
    if (value.from && value.to) {
      return `${format(value.from, 'MMM d, yyyy')} – ${format(value.to, 'MMM d, yyyy')}`;
    }
    if (value.from) return `From ${format(value.from, 'MMM d, yyyy')}`;
    return 'All Time';
  }, [value]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 text-xs font-medium">
          <CalendarIcon className="h-3.5 w-3.5" />
          {displayLabel}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="end">
        <div className="flex">
          {/* Presets sidebar */}
          <div className="border-r py-1.5 px-1 shrink-0">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => {
                  onChange(preset.getRange());
                  setOpen(false);
                }}
                className={cn(
                  'w-full text-left px-2 py-1 rounded text-xs transition-colors',
                  activePreset === preset.label
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>
          {/* Calendar */}
          <div className="p-2">
            <Calendar
              mode="range"
              selected={value.from && value.to ? { from: value.from, to: value.to } : undefined}
              onSelect={(range) => {
                if (range) {
                  onChange({ from: range.from, to: range.to });
                  if (range.from && range.to) setOpen(false);
                }
              }}
              numberOfMonths={2}
              className="pointer-events-auto"
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default DateRangeFilter;
