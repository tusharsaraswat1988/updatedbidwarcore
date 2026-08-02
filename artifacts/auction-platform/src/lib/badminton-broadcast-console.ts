/**
 * Tournament Broadcast Console helpers.
 * Display-only orchestration — does not change scoring or match lifecycle.
 */

import type {
  BadmintonMatchKind,
  BadmintonMatchState,
  BadmintonSideInfo,
} from "@workspace/badminton-core";
import {
  formatTeamPlayerLine,
  identityFromSideInfo,
} from "@/lib/team-player-identity";
import { displayMatchSideScores } from "@/lib/badminton-results";

export const LIVE_FOLLOW_MATCH_SEGMENT = "live";

export type BroadcastConsoleMatch = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  detail: Record<string, unknown> | null;
  state: BadmintonMatchState | null;
};

export type BroadcastConsoleStatus =
  | "live_active"
  | "waiting_next"
  | "no_live"
  | "multi_live";

export type CourtBroadcastChip = {
  key: string;
  label: string;
  status: "LIVE" | "READY" | "IDLE";
  matchId: number | null;
  isPrimary: boolean;
};

export function isLiveFollowMatchId(raw: string | undefined | null): boolean {
  if (!raw) return false;
  const normalized = raw.trim().toLowerCase();
  return normalized === LIVE_FOLLOW_MATCH_SEGMENT || normalized === "0";
}

export function isLiveMatchStatus(status: string | null | undefined): boolean {
  return status === "live" || status === "paused" || status === "in_progress";
}

export function listLiveMatches(matches: BroadcastConsoleMatch[]): BroadcastConsoleMatch[] {
  return matches
    .filter((m) => isLiveMatchStatus(m.status) || isLiveMatchStatus(m.state?.matchStatus))
    .sort((a, b) => {
      const ca = String(a.detail?.courtNumber ?? a.detail?.courtId ?? "");
      const cb = String(b.detail?.courtNumber ?? b.detail?.courtId ?? "");
      if (ca !== cb) return ca.localeCompare(cb, undefined, { numeric: true });
      return a.id - b.id;
    });
}

/**
 * Resolve which LIVE match feeds Venue Display + OBS Overlay.
 * One live → that match. Multiple → stored primary if still live; else first live.
 */
export function resolvePrimaryBroadcastMatchId(
  matches: BroadcastConsoleMatch[],
  storedPrimaryId: number | null | undefined,
): number | null {
  const live = listLiveMatches(matches);
  if (live.length === 0) return null;
  if (live.length === 1) return live[0].id;
  if (storedPrimaryId != null && live.some((m) => m.id === storedPrimaryId)) {
    return storedPrimaryId;
  }
  return live[0].id;
}

export function findMatchById(
  matches: BroadcastConsoleMatch[],
  matchId: number | null | undefined,
): BroadcastConsoleMatch | null {
  if (matchId == null) return null;
  return matches.find((m) => m.id === matchId) ?? null;
}

