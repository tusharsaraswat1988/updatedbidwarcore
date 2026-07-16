/**
 * Resolve the match that persistent /badminton/live/* surfaces should follow.
 * Polls tournament matches + branding; reuses existing per-match SSE via useBadmintonMatch.
 */

import { useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { badmintonFetch } from "@/lib/badminton-api";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonMatch } from "@/hooks/use-badminton-match";
import {
  findMatchById,
  listLiveMatches,
  resolvePrimaryBroadcastMatchId,
  type BroadcastConsoleMatch,
} from "@/lib/badminton-broadcast-console";
import { MAX_MULTI_COURT_ROWS } from "@/lib/badminton-broadcast-director";

const API_BASE = import.meta.env.VITE_API_URL ?? "";

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
    const url = `${API_BASE}/api/tournaments/${tournamentId}/badminton/stream`;
    const es = new EventSource(url, { withCredentials: true });
    es.onmessage = () => {
      void queryClient.invalidateQueries({ queryKey: ["badminton-matches", tournamentId] });
      void queryClient.invalidateQueries({ queryKey: ["badminton-branding", tournamentId] });
    };
    return () => es.close();
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

  return {
    primaryMatchId,
    primaryMatch,
    liveMatches,
    matches: matchesQuery.data ?? [],
    matchesLoading: matchesQuery.isLoading,
    matchQuery,
    branding,
  };
}
