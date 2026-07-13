/**
 * Tournament Control Center — client-side orchestration helpers.
 * Derives per-court operational status from existing Courts / Fixtures / Matches.
 * No duplicated storage.
 */

export type CourtOpsStatus = "EMPTY" | "READY" | "LIVE" | "FINISHED" | "DELAYED";

export type ControlCourt = {
  id: number;
  name: string;
  shortName?: string | null;
  sortOrder: number;
};

export type ControlMatch = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  detail: Record<string, unknown> | null;
  state: {
    leftSide?: { shortLabel?: string; label?: string };
    rightSide?: { shortLabel?: string; label?: string };
    leftScore?: number;
    rightScore?: number;
    currentGame?: number;
  } | null;
};

export type ControlFixture = {
  id: number;
  categoryId: number;
  slotNumber?: number | null;
  courtId?: number | null;
  scheduledAt?: string | null;
  status: string;
  scoringMatchId?: number | null;
  registrationAId?: number | null;
  registrationBId?: number | null;
};

export type CourtBoardRow = {
  court: ControlCourt;
  status: CourtOpsStatus;
  currentMatch: ControlMatch | null;
  nextMatch: ControlMatch | null;
  nextFixture: ControlFixture | null;
  /** Extra scheduled matches on this court beyond the primary ready one. */
  readyOverflow: number;
  delayed: boolean;
};

function matchCourtId(m: ControlMatch): number | null {
  const id = m.detail?.courtId;
  return typeof id === "number" ? id : null;
}

