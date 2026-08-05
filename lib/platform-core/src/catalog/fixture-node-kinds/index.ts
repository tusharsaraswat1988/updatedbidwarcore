import type { FixtureNodeKindCatalogEntry } from "../types.ts";

/**
 * Fixture Node Kind catalog — structural positions (EPIC-06).
 * Not every node is a contest; some are placeholders / byes / qualifiers.
 */
export const FIXTURE_NODE_KIND_CATALOG: readonly FixtureNodeKindCatalogEntry[] = [
  {
    kind: "fixture_node_kind",
    id: "contest",
    version: "1.0.0",
    displayName: "Contest",
    description: "A position that carries a Match Blueprint.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "fixture_node_kind",
    id: "bye",
    version: "1.0.0",
    displayName: "Bye",
    description: "Structural bye placeholder.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "fixture_node_kind",
    id: "placeholder",
    version: "1.0.0",
    displayName: "Placeholder",
    description: "Unresolved slot awaiting earlier-round outcomes.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "fixture_node_kind",
    id: "qualifier",
    version: "1.0.0",
    displayName: "Qualifier",
    description: "Qualification slot in the structure.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
];
