import {
  getCapabilityProfile,
  getPresentationDefinition,
  PRESENTATION_DEFINITION_CATALOG,
  PRESENTATION_PROFILE_CATALOG,
} from "../catalog/presentation/index.ts";
import type { PresentationProfileCatalogEntry } from "../catalog/types.ts";

export {
  getCapabilityProfile,
  getPresentationDefinition,
  PRESENTATION_DEFINITION_CATALOG,
};

export function getPresentationProfile(
  id: string,
  version?: string | null,
): PresentationProfileCatalogEntry | null {
  const matches = PRESENTATION_PROFILE_CATALOG.filter((p) => p.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((p) => p.version === version) ?? null;
  const active = matches.filter((p) => p.status !== "deprecated" && p.status !== "legacy");
  const pool = active.length > 0 ? active : matches;
  return [...pool].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}

export function supportsToken(supported: readonly string[], token: string): boolean {
  return supported.includes("*") || supported.includes(token);
}

export function definitionsForContext(sportId: string) {
  return PRESENTATION_DEFINITION_CATALOG.filter(
    (d) => d.sportId === "*" || d.sportId === sportId,
  ).sort((a, b) => a.id.localeCompare(b.id));
}
