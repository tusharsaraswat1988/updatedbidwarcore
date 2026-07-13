/**
 * Tournament Scheduling Engine — fixture court / date / time metadata.
 *
 * BidWar Scoring Architecture v1.0:
 *   Fixtures → Scheduling → Matches → Scoring
 *
 * Scheduling owns: Unscheduled → Scheduled → Ready
 * Scoring owns: In Progress (live) → Completed
 *
 * Reuses badminton_fixtures.courtId + scheduledAt + status. No new tables.
 *
 * Future (prepare only — not implemented): umpire, scorer, priority, notes via metaJson.
 *
 * @see docs/superpowers/specs/2026-07-13-draw-fixtures-module-design.md
 */

import { and, eq, isNull } from "drizzle-orm";
import { db } from "@workspace/db";
import {
  badmintonCourtsTable,
  badmintonFixturesTable,
  type BadmintonFixture,
} from "@workspace/db";
import { findServerCourtScheduleConflicts } from "./badminton-ops";

/** Scheduling-controlled statuses. */
export const FIXTURE_SCHEDULING_STATUSES = ["unscheduled", "scheduled", "ready"] as const;

/** Scoring-controlled statuses (plus legacy live). */
export const FIXTURE_SCORING_STATUSES = ["live", "in_progress", "completed"] as const;

export type FixtureSchedulingStatus = (typeof FIXTURE_SCHEDULING_STATUSES)[number];

export class FixtureSchedulingError extends Error {
  constructor(
    message: string,
    public status: number = 400,
    public code?: string,
  ) {
    super(message);
    this.name = "FixtureSchedulingError";
  }
}

/** True when fixture has court + time (eligible for Create Match). */
export function isFixtureScheduled(fixture: {
  courtId?: number | null;
  scheduledAt?: Date | string | null;
}): boolean {
  return fixture.courtId != null && fixture.scheduledAt != null;
}

/**
 * Effective planning status for UI / gates.
 * Legacy rows often store status "scheduled" without court/time — treat as unscheduled.
 */
export function resolveFixturePlanningStatus(fixture: {
  status: string;
  courtId?: number | null;
  scheduledAt?: Date | string | null;
  scoringMatchId?: number | null;
}): string {
  const raw = fixture.status;
  if (raw === "walkover" || raw === "cancelled") return raw;
  if (raw === "live" || raw === "in_progress") return "in_progress";
  if (raw === "completed") return "completed";
  if (fixture.scoringMatchId != null) return "ready";
  if (isFixtureScheduled(fixture)) return "scheduled";
  return "unscheduled";
}

export function canCreateMatchFromFixture(fixture: {
  status: string;
  courtId?: number | null;
  scheduledAt?: Date | string | null;
  scoringMatchId?: number | null;
}): { ok: true } | { ok: false; error: string } {
  if (fixture.scoringMatchId != null) {
    return {
      ok: false,
      error: "A match already exists for this fixture. Open Matches or Match Control.",
    };
  }
  if (fixture.status === "walkover") {
    return { ok: false, error: "Walkover fixtures cannot create a match" };
  }
  if (fixture.status === "cancelled") {
    return { ok: false, error: "Cancelled fixtures cannot create a match" };
  }
  if (!isFixtureScheduled(fixture)) {
    return {
      ok: false,
      error: "Assign a court and time in Scheduling before creating a match",
    };
  }
  return { ok: true };
}

export type ScheduleFixtureInput = {
  tournamentId: number;
  fixtureId: number;
  courtId: number;
  /** ISO datetime or Date — date + time combined. */
  scheduledAt: Date;
  /**
   * When true, allow scheduling onto a court that already has another fixture
   * within ±45 minutes. Default false (server blocks double-booking).
   */
  allowCourtConflict?: boolean;
};

