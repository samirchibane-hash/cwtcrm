import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getProspectLastContactLabel } from '@/lib/prospect-last-contact';

describe('getProspectLastContactLabel', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 18, 12)); // Nov 18 2026
  });
  afterEach(() => vi.useRealTimers());

  it('ignores a year-less legacy date instead of reading it as today', () => {
    expect(getProspectLastContactLabel({ lastContact: '11/18', engagements: [] })).toBe('');
  });

  it('uses a legacy date that carries a year', () => {
    expect(getProspectLastContactLabel({ lastContact: '11/18/2025', engagements: [] })).toBe('11/18/2025');
  });

  it('prefers the newest of engagements and legacy field', () => {
    expect(
      getProspectLastContactLabel({
        lastContact: '10/1/2026',
        engagements: [{ date: '2026-11-10' }, { date: '11/3/2026' }] as never,
      }),
    ).toBe('11/10/2026');
  });
});
