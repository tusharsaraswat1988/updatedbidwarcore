/**
 * Resolve the match that persistent /badminton/live/* surfaces should follow.
 * Polls tournament matches + branding; reuses existing per-match SSE via useBadmintonMatch.
 */

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { badmintonFetch } from "@/lib/badminton-api";
import {
  useBadmintonBranding,
  type BadmintonBranding,
} from "@/hooks/use-badminton-branding";
import {
  subscribeBadmintonDashboardStream,
  useBadmintonMatch,
} from "@/hooks/use-badminton-match";
import {
  findMatchById,
  listLiveMatches,
  resolvePrimaryBroadcastMatchId,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import { MAX_MULTI_COURT_ROWS } from "@/lib/badminton-broadcast-director";

function applyPresentationPayload(
  prev: BadmintonBranding | undefined,
  payload: Record<string, unknown>,
): BadmintonBranding | undefined {
  if (!prev) return prev;
  const next = { ...prev };
  if ("primaryBroadcastMatchId" in payload) {
    const raw = payload.primaryBroadcastMatchId;
    next.primaryBroadcastMatchId =
      typeof raw === "number" && Number.isFinite(raw) && raw > 0
        ? Math.floor(raw)
        : null;
  }
  if (typeof payload.venueScene === "string") {
    next.venueScene = payload.venueScene as BadmintonBranding["venueScene"];
  }
  if (typeof payload.overlayScene === "string") {
    next.overlayScene = payload.overlayScene as BadmintonBranding["overlayScene"];
  }
  if (typeof payload.venueMusicPlaying === "boolean") {
    next.venueMusicPlaying = payload.venueMusicPlaying;
  }
  if ("resolvedVenueMusicUrl" in payload) {
    const url = payload.resolvedVenueMusicUrl;
    next.resolvedVenueMusicUrl = typeof url === "string" && url.trim() ? url.trim() : null;
  }
  return next;
}

export function useBadmintonLiveFollow(tournamentId: number) {
  const queryClient = useQueryClient();
  const { data: branding } = useBadmintonBranding(tournamentId);

  const matchesQuery = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => badmintonFetch(tournamentId, `/matches`),
    enabled: !!tournamentId,
    refetchInterval: 8_000,
  });

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeBadmintonDashboardStream(tournamentId, (payload) => {
      const data =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;
      if (
        data
        && (data.kind === "broadcast_presentation"
          || "primaryBroadcastMatchId" in data
          || "venueScene" in data
          || "overlayScene" in data)
      ) {
        queryClient.setQueryData<BadmintonBranding | undefined>(
          ["badminton-branding", tournamentId],
          (prev) => applyPresentationPayload(prev, data),
        );
      }
      void queryClient.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["badminton-branding", tournamentId] });
    });
  }, [tournamentId, queryClient]);

  const primaryMatchId = useMemo(
    () =>
      resolvePrimaryBroadcastMatchId(
        matchesQuery.data ?? [],
        branding?.primaryBroadcastMatchId ?? null,
      ),
    [matchesQuery.data, branding?.primaryBroadcastMatchId],
  );

  const primaryMatch = findMatchById(matchesQuery.data ?? [], primaryMatchId);
  const matchQuery = useBadmintonMatch(tournamentId, primaryMatchId ?? 0);
  const liveMatches = useMemo(
    () => listLiveMatches(matchesQuery.data ?? []).slice(0, MAX_MULTI_COURT_ROWS),
    [matchesQuery.data],
  );

  // Seed per-match cache from list snapshot so Focus court paints immediately
  // while GET /matches/:id / SSE catch up.
  useEffect(() => {
    if (!tournamentId || !primaryMatchId || !primaryMatch?.state) return;
    const key = ["badminton-match", tournamentId, primaryMatchId] as const;
    const existing = queryClient.getQueryData<{
      state: BadmintonMatchState;
      detail: unknown;
    }>(key);
    if (existing?.state) return;
    queryClient.setQueryData(key, {
      state: primaryMatch.state,
      detail: primaryMatch.detail,
    });
  }, [tournamentId, primaryMatchId, primaryMatch?.state, primaryMatch?.detail, queryClient]);

  const followState =
    (matchQuery.data?.state as BadmintonMatchState | undefined)
    ?? primaryMatch?.state
    ?? null;
  const followDetail = matchQuery.data?.detail ?? primaryMatch?.detail ?? null;

  return {
    primaryMatchId,
    primaryMatch,
    liveMatches,
    matches: matchesQuery.data ?? [],
    matchesLoading: matchesQuery.isLoading,
    matchesError: matchesQuery.isError,
    refetchMatches: () => matchesQuery.refetch(),
    matchQuery,
    /** Best-available state for the followed court (detail GET or list snapshot). */
    followState,
    followDetail,
    branding,
  };
}