function matchStartMs(match: BroadcastConsoleMatch): number {
  if (!match.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(match.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

function matchCourtKey(match: BroadcastConsoleMatch): string {
  const courtId = match.detail?.courtId;
  if (typeof courtId === "number") return `id:${courtId}`;
  const num =
    (match.detail?.courtNumber as string | undefined)?.trim() ||
    (match.detail?.courtName as string | undefined)?.trim();
  return num ? `n:${num.toLowerCase()}` : "";
}

function isUpcomingMatchCandidate(
  match: BroadcastConsoleMatch,
  primaryLiveId: number | null,
): boolean {
  if (match.id === primaryLiveId) return false;
  if (isLiveMatchStatus(match.status) || isLiveMatchStatus(match.state?.matchStatus)) {
    return false;
  }
  if (
    match.status === "completed"
    || match.status === "walkover"
    || match.status === "retired"
    || match.status === "disqualified"
    || match.status === "abandoned"
  ) {
    return false;
  }
  return true;
}

/** Upcoming non-live matches — same court as primary first, then schedule order. */
export function listUpcomingMatches(
  matches: BroadcastConsoleMatch[],
  primaryLiveId: number | null,
): BroadcastConsoleMatch[] {
  const primary = findMatchById(matches, primaryLiveId);
  const primaryCourt = primary ? matchCourtKey(primary) : "";

  return matches
    .filter((m) => isUpcomingMatchCandidate(m, primaryLiveId))
    .sort((a, b) => {
      if (primaryCourt) {
        const aSame = matchCourtKey(a) === primaryCourt ? 0 : 1;
        const bSame = matchCourtKey(b) === primaryCourt ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
      }
      const ta = matchStartMs(a);
      const tb = matchStartMs(b);
      if (ta !== tb) return ta - tb;
      return a.id - b.id;
    });
}

/** Next non-live match — prefer same court as primary live, then schedule order. */
export function findUpNextMatch(
  matches: BroadcastConsoleMatch[],
  primaryLiveId: number | null,
): BroadcastConsoleMatch | null {
  return listUpcomingMatches(matches, primaryLiveId)[0] ?? null;
}

/** Resolve operator-selected Next match; null when selection is missing or no longer upcoming. */
export function resolveSelectedUpNextMatch(
  matches: BroadcastConsoleMatch[],
  primaryLiveId: number | null,
  selectedMatchId: number | null | undefined,
): BroadcastConsoleMatch | null {
  if (selectedMatchId == null || selectedMatchId <= 0) return null;
  const selected = findMatchById(matches, selectedMatchId);
  if (!selected || !isUpcomingMatchCandidate(selected, primaryLiveId)) return null;
  return selected;
}

/** Coerce stored side JSON / snapshot side into display SideInfo. */
export function coerceBroadcastSideInfo(raw: unknown): BadmintonSideInfo | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const label =
    (typeof o.label === "string" && o.label.trim()) ||
    (typeof o.shortLabel === "string" && o.shortLabel.trim()) ||
    (typeof o.displayName === "string" && o.displayName.trim()) ||
    "";
  const shortLabel =
    (typeof o.shortLabel === "string" && o.shortLabel.trim()) || label;
  if (!label && !shortLabel) return null;

  const playerIds = Array.isArray(o.playerIds)
    ? o.playerIds.filter((id): id is number => typeof id === "number")
    : [];

  return {
    label: label || shortLabel,
    shortLabel: shortLabel || label,
    countryCode: typeof o.countryCode === "string" ? o.countryCode : undefined,
    countryName: typeof o.countryName === "string" ? o.countryName : undefined,
    photoUrl: typeof o.photoUrl === "string" ? o.photoUrl : undefined,
    flagUrl: typeof o.flagUrl === "string" ? o.flagUrl : undefined,
    teamColor: typeof o.teamColor === "string" ? o.teamColor : undefined,
    franchiseName: typeof o.franchiseName === "string" ? o.franchiseName : undefined,
    franchiseLogoUrl:
      typeof o.franchiseLogoUrl === "string" ? o.franchiseLogoUrl : undefined,
    teamName: typeof o.teamName === "string" ? o.teamName : undefined,
    teamLogoUrl: typeof o.teamLogoUrl === "string" ? o.teamLogoUrl : undefined,
    sponsorName: typeof o.sponsorName === "string" ? o.sponsorName : undefined,
    sponsorLogoUrl:
      typeof o.sponsorLogoUrl === "string" ? o.sponsorLogoUrl : undefined,
    masterPlayerId:
      typeof o.masterPlayerId === "string" ? o.masterPlayerId : undefined,
    playerIds,
    players: Array.isArray(o.players) ? (o.players as BadmintonSideInfo["players"]) : undefined,
  };
}

export type BroadcastMatchSides = {
  left: BadmintonSideInfo;
  right: BadmintonSideInfo;
  matchKind: BadmintonMatchKind;
};

/**
 * Resolve sides for venue/OBS cards — live snapshot first, else detail side JSON
 * (scheduled matches often have no stateSnapshot yet).
 */
export function resolveBroadcastMatchSides(
  match: BroadcastConsoleMatch | null | undefined,
): BroadcastMatchSides | null {
  if (!match) return null;

  const leftFromState = coerceBroadcastSideInfo(match.state?.leftSide);
  const rightFromState = coerceBroadcastSideInfo(match.state?.rightSide);
  const leftFromDetail = coerceBroadcastSideInfo(match.detail?.leftSideJson);
  const rightFromDetail = coerceBroadcastSideInfo(match.detail?.rightSideJson);

  const left = leftFromState ?? leftFromDetail;
  const right = rightFromState ?? rightFromDetail;
  if (!left || !right) return null;

  const rawKind =
    match.state?.matchKind ||
    (match.detail?.matchType as string | undefined) ||
    "singles";
  const matchKind: BadmintonMatchKind =
    rawKind === "doubles" || rawKind === "mixed_doubles" ? rawKind : "singles";

  return { left, right, matchKind };
}

export function deriveBroadcastConsoleStatus(
  liveCount: number,
  hasUpNext: boolean,
): BroadcastConsoleStatus {
  if (liveCount > 1) return "multi_live";
  if (liveCount === 1) return "live_active";
  if (hasUpNext) return "waiting_next";
  return "no_live";
}

export function broadcastConsoleStatusLabel(status: BroadcastConsoleStatus): string {
  switch (status) {
    case "live_active":
      return "Live Match Active";
    case "multi_live":
      return "Multiple Courts Live";
    case "waiting_next":
      return "Waiting for Next Match";
    case "no_live":
    default:
      return "No Live Match";
  }
}

export function matchCourtLabel(match: BroadcastConsoleMatch | null | undefined): string {
  if (!match) return "Court —";
  const fromDetail =
    (match.detail?.courtNumber as string | undefined)?.trim() ||
    (match.detail?.courtName as string | undefined)?.trim();
  if (fromDetail) {
    return fromDetail.toLowerCase().startsWith("court")
      ? fromDetail
      : `Court ${fromDetail}`;
  }
  if (match.detail?.courtId != null) return `Court ${String(match.detail.courtId)}`;
  return "Court —";
}

export function matchCategoryLabel(match: BroadcastConsoleMatch | null | undefined): string {
  if (!match) return "—";
  return (
    (match.detail?.categoryName as string | undefined)?.trim() ||
    (match.detail?.matchType as string | undefined)?.trim() ||
    (match.detail?.roundName as string | undefined)?.trim() ||
    (match.detail?.matchLabel as string | undefined)?.trim() ||
    `Match #${match.id}`
  );
}

export function matchIdentityLine(match: BroadcastConsoleMatch | null | undefined): string {
  if (!match) return "TBD";
  const sides = resolveBroadcastMatchSides(match);
  if (sides) {
    return `${formatTeamPlayerLine(identityFromSideInfo(sides.left))} vs ${formatTeamPlayerLine(identityFromSideInfo(sides.right))}`;
  }
  const label = (match.detail?.matchLabel as string | undefined)?.trim();
  return label || `Match #${match.id}`;
}

export function formatEstimatedStart(iso: string | null | undefined): string {
  if (!iso) return "Time TBD";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Time TBD";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function currentGameLabel(state: BadmintonMatchState | null | undefined): string {
  if (!state) return "—";
  const game = state.currentGame;
  if (!game || game < 1) return "—";
  return `Game ${game}`;
}

export function currentScoreLabel(state: BadmintonMatchState | null | undefined): string {
  if (!state) return "—";
  const { left, right } = displayMatchSideScores(state);
  return `${left} – ${right}`;
}

/** Soft connection status — no real telemetry yet. */
export function softFeedStatus(hasPrimaryLive: boolean): {
  overlay: string;
  venue: string;
} {
  if (hasPrimaryLive) {
    return {
      overlay: "Following Primary Broadcast",
      venue: "Following Primary Broadcast",
    };
  }
  return {
    overlay: "Standing by",
    venue: "Standing by",
  };
}

export function buildCourtBroadcastChips(
  matches: BroadcastConsoleMatch[],
  primaryMatchId: number | null,
): CourtBroadcastChip[] {
  const live = listLiveMatches(matches);
  const chips: CourtBroadcastChip[] = live.map((m) => ({
    key: `live-${m.id}`,
    label: matchCourtLabel(m),
    status: "LIVE" as const,
    matchId: m.id,
    isPrimary: m.id === primaryMatchId,
  }));

  const upNext = findUpNextMatch(matches, primaryMatchId);
  if (upNext) {
    const court = matchCourtLabel(upNext);
    const already = chips.some((c) => c.label === court && c.status === "LIVE");
    if (!already) {
      chips.push({
        key: `ready-${upNext.id}`,
        label: court,
        status: "READY",
        matchId: upNext.id,
        isPrimary: false,
      });
    }
  }

  return chips;
}