function matchTime(m: ControlMatch): number {
  if (!m.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(m.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function fixtureTime(f: ControlFixture): number {
  if (!f.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(f.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** Past scheduled time and still waiting to start. */
export function isDelayedScheduledAt(
  scheduledAt: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!scheduledAt) return false;
  const t = new Date(scheduledAt).getTime();
  if (Number.isNaN(t)) return false;
  return t < now;
}

export function isDelayedMatch(m: ControlMatch, now = Date.now()): boolean {
  return m.status === "scheduled" && isDelayedScheduledAt(m.scheduledAt, now);
}

export function isDelayedFixture(f: ControlFixture, now = Date.now()): boolean {
  if (f.scoringMatchId != null) return false;
  if (f.status === "walkover" || f.status === "cancelled" || f.status === "completed") {
    return false;
  }
  return isDelayedScheduledAt(f.scheduledAt, now);
}

/**
 * Detect fixtures already assigned to the same court near the same time.
 * Client-side only — concurrent saves can still race.
 */
export function findCourtScheduleConflicts(
  fixtures: ControlFixture[],
  opts: {
    courtId: number;
    scheduledAtIso: string;
    excludeFixtureId?: number;
    /** Half-window in minutes (default ±45). */
    windowMinutes?: number;
  },
): ControlFixture[] {
  const windowMs = (opts.windowMinutes ?? 45) * 60_000;
  const center = new Date(opts.scheduledAtIso).getTime();
  if (Number.isNaN(center)) return [];

  return fixtures.filter((f) => {
    if (opts.excludeFixtureId != null && f.id === opts.excludeFixtureId) return false;
    if (f.courtId !== opts.courtId) return false;
    if (!f.scheduledAt) return false;
    if (f.status === "walkover" || f.status === "cancelled") return false;
    const t = new Date(f.scheduledAt).getTime();
    if (Number.isNaN(t)) return false;
    return Math.abs(t - center) <= windowMs;
  });
}

export function matchDisplayLabel(m: ControlMatch): string {
  if (m.state?.leftSide || m.state?.rightSide) {
    const left = m.state.leftSide?.shortLabel || m.state.leftSide?.label || "—";
    const right = m.state.rightSide?.shortLabel || m.state.rightSide?.label || "—";
    return `${left} vs ${right}`;
  }
  const label = m.detail?.matchLabel;
  return typeof label === "string" && label.trim() ? label.trim() : `Match #${m.id}`;
}

export function fixtureSlotLabel(
  f: ControlFixture,
  categoryName?: string,
): string {
  const cat = categoryName?.trim() || "Fixture";
  return `${cat} · Match ${f.slotNumber ?? f.id}`;
}

/**
 * Per-court operational board.
 *
 * LIVE — match status live on court
 * DELAYED — ready/scheduled but past start time (shown when not live)
 * READY — scheduled match on court (created, not started)
 * FINISHED — latest match completed and no ready/live on court
 * EMPTY — nothing current on court
 */
export function buildCourtBoard(
  courts: ControlCourt[],
  matches: ControlMatch[],
  fixtures: ControlFixture[],
  now = Date.now(),
): CourtBoardRow[] {
  const sortedCourts = [...courts].sort(
    (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
  );

  return sortedCourts.map((court) => {
    const onCourt = matches
      .filter((m) => matchCourtId(m) === court.id)
      .sort((a, b) => matchTime(a) - matchTime(b));

    const live = onCourt.find((m) => m.status === "live") ?? null;
    const scheduledOnCourt = onCourt.filter((m) => m.status === "scheduled");
    const ready = scheduledOnCourt[0] ?? null;
    const readyOverflow = Math.max(0, scheduledOnCourt.length - 1);
    const completed = onCourt
      .filter((m) => m.status === "completed")
      .sort((a, b) => matchTime(b) - matchTime(a));
    const lastFinished = completed[0] ?? null;

    let status: CourtOpsStatus = "EMPTY";
    let currentMatch: ControlMatch | null = null;
    let delayed = false;

    if (live) {
      status = "LIVE";
      currentMatch = live;
    } else if (ready) {
      delayed = isDelayedMatch(ready, now);
      status = delayed ? "DELAYED" : "READY";
      currentMatch = ready;
    } else if (lastFinished) {
      status = "FINISHED";
      currentMatch = lastFinished;
    }

    const afterId = currentMatch?.id;
    const nextMatch =
      onCourt.find(
        (m) =>
          m.status === "scheduled" &&
          m.id !== afterId &&
          (!currentMatch || matchTime(m) >= matchTime(currentMatch)),
      ) ??
      onCourt.find((m) => m.status === "scheduled" && m.id !== currentMatch?.id) ??
      null;

    const courtFixtures = fixtures
      .filter(
        (f) =>
          f.courtId === court.id &&
          f.scheduledAt != null &&
          f.status !== "walkover" &&
          f.status !== "cancelled" &&
          !f.scoringMatchId,
      )
      .sort((a, b) => fixtureTime(a) - fixtureTime(b));

    const nextFixture = courtFixtures[0] ?? null;

    return {
      court,
      status,
      currentMatch,
      nextMatch,
      nextFixture,
      readyOverflow,
      delayed,
    };
  });
}

export function listUpcomingFixtures(fixtures: ControlFixture[]): ControlFixture[] {
  return fixtures
    .filter(
      (f) =>
        f.courtId != null &&
        f.scheduledAt != null &&
        !f.scoringMatchId &&
        f.status !== "walkover" &&
        f.status !== "cancelled",
    )
    .sort((a, b) => fixtureTime(a) - fixtureTime(b));
}

export function listReadyMatches(matches: ControlMatch[]): ControlMatch[] {
  return matches
    .filter((m) => m.status === "scheduled")
    .sort((a, b) => matchTime(a) - matchTime(b));
}

export function listRecentlyCompleted(
  matches: ControlMatch[],
  limit = 8,
): ControlMatch[] {
  return matches
    .filter((m) => m.status === "completed")
    .sort((a, b) => matchTime(b) - matchTime(a))
    .slice(0, limit);
}

export function listDelayedMatches(matches: ControlMatch[], now = Date.now()): ControlMatch[] {
  return matches.filter((m) => isDelayedMatch(m, now)).sort((a, b) => matchTime(a) - matchTime(b));
}
