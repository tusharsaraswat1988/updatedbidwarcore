import type { ConflictPolicy } from "../types.ts";

/**
 * Explicit ConflictPolicy registry.
 * Empty foundation set — definition.conflicts[] synthesize FAIL policies at resolve time.
 * Future epics add auditable policy rows here.
 */
const CONFLICT_POLICY_CATALOG: readonly ConflictPolicy[] = Object.freeze([]);

export function listConflictPolicies(): readonly ConflictPolicy[] {
  return CONFLICT_POLICY_CATALOG;
}

/** Normalize undirected pair for lookup. */
export function normalizePair(a: string, b: string): readonly [string, string] {
  return a.localeCompare(b) <= 0 ? [a, b] : [b, a];
}
