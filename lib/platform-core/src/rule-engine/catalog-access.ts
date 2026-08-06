import { RULE_CATEGORY_CATALOG } from "../catalog/categories/index.ts";
import { RULE_DEFINITION_CATALOG } from "../catalog/definitions/index.ts";
import { RULE_PROFILE_CATALOG } from "../catalog/rules/index.ts";
import type { RuleDefinitionEntry, RuleProfileCatalogEntry } from "../catalog/types.ts";

export function getDefinition(
  id: string,
  version?: string | null,
): RuleDefinitionEntry | null {
  const matches = RULE_DEFINITION_CATALOG.filter((d) => d.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((d) => d.version === version) ?? null;
  return [...matches].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

export function getProfile(
  id: string,
  version?: string | null,
): RuleProfileCatalogEntry | null {
  const matches = RULE_PROFILE_CATALOG.filter((p) => p.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((p) => p.version === version) ?? null;
  const active = matches.filter((p) => p.status !== "deprecated" && p.status !== "legacy");
  const pool = active.length > 0 ? active : matches;
  return [...pool].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

export function definitionsForSport(sportId: string): RuleDefinitionEntry[] {
  return RULE_DEFINITION_CATALOG.filter((d) => d.sportId === sportId).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
}

export function categoryExists(categoryId: string): boolean {
  return RULE_CATEGORY_CATALOG.some((c) => c.id === categoryId);
}

export function supportsToken(supported: readonly string[], token: string): boolean {
  return supported.includes("*") || supported.includes(token);
}

export const SUPPORTED_BINDING_TYPES: Readonly<Record<string, readonly string[]>> = {
  cricket: ["cricket_platform_defaults"],
  badminton: ["badminton_match_format"],
  football: ["football_platform_defaults"],
};
