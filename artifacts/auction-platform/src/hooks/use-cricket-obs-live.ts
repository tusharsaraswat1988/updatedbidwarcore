import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import {
  getCricketMasterTeams,
  getCricketTournamentRoster,
  getPublicMatchScorecard,
  type ScoringLiveDisplay,
} from "@/lib/scoring-api";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
} from "@/lib/scoring-squad";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import {
  buildCricketObsViewModel,
  flashTokenForBall,
  mergeLiveDisplayPreserveBranding,
  type CricketObsFlashKind,
  type CricketObsMidOverlayKind,
  type CricketObsViewModel,
} from "@/lib/cricket-obs-view-model";

/**
 * Cricket OBS live feed hook.
 * Powers the 5 core broadcast layers:
 * 1. Solid Top Header
 * 2. Transparent Mid Viewport
 * 3. Solid Bottom Scorebug (batting figures, bowler spell, over train, run rates)
 * 4. Real-time scoring animations (Four, Six, Wicket, Superball, Free Hit, New Batsman, etc.)
 * 5. 80% screen frosted overlays (Sponsors, Standings, Schedule, Scorecard, Summary)
 */
export function useCricketObsLive(
  tournamentId: number,
  pinnedMatchId: number | null,
): {
  vm: CricketObsViewModel;
  scoringActive: boolean;
  isLoading: boolean;
  setMidOverlay: (overlay: CricketObsMidOverlayKind) => void;
  triggerFlash: (flash: CricketObsFlashKind, detail?: string) => void;
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

  // Master Teams
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

  // Tournament Roster for Player Names & Avatars
  const { data: rosterData } = useQuery({
    queryKey: ["cricket-tournament-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: tournamentId > 0 && scoringActive,
    staleTime: 120_000,
  });

  const players = useMemo(
    () => (Array.isArray(rosterData) ? rosterData.map(cricketRosterToScorerPlayer) : []),
    [rosterData],
  );

  // Active match ID for scorecard
  const activeMatchId = pinnedMatchId ?? mergedLive?.match?.id ?? null;

  // Real-time Match Scorecard for batter/bowler figures
  const { data: scorecardData } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, activeMatchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, activeMatchId!),
    enabled: !!tournamentId && !!activeMatchId,
    refetchInterval: mergedLive?.match?.status === "live" ? 3000 : 15000,
  });

  const sponsors = useMemo(
    () => parseTournamentSponsors(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  // Mid Overlay (80% screen) state: URL param initial value or operator selection
  const [midOverlay, setMidOverlayState] = useState<CricketObsMidOverlayKind>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const ov = sp.get("overlay")?.toLowerCase();
      if (
        ov === "sponsors" ||
        ov === "standings" ||
        ov === "fixtures" ||
        ov === "scorecard" ||
        ov === "summary" ||
        ov === "intro"
      ) {
        return ov as CricketObsMidOverlayKind;
      }
    }
    return "none";
  });

  // Query server for active OBS director state (persisted across reloads/new tabs)
  const { data: serverObsState } = useQuery<{ overlay?: string }>({
    queryKey: ["cricket-obs-director", tournamentId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`);
        if (!res.ok) return { overlay: "none" };
        return await res.json();
      } catch {
        return { overlay: "none" };
      }
    },
    enabled: tournamentId > 0,
    staleTime: 5000,
  });

  useEffect(() => {
    if (serverObsState?.overlay) {
      setMidOverlayState(serverObsState.overlay as CricketObsMidOverlayKind);
    }
  }, [serverObsState?.overlay]);

  // Manual / Operator / Injected Flash Event
  const [overrideFlash, setOverrideFlash] = useState<{
    kind: CricketObsFlashKind | null;
    token: string | null;
    detail?: string | null;
  }>({ kind: null, token: null });

  const triggerFlash = useCallback((flash: CricketObsFlashKind, detail?: string) => {
    const token = `flash-${Date.now()}-${flash}`;
    setOverrideFlash({ kind: flash, token, detail });
  }, []);

  const setMidOverlay = useCallback(
    (overlay: CricketObsMidOverlayKind) => {
      setMidOverlayState(overlay);
      // 1. Post to server for cross-device SSE broadcast (Phone -> Laptop / OBS Studio)
      void fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlay }),
      }).catch(() => {});

      // 2. BroadcastChannel fallback for same-browser tabs
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
          ch.postMessage({ type: "SET_OVERLAY", overlay });
          ch.close();
        } catch {
          // ignore
        }
      }
    },
    [tournamentId],
  );

  // Cross-device SSE Director listener (from useScoringSocket)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSseDirector = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (!detail) return;
      if (detail.overlay !== undefined) {
        setMidOverlayState(detail.overlay as CricketObsMidOverlayKind);
      }
      if (detail.flash) {
        triggerFlash(detail.flash, detail.detail);
      }
    };
    window.addEventListener("cricket_obs_director", handleSseDirector);
    return () => window.removeEventListener("cricket_obs_director", handleSseDirector);
  }, [triggerFlash]);

  // Cross-tab / Operator BroadcastChannel listener (same-machine fallback)
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined" || !tournamentId) {
      return;
    }
    const channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
    channel.onmessage = (ev) => {
      const data = ev.data;
      if (!data) return;
      if (data.type === "SET_OVERLAY") {
        setMidOverlayState(data.overlay ?? "none");
      } else if (data.type === "TRIGGER_FLASH") {
        triggerFlash(data.flash, data.detail);
      }
    };
    return () => {
      channel.close();
    };
  }, [tournamentId, triggerFlash]);

  // Flash auto-clear timer
  useEffect(() => {
    if (overrideFlash.kind && overrideFlash.token) {
      const timer = window.setTimeout(() => {
        setOverrideFlash({ kind: null, token: null });
      }, 3500);
      return () => window.clearTimeout(timer);
    }
  }, [overrideFlash.token, overrideFlash.kind]);

  const [seenFlashToken, setSeenFlashToken] = useState<string | null>(null);
  const bootstrappedFlash = useRef(false);

  // Suppress ball flash on first hydrate / refresh
  useEffect(() => {
    if (bootstrappedFlash.current || !mergedLive?.state || !mergedLive.match) return;
    bootstrappedFlash.current = true;
    const trail = mergedLive.state.thisOver;
    const last = trail.length > 0 ? trail[trail.length - 1] : null;
    setSeenFlashToken(
      flashTokenForBall(mergedLive.match.id, mergedLive.state.lastSequence, last),
    );
  }, [mergedLive]);

  // Automatic Event Detection: New Batsman, Free Hit, Match Won, Superball
  const seenBatsmenRef = useRef<Set<number>>(new Set());
  const prevFreeHitRef = useRef<boolean>(false);
  const prevTossWinnerRef = useRef<number | null>(null);
  const prevWonRef = useRef<boolean>(false);

  useEffect(() => {
    const state = mergedLive?.state;
    if (!state) return;

    // Detect Match Won / Target Reached
    const innings = getActiveInnings(state);
    const target = state.target;
    const runs = innings?.runs ?? 0;
    const isTargetReached = target != null && runs >= target && (state.currentInnings ?? 1) >= 2;
    const isCompleted = state.matchStatus === "completed" || isTargetReached;

    if (isCompleted && !prevWonRef.current) {
      prevWonRef.current = true;
      if (bootstrappedFlash.current) {
        const batting = innings ? teams.find((t) => t.id === innings.battingTeamId) : null;
        const winDesc =
          state.resultText ||
          (batting ? `${batting.name} Won` : "Champions · Match Won");
        triggerFlash("MATCH_WON", winDesc);
      }
    } else if (!isCompleted) {
      prevWonRef.current = false;
    }

    if (state.matchStatus !== "live") return;

    // Detect Free Hit turn-on
    if (state.freeHitActive && !prevFreeHitRef.current) {
      triggerFlash("FREE_HIT");
    }
    prevFreeHitRef.current = !!state.freeHitActive;

    // Detect Toss Win
    if (state.tossWinnerTeamId && prevTossWinnerRef.current !== state.tossWinnerTeamId) {
      if (prevTossWinnerRef.current === null && bootstrappedFlash.current) {
        triggerFlash("TOSS_WIN");
      }
      prevTossWinnerRef.current = state.tossWinnerTeamId;
    }

    // Detect New Batsman
    if (bootstrappedFlash.current) {
      const strikerId = state.strikerId;
      if (strikerId && !seenBatsmenRef.current.has(strikerId)) {
        seenBatsmenRef.current.add(strikerId);
        const player = players.find((p) => p.id === strikerId);
        if (player) {
          triggerFlash("NEW_BATSMAN", player.name);
        }
      }
    } else {
      if (state.strikerId) seenBatsmenRef.current.add(state.strikerId);
      if (state.nonStrikerId) seenBatsmenRef.current.add(state.nonStrikerId);
    }
  }, [mergedLive?.state, players, triggerFlash]);

  const vm = useMemo(
    () =>
      buildCricketObsViewModel({
        live: mergedLive,
        teams,
        players,
        scorecard: scorecardData?.scorecard ?? null,
        tournamentName: tournament?.name ?? "BidWar Cricket",
        tournamentLogoUrl:
          tournament?.logoUrl && !tournament.logoUrl.startsWith("data:")
            ? tournament.logoUrl
            : null,
        sponsors,
        pinnedMatchId,
        connectionStatus,
        previousFlashToken: seenFlashToken,
        overrideFlash: overrideFlash.kind,
        overrideFlashToken: overrideFlash.token,
        overrideFlashDetail: overrideFlash.detail,
        midOverlay,
      }),
    [
      mergedLive,
      teams,
      players,
      scorecardData?.scorecard,
      tournament?.name,
      tournament?.logoUrl,
      sponsors,
      pinnedMatchId,
      connectionStatus,
      seenFlashToken,
      overrideFlash,
      midOverlay,
    ],
  );

  useEffect(() => {
    if (vm.flashToken && vm.flash && !overrideFlash.kind) {
      const token = vm.flashToken;
      const timer = window.setTimeout(() => setSeenFlashToken(token), 3000);
      return () => window.clearTimeout(timer);
    }
  }, [vm.flashToken, vm.flash, overrideFlash.kind]);

  return {
    vm,
    scoringActive,
    isLoading: tournamentLoading || (scoringActive && liveLoading && !mergedLive?.state),
    setMidOverlay,
    triggerFlash,
  };
}
