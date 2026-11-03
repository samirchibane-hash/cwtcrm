import { describe, it, expect } from 'vitest';
import {
  buildChildrenIndex,
  getDescendantIds,
  eligibleParents,
  eligibleSubsidiaries,
  matchesOwnership,
} from '@/lib/company-hierarchy';

// aos owns hague; hague owns brand; pentair owns manitowoc; solo is independent
const companies = [
  { id: 'aos' },
  { id: 'hague', parentId: 'aos' },
  { id: 'brand', parentId: 'hague' },
  { id: 'pentair' },
  { id: 'manitowoc', parentId: 'pentair' },
  { id: 'solo', parentId: null },
];

describe('company hierarchy', () => {
  it('indexes direct subsidiaries by parent', () => {
    const index = buildChildrenIndex(companies);
    expect(index.get('aos')?.map(c => c.id)).toEqual(['hague']);
    expect(index.get('pentair')?.map(c => c.id)).toEqual(['manitowoc']);
    expect(index.has('solo')).toBe(false);
  });

  it('collects every descendant', () => {
    expect([...getDescendantIds('aos', companies)].sort()).toEqual(['brand', 'hague']);
    expect(getDescendantIds('solo', companies).size).toBe(0);
  });

  it('never offers itself or its own subsidiaries as a parent', () => {
    const ids = eligibleParents('aos', companies).map(c => c.id);
    expect(ids).not.toContain('aos');
    expect(ids).not.toContain('hague');
    expect(ids).not.toContain('brand');
    expect(ids).toContain('pentair');
  });

  it('never offers an ancestor or an existing child as a subsidiary', () => {
    const ids = eligibleSubsidiaries('hague', companies).map(c => c.id);
    expect(ids).not.toContain('hague');
    expect(ids).not.toContain('aos'); // would loop
    expect(ids).not.toContain('brand'); // already under hague
    expect(ids).toContain('manitowoc'); // moving it is allowed
  });

  it('classifies ownership for the pipeline filter', () => {
    const index = buildChildrenIndex(companies);
    const byId = Object.fromEntries(companies.map(c => [c.id, c]));
    expect(matchesOwnership(byId.hague, 'subsidiary', index)).toBe(true);
    expect(matchesOwnership(byId.hague, 'parent', index)).toBe(true);
    expect(matchesOwnership(byId.aos, 'parent', index)).toBe(true);
    expect(matchesOwnership(byId.aos, 'subsidiary', index)).toBe(false);
    expect(matchesOwnership(byId.solo, 'independent', index)).toBe(true);
    expect(matchesOwnership(byId.manitowoc, 'independent', index)).toBe(false);
  });
});
