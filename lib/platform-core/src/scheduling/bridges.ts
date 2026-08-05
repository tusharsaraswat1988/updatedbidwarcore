import type {
  ResourceAssignment,
  ScheduleSlot,
  SchedulingIdentity,
  SchedulingResourceRef,
} from "./types.ts";
import { encodeSchedulingId } from "./ids.ts";
import {
  resolvePlanKindId,
  resolveSchedulingConfiguration,
  type DrawSchedulingRuntimeColumns,
} from "./configuration.ts";
import { resolveSchedulingLifecycle } from "./lifecycle.ts";

export type BadmintonCourtBridgeRow = {
  id: number;
  name: string;
  status?: string | null;
};

export type BadmintonFixtureScheduleRow = {
  id: number;
  drawId: number;
  courtId?: number | null;
  scheduledAt?: Date | string | null;
  status?: string | null;
  slotNumber?: number | null;
};

export type ScoringVenueBridgeRow = {
  id: number;
  name: string;
  status?: string | null;
};

export type ScoringFixtureScheduleRow = {
  id: number;
  drawId?: number | null;
  venueId?: number | null;
  venue?: string | null;
  scheduledAt?: Date | string | null;
  status?: string | null;
  fixtureNumber?: number | null;
};

function splitDateTime(value: Date | string | null | undefined): {
  date: string | null;
  startTime: string | null;
} {
  if (!value) return { date: null, startTime: null };
  const d = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return { date: null, startTime: null };
  const iso = d.toISOString();
  return { date: iso.slice(0, 10), startTime: iso.slice(11, 16) };
}

function endTimeFromStart(start: string | null, durationMinutes: number): string | null {
  if (!start) return null;
  const [h, m] = start.split(":").map(Number);
  if (h == null || m == null || Number.isNaN(h) || Number.isNaN(m)) return null;
  const total = h * 60 + m + durationMinutes;
  const eh = Math.floor(total / 60) % 24;
  const em = total % 60;
  return `${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}`;
}

export function mapDrawToSchedulingIdentity(
  row: DrawSchedulingRuntimeColumns,
  fixtureTypeId?: string | null,
): SchedulingIdentity {
  const id = encodeSchedulingId(row.source, row.id);
  return {
    id,
    tournamentId: row.tournamentId,
    planKindId: resolvePlanKindId(row, fixtureTypeId),
    source: row.source,
    fixtureId: id,
  };
}

export function mapDrawToSchedulingConfiguration(
  row: DrawSchedulingRuntimeColumns,
  opts?: { planVersion?: number | null },
) {
  return resolveSchedulingConfiguration(row, opts);
}

export function mapDrawToSchedulingLifecycle(
  row: DrawSchedulingRuntimeColumns,
  hasStructure: boolean,
) {
  return resolveSchedulingLifecycle(
    encodeSchedulingId(row.source, row.id),
    row.tournamentId,
    row.schedulingLifecycleStatus,
    !!row.schedulingConfigurationLocked,
    hasStructure,
  );
}

/**
 * Badminton fixtures → ScheduleSlots + ResourceAssignments.
 * Algorithms stay in runtime; this only maps structure to product views.
 */
export function mapBadmintonFixturesToSchedule(
  fixtures: readonly BadmintonFixtureScheduleRow[],
  courts: readonly BadmintonCourtBridgeRow[],
  opts?: { defaultDurationMinutes?: number },
): { slots: ScheduleSlot[]; assignments: ResourceAssignment[] } {
  const duration = opts?.defaultDurationMinutes ?? 45;
  const courtById = new Map(courts.map((c) => [c.id, c]));
  const slots: ScheduleSlot[] = [];
  const assignments: ResourceAssignment[] = [];

  for (const row of fixtures) {
    const { date, startTime } = splitDateTime(row.scheduledAt);
    const hasTime = !!row.scheduledAt;
    const hasCourt = row.courtId != null;
    const slotId = `slot-bf-${row.id}`;
    slots.push({
      slotId,
      date,
      startTime,
      endTime: endTimeFromStart(startTime, duration),
      durationMinutes: hasTime ? duration : null,
      availability: hasTime || hasCourt ? "available" : "unavailable",
      status: hasCourt && hasTime ? "assigned" : hasTime || hasCourt ? "reserved" : "available",
      blueprintId: `bp-bf-${row.id}`,
    });
    if (hasCourt && row.courtId != null) {
      const court = courtById.get(row.courtId);
      assignments.push({
        assignmentId: `ra-bf-${row.id}`,
        slotId,
        resourceKindId: "court",
        resourceId: `court:${row.courtId}`,
        resourceDisplayName: court?.name ?? `Court ${row.courtId}`,
        status: "planned",
        priority: row.slotNumber ?? null,
      });
    }
  }

  return { slots, assignments };
}

export function mapScoringFixturesToSchedule(
  fixtures: readonly ScoringFixtureScheduleRow[],
  venues: readonly ScoringVenueBridgeRow[],
  opts?: { defaultDurationMinutes?: number },
): { slots: ScheduleSlot[]; assignments: ResourceAssignment[] } {
  const duration = opts?.defaultDurationMinutes ?? 180;
  const venueById = new Map(venues.map((v) => [v.id, v]));
  const slots: ScheduleSlot[] = [];
  const assignments: ResourceAssignment[] = [];

  for (const row of fixtures) {
    const { date, startTime } = splitDateTime(row.scheduledAt);
    const hasTime = !!row.scheduledAt;
    const hasVenue = row.venueId != null || !!(row.venue && row.venue.trim());
    const slotId = `slot-sf-${row.id}`;
    slots.push({
      slotId,
      date,
      startTime,
      endTime: endTimeFromStart(startTime, duration),
      durationMinutes: hasTime ? duration : null,
      availability: hasTime || hasVenue ? "available" : "unavailable",
      status: hasVenue && hasTime ? "assigned" : hasTime || hasVenue ? "reserved" : "available",
      blueprintId: `bp-sf-${row.id}`,
    });
    if (row.venueId != null) {
      const venue = venueById.get(row.venueId);
      assignments.push({
        assignmentId: `ra-sf-${row.id}`,
        slotId,
        resourceKindId: "ground",
        resourceId: `venue:${row.venueId}`,
        resourceDisplayName: venue?.name ?? row.venue ?? `Venue ${row.venueId}`,
        status: "planned",
        priority: row.fixtureNumber ?? null,
      });
    } else if (row.venue && row.venue.trim()) {
      assignments.push({
        assignmentId: `ra-sf-${row.id}`,
        slotId,
        resourceKindId: "ground",
        resourceId: `venue-label:${encodeURIComponent(row.venue.trim())}`,
        resourceDisplayName: row.venue.trim(),
        status: "planned",
        priority: row.fixtureNumber ?? null,
      });
    }
  }

  return { slots, assignments };
}

export function mapBadmintonCourtsToResourceRefs(
  courts: readonly BadmintonCourtBridgeRow[],
): SchedulingResourceRef[] {
  return courts.map((c) => ({
    resourceId: `court:${c.id}`,
    resourceKindId: "court" as const,
    displayName: c.name,
    source: "badminton" as const,
  }));
}

export function mapScoringVenuesToResourceRefs(
  venues: readonly ScoringVenueBridgeRow[],
): SchedulingResourceRef[] {
  return venues.map((v) => ({
    resourceId: `venue:${v.id}`,
    resourceKindId: "ground" as const,
    displayName: v.name,
    source: "cricket" as const,
  }));
}
