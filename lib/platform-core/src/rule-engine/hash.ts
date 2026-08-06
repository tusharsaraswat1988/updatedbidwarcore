import type { ConcreteRuleValue } from "../catalog/types.ts";
import type { ExecutableRule, ResolvedRuntimeRulesEffective, RuleEngineInput } from "./types.ts";
import { RUNTIME_RULES_VERSION } from "./versions.ts";

function canonicalizeValue(value: ConcreteRuleValue): string {
  if (value === null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalizeValue(v as ConcreteRuleValue)).join(",")}]`;
  }
  const obj = value as { readonly [key: string]: ConcreteRuleValue };
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalizeValue(obj[k]!)}`).join(",")}}`;
}

/** FNV-1a 32-bit — deterministic, no crypto dependency. */
export function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function refKey(id: string, version: string | number | null | undefined): string {
  return `${id}@${version ?? "null"}`;
}

export function computeRulesHash(input: {
  sportId: string;
  variantId: string;
  competitionTypeId: string;
  rules: readonly ExecutableRule[];
  effective: ResolvedRuntimeRulesEffective;
}): string {
  const sortedRules = [...input.rules].sort((a, b) =>
    a.definitionId.localeCompare(b.definitionId),
  );
  const payload = [
    `runtimeRulesVersion=${RUNTIME_RULES_VERSION}`,
    `sport=${input.sportId}`,
    `variant=${input.variantId}`,
    `competition=${input.competitionTypeId}`,
    ...sortedRules.map(
      (r) => `${r.definitionId}@${r.definitionVersion}=${canonicalizeValue(r.value)}`,
    ),
    `enabled=${[...input.effective.enabledDefinitions].sort().join(",")}`,
    `disabled=${[...input.effective.disabledDefinitions].sort().join(",")}`,
    `forced=${[...input.effective.forcedValues]
      .sort((a, b) => a.definitionId.localeCompare(b.definitionId))
      .map((f) => `${f.definitionId}=${canonicalizeValue(f.value)}`)
      .join(",")}`,
    `depDisabled=${[...input.effective.disabledByDependencies].sort().join(",")}`,
    `conflictDisabled=${[...input.effective.disabledByConflicts].sort().join(",")}`,
  ].join("|");
  return `rules-fnv1a32:${fnv1a(payload)}`;
}

/**
 * resolutionId changes only when ResolvedRuntimeRules would change.
 * Derived from rulesHash + stable identity scope — never timestamps.
 */
export function computeResolutionId(input: {
  rulesHash: string;
  engineInput: RuleEngineInput;
}): string {
  const ctx = input.engineInput.context;
  const snap = input.engineInput.snapshot;
  const scope = snap
    ? `match=${snap.matchId};sv=${snap.snapshotVersion}`
    : `preview=${ctx.sportId}/${ctx.variantId}/${ctx.competitionTypeId}`;
  const payload = [
    scope,
    `profile=${refKey(String(ctx.ruleProfile.id), ctx.ruleProfile.version)}`,
    `mode=${ctx.resolutionMode}`,
    `inputVersion=${input.engineInput.inputVersion}`,
    `rulesHash=${input.rulesHash}`,
  ].join("|");
  return `rid-fnv1a32:${fnv1a(payload)}`;
}

export function overrideDocKey(id: string, version: string | number | null): string {
  return refKey(id, version);
}
