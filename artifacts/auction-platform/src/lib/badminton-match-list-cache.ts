/**
 * In-place React Query patches for ["badminton-matches", tournamentId].
 * Live scores must never trigger a full GET /matches refetch storm.
 */

import type { QueryClient } from "@tanstack/react-query";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import type { BroadcastConsoleMatch } from "@/lib/badminton-broadcast-console";

export type BadmintonMatchListLivePatch = {
  type: "match_state_changed";
  matchId: number;
  tournamentId: number;
  status?: string;
  matchStatus?: BadmintonMatchState["matchStatus"];
  leftScore?: number;
  rightScore?: number;
  gamesLeft?: number;
  gamesRight?: number;
  currentGame?: number;
  servingSide?: BadmintonMatchState["servingSide"];
  totalRallies?: number;
  lastSequence?: number;
  inInterval?: boolean;
  isPaused?: boolean;
  winnerSide?: BadmintonMatchState["winnerSide"];
  resultReason?: BadmintonMatchState["resultReason"];
  games?: BadmintonMatchState["games"];
};

export function isMatchStateChangedPayload(
  data: Record<string, unknown>,
): data is BadmintonMatchListLivePatch & Record<string, unknown> {
  return (
    data.type === "match_state_changed"
    && typeof data.matchId === "number"
    && Number.isFinite(data.matchId)
  );
}

/** Structural tournament events still need a list refetch (create/delete/schedule). */
export function shouldRefetchBadmintonMatches(
  data: Record<string, unknown> | null,
): boolean {
  if (!data) return true;
  if (isMatchStateChangedPayload(data)) return false;
  // Presentation / focus handled separately (branding patch ± primary refetch).
  if (
    data.kind === "broadcast_presentation"
    || "primaryBroadcastMatchId" in data
    || "venueScene" in data
    || "overlayScene" in data
    || "venueMusicPlaying" in data
  ) {
    return false;
  }
  return true;
}

function applyLiveFieldsToState(
  prev: BadmintonMatchState | null | undefined,
  patch: BadmintonMatchListLivePatch,
): BadmintonMatchState | null {
  if (!prev) {
    // No prior snapshot in cache — cannot invent a full state from a slim patch.
    return prev ?? null;
  }
  if (
    typeof patch.lastSequence === "number"
    && typeof prev.lastSequence === "number"
    && patch.lastSequence < prev.lastSequence
  ) {
    return prev;
  }
  return {
    ...prev,
    ...(patch.matchStatus != null ? { matchStatus: patch.matchStatus } : {}),
    ...(typeof patch.leftScore === "number" ? { leftScore: patch.leftScore } : {}),
    ...(typeof patch.rightScore === "number" ? { rightScore: patch.rightScore } : {}),
    ...(typeof patch.gamesLeft === "number" ? { gamesLeft: patch.gamesLeft } : {}),
    ...(typeof patch.gamesRight === "number" ? { gamesRight: patch.gamesRight } : {}),
    ...(typeof patch.currentGame === "number" ? { currentGame: patch.currentGame } : {}),
    ...(patch.servingSide != null ? { servingSide: patch.servingSide } : {}),
    ...(typeof patch.totalRallies === "number" ? { totalRallies: patch.totalRallies } : {}),
    ...(typeof patch.lastSequence === "number" ? { lastSequence: patch.lastSequence } : {}),
    ...(typeof patch.inInterval === "boolean" ? { inInterval: patch.inInterval } : {}),
    ...(typeof patch.isPaused === "boolean" ? { isPaused: patch.isPaused } : {}),
    ...(patch.winnerSide !== undefined ? { winnerSide: patch.winnerSide } : {}),
    ...(patch.resultReason !== undefined ? { resultReason: patch.resultReason } : {}),
    ...(patch.games != null ? { games: patch.games } : {}),
  };
}

/** Patch one match row from a slim SSE tournament_update (score path). */
export function patchBadmintonMatchesFromLiveUpdate(
  queryClient: QueryClient,
  tournamentId: number,
  patch: BadmintonMatchListLivePatch,
): void {
  queryClient.setQueryData<BroadcastConsoleMatch[]>(
    ["badminton-matches", tournamentId],
    (prev) => {
      if (!prev?.length) return prev;
      let changed = false;
      const next = prev.map((row) => {
        if (row.id !== patch.matchId) return row;
        const status =
          (typeof patch.status === "string" && patch.status)
          || (typeof patch.matchStatus === "string" && patch.matchStatus)
          || row.status;
        const state = applyLiveFieldsToState(row.state, patch);
        if (status === row.status && state === row.state) return row;
        changed = true;
        return { ...row, status, state };
      });
      return changed ? next : prev;
    },
  );
}

/** Patch one match row from a full match_state SSE frame. */
export function patchBadmintonMatchesFromMatchState(
  queryClient: QueryClient,
  tournamentId: number,
  matchId: number,
  state: BadmintonMatchState,
): void {
  queryClient.setQueryData<BroadcastConsoleMatch[]>(
    ["badminton-matches", tournamentId],
    (prev) => {
      if (!prev?.length) return prev;
      let changed = false;
      const next = prev.map((row) => {
        if (row.id !== matchId) return row;
        if (
          row.state
          && typeof row.state.lastSequence === "number"
          && typeof state.lastSequence === "number"
          && state.lastSequence < row.state.lastSequence
        ) {
          return row;
        }
        changed = true;
        return {
          ...row,
          status: state.matchStatus ?? row.status,
          state,
        };
      });
      return changed ? next : prev;
    },
  );
}
