import type { TeamFormationStrategyCatalogEntry } from "../types.ts";

/**
 * Team Formation Strategy catalog — how teams are formed (configuration only).
 * Execution belongs to future epics.
 */
export const TEAM_FORMATION_STRATEGY_CATALOG: readonly TeamFormationStrategyCatalogEntry[] =
  [
    {
      kind: "team_formation",
      id: "auction",
      version: "1.0.0",
      displayName: "Auction",
      description: "Form squads via live auction (downstream).",
      supportedCompetitionTypes: ["auction", "hybrid"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "recommended",
    },
    {
      kind: "team_formation",
      id: "captain_pick",
      version: "1.0.0",
      displayName: "Captain Pick",
      description: "Captains select from the participant pool.",
      supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "*"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "advanced",
    },
    {
      kind: "team_formation",
      id: "manual",
      version: "1.0.0",
      displayName: "Manual",
      description: "Organizer assigns participants to teams.",
      supportedCompetitionTypes: ["*"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "recommended",
    },
    {
      kind: "team_formation",
      id: "random",
      version: "1.0.0",
      displayName: "Random",
      description: "System assigns participants randomly (future execution).",
      supportedCompetitionTypes: ["practice", "registered_teams", "*"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "advanced",
    },
    {
      kind: "team_formation",
      id: "import",
      version: "1.0.0",
      displayName: "Import",
      description: "Import already-formed teams.",
      supportedCompetitionTypes: ["registered_teams", "hybrid", "*"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "advanced",
    },
    {
      kind: "team_formation",
      id: "none",
      version: "1.0.0",
      displayName: "None",
      description: "No team formation (individual / practice events).",
      supportedCompetitionTypes: ["practice", "auction", "*"],
      supportedVariants: ["*"],
      status: "active",
      recommendation: "auto_suggested",
    },
  ];

export const DEFAULT_TEAM_FORMATION_BY_COMPETITION: Readonly<Record<string, string>> = {
  auction: "auction",
  registered_teams: "manual",
  hybrid: "auction",
  practice: "none",
};
