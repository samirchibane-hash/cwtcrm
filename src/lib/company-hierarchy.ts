// Company ownership helpers (prospects.parent_id). Pure functions so the
// pipeline table, company page and picker agree on the same rules.

interface Node {
  id: string;
  parentId?: string | null;
}

export type OwnershipFilter = 'subsidiary' | 'parent' | 'independent';

export const OWNERSHIP_OPTIONS: { value: OwnershipFilter; label: string }[] = [
  { value: 'subsidiary', label: 'Owned by another company' },
  { value: 'parent', label: 'Owns other companies' },
  { value: 'independent', label: 'Independent' },
];

/** parentId -> direct subsidiaries, built once per list. */
export function buildChildrenIndex<T extends Node>(companies: T[]): Map<string, T[]> {
  const index = new Map<string, T[]>();
  for (const c of companies) {
    if (!c.parentId) continue;
    const list = index.get(c.parentId);
    if (list) list.push(c);
    else index.set(c.parentId, [c]);
  }
  return index;
}

/** Every company below `id` (subsidiaries, their subsidiaries, …). */
export function getDescendantIds<T extends Node>(id: string, companies: T[]): Set<string> {
  const index = buildChildrenIndex(companies);
  const out = new Set<string>();
  const stack = [id];
  while (stack.length) {
    const current = stack.pop()!;
    for (const child of index.get(current) ?? []) {
      if (out.has(child.id)) continue;
      out.add(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

/**
 * Companies that can own `id`: not itself and not anything it already owns
 * (directly or indirectly), which would create an ownership loop.
 * Mirrors the prevent_prospect_parent_cycle trigger.
 */
export function eligibleParents<T extends Node>(id: string, companies: T[]): T[] {
  const blocked = getDescendantIds(id, companies);
  blocked.add(id);
  return companies.filter(c => !blocked.has(c.id));
}

/** Companies that could be attached as a subsidiary of `id`. */
export function eligibleSubsidiaries<T extends Node>(id: string, companies: T[]): T[] {
  // Anything above `id` would loop; anything already directly under it is a no-op.
  const ancestors = new Set<string>([id]);
  const byId = new Map(companies.map(c => [c.id, c]));
  let cursor = byId.get(id)?.parentId;
  while (cursor && !ancestors.has(cursor)) {
    ancestors.add(cursor);
    cursor = byId.get(cursor)?.parentId;
  }
  return companies.filter(c => !ancestors.has(c.id) && c.parentId !== id);
}

export function matchesOwnership(
  company: Node,
  filter: OwnershipFilter,
  childrenIndex: Map<string, unknown[]>,
): boolean {
  const isSubsidiary = !!company.parentId;
  const isParent = (childrenIndex.get(company.id)?.length ?? 0) > 0;
  if (filter === 'subsidiary') return isSubsidiary;
  if (filter === 'parent') return isParent;
  return !isSubsidiary && !isParent;
}
