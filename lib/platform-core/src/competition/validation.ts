import { CatalogRegistry } from "../catalog/registry.ts";
import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type {
  CompetitionConfiguration,
  CompetitionReadiness,
  CompetitionStatus,
  CompetitionValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

/** Validate Working Competition Configuration (platform / competition layer). */
export function validateCompetitionConfiguration(
  config: CompetitionConfiguration,
): CompetitionValidationResult {
  const issues: ValidationIssue[] = [];

  if (!config.competitionTypeId) {
    issues.push(
      issue(
        "ERROR",
        "COMPETITION_TYPE_REQUIRED",
        "Competition Type is required before locking Competition Setup.",
        "competitionTypeId",
      ),
    );
  }

  if (!config.registrationModeId) {
    issues.push(
      issue(
        "ERROR",
        "REGISTRATION_MODE_REQUIRED",
        "Registration Mode must be confirmed before locking.",
        "registrationModeId",
      ),
    );
  } else if (config.competitionTypeId) {
    const modes = CatalogRegistry.listRegistrationModes(config.competitionTypeId);
    if (!modes.some((m) => m.id === config.registrationModeId)) {
      issues.push(
        issue(
          "ERROR",
          "REGISTRATION_MODE_INCOMPATIBLE",
          `Registration Mode "${config.registrationModeId}" is not supported for this Competition Type.`,
          "registrationModeId",
        ),
      );
    } else {
      const recommended = CatalogRegistry.suggestRegistrationModeId(config.competitionTypeId);
      if (recommended && recommended !== config.registrationModeId) {
        issues.push(
          issue(
            "INFO",
            "REGISTRATION_MODE_NOT_RECOMMENDED",
            `Recommended Registration Mode for this Competition Type is "${recommended}".`,
            "registrationModeId",
          ),
        );
      }
    }
  }

  if (!config.teamFormationStrategyId) {
    issues.push(
      issue(
        "WARNING",
        "TEAM_FORMATION_UNSET",
        "Team Formation Strategy is not set. Confirm a strategy before locking.",
        "teamFormationStrategyId",
      ),
    );
  } else if (config.competitionTypeId) {
    const strategies = CatalogRegistry.listTeamFormationStrategies(config.competitionTypeId);
    if (!strategies.some((s) => s.id === config.teamFormationStrategyId)) {
      issues.push(
        issue(
          "ERROR",
          "TEAM_FORMATION_INCOMPATIBLE",
          `Team Formation Strategy "${config.teamFormationStrategyId}" is not supported for this Competition Type.`,
          "teamFormationStrategyId",
        ),
      );
    }
  }

  if (!config.variantId) {
    issues.push(
      issue("WARNING", "VARIANT_UNSET", "Variant is not set.", "variantId"),
    );
  }

  if (!config.ruleProfileId) {
    issues.push(
      issue(
        "WARNING",
        "RULE_PROFILE_UNSET",
        "Rule Profile is not bound (legacy resolution may apply).",
        "ruleProfileId",
      ),
    );
  }

  const { minPlayers, maxPlayers } = config.squadRules;
  if (
    typeof minPlayers === "number" &&
    typeof maxPlayers === "number" &&
    minPlayers > maxPlayers
  ) {
    issues.push(
      issue(
        "ERROR",
        "SQUAD_LIMITS_INVALID",
        "Minimum players cannot exceed maximum players.",
        "squadRules",
      ),
    );
  }

  const { minParticipants, maxParticipants } = config.participantConstraints;
  if (
    typeof minParticipants === "number" &&
    typeof maxParticipants === "number" &&
    minParticipants > maxParticipants
  ) {
    issues.push(
      issue(
        "ERROR",
        "PARTICIPANT_LIMITS_INVALID",
        "Minimum participants cannot exceed maximum participants.",
        "participantConstraints",
      ),
    );
  }

  if (
    config.competitionTypeId === "registered_teams" &&
    config.registrationModeId === "individual"
  ) {
    issues.push(
      issue(
        "WARNING",
        "REGISTERED_TEAMS_INDIVIDUAL",
        "Registered Teams usually uses Team registration. Individual mode may be incomplete.",
        "registrationModeId",
      ),
    );
  }

  const errorCount = issues.filter((i) => i.severity === "ERROR").length;
  const warningCount = issues.filter((i) => i.severity === "WARNING").length;
  const infoCount = issues.filter((i) => i.severity === "INFO").length;

  let readiness: CompetitionReadiness = "ready";
  if (errorCount > 0) readiness = "not_ready";
  else if (warningCount > 0) readiness = "almost_ready";

  return { issues, errorCount, warningCount, infoCount, readiness };
}

export function buildCompetitionStatus(
  config: CompetitionConfiguration,
  validation: CompetitionValidationResult,
): CompetitionStatus {
  const recommendations: string[] = [];
  if (!config.registrationModeId && config.competitionTypeId) {
    const suggested = CatalogRegistry.suggestRegistrationModeId(config.competitionTypeId);
    if (suggested) {
      recommendations.push(`Confirm Registration Mode (recommended: ${suggested}).`);
    }
  }
  if (!config.teamFormationStrategyId && config.competitionTypeId) {
    const suggested = CatalogRegistry.suggestTeamFormationStrategyId(config.competitionTypeId);
    if (suggested) {
      recommendations.push(`Confirm Team Formation Strategy (recommended: ${suggested}).`);
    }
  }
  for (const i of validation.issues) {
    if (i.severity === "INFO") recommendations.push(i.message);
  }

  return {
    readiness: config.locked ? "ready" : validation.readiness,
    businessStageId: config.businessStageId,
    locked: config.locked,
    blockingIssueCount: validation.errorCount,
    warningCount: validation.warningCount,
    recommendations,
  };
}
