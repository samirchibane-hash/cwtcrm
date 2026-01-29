export type ParsedDateOptions = {
  /**
   * If the year is missing (e.g. "12/18"), interpret it as the most recent
   * occurrence that is NOT in the future relative to today.
   */
  assumeMostRecentPast?: boolean;
};

const isValidMonthDay = (month: number, day: number) =>
  Number.isFinite(month) && Number.isFinite(day) && month >= 1 && month <= 12 && day >= 1 && day <= 31;

/**
 * Parses common US date strings into a Date (local time, midnight).
 * Supported:
 * - M/D
 * - MM/DD
 * - M/D/YY
 * - MM/DD/YYYY
 * - ISO-ish: YYYY-MM-DD (fallback)
 */
export function parseDateLoose(input: string, options: ParsedDateOptions = {}): Date | null {
  const raw = (input ?? '').trim();
  if (!raw) return null;

  // ISO-ish fallback
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const parts = raw.split('/').map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;

  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (!isValidMonthDay(month, day)) return null;

  const today = new Date();
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  let year = today.getFullYear();
  if (parts.length >= 3) {
    year = parseInt(parts[2], 10);
    if (!Number.isFinite(year)) return null;
    if (year < 100) year += 2000;
  } else if (options.assumeMostRecentPast) {
    const candidate = new Date(year, month - 1, day);
    // If the candidate date is in the future, assume it was last year.
    if (candidate.getTime() > todayStart.getTime()) {
      year -= 1;
    }
  }

  const date = new Date(year, month - 1, day);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatMmDdYyyy(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  return `${mm}/${dd}/${yyyy}`;
}
