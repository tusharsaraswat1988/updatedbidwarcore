import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type {
  RuntimeSnapshot,
  RuntimeSnapshotReferences,
  RuntimeValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function readinessFromIssues(
  issues: readonly ValidationIssue[],
): RuntimeValidationResult["readiness"] {
  if (issues.some((i) => i.severity === "ERROR")) return "not_ready";
  if (issues.some((i) => i.severity === "WARNING")) return "almost_ready";
  return "ready";
}

export type CompetitionStateForRuntime = {
  competitionLocked: boolean;
  competitionReadiness?: "ready" | "almost_ready" | "not_ready" | null;
  ruleProfileId?: string | null;
  ruleProfileVersion?: number | string | null;
  presentationProfileId?: string | null;
  presentationProfileVersion?: number | string | null;
};

export type FixtureStateForRuntime = {
  fixtureReady: boolean;
  fixtureLocked: boolean;
};

export type SchedulingStateForRuntime = {
  schedulingReady: boolean;
  schedulingLocked: boolean;
  resourceAssignmentLocked?: boolean;
};

export type MatchConfigStateForRuntime = {
  configurationLocked: boolean;
  configurationVersion?: number | null;
};

/**
 * Validate Runtime Preparation readiness.
 * Reuses shared ValidationIssue severities — no new response format.
 * No scoring validation.
 */
export function validateRuntimeMatch(
  refs: RuntimeSnapshotReferences | null,
  competition?: CompetitionStateForRuntime | null,
  fixture?: FixtureStateForRuntime | null,
  scheduling?: SchedulingStateForRuntime | null,
  matchConfig?: MatchConfigStateForRuntime | null,
  activeSnapshot?: RuntimeSnapshot | null,
): RuntimeValidationResult {
  const issues: ValidationIssue[] = [];

  if (competition) {
    if (!competition.competitionLocked) {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition Setup must be locked before Runtime Preparation.",
          "competition",
        ),
      );
    } else if (competition.competitionReadiness === "not_ready") {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition is not Ready.",
          "competition",
        ),
      );
    }
    if (!competition.ruleProfileId) {
      issues.push(
        issue(
          "ERROR",
          "RULE_PROFILE_NOT_LOCKED",
          "Locked Rule Profile reference is required.",
          "ruleProfile",
        ),
      );
    } else if (competition.ruleProfileVersion == null) {
      issues.push(
        issue(
          "WARNING",
          "RULE_PROFILE_VERSION_UNSET",
          "Rule Profile has no frozen version id.",
          "ruleProfile.version",
        ),
      );
    }
    if (!competition.presentationProfileId) {
      issues.push(
        issue(
          "ERROR",
          "PRESENTATION_PROFILE_NOT_LOCKED",
          "Locked Presentation Profile reference is required.",
          "presentationProfile",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "ERROR",
        "COMPETITION_STATE_UNKNOWN",
        "Competition State is required for Runtime Validation.",
        "competition",
      ),
    );
  }

  if (fixture) {
    if (!fixture.fixtureReady && !fixture.fixtureLocked) {
      issues.push(
        issue(
          "ERROR",
          "FIXTURE_NOT_READY",
          "Fixture must be Ready before Runtime Preparation.",
          "fixture",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "WARNING",
        "FIXTURE_STATE_UNKNOWN",
        "Fixture State could not be resolved for this Match.",
        "fixture",
      ),
    );
  }

  if (scheduling) {
    if (!scheduling.schedulingReady && !scheduling.schedulingLocked) {
      issues.push(
        issue(
          "ERROR",
          "SCHEDULING_NOT_READY",
          "Scheduling must be Ready before Runtime Preparation.",
          "scheduling",
        ),
      );
    }
    if (scheduling.resourceAssignmentLocked === false) {
      issues.push(
        issue(
          "ERROR",
          "RESOURCE_ASSIGNMENT_NOT_LOCKED",
          "Resource Assignment must be locked.",
          "resourceAssignment",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "WARNING",
        "SCHEDULING_STATE_UNKNOWN",
        "Scheduling State could not be resolved for this Match.",
        "scheduling",
      ),
    );
  }

  if (matchConfig) {
    if (!matchConfig.configurationLocked) {
      issues.push(
        issue(
          "ERROR",
          "MATCH_CONFIGURATION_NOT_LOCKED",
          "Match Configuration must be locked before Runtime Preparation.",
          "matchConfiguration",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "ERROR",
        "MATCH_CONFIGURATION_STATE_UNKNOWN",
        "Match Configuration State is required.",
        "matchConfiguration",
      ),
    );
  }

  const checkRefs = activeSnapshot?.references ?? refs;
  if (checkRefs) {
    if (!checkRefs.matchConfiguration) {
      issues.push(
        issue(
          "ERROR",
          "SNAPSHOT_MATCH_CONFIG_REF_MISSING",
          "Runtime Snapshot must reference a frozen Match Configuration version.",
          "snapshot.matchConfiguration",
        ),
      );
    }
    if (!checkRefs.sides.length) {
      issues.push(
        issue(
          "WARNING",
          "SNAPSHOT_SIDES_EMPTY",
          "Runtime Snapshot has no Side references.",
          "snapshot.sides",
        ),
      );
    }
  } else if (!activeSnapshot) {
    issues.push(
      issue(
        "INFO",
        "SNAPSHOT_NOT_FROZEN",
        "No Runtime Snapshot frozen yet. Prepare will freeze one.",
        "snapshot",
      ),
    );
  }

  if (activeSnapshot) {
    if (!activeSnapshot.snapshotSchemaVersion) {
      issues.push(
        issue(
          "ERROR",
          "SNAPSHOT_SCHEMA_VERSION_MISSING",
          "Snapshot must be self-describing with snapshotSchemaVersion.",
          "snapshot.snapshotSchemaVersion",
        ),
      );
    }
    if (!activeSnapshot.createdAt) {
      issues.push(
        issue(
          "ERROR",
          "SNAPSHOT_CREATED_AT_MISSING",
          "Snapshot must include createdAt.",
          "snapshot.createdAt",
        ),
      );
    }
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
