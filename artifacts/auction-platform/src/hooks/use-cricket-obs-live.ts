import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { getCricketMasterTeams, type ScoringLiveDisplay } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import {
  buildCricketObsViewModel,
  flashTokenForBall,
  mergeLiveDisplayPreserveBranding,
  type CricketObsViewModel,
} from "@/lib/cricket-obs-view-model";

/**
 * Read-only Cricket OBS live feed.
 * Preserves REST branding across slim SSE match patches.
 */
export function useCricketObsLive(
  tournamentId: number,
  pinnedMatchId: number | null,
): {
  vm: CricketObsViewModel;
  scoringActive: boolean;
  isLoading: boolean;
} {
  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0,
    },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { connectionStatus } = useScoringSocket(tournamentId, scoringActive && tournamentId > 0);
  const { data: liveRaw, isLoading: liveLoading } = useScoringLive(
    tournamentId,
    scoringActive && tournamentId > 0,
    connectionStatus,
  );

  const [mergedLive, setMergedLive] = useState<ScoringLiveDisplay | null>(null);
  const preservedRef = useRef<ScoringLiveDisplay | null>(null);

  useEffect(() => {
    const merged = mergeLiveDisplayPreserveBranding(preservedRef.current, liveRaw ?? null);
    preservedRef.current = merged;
    setMergedLive(merged);
  }, [liveRaw]);

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: tournamentId > 0 && scoringActive,
    staleTime: 60_000,
  });

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const sponsors = useMemo(
    () => parseTournamentSponsors(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  const [seenFlashToken, setSeenFlashToken] = useState<string | null>(null);
  const bootstrappedFlash = useRef(false);

  // Suppress flash on first hydrate / refresh — only animate new balls after connect.
  useEffect(() => {
    if (bootstrappedFlash.current || !mergedLive?.state || !mergedLive.match) return;
    bootstrappedFlash.current = true;
    const trail = mergedLive.state.thisOver;
    const last = trail.length > 0 ? trail[trail.length - 1] : null;
    setSeenFlashToken(
      flashTokenForBall(mergedLive.match.id, mergedLive.state.lastSequence, last),
    );
  }, [mergedLive]);

  const vm = useMemo(
    () =>
      buildCricketObsViewModel({
        live: mergedLive,
        teams,
        tournamentName: tournament?.name ?? "BidWar Cricket",
        tournamentLogoUrl:
          tournament?.logoUrl && !tournament.logoUrl.startsWith("data:")
            ? tournament.logoUrl
            : null,
        sponsors,
        pinnedMatchId,
        connectionStatus,
        previousFlashToken: seenFlashToken,
      }),
    [
      mergedLive,
      teams,
      tournament?.name,
      tournament?.logoUrl,
      sponsors,
      pinnedMatchId,
      connectionStatus,
      seenFlashToken,
    ],
  );

  useEffect(() => {
    if (vm.flashToken && vm.flash) {
      const token = vm.flashToken;
      const timer = window.setTimeout(() => setSeenFlashToken(token), 2200);
      return () => window.clearTimeout(timer);
    }
  }, [vm.flashToken, vm.flash]);

  return {
    vm,
    scoringActive,
    isLoading: tournamentLoading || (scoringActive && liveLoading && !mergedLive?.state),
  };
}
