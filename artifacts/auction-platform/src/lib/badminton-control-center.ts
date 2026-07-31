/**
 * Tournament Control Center — client-side orchestration helpers.
 * Derives per-court operational status from existing Courts / Fixtures / Matches.
 * No duplicated storage.
 */

import { isTerminalScoringMatchStatus } from "@workspace/badminton-core";

export type CourtOpsStatus = "EMPTY" | "READY" | "LIVE" | "FINISHED" | "DELAYED";

export type ControlCourt = {
  id: number;
  name: string;
  shortName?: string | null;
  sortOrder: number;
  scorerPin?: string | null;
  scorerName?: string | null;
  hasScorerPin?: boolean;
};

export type ControlMatchSide = {
  shortLabel?: string;
  label?: string;
  franchiseName?: string;
  franchiseLogoUrl?: string;
  teamName?: string;
  teamLogoUrl?: string;
  teamColor?: string;
};

export type ControlMatch = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  detail: Record<string, unknown> | null;
  state: {
    leftSide?: ControlMatchSide;
    rightSide?: ControlMatchSide;
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

export type CourtScheduleTimeSuggestion = {
  /** Local time for `<input type="time">` (HH:mm). */
  time: string;
  label: string;
};

const DEFAULT_SCHEDULE_GAP_MINUTES = 45;
const SCHEDULE_TIME_ROUND_MINUTES = 15;

function localDateKeyFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function localDateTimeMs(date: string, time: string): number {
  const d = new Date(`${date}T${time}:00`);
  const t = d.getTime();
  return Number.isNaN(t) ? Number.NaN : t;
}

function localDateTimeIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString();
}

