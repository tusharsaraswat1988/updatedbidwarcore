import type { ConcreteRuleValue } from "../types.ts";
import type { ResolvedRuleEntry } from "./types.ts";

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
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Frozen algorithm contract:
 * Hash ONLY definition versions, profile versions, resolved values, binding ids.
 * Never include resolvedAt, timestamps, or free-form metadata.
 */
export function computeSnapshotHash(input: {
  profileId: string;
  profileVersion: string;
  runtimeBindingType: string;
  runtimeBindingId: string;
  values: readonly ResolvedRuleEntry[];
}): string {
  const sorted = [...input.values].sort((a, b) =>
    a.definitionId.localeCompare(b.definitionId),
  );
  const payload = [
    `profile=${input.profileId}@${input.profileVersion}`,
    `binding=${input.runtimeBindingType}:${input.runtimeBindingId}`,
    ...sorted.map(
      (v) =>
        `${v.definitionId}@${v.definitionVersion}=${canonicalizeValue(v.resolvedValue)}`,
    ),
  ].join("|");
  return `sha256-fnv1a32:${fnv1a(payload)}`;
}
