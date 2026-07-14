/**
 * Pre-match Match Control — validation helpers.
 * Prepares a match before scoring; does not own scoring logic.
 */

import {
  isPairMatchKind,
  parseBadmintonMatchFormat,
  STANDARD_FORMAT,
  type BadmintonMatchFormat,
} from "@workspace/badminton-core";
import { sideJsonToStartSide } from "@/components/badminton/pair-side-picker";
import { isDelayedScheduledAt } from "@/lib/badminton-control-center";
import {
  isDoublesPreMatchToss,
  isSinglesPreMatchToss,
  type PreMatchToss,
} from "@/lib/badminton-pre-match-toss";

export type MatchControlWarning = {
  id: string;
  message: string;
  href?: string;
  hrefLabel?: string;
  /** Soft warnings do not block Start (e.g. delayed time). */
  soft?: boolean;
};

export type MatchControlSnapshot = {
  tournamentId: number;
  matchId: number;
  tournamentName: string;
  categoryName: string | null;
  courtLabel: string | null;
  courtId: number | null;
  scheduledAt: string | null;
  matchFormat: BadmintonMatchFormat;
  matchFormatLabel: string;
  matchType: string;
  leftLabel: string;
  rightLabel: string;
  leftSideJson: Record<string, unknown>;
  rightSideJson: Record<string, unknown>;
  /** Toss saved at create/edit — when complete, Start can skip the wizard. */
  preMatchTossJson?: unknown;
  fixtureId: number | null;
  matchStatus: string;
};

export type MatchControlPeerMatch = {
  id: number;
  status: string;
  scheduledAt?: string | null;
  detail: Record<string, unknown> | null;
};

function sideHasPlayers(side: Record<string, unknown>, isPair: boolean): boolean {
  const label = typeof side.label === "string" ? side.label.trim() : "";
  const masterId = typeof side.masterPlayerId === "string" ? side.masterPlayerId.trim() : "";
  const playerIds = Array.isArray(side.playerIds) ? side.playerIds : [];
  const players = Array.isArray(side.players) ? side.players : [];

  if (isPair) {
    if (players.length >= 2) {
      return players.every((p) => {
        if (!p || typeof p !== "object") return false;
        const row = p as Record<string, unknown>;
        const pl = typeof row.label === "string" ? row.label.trim() : "";
        const pm = typeof row.masterPlayerId === "string" ? row.masterPlayerId.trim() : "";
        return Boolean(pl || pm);
      });
    }
    return Boolean(label || masterId) && (players.length >= 1 || playerIds.length >= 1);
  }

  return Boolean(masterId || label || playerIds.length > 0);
}

/** True when both sides have enough players for Start. */
export function hasCompleteMatchRoster(
  leftSideJson: Record<string, unknown>,
  rightSideJson: Record<string, unknown>,
  matchType: string,
): boolean {
  const isPair = isPairMatchKind(matchType);
  return sideHasPlayers(leftSideJson, isPair) && sideHasPlayers(rightSideJson, isPair);
}

function peerCourtId(m: MatchControlPeerMatch): number | null {
  const id = m.detail?.courtId;
  return typeof id === "number" ? id : null;
}

function peerTime(m: MatchControlPeerMatch): number {
  if (!m.scheduledAt) return Number.MAX_SAFE_INTEGER;
  const t = new Date(m.scheduledAt).getTime();
  return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : t;
}

