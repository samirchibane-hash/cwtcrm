import { describe, it, expect } from 'vitest';
import { normalizeRecords } from '@/lib/prospect-records';

type Engagement = { id: string; date?: string; summary?: string };

describe('normalizeRecords', () => {
  it('fills in ids for script-written engagements that have none', () => {
    // Shape that took Micro Matic / U-Line Corp / Blupura profiles to a blank page
    const raw = [{ date: '2026-04-09', summary: 'Sent intro email' }];
    const [engagement] = normalizeRecords<Engagement>(raw, 'eng', 'row-1');
    expect(engagement.id).toBe('eng-row-1-0');
    expect(engagement.summary).toBe('Sent intro email');
  });

  it('keeps existing ids untouched', () => {
    const raw = [{ id: 'eng-123', date: '2026-04-09' }, { date: '2026-04-10' }];
    expect(normalizeRecords<Engagement>(raw, 'eng', 'row-1').map(e => e.id))
      .toEqual(['eng-123', 'eng-row-1-1']);
  });

  it('produces the same ids on repeat calls so React keys stay stable', () => {
    const raw = [{ date: '2026-04-09' }, { date: '2026-04-10' }];
    expect(normalizeRecords<Engagement>(raw, 'eng', 'row-1'))
      .toEqual(normalizeRecords<Engagement>(raw, 'eng', 'row-1'));
  });

  it('drops null and non-object entries', () => {
    const raw = [null, 'nope', { date: '2026-04-09' }];
    expect(normalizeRecords<Engagement>(raw, 'eng', 'row-1')).toHaveLength(1);
  });

  it('returns an empty array for missing or non-array columns', () => {
    expect(normalizeRecords<Engagement>(null, 'eng', 'row-1')).toEqual([]);
    expect(normalizeRecords<Engagement>(undefined, 'eng', 'row-1')).toEqual([]);
    expect(normalizeRecords<Engagement>({}, 'eng', 'row-1')).toEqual([]);
  });
});
