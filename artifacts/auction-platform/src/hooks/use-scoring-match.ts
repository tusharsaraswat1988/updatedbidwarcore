import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  getScoringMatch,
  listScoringMatches,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";

export function scoringMatchesQueryKey(tournamentId: number) {
  return ["scoring-matches", tournamentId] as const;
}

export function scoringMatchQueryKey(tournamentId: number, matchId: number) {
  return ["scoring-match", tournamentId, matchId] as const;
}

export function useScoringMatches(tournamentId: number) {
  return useQuery({
    queryKey: scoringMatchesQueryKey(tournamentId),
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
  });
}

export function useScoringMatch(tournamentId: number, matchId: number) {
  return useQuery({
    queryKey: scoringMatchQueryKey(tournamentId, matchId),
    queryFn: () => getScoringMatch(tournamentId, matchId),
    enabled: tournamentId > 0 && matchId > 0,
    refetchInterval: 4000,
  });
}

export function useInvalidateScoring(tournamentId: number, matchId?: number) {
  const qc = useQueryClient();
  return {
    invalidateAll: () => {
      void qc.invalidateQueries({ queryKey: scoringMatchesQueryKey(tournamentId) });
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
