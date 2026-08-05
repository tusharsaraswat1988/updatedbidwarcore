import { CatalogRegistry } from "../catalog/registry.ts";
import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type {
  FixtureConfiguration,
  FixtureNode,
  FixtureReadiness,
  FixtureValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function readinessFromIssues(issues: readonly ValidationIssue[]): FixtureReadiness {
  if (issues.some((i) => i.severity === "ERROR")) return "not_ready";
  if (issues.some((i) => i.severity === "WARNING")) return "almost_ready";
  return "ready";
}

export type CompetitionStateForFixture = {
  /** True when Competition Setup is locked (EPIC-03 Plan exists). */
  competitionLocked: boolean;
  competitionReadiness?: "ready" | "almost_ready" | "not_ready" | null;
  competitionTypeId?: string | null;
  ruleProfileId?: string | null;
  presentationProfileId?: string | null;
};

export type FixtureValidationContext = {
  teamCount?: number | null;
  participantCount?: number | null;
};

/**
 * Validate Working Fixture Configuration + Nodes.
 * Competition State checks reference EPIC-03 — no duplicate competition logic.
 * No scheduling / scoring / standings validation.
 */
export function validateFixture(
  configuration: FixtureConfiguration,
  nodes: readonly FixtureNode[],
  competition?: CompetitionStateForFixture | null,
  context?: FixtureValidationContext | null,
): FixtureValidationResult {
  const issues: ValidationIssue[] = [];

  if (!configuration.name?.trim()) {
    issues.push(
      issue("ERROR", "FIXTURE_NAME_REQUIRED", "Fixture name is required.", "name"),
    );
  }

  const type = CatalogRegistry.getFixtureType(configuration.typeId);
  if (!type) {
    issues.push(
      issue(
        "ERROR",
        "FIXTURE_TYPE_UNKNOWN",
        `Fixture Type "${configuration.typeId}" is not in the catalog.`,
        "typeId",
      ),
    );
  }

  if (competition) {
    if (!competition.competitionLocked) {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition Setup must be locked before locking Fixture Setup.",
          "competition",
        ),
      );
    } else if (competition.competitionReadiness === "not_ready") {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition is not Ready; cannot lock Fixture Setup.",
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
  } else {
    issues.push(
      issue(
        "ERROR",
        "COMPETITION_STATE_UNKNOWN",
        "Competition State is required to validate Fixture Ready.",
        "competition",
      ),
    );
  }

  if (nodes.length === 0) {
    issues.push(
      issue(
        "ERROR",
        "FIXTURE_STRUCTURE_EMPTY",
        "Fixture has no nodes. Structure must exist (Generated) before Ready.",
        "nodes",
      ),
    );
  }

  for (const node of nodes) {
    const kind = CatalogRegistry.getFixtureNodeKind(node.kindId);
    if (!kind) {
      issues.push(
        issue(
          "ERROR",
          "FIXTURE_NODE_KIND_UNKNOWN",
          `Node kind "${node.kindId}" is not in the catalog.`,
          `nodes.${node.nodeId}.kindId`,
        ),
      );
    }
    for (const adv of node.advancements) {
      const rule = CatalogRegistry.getAdvancementRule(adv.ruleId);
      if (!rule) {
        issues.push(
          issue(
            "ERROR",
            "ADVANCEMENT_RULE_UNKNOWN",
            `Advancement rule "${adv.ruleId}" is not in the catalog.`,
            `nodes.${node.nodeId}.advancement`,
          ),
        );
      }
    }
    if (node.kindId === "contest" && !node.blueprint) {
      issues.push(
        issue(
          "WARNING",
          "FIXTURE_NODE_MISSING_BLUEPRINT",
          `Contest node "${node.nodeId}" has no Match Blueprint.`,
          `nodes.${node.nodeId}.blueprint`,
        ),
      );
    }
    if (node.blueprint) {
      for (const ruleId of node.blueprint.advancementRuleIds) {
        if (!CatalogRegistry.getAdvancementRule(ruleId)) {
          issues.push(
            issue(
              "ERROR",
              "ADVANCEMENT_RULE_UNKNOWN",
              `Blueprint advancement rule "${ruleId}" is not in the catalog.`,
              `nodes.${node.nodeId}.blueprint`,
            ),
          );
        }
      }
    }
  }

  if (context?.teamCount != null && context.teamCount < 2) {
    issues.push(
      issue(
        "WARNING",
        "FIXTURE_TEAM_COUNT_LOW",
        "Fewer than two teams are available for this Fixture.",
        "teams",
      ),
    );
  }

  if (
    configuration.qualificationRules &&
    typeof configuration.qualificationRules !== "object"
  ) {
    issues.push(
      issue(
        "ERROR",
        "FIXTURE_QUALIFICATION_INVALID",
        "Qualification rules must be an object.",
        "qualificationRules",
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
