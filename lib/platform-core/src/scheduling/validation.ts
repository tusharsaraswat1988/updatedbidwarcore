import { CatalogRegistry } from "../catalog/registry.ts";
import type { ValidationIssue } from "../catalog/resolve/types.ts";
import type {
  ResourceAssignment,
  ScheduleSlot,
  SchedulingConfiguration,
  SchedulingReadiness,
  SchedulingValidationResult,
} from "./types.ts";

function issue(
  severity: ValidationIssue["severity"],
  code: string,
  message: string,
  path?: string,
): ValidationIssue {
  return { severity, code, message, path };
}

function readinessFromIssues(issues: readonly ValidationIssue[]): SchedulingReadiness {
  if (issues.some((i) => i.severity === "ERROR")) return "not_ready";
  if (issues.some((i) => i.severity === "WARNING")) return "almost_ready";
  return "ready";
}

/** EPIC-03 Competition State — reference only; do not duplicate Competition logic. */
export type CompetitionStateForScheduling = {
  competitionLocked: boolean;
  competitionReadiness?: "ready" | "almost_ready" | "not_ready" | null;
};

/** EPIC-06 Fixture State — reference only; do not duplicate Fixture logic. */
export type FixtureStateForScheduling = {
  fixtureReady: boolean;
  fixtureLocked: boolean;
  fixtureReadiness?: "ready" | "almost_ready" | "not_ready" | null;
};

export type SchedulingValidationContext = {
  conflictCount?: number | null;
};

/**
 * Validate Working Scheduling Configuration + Slots + Assignments.
 * Competition / Fixture readiness are referenced — never reimplemented.
 */
export function validateScheduling(
  configuration: SchedulingConfiguration,
  slots: readonly ScheduleSlot[],
  assignments: readonly ResourceAssignment[],
  competition?: CompetitionStateForScheduling | null,
  fixture?: FixtureStateForScheduling | null,
  context?: SchedulingValidationContext | null,
): SchedulingValidationResult {
  const issues: ValidationIssue[] = [];

  const strategy = CatalogRegistry.getSchedulingStrategy(configuration.strategyId);
  if (!strategy) {
    issues.push(
      issue(
        "ERROR",
        "SCHEDULING_STRATEGY_UNKNOWN",
        `Scheduling Strategy "${configuration.strategyId}" is not in the catalog.`,
        "strategyId",
      ),
    );
  }

  if (competition) {
    if (!competition.competitionLocked) {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition Setup must be locked before locking Scheduling Setup.",
          "competition",
        ),
      );
    } else if (competition.competitionReadiness === "not_ready") {
      issues.push(
        issue(
          "ERROR",
          "COMPETITION_NOT_READY",
          "Competition is not Ready; cannot lock Scheduling Setup.",
          "competition",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "ERROR",
        "COMPETITION_STATE_UNKNOWN",
        "Competition State is required to validate Scheduling Ready.",
        "competition",
      ),
    );
  }

  if (fixture) {
    // Fixture Ready = configuration locked (EPIC-06 POST ready).
    if (!fixture.fixtureLocked && !fixture.fixtureReady) {
      issues.push(
        issue(
          "ERROR",
          "FIXTURE_NOT_READY",
          "Fixture Setup must be Ready (locked) before locking Scheduling Setup.",
          "fixture",
        ),
      );
    } else if (fixture.fixtureReadiness === "not_ready") {
      issues.push(
        issue(
          "ERROR",
          "FIXTURE_NOT_READY",
          "Fixture is not Ready; cannot lock Scheduling Setup.",
          "fixture",
        ),
      );
    }
  } else {
    issues.push(
      issue(
        "ERROR",
        "FIXTURE_STATE_UNKNOWN",
        "Fixture State is required to validate Scheduling Ready.",
        "fixture",
      ),
    );
  }

  if (slots.length === 0) {
    issues.push(
      issue(
        "ERROR",
        "SCHEDULING_STRUCTURE_EMPTY",
        "Scheduling has no slots. Structure must exist (Generated) before Ready.",
        "slots",
      ),
    );
  }

  const slotIds = new Set(slots.map((s) => s.slotId));
  for (const slot of slots) {
    if (slot.blueprintId == null) {
      issues.push(
        issue(
          "WARNING",
          "SCHEDULE_SLOT_MISSING_BLUEPRINT",
          `Slot "${slot.slotId}" has no Match Blueprint reference.`,
          `slots.${slot.slotId}.blueprintId`,
        ),
      );
    }
    if (!slot.date && !slot.startTime) {
      issues.push(
        issue(
          "WARNING",
          "SCHEDULE_SLOT_UNSCHEDULED",
          `Slot "${slot.slotId}" has no date/time yet.`,
          `slots.${slot.slotId}`,
        ),
      );
    }
  }

  for (const assignment of assignments) {
    if (!slotIds.has(assignment.slotId)) {
      issues.push(
        issue(
          "ERROR",
          "RESOURCE_ASSIGNMENT_ORPHAN",
          `Assignment "${assignment.assignmentId}" references unknown slot.`,
          `assignments.${assignment.assignmentId}`,
        ),
      );
    }
    if (!CatalogRegistry.getResourceKind(assignment.resourceKindId)) {
      issues.push(
        issue(
          "ERROR",
          "RESOURCE_KIND_UNKNOWN",
          `Resource kind "${assignment.resourceKindId}" is not in the catalog.`,
          `assignments.${assignment.assignmentId}.resourceKindId`,
        ),
      );
    }
  }

  const assignedSlots = new Set(assignments.map((a) => a.slotId));
  for (const slot of slots) {
    if (slot.status === "assigned" && !assignedSlots.has(slot.slotId)) {
      issues.push(
        issue(
          "WARNING",
          "SCHEDULE_SLOT_MISSING_ASSIGNMENT",
          `Slot "${slot.slotId}" is assigned but has no Resource Assignment.`,
          `slots.${slot.slotId}`,
        ),
      );
    }
  }

  if (context?.conflictCount != null && context.conflictCount > 0) {
    issues.push(
      issue(
        "ERROR",
        "SCHEDULING_CONFLICTS",
        `${context.conflictCount} scheduling conflict(s) detected.`,
        "conflicts",
      ),
    );
  }

  if (
    configuration.operatingHours.start &&
    configuration.operatingHours.end &&
    configuration.operatingHours.start >= configuration.operatingHours.end
  ) {
    issues.push(
      issue(
        "ERROR",
        "SCHEDULING_HOURS_INVALID",
        "Operating hours start must be before end.",
        "operatingHours",
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