export function buildMatchControlWarnings(
  snap: Pick<
    MatchControlSnapshot,
    | "leftSideJson"
    | "rightSideJson"
    | "courtId"
    | "courtLabel"
    | "scheduledAt"
    | "matchFormat"
    | "matchType"
    | "tournamentId"
    | "fixtureId"
    | "matchId"
  >,
  peers?: MatchControlPeerMatch[],
): MatchControlWarning[] {
  const warnings: MatchControlWarning[] = [];
  const isPair = isPairMatchKind(snap.matchType);

  if (!sideHasPlayers(snap.leftSideJson, isPair) || !sideHasPlayers(snap.rightSideJson, isPair)) {
    warnings.push({
      id: "players",
      message: "Players are not fully assigned on both sides.",
      href: `/tournament/${snap.tournamentId}/badminton/matches`,
      hrefLabel: "Edit match roster",
    });
  }

  if (snap.courtId == null && !snap.courtLabel?.trim()) {
    warnings.push({
      id: "court",
      message: "No court assigned.",
      href: `/tournament/${snap.tournamentId}/badminton/schedule`,
      hrefLabel: "Open Scheduling",
    });
  }

  if (!snap.scheduledAt) {
    warnings.push({
      id: "scheduled",
      message: "Match has no scheduled time.",
      href: snap.fixtureId
        ? `/tournament/${snap.tournamentId}/badminton/schedule?fixture=${snap.fixtureId}`
        : `/tournament/${snap.tournamentId}/badminton/schedule`,
      hrefLabel: "Back to Scheduling",
    });
  } else if (isDelayedScheduledAt(snap.scheduledAt)) {
    warnings.push({
      id: "delayed",
      soft: true,
      message: "Scheduled time has passed — confirm the court is free, or delay the match.",
      href: snap.fixtureId
        ? `/tournament/${snap.tournamentId}/badminton/schedule?fixture=${snap.fixtureId}`
        : `/tournament/${snap.tournamentId}/badminton/schedule`,
      hrefLabel: "Reschedule",
    });
  }

  // Format is always cascaded (match → category → tournament → STANDARD).
  const pts = snap.matchFormat?.pointsPerGame;
  const totalGames = snap.matchFormat?.totalGames;
  if (
    typeof pts !== "number" ||
    pts < 1 ||
    typeof totalGames !== "number" ||
    totalGames < 1 ||
    totalGames % 2 === 0
  ) {
    warnings.push({
      id: "format",
      message: "Match format is not resolved.",
      href: `/tournament/${snap.tournamentId}/badminton/scoring-format`,
      hrefLabel: "Open Match Format",
    });
  }

  if (peers && snap.courtId != null) {
    const liveOnCourt = peers.find(
      (m) => m.id !== snap.matchId && m.status === "live" && peerCourtId(m) === snap.courtId,
    );
    if (liveOnCourt) {
      warnings.push({
        id: "court_busy",
        message: "Another match is already live on this court. Finish or pause it before starting.",
        href: `/tournament/${snap.tournamentId}/badminton/control`,
        hrefLabel: "Open Control Center",
      });
    }

    const earlierReady = peers
      .filter(
        (m) =>
          m.id !== snap.matchId &&
          m.status === "scheduled" &&
          peerCourtId(m) === snap.courtId,
      )
      .sort((a, b) => peerTime(a) - peerTime(b));

    const myTime = snap.scheduledAt
      ? new Date(snap.scheduledAt).getTime()
      : Number.MAX_SAFE_INTEGER;
    const earlier = earlierReady.find((m) => peerTime(m) < myTime);
    if (earlier) {
      warnings.push({
        id: "not_next",
        soft: true,
        message: "This is not the earliest ready match on this court — confirm you have the right match.",
        href: `/tournament/${snap.tournamentId}/badminton/control`,
        hrefLabel: "Check Control Center",
      });
    }
  }

  return warnings;
}

/** Hard blockers only — soft warnings still allow Start. */
export function hasBlockingMatchControlWarnings(warnings: MatchControlWarning[]): boolean {
  return warnings.some((w) => !w.soft);
}

export function resolveMatchFormatFromDetail(detail: Record<string, unknown> | null | undefined): BadmintonMatchFormat {
  return parseBadmintonMatchFormat(detail?.matchFormatJson) ?? STANDARD_FORMAT;
}

/** Build MATCH_STARTED payload from saved pre-match toss + roster/format. */
export function buildStartPayloadFromPreMatchToss(
  detail: Record<string, unknown>,
  toss: PreMatchToss,
) {
  const matchType = (detail.matchType as string) ?? "singles";
  const leftSideJson = (detail.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (detail.rightSideJson ?? {}) as Record<string, unknown>;
  const leftSide = sideJsonToStartSide(leftSideJson);
  const rightSide = sideJsonToStartSide(rightSideJson);
  const format = resolveMatchFormatFromDetail(detail);

  if (isPairMatchKind(matchType) && isDoublesPreMatchToss(toss)) {
    return {
      matchKind: matchType,
      format,
      leftSide,
      rightSide,
      firstServer: toss.firstServingSide,
      doublesSetup: {
        tossWinnerSide: toss.tossWinnerSide,
        tossDecision: toss.tossDecision,
        firstServingSide: toss.firstServingSide,
        firstReceivingSide: toss.firstReceivingSide,
        firstServerPlayerIndex: toss.firstServerPlayerIndex,
        firstReceiverPlayerIndex: toss.firstReceiverPlayerIndex,
      },
    };
  }

  if (isSinglesPreMatchToss(toss)) {
    return {
      matchKind: matchType,
      format,
      leftSide,
      rightSide,
      firstServer: toss.firstServer,
    };
  }

  return buildOperationalStartPayload(detail);
}

/** Build MATCH_STARTED payload without coin-toss UI (operational defaults). */
export function buildOperationalStartPayload(detail: Record<string, unknown>) {
  const matchType = (detail.matchType as string) ?? "singles";
  const leftSideJson = (detail.leftSideJson ?? {}) as Record<string, unknown>;
  const rightSideJson = (detail.rightSideJson ?? {}) as Record<string, unknown>;
  const leftSide = sideJsonToStartSide(leftSideJson);
  const rightSide = sideJsonToStartSide(rightSideJson);
  const format = resolveMatchFormatFromDetail(detail);
  const firstServer = "left" as const;

  if (isPairMatchKind(matchType)) {
    return {
      matchKind: matchType,
      format,
      leftSide,
      rightSide,
      firstServer,
      doublesSetup: {
        // Operational start skips toss UI — left serves first by default.
        tossWinnerSide: "left" as const,
        tossDecision: "serve" as const,
        firstServingSide: "left" as const,
        firstReceivingSide: "right" as const,
        firstServerPlayerIndex: 0 as const,
        firstReceiverPlayerIndex: 0 as const,
      },
    };
  }

  return {
    matchKind: matchType,
    format,
    leftSide,
    rightSide,
    firstServer,
  };
}
