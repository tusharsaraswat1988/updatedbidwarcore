/**
 * Resolve the match that persistent /badminton/live/* surfaces should follow.
 * Polls tournament matches + branding; reuses existing per-match SSE via useBadmintonMatch.
 */

import { useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { BadmintonMatchState } from "@workspace/badminton-core";
import { fetchBadmintonMatches } from "@/lib/badminton-api";
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
import {
  applyPresentationPayload,
  isPresentationPayload,
} from "@/lib/badminton-presentation-mutation";

/** Venue/OBS follow — longer stale windows; SSE applies presentation in-place. */
export function useBadmintonLiveFollow(tournamentId: number) {
  const queryClient = useQueryClient();
  const { data: branding } = useBadmintonBranding(tournamentId, {
    staleTime: 60_000,
    refetchInterval: false,
  });

  const matchesQuery = useQuery<BroadcastConsoleMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: !!tournamentId,
    staleTime: 15_000,
    // Safety net only — live scores for the focused court come from match SSE.
    refetchInterval: 20_000,
    placeholderData: (prev) => prev,
  });

  const matchesInvalidateTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!tournamentId) return;
    return subscribeBadmintonDashboardStream(tournamentId, (payload) => {
      const data =
        payload && typeof payload === "object"
          ? (payload as Record<string, unknown>)
          : null;

      // Moments / focus / music: patch cache only — never refetch branding
      // (refetch was remounting LED chrome and flashing "Connecting…").
      if (data && isPresentationPayload(data)) {
        queryClient.setQueryData<BadmintonBranding | undefined>(
          ["badminton-branding", tournamentId],
          (prev) => applyPresentationPayload(prev, data),
        );
        // Primary court change may need a fresher match list, but debounce.
        if ("primaryBroadcastMatchId" in data) {
          if (matchesInvalidateTimer.current) {
            clearTimeout(matchesInvalidateTimer.current);
          }
          matchesInvalidateTimer.current = setTimeout(() => {
            void queryClient.invalidateQueries({
              queryKey: ["badminton-matches", tournamentId],
            });
          }, 400);
        }
        return;
      }

      // Other tournament events (scores, schedule): debounce match-list refresh.
      if (matchesInvalidateTimer.current) {
        clearTimeout(matchesInvalidateTimer.current);
      }
      matchesInvalidateTimer.current = setTimeout(() => {
        void queryClient.invalidateQueries({
          queryKey: ["badminton-matches", tournamentId],
        });
      }, 750);
    });
  }, [tournamentId, queryClient]);

  useEffect(() => {
    return () => {
      if (matchesInvalidateTimer.current) {
        clearTimeout(matchesInvalidateTimer.current);
      }
    };
  }, []);

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