function msToTimeInput(ms: number): string {
  const d = new Date(ms);
  if (Number.isNaN(d.getTime())) return "";
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${h}:${min}`;
}

function roundUpToMinutes(ms: number, stepMinutes: number): number {
  const stepMs = stepMinutes * 60_000;
  return Math.ceil(ms / stepMs) * stepMs;
}

function formatSuggestionTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function isConflictFreeSlot(
  fixtures: ControlFixture[],
  opts: {
    courtId: number;
    date: string;
    time: string;
    excludeFixtureId?: number;
    windowMinutes: number;
  },
): boolean {
  return (
    findCourtScheduleConflicts(fixtures, {
      courtId: opts.courtId,
      scheduledAtIso: localDateTimeIso(opts.date, opts.time),
      excludeFixtureId: opts.excludeFixtureId,
      windowMinutes: opts.windowMinutes,
    }).length === 0
  );
}

/**
 * Suggest conflict-free start times on a court for a given day.
 * Slots are spaced at least `windowMinutes` from existing fixtures (default 45).
 */
export function suggestCourtScheduleTimes(
  fixtures: ControlFixture[],
  opts: {
    courtId: number;
    date: string;
    excludeFixtureId?: number;
    windowMinutes?: number;
    maxSuggestions?: number;
  },
): CourtScheduleTimeSuggestion[] {
  const windowMinutes = opts.windowMinutes ?? DEFAULT_SCHEDULE_GAP_MINUTES;
  const maxSuggestions = opts.maxSuggestions ?? 4;
  const gapMs = windowMinutes * 60_000;

  if (!opts.date || !opts.courtId) return [];

  const onCourtDay = fixtures
    .filter((f) => {
      if (opts.excludeFixtureId != null && f.id === opts.excludeFixtureId) return false;
      if (f.courtId !== opts.courtId) return false;
      if (!f.scheduledAt) return false;
      if (f.status === "walkover" || f.status === "cancelled") return false;
      return localDateKeyFromIso(f.scheduledAt) === opts.date;
    })
    .sort((a, b) => fixtureTime(a) - fixtureTime(b));

  const rawCandidates: Array<{ ms: number; label: string }> = [];

  if (onCourtDay.length === 0) {
    const dayStart = localDateTimeMs(opts.date, "09:00");
    if (!Number.isNaN(dayStart)) {
      for (let i = 0; i < maxSuggestions; i++) {
        rawCandidates.push({
          ms: roundUpToMinutes(dayStart + i * gapMs, SCHEDULE_TIME_ROUND_MINUTES),
          label: i === 0 ? "First slot on court" : `${windowMinutes} min after previous`,
        });
      }
    }
  } else {
    const firstMs = new Date(onCourtDay[0]!.scheduledAt!).getTime();
    const morningMs = localDateTimeMs(opts.date, "09:00");
    if (!Number.isNaN(firstMs) && !Number.isNaN(morningMs) && firstMs - morningMs >= gapMs * 2) {
      rawCandidates.push({
        ms: roundUpToMinutes(morningMs, SCHEDULE_TIME_ROUND_MINUTES),
        label: "Before first match",
      });
    }

    for (const f of onCourtDay) {
      const t = new Date(f.scheduledAt!).getTime();
      if (Number.isNaN(t)) continue;
      const afterMs = roundUpToMinutes(t + gapMs + 60_000, SCHEDULE_TIME_ROUND_MINUTES);
      const matchLabel = `Match ${f.slotNumber ?? f.id}`;
      const timeLabel = formatSuggestionTime(f.scheduledAt!);
      rawCandidates.push({
        ms: afterMs,
        label: `After ${matchLabel}${timeLabel ? ` · ${timeLabel}` : ""}`,
      });
    }
  }

  rawCandidates.sort((a, b) => a.ms - b.ms);

  const results: CourtScheduleTimeSuggestion[] = [];
  const seen = new Set<string>();

  for (const candidate of rawCandidates) {
    const time = msToTimeInput(candidate.ms);
    if (!time || seen.has(time)) continue;
    if (
      !isConflictFreeSlot(fixtures, {
        courtId: opts.courtId,
        date: opts.date,
        time,
        excludeFixtureId: opts.excludeFixtureId,
        windowMinutes,
      })
    ) {
      continue;
    }
    seen.add(time);
    results.push({ time, label: candidate.label });
    if (results.length >= maxSuggestions) return results;
  }

  while (results.length < maxSuggestions && results.length > 0) {
    const lastTime = results[results.length - 1]!.time;
    const lastMs = localDateTimeMs(opts.date, lastTime);
    if (Number.isNaN(lastMs)) break;
    const nextMs = roundUpToMinutes(lastMs + gapMs, SCHEDULE_TIME_ROUND_MINUTES);
    const time = msToTimeInput(nextMs);
    if (!time || seen.has(time)) break;
    if (
      !isConflictFreeSlot(fixtures, {
        courtId: opts.courtId,
        date: opts.date,
        time,
        excludeFixtureId: opts.excludeFixtureId,
        windowMinutes,
      })
    ) {
      break;
    }
    seen.add(time);
    results.push({ time, label: `${windowMinutes} min after previous slot` });
  }

  return results;
}

export function matchDisplayLabel(m: ControlMatch): string {
  if (m.state?.leftSide || m.state?.rightSide) {
    // Lazy import avoided — keep string helper self-contained for list labels.
    const left = formatSideWithTeam(m.state.leftSide);
    const right = formatSideWithTeam(m.state.rightSide);
    return `${left} vs ${right}`;
  }
  const label = m.detail?.matchLabel;
  return typeof label === "string" && label.trim() ? label.trim() : `Match #${m.id}`;
}

function formatSideWithTeam(side: ControlMatchSide | undefined): string {
  if (!side) return "—";
  const player = side.shortLabel?.trim() || side.label?.trim() || "—";
  const team =
    side.franchiseName?.trim() ||
    side.teamName?.trim() ||
    "";
  return team ? `${team} · ${player}` : player;
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
      .filter((m) => isTerminalScoringMatchStatus(m.status))
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
    .filter((m) => isTerminalScoringMatchStatus(m.status))
    .sort((a, b) => matchTime(b) - matchTime(a))
    .slice(0, limit);
}

export function listDelayedMatches(matches: ControlMatch[], now = Date.now()): ControlMatch[] {
  return matches.filter((m) => isDelayedMatch(m, now)).sort((a, b) => matchTime(a) - matchTime(b));
}
