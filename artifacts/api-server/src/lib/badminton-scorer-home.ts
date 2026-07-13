/**
 * Pure helpers for Scorer Home — match cards + court assignment views.
 * No DB imports.
 */

export type ScorerHomeUiStatus = "READY" | "LIVE" | "PAUSED" | "COMPLETED";

export type ScorerHomeMatchCard = {
  id: number;
  category: string | null;
  playerA: string;
  playerB: string;
  court: string | null;
  courtId: number | null;
  scheduledAt: string | null;
  status: ScorerHomeUiStatus;
  matchStatus: string;
  actionLabel: "Start Scoring" | "Resume" | "Read Only";
  readOnly: boolean;
  /** How this PIN unlocked the match. */
  accessVia: "match_pin" | "court_pin";
};

export type ScorerHomeCourtCard = {
  id: number;
  name: string;
  shortName: string | null;
  scorerName: string | null;
  currentMatch: ScorerHomeMatchCard | null;
  nextMatch: ScorerHomeMatchCard | null;
  matches: ScorerHomeMatchCard[];
};

export type ScorerHomeSessionPayload = {
  ok: boolean;
  /** Flat list — backward compatible with match-PIN-only flow. */
  matches: ScorerHomeMatchCard[];
  /** Courts this PIN is assigned to (court-level PIN). */
  courts: ScorerHomeCourtCard[];
  /**
   * court — single court focus (current + next)
   * courts — pick a court first
   * matches — legacy flat match list (no court PIN assignment)
   */
  view: "court" | "courts" | "matches";
};

export function sideDisplayLabel(side: Record<string, unknown> | null | undefined): string {
  if (!side) return "TBD";
  const player =
    (typeof side.label === "string" && side.label.trim()) ||
    (typeof side.shortLabel === "string" && side.shortLabel.trim()) ||
    (typeof side.displayName === "string" && side.displayName.trim()) ||
    "";
  if (!player) return "TBD";
  const team =
    (typeof side.franchiseName === "string" && side.franchiseName.trim()) ||
    (typeof side.teamName === "string" && side.teamName.trim()) ||
    "";
  return team ? `${team} · ${player}` : player;
}

export function mapMatchStatusToScorerHomeUi(rawStatus: string): {
  status: ScorerHomeUiStatus;
  actionLabel: ScorerHomeMatchCard["actionLabel"];
  readOnly: boolean;
} {
  const status = rawStatus.trim().toLowerCase();
  if (status === "live") {
    return { status: "LIVE", actionLabel: "Resume", readOnly: false };
  }
  if (status === "paused") {
    return { status: "PAUSED", actionLabel: "Resume", readOnly: false };
  }
  if (
    status === "completed" ||
    status === "walkover" ||
    status === "retired" ||
    status === "disqualified" ||
    status === "abandoned"
  ) {
    return { status: "COMPLETED", actionLabel: "Read Only", readOnly: true };
  }
  return { status: "READY", actionLabel: "Start Scoring", readOnly: false };
}

/** Match PIN wins when set; otherwise inherit court PIN. */
export function resolveEffectiveScorerPin(
  matchPin: string | null | undefined,
  courtPin: string | null | undefined,
): string | null {
  const match = typeof matchPin === "string" ? matchPin.trim() : "";
  if (match.length >= 4) return match;
  const court = typeof courtPin === "string" ? courtPin.trim() : "";
  if (court.length >= 4) return court;
  return null;
}

export function pinUnlocksMatch(opts: {
  pin: string;
  matchPin: string | null | undefined;
  courtPin: string | null | undefined;
}): { ok: boolean; via: "match_pin" | "court_pin" | null } {
  const pin = opts.pin.trim();
  if (pin.length < 4) return { ok: false, via: null };

  const match = typeof opts.matchPin === "string" ? opts.matchPin.trim() : "";
  if (match.length >= 4) {
    return match === pin ? { ok: true, via: "match_pin" } : { ok: false, via: null };
  }

  const court = typeof opts.courtPin === "string" ? opts.courtPin.trim() : "";
  if (court.length >= 4 && court === pin) {
    return { ok: true, via: "court_pin" };
  }
  return { ok: false, via: null };
}

function matchSortTime(m: ScorerHomeMatchCard): number {
  if (!m.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(m.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

/** Pick current + next match for a court (ops-style, without changing Match Control). */
export function pickCourtCurrentAndNext(matches: ScorerHomeMatchCard[]): {
  currentMatch: ScorerHomeMatchCard | null;
  nextMatch: ScorerHomeMatchCard | null;
} {
  const sorted = [...matches].sort((a, b) => matchSortTime(a) - matchSortTime(b) || a.id - b.id);
  const live =
    sorted.find((m) => m.matchStatus === "live") ??
    sorted.find((m) => m.matchStatus === "paused") ??
    null;
  const ready = sorted.filter((m) => m.status === "READY");

  if (live) {
    const next =
      ready[0] ??
      sorted.find(
        (m) =>
          m.id !== live.id &&
          m.status !== "COMPLETED" &&
          matchSortTime(m) >= matchSortTime(live),
      ) ??
      null;
    return { currentMatch: live, nextMatch: next && next.id !== live.id ? next : ready[0] ?? null };
  }

  const current = ready[0] ?? null;
  const next = ready[1] ?? null;
  return { currentMatch: current, nextMatch: next };
}

export function buildScorerHomeView(opts: {
  matches: ScorerHomeMatchCard[];
  courts: Array<{
    id: number;
    name: string;
    shortName: string | null;
    scorerName: string | null;
  }>;
}): Pick<ScorerHomeSessionPayload, "view" | "courts" | "matches"> {
  const courtCards: ScorerHomeCourtCard[] = opts.courts.map((court) => {
    const onCourt = opts.matches.filter((m) => m.courtId === court.id);
    const { currentMatch, nextMatch } = pickCourtCurrentAndNext(onCourt);
    return {
      id: court.id,
      name: court.name,
      shortName: court.shortName,
      scorerName: court.scorerName,
      currentMatch,
      nextMatch,
      matches: onCourt,
    };
  });

  if (courtCards.length === 1) {
    return { view: "court", courts: courtCards, matches: opts.matches };
  }
  if (courtCards.length > 1) {
    return { view: "courts", courts: courtCards, matches: opts.matches };
  }
  return { view: "matches", courts: [], matches: opts.matches };
}

/** Serialize court row for API — strip PIN unless organizer. */
export function serializeBadmintonCourt(
  court: Record<string, unknown>,
  opts: { includeScorerPin: boolean },
): Record<string, unknown> {
  if (opts.includeScorerPin) {
    return {
      ...court,
      hasScorerPin: !!(typeof court.scorerPin === "string" && court.scorerPin.trim()),
    };
  }
  const { scorerPin: _pin, ...rest } = court;
  return {
    ...rest,
    hasScorerPin: !!(typeof _pin === "string" && _pin.trim()),
  };
}
