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

  // Fallback to legacy field if present
  const legacy = parseDateLoose(prospect.lastContact, { assumeMostRecentPast: true });
  if (legacy && (!best || legacy.getTime() > best.getTime())) best = legacy;

  return best;
}

export function getProspectLastContactSortValue(prospect: HasActivity): number {
  return getProspectLastContactDate(prospect)?.getTime() ?? 0;
}

export function getProspectLastContactLabel(prospect: HasActivity): string {
  const d = getProspectLastContactDate(prospect);
  return d ? formatMmDdYyyy(d) : '';
}
