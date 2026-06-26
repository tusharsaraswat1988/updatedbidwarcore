import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getScoringLive,
  getScoringMatch,
  getScoringStandings,
  getSquadReadiness,
  listScoringMatches,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";
import { sseAwareRefetchInterval } from "@/lib/sse-polling";
import type { ScoringConnectionStatus } from "@/hooks/use-scoring-socket";

export function scoringLiveQueryKey(tournamentId: number) {
  return ["scoring-live", tournamentId] as const;
}

export function scoringMatchesQueryKey(tournamentId: number) {
  return ["scoring-matches", tournamentId] as const;
}

export function scoringMatchQueryKey(tournamentId: number, matchId: number) {
  return ["scoring-match", tournamentId, matchId] as const;
}

export function scoringStandingsQueryKey(tournamentId: number) {
  return ["scoring-standings", tournamentId] as const;
}

export function scoringSquadsQueryKey(tournamentId: number) {
  return ["scoring-squads", tournamentId] as const;
}

export function useScoringMatches(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: scoringMatchesQueryKey(tournamentId),
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0 && enabled,
  });
}

export function useScoringLive(
  tournamentId: number,
  enabled = true,
  connectionStatus?: ScoringConnectionStatus,
) {
  return useQuery({
    queryKey: scoringLiveQueryKey(tournamentId),
    queryFn: () => getScoringLive(tournamentId),
    enabled: tournamentId > 0 && enabled,
    refetchInterval:
      connectionStatus !== undefined
        ? sseAwareRefetchInterval(connectionStatus, 15000)
        : enabled
          ? 15000
          : false,
  });
}

export function useScoringMatch(tournamentId: number, matchId: number, enabled = true) {
  return useQuery({
    queryKey: scoringMatchQueryKey(tournamentId, matchId),
    queryFn: () => getScoringMatch(tournamentId, matchId),
    enabled: tournamentId > 0 && matchId > 0 && enabled,
    refetchInterval: enabled ? 4000 : false,
  });
}

export function useScoringStandings(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: scoringStandingsQueryKey(tournamentId),
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0 && enabled,
    refetchInterval: 30000,
  });
}

export function useSquadReadiness(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: scoringSquadsQueryKey(tournamentId),
    queryFn: () => getSquadReadiness(tournamentId),
    enabled: tournamentId > 0 && enabled,
  });
}

export function useInvalidateScoring(tournamentId: number, matchId?: number) {
  const qc = useQueryClient();
  return {
    invalidateAll: () => {
      void qc.invalidateQueries({ queryKey: scoringMatchesQueryKey(tournamentId) });
      void qc.invalidateQueries({ queryKey: scoringStandingsQueryKey(tournamentId) });
      if (matchId) {
        void qc.invalidateQueries({ queryKey: scoringMatchQueryKey(tournamentId, matchId) });
      }
    },
    setMatchDetail: (detail: ScoringMatchDetail) => {
      if (matchId) {
        qc.setQueryData(scoringMatchQueryKey(tournamentId, matchId), detail);
      }
    },
  };
}
