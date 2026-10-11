import { replaceEqualDeep, useQuery, useQueryClient } from "@tanstack/react-query";
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

function matchDetailSequence(detail: ScoringMatchDetail | undefined): number {
  if (!detail) return -1;
  if (typeof detail.lastSequence === "number") return detail.lastSequence;
  if (typeof detail.state?.lastSequence === "number") return detail.state.lastSequence;
  return -1;
}

/** A slower poll must not put an older crease back over a ball that already landed. */
export function shareNewerMatchDetail<T>(oldData: T, newData: T): T {
  const previous = oldData as ScoringMatchDetail | undefined;
  const incoming = newData as ScoringMatchDetail | undefined;
  if (matchDetailSequence(incoming) < matchDetailSequence(previous)) {
    return oldData;
  }
  return replaceEqualDeep(oldData, newData);
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
    refetchInterval: (query) => {
      const list = query.state.data ?? [];
      const hasLive = list.some((m) => m.status === "live");
      return hasLive ? 4000 : 30000;
    },
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
    structuralSharing: shareNewerMatchDetail,
  });
}

export function useScoringStandings(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: scoringStandingsQueryKey(tournamentId),
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0 && enabled,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useSquadReadiness(tournamentId: number, enabled = true) {
  return useQuery({
    queryKey: scoringSquadsQueryKey(tournamentId),
    queryFn: () => getSquadReadiness(tournamentId),
    enabled: tournamentId > 0 && enabled,
    staleTime: 60_000,
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
      if (!matchId) return;
      qc.setQueryData<ScoringMatchDetail>(
        scoringMatchQueryKey(tournamentId, matchId),
        (current) => {
          if (matchDetailSequence(detail) < matchDetailSequence(current)) return current;
          return detail;
        },
      );
    },
  };
}
