/**
 * Tournament-level cricket key rule overrides (organiser edits on top of Rule Profile).
 */

import type { ConcreteRuleValue } from "../catalog/types.ts";

export const CRICKET_KEY_RULE_OVERRIDE_IDS = [
  "cricket.match.overs_per_innings",
  "cricket.match.max_wickets",
  "cricket.match.playing_squad_size",
  "cricket.match.bench_size",
  "cricket.batting.retire_at_runs",
  "cricket.dismissal.lbw_enabled",
  "cricket.bowling.free_hit_enabled",
] as const;

export type CricketKeyRuleOverrideId = (typeof CRICKET_KEY_RULE_OVERRIDE_IDS)[number];

export type RuleOverridesDocument = {
  values: Record<string, ConcreteRuleValue>;
};

const ALLOWED = new Set<string>(CRICKET_KEY_RULE_OVERRIDE_IDS);

export function parseRuleOverrides(value: unknown): RuleOverridesDocument | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as { values?: unknown };
  if (!raw.values || typeof raw.values !== "object" || Array.isArray(raw.values)) return null;
  const values: Record<string, ConcreteRuleValue> = {};
  for (const [k, v] of Object.entries(raw.values as Record<string, unknown>)) {
    if (!ALLOWED.has(k)) continue;
    if (v === null || typeof v === "number" || typeof v === "boolean" || typeof v === "string") {
      values[k] = v as ConcreteRuleValue;
    }
  }
  return Object.keys(values).length > 0 ? { values } : null;
}

export function validateCricketKeyRuleOverrides(
  input: unknown,
): { ok: true; document: RuleOverridesDocument | null } | { ok: false; error: string } {
  if (input === null) return { ok: true, document: null };
  if (!input || typeof input !== "object") {
    return { ok: false, error: "ruleOverrides must be an object or null" };
  }
  const raw = input as { values?: unknown };
  if (raw.values === undefined) {
    return { ok: true, document: null };
  }
  if (!raw.values || typeof raw.values !== "object" || Array.isArray(raw.values)) {
    return { ok: false, error: "ruleOverrides.values must be an object" };
  }

  const values: Record<string, ConcreteRuleValue> = {};
  for (const [key, value] of Object.entries(raw.values as Record<string, unknown>)) {
    if (!ALLOWED.has(key)) {
      return { ok: false, error: `Unsupported rule override: ${key}` };
    }
    if (key === "cricket.batting.retire_at_runs") {
      if (value === null) {
        values[key] = null;
        continue;
      }
      if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
        return { ok: false, error: "Retire at runs must be empty/null or ≥ 1" };
      }
      values[key] = value;
      continue;
    }
    if (key === "cricket.dismissal.lbw_enabled" || key === "cricket.bowling.free_hit_enabled") {
      if (typeof value !== "boolean") {
        return { ok: false, error: `${key} must be boolean` };
      }
      values[key] = value;
      continue;
    }
    if (typeof value !== "number" || !Number.isFinite(value)) {
      return { ok: false, error: `${key} must be a number` };
    }
    if (key === "cricket.match.overs_per_innings" && value < 1) {
      return { ok: false, error: "Overs per innings must be ≥ 1" };
    }
    if (key === "cricket.match.max_wickets" && value < 1) {
      return { ok: false, error: "Max wickets must be ≥ 1" };
    }
    if (
      (key === "cricket.match.playing_squad_size" || key === "cricket.match.bench_size") &&
      value < 0
    ) {
      return { ok: false, error: `${key} must be ≥ 0` };
    }
    values[key] = value;
  }

  return {
    ok: true,
    document: Object.keys(values).length > 0 ? { values } : null,
  };
}

/** Keep only keys that differ from profile baseline values. */
export function sparseRuleOverrides(
  baseline: Readonly<Record<string, ConcreteRuleValue>>,
  effective: Readonly<Record<string, ConcreteRuleValue>>,
): RuleOverridesDocument | null {
  const values: Record<string, ConcreteRuleValue> = {};
  for (const id of CRICKET_KEY_RULE_OVERRIDE_IDS) {
    if (!(id in effective)) continue;
    const next = effective[id];
    const base = baseline[id];
    if (Object.is(next, base)) continue;
    values[id] = next as ConcreteRuleValue;
  }
  return Object.keys(values).length > 0 ? { values } : null;
}
