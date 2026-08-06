import { CatalogRegistry } from "../catalog/registry.ts";
import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type {
  MatchConfiguration,
  MatchOfficial,
  MatchReadiness,
  MatchSide,
  MatchValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function readinessFromIssues(issues: readonly ValidationIssue[]): MatchReadiness {
  if (issues.some((i) => i.severity === "ERROR")) return "not_ready";
  if (issues.some((i) => i.severity === "WARNING")) return "almost_ready";
  return "ready";
}

export type CompetitionStateForMatch = {
  /** True when Competition Setup is locked (EPIC-03 Plan exists). */
  competitionLocked: boolean;
  competitionReadiness?: "ready" | "almost_ready" | "not_ready" | null;
  competitionTypeId?: string | null;
  ruleProfileId?: string | null;
  presentationProfileId?: string | null;
};

/**
 * Validate Working Match Configuration + Sides + Officials.
 * Competition State checks reference EPIC-03 — no duplicate competition logic.
 */
export function validateMatch(
  configuration: MatchConfiguration,
  sides: readonly MatchSide[],
  officials: readonly MatchOfficial[],
  competition?: CompetitionStateForMatch | null,
): MatchValidationResult {
  const issues: ValidationIssue[] = [];

  if (!configuration.name?.trim()) {
    issues.push(issue("ERROR", "MATCH_NAME_REQUIRED", "Match name is required.", "name"));
  }

  const type = CatalogRegistry.getMatchType(configuration.typeId);
  if (!type) {
    issues.push(
      issue(
        "ERROR",
        "MATCH_TYPE_UNKNOWN",
        `Match Type "${configuration.typeId}" is not in the catalog.`,
        "typeId",
      ),
    );
  }

  // Competition State before Match Ready (EPIC-03 reference).
  if (competition) {
    if (!competition.competitionLocked) {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition Setup must be locked before locking Match Setup.",
          "competition",
        ),
      );
    } else if (
      competition.competitionReadiness === "not_ready"
    ) {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition is not Ready; cannot lock Match Setup.",
          "competition",
        ),
      );
    }

    if (!competition.ruleProfileId) {
      issues.push(
        issue(
          "WARNING",
          "RULE_PROFILE_UNSET",
          "Competition has no Rule Profile reference.",
          "ruleProfileId",
        ),
      );
    }
    if (!competition.presentationProfileId) {
      issues.push(
        issue(
          "INFO",
          "PRESENTATION_PROFILE_UNSET",
          "Competition has no Presentation Profile reference.",
          "presentationProfileId",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "ERROR",
        "COMPETITION_STATE_UNKNOWN",
        "Competition State is required to validate Match Ready.",
        "competition",
      ),
    );
  }

  // Sides — platform slots side_a / side_b.
  for (const side of sides) {
    if (!side.subject) {
      issues.push(
        issue(
          "ERROR",
          "MATCH_SIDE_EMPTY",
          `Match Side "${side.sideId}" has no Team or Participant.`,
          `sides.${side.sideId}`,
        ),
      );
      continue;
    }
    for (const roleId of side.roles) {
      const role = CatalogRegistry.getMatchRole(roleId);
      if (!role || role.scope !== "side") {
        issues.push(
          issue(
            "ERROR",
            "MATCH_SIDE_ROLE_UNKNOWN",
            `Side role "${roleId}" is not a valid side role.`,
            `sides.${side.sideId}.roles`,
          ),
        );
      }
    }
    const sideRoles = CatalogRegistry.listMatchRoles("side");
    for (const role of sideRoles) {
      if (!role.required) continue;
      const count = side.roles.filter((r) => r === role.id).length;
      if (count === 0) {
        issues.push(
          issue(
            "ERROR",
            "MATCH_SIDE_ROLE_REQUIRED",
            `${role.displayName} is required on Side "${side.sideId}".`,
            `sides.${side.sideId}.roles`,
          ),
        );
      }
    }
  }

  if (sides.length < 2) {
    issues.push(
      issue(
        "ERROR",
        "MATCH_SIDES_INCOMPLETE",
        "A Match requires Side A and Side B.",
        "sides",
      ),
    );
  }

  // Officials — catalog constraints; never mixed into sides.
  const officialRoles = CatalogRegistry.listMatchRoles("official");
  for (const role of officialRoles) {
    const holders = officials.filter((o) => o.roleId === role.id);
    if (role.required && holders.length === 0) {
      issues.push(
        issue(
          "ERROR",
          "MATCH_OFFICIAL_ROLE_REQUIRED",
          `${role.displayName} is required.`,
          `officials.${role.id}`,
        ),
      );
    }
    if (role.maxCount != null && holders.length > role.maxCount) {
      issues.push(
        issue(
          "ERROR",
          "MATCH_OFFICIAL_ROLE_MAX_EXCEEDED",
          `${role.displayName} allows at most ${role.maxCount}; found ${holders.length}.`,
          `officials.${role.id}`,
        ),
      );
    }
  }
  for (const official of officials) {
    const role = CatalogRegistry.getMatchRole(official.roleId);
    if (!role || role.scope !== "official") {
      issues.push(
        issue(
          "ERROR",
          "MATCH_OFFICIAL_ROLE_UNKNOWN",
          `Official role "${official.roleId}" is not in the catalog.`,
          "officials.roleId",
        ),
      );
    }
  }

  if (configuration.scheduledDate && configuration.scheduledTime) {
    const when = new Date(`${configuration.scheduledDate}T${configuration.scheduledTime}:00Z`);
    if (Number.isNaN(when.getTime())) {
      issues.push(
        issue(
          "WARNING",
          "MATCH_SCHEDULE_INVALID",
          "Scheduled date/time could not be parsed.",
          "scheduledDate",
        ),
      );
    }
  } else if (configuration.scheduledDate || configuration.scheduledTime) {
    issues.push(
      issue(
        "WARNING",
        "MATCH_SCHEDULE_PARTIAL",
        "Schedule should include both date and time.",
        "scheduledDate",
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