export async function scheduleFixture(
  input: ScheduleFixtureInput,
): Promise<BadmintonFixture> {
  const [fixture] = await db
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, input.fixtureId),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!fixture) {
    throw new FixtureSchedulingError(
      "Fixture not found. Refresh Scheduling and try again.",
      404,
      "FIXTURE_NOT_FOUND",
    );
  }

  if (fixture.status === "live" || fixture.status === "in_progress" || fixture.status === "completed") {
    throw new FixtureSchedulingError(
      "Cannot reschedule a fixture that is in progress or completed",
      400,
      "FIXTURE_LOCKED",
    );
  }

  const [court] = await db
    .select({ id: badmintonCourtsTable.id })
    .from(badmintonCourtsTable)
    .where(
      and(
        eq(badmintonCourtsTable.id, input.courtId),
        eq(badmintonCourtsTable.tournamentId, input.tournamentId),
      ),
    )
    .limit(1);

  if (!court) {
    throw new FixtureSchedulingError(
      "Court not found in this tournament. Pick another court.",
      400,
      "COURT_NOT_FOUND",
    );
  }

  if (Number.isNaN(input.scheduledAt.getTime())) {
    throw new FixtureSchedulingError("Invalid date or time", 400, "INVALID_TIME");
  }

  // Idempotent: same court + same minute already set
  if (
    fixture.courtId === input.courtId &&
    fixture.scheduledAt &&
    Math.abs(new Date(fixture.scheduledAt).getTime() - input.scheduledAt.getTime()) < 60_000
  ) {
    return fixture;
  }

  const conflicts = await findServerCourtScheduleConflicts({
    tournamentId: input.tournamentId,
    courtId: input.courtId,
    scheduledAt: input.scheduledAt,
    excludeFixtureId: input.fixtureId,
  });

  if (conflicts.length > 0 && !input.allowCourtConflict) {
    const sample = conflicts[0];
    throw new FixtureSchedulingError(
      `Court already has another fixture near this time (Match ${sample?.slotNumber ?? sample?.id}). Move one fixture, or confirm the conflict to save anyway.`,
      409,
      "COURT_CONFLICT",
    );
  }

  const nextStatus =
    fixture.scoringMatchId != null
      ? "ready"
      : fixture.status === "walkover"
        ? "walkover"
        : "scheduled";

  const [updated] = await db
    .update(badmintonFixturesTable)
    .set({
      courtId: input.courtId,
      scheduledAt: input.scheduledAt,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonFixturesTable.id, input.fixtureId),
        eq(badmintonFixturesTable.tournamentId, input.tournamentId),
      ),
    )
    .returning();

  return updated;
}

export async function unscheduleFixture(
  tournamentId: number,
  fixtureId: number,
): Promise<BadmintonFixture> {
  const [fixture] = await db
    .select()
    .from(badmintonFixturesTable)
    .where(
      and(
        eq(badmintonFixturesTable.id, fixtureId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!fixture) {
    throw new FixtureSchedulingError(
      "Fixture not found. Refresh Scheduling and try again.",
      404,
      "FIXTURE_NOT_FOUND",
    );
  }

  // Idempotent: already unscheduled
  if (fixture.courtId == null && fixture.scheduledAt == null) {
    return fixture;
  }

  if (fixture.scoringMatchId != null) {
    throw new FixtureSchedulingError(
      "Cannot unschedule — a match already exists. Delete the match from Matches first.",
      400,
      "MATCH_EXISTS",
    );
  }

  if (fixture.status === "live" || fixture.status === "in_progress" || fixture.status === "completed") {
    throw new FixtureSchedulingError(
      "Cannot unschedule a fixture that is in progress or completed",
      400,
      "FIXTURE_LOCKED",
    );
  }

  const nextStatus = fixture.status === "walkover" ? "walkover" : "unscheduled";

  const [updated] = await db
    .update(badmintonFixturesTable)
    .set({
      courtId: null,
      scheduledAt: null,
      status: nextStatus,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonFixturesTable.id, fixtureId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
        isNull(badmintonFixturesTable.scoringMatchId),
      ),
    )
    .returning();

  if (!updated) {
    throw new FixtureSchedulingError(
      "Cannot unschedule — a match was created while you were editing. Refresh and try again.",
      409,
      "MATCH_EXISTS",
    );
  }

  return updated;
}

/** Mark fixture Ready after match creation (scheduling → execution handoff). */
export async function markFixtureReady(
  tournamentId: number,
  fixtureId: number,
  scoringMatchId: number,
): Promise<void> {
  const [linked] = await db
    .update(badmintonFixturesTable)
    .set({
      scoringMatchId,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(badmintonFixturesTable.id, fixtureId),
        eq(badmintonFixturesTable.tournamentId, tournamentId),
        isNull(badmintonFixturesTable.scoringMatchId),
      ),
    )
    .returning({ id: badmintonFixturesTable.id });

  if (!linked) {
    throw new FixtureSchedulingError(
      "A match was already created for this fixture. Open Matches or Match Control.",
      409,
      "MATCH_EXISTS",
    );
  }
}
