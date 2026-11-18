import type { Prospect } from '@/data/prospects';

// Anything with an activity history: companies and investors
type HasActivity = Pick<Prospect, 'engagements' | 'lastContact'>;
import { formatMmDdYyyy, parseDateLoose } from '@/lib/date';

export function getProspectLastContactDate(prospect: HasActivity): Date | null {
  let best: Date | null = null;

  // Prefer derived engagement timestamps (notes, calls, etc.)
  for (const eng of prospect.engagements ?? []) {
    const d = parseDateLoose(eng.date, { assumeMostRecentPast: true });
    if (!d) continue;
    if (!best || d.getTime() > best.getTime()) best = d;
  }

  // Fallback to legacy field if present. A year-less value ("11/18") is ambiguous:
  // guessing the year relative to today made old imports read as "today" on their
  // anniversary, so only trust the legacy field when it carries a full date.
  const legacy = hasExplicitYear(prospect.lastContact) ? parseDateLoose(prospect.lastContact) : null;
  if (legacy && (!best || legacy.getTime() > best.getTime())) best = legacy;

  return best;
}

function hasExplicitYear(value: string | undefined): boolean {
  const raw = (value ?? '').trim();
  return /^\d{4}-\d{2}-\d{2}/.test(raw) || raw.split('/').filter(Boolean).length >= 3;
}

export function getProspectLastContactSortValue(prospect: HasActivity): number {
  return getProspectLastContactDate(prospect)?.getTime() ?? 0;
}

export function getProspectLastContactLabel(prospect: HasActivity): string {
  const d = getProspectLastContactDate(prospect);
  return d ? formatMmDdYyyy(d) : '';
}
