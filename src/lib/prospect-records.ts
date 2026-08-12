/**
 * Contacts and engagements are free-form JSONB on the `prospects` row, and rows
 * written by the outreach scripts have landed without an `id`. Anything that keys,
 * dedupes or filters on that id then blows up mid-render (a company profile went
 * blank instead of loading), so normalize on read: fill missing ids from the row id
 * plus position so they stay stable across renders and get persisted on the next
 * save, and drop entries that aren't objects at all.
 */
export const normalizeRecords = <T extends { id: string }>(
  raw: unknown,
  prefix: string,
  rowId: string,
): T[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is Record<string, unknown> => Boolean(entry) && typeof entry === 'object')
    .map((entry, idx) => ({
      ...entry,
      id: typeof entry.id === 'string' && entry.id ? entry.id : `${prefix}-${rowId}-${idx}`,
    })) as T[];
};
