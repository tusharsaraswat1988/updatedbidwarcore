import type { BusinessStageCatalogEntry } from "../types.ts";

/**
 * Business Stage vocabulary for Competition Module (EPIC-03).
 * Not a full catalog registry yet (Backlog B2) — stable ids for persistence.
 */
export const BUSINESS_STAGE_CATALOG: readonly BusinessStageCatalogEntry[] = [
  {
    kind: "business_stage",
    id: "registration_planning",
    version: "1.0.0",
    displayName: "Registration Planning",
    description: "Organizer is configuring how participants will enter.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 10,
  },
  {
    kind: "business_stage",
    id: "registration_open",
    version: "1.0.0",
    displayName: "Registration Open",
    description: "Participants may register.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 20,
  },
  {
    kind: "business_stage",
    id: "registration_closed",
    version: "1.0.0",
    displayName: "Registration Closed",
    description: "Registration window has closed.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 30,
  },
  {
    kind: "business_stage",
    id: "verification",
    version: "1.0.0",
    displayName: "Verification",
    description: "Entries are being verified.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 40,
  },
  {
    kind: "business_stage",
    id: "team_formation",
    version: "1.0.0",
    displayName: "Team Formation",
    description: "Teams are being formed from participants.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 50,
  },
  {
    kind: "business_stage",
    id: "competition_ready",
    version: "1.0.0",
    displayName: "Competition Ready",
    description: "Configuration locked; ready for draws / next platform step.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 60,
  },
  {
    kind: "business_stage",
    id: "configuration_locked",
    version: "1.0.0",
    displayName: "Configuration Locked",
    description: "Competition Plan Version 1 is frozen.",
    supportedCompetitionTypes: ["*"],
    supportedVariants: ["*"],
    status: "active",
    sortOrder: 70,
  },
];

export const DEFAULT_BUSINESS_STAGE_ID = "registration_planning";
