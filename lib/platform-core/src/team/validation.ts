import { CatalogRegistry } from "../catalog/registry.ts";
import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type { SquadRules } from "../competition/types.ts";
import type {
  TeamConfiguration,
  TeamMember,
  TeamReadiness,
  TeamValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function readinessFromIssues(issues: readonly ValidationIssue[]): TeamReadiness {
  const errors = issues.filter((i) => i.severity === "ERROR").length;
  const warnings = issues.filter((i) => i.severity === "WARNING").length;
  if (errors > 0) return "not_ready";
  if (warnings > 0) return "almost_ready";
  return "ready";
}

/**
 * Validate Working Team Configuration + Members.
 * Squad capacity checks reference Competition SquadRules (EPIC-03) — not duplicated here.
 */
export function validateTeam(
  configuration: TeamConfiguration,
  members: readonly TeamMember[],
  opts?: {
    competitionSquadRules?: SquadRules | null;
    competitionTypeId?: string | null;
    registrationModeId?: string | null;
  },
): TeamValidationResult {
  const issues: ValidationIssue[] = [];

  if (!configuration.name?.trim()) {
    issues.push(issue("ERROR", "TEAM_NAME_REQUIRED", "Team name is required.", "name"));
  }
  if (!configuration.shortName?.trim()) {
    issues.push(
      issue("ERROR", "TEAM_SHORT_NAME_REQUIRED", "Team short name is required.", "shortName"),
    );
  }

  const type = CatalogRegistry.getTeamType(configuration.typeId);
  if (!type) {
    issues.push(
      issue(
        "ERROR",
        "TEAM_TYPE_UNKNOWN",
        `Team Type "${configuration.typeId}" is not in the catalog.`,
        "typeId",
      ),
    );
  }

  // Role constraints from catalog (never hardcoded role matrix).
  const roles = CatalogRegistry.listTeamRoles();
  for (const role of roles) {
    const holders = members.filter((m) => m.roleId === role.id);
    if (role.required && holders.length === 0) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_ROLE_REQUIRED",
          `${role.displayName} is required.`,
          `roles.${role.id}`,
        ),
      );
    }
    const max = role.maxCount;
    if (max != null && holders.length > max) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_ROLE_MAX_EXCEEDED",
          `${role.displayName} allows at most ${max}; found ${holders.length}.`,
          `roles.${role.id}`,
        ),
      );
    }
    if (!role.multipleAllowed && holders.length > 1) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_ROLE_MULTIPLE_NOT_ALLOWED",
          `${role.displayName} does not allow multiple holders.`,
          `roles.${role.id}`,
        ),
      );
    }
  }

  // Unknown role ids on members.
  for (const member of members) {
    if (!CatalogRegistry.getTeamRole(member.roleId)) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_ROLE_UNKNOWN",
          `Role "${member.roleId}" is not in the catalog.`,
          "members.roleId",
        ),
      );
    }
  }

  // Competition squad rules — single source of truth from EPIC-03.
  const squad = opts?.competitionSquadRules;
  if (squad) {
    const playingRoles = new Set(["player", "captain", "vice_captain"]);
    const playingCount = members.filter(
      (m) => playingRoles.has(m.roleId) && m.status === "active",
    ).length;
    // Count unique participants in playing roles.
    const uniquePlaying = new Set(
      members
        .filter((m) => playingRoles.has(m.roleId) && m.status === "active")
        .map((m) => m.participant.id),
    ).size;
    const count = uniquePlaying || playingCount;

    if (squad.minPlayers != null && count < squad.minPlayers) {
      issues.push(
        issue(
          "WARNING",
          "TEAM_BELOW_MIN_SQUAD",
          `Team has ${count} playing members; Competition minimum is ${squad.minPlayers}.`,
          "members",
        ),
      );
    }
    if (squad.maxPlayers != null && count > squad.maxPlayers) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_ABOVE_MAX_SQUAD",
          `Team has ${count} playing members; Competition maximum is ${squad.maxPlayers}.`,
          "members",
        ),
      );
    }
  }

  if (opts?.competitionTypeId === "registered_teams" && members.length === 0) {
    issues.push(
      issue(
        "WARNING",
        "TEAM_NO_MEMBERS",
        "Registered-teams competitions typically have members before lock.",
        "members",
      ),
    );
  }

  if (
    opts?.registrationModeId === "team" &&
    !members.some((m) => m.roleId === "captain")
  ) {
    issues.push(
      issue(
        "INFO",
        "TEAM_CAPTAIN_FOR_TEAM_REGISTRATION",
        "Team registration mode usually expects a captain before competition starts.",
        "roles.captain",
      ),
    );
  }

  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const infoCount = issues.filter((i) => i.severity === "INFO").length;

  return {
    issues,
    errorCount,
    warningCount,
    infoCount,
    readiness: readinessFromIssues(issues),
  };
}
