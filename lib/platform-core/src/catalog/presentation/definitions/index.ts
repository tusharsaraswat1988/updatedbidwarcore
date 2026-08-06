import type { PresentationDefinitionEntry } from "../../types.ts";
import { PLATFORM_PRESENTATION_DEFINITIONS } from "./platform.ts";

export const PRESENTATION_DEFINITION_CATALOG: readonly PresentationDefinitionEntry[] = [
  ...PLATFORM_PRESENTATION_DEFINITIONS,
];

export function getPresentationDefinition(
  id: string,
  version?: string | null,
): PresentationDefinitionEntry | null {
  const matches = PRESENTATION_DEFINITION_CATALOG.filter((d) => d.id === id);
  if (matches.length === 0) return null;
  if (version) return matches.find((d) => d.version === version) ?? null;
  return [...matches].sort((a, b) => b.version.localeCompare(a.version))[0] ?? null;
}
