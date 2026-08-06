import type { RegistrationModeCatalogEntry } from "../types.ts";

/**
 * Registration Mode catalog — how participants enter a competition.
 * Independent of Competition Type; compatibility via supportedCompetitionTypes.
 */
export const REGISTRATION_MODE_CATALOG: readonly RegistrationModeCatalogEntry[] = [
  {
    kind: "registration_mode",
    id: "individual",
    version: "1.0.0",
    displayName: "Individual",
    description: "Individuals register into a participant pool.",
    supportedCompetitionTypes: ["auction", "hybrid", "practice", "*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "registration_mode",
    id: "team",
    version: "1.0.0",
    displayName: "Team",
    description: "Pre-formed teams register complete squads.",
    supportedCompetitionTypes: ["registered_teams", "hybrid", "practice", "*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "recommended",
  },
  {
    kind: "registration_mode",
    id: "hybrid",
    version: "1.0.0",
    displayName: "Hybrid",
    description: "Mix of individual entries and registered teams.",
    supportedCompetitionTypes: ["hybrid", "auction", "registered_teams"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "registration_mode",
    id: "invitation",
    version: "1.0.0",
    displayName: "Invitation Only",
    description: "Participants enter by invitation.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "registration_mode",
    id: "import",
    version: "1.0.0",
    displayName: "Import",
    description: "Participants are imported from an external roster.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "advanced",
  },
  {
    kind: "registration_mode",
    id: "practice",
    version: "1.0.0",
    displayName: "Practice",
    description: "Lightweight entry for practice or friendly events.",
    supportedCompetitionTypes: ["practice", "*"],
    supportedVariants: ["*"],
    status: "active",
    recommendation: "auto_suggested",
  },
];

/** Default recommended registration mode id per competition type. */
export const DEFAULT_REGISTRATION_MODE_BY_COMPETITION: Readonly<
  Record<string, string>
> = {
  auction: "individual",
  registered_teams: "team",
  hybrid: "hybrid",
  practice: "practice",
};
