import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { getActiveInnings } from "@/lib/scoring-ball";
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
  cricketBrandingQueryKey,
  getCricketBranding,
} from "@/lib/scoring-api";
import type { BadmintonBranding } from "@/hooks/use-badminton-branding";
import {
  buildCricketObsViewModel,
  flashTokenForBall,
  mapBallToFlash,
  mergeLiveDisplayPreserveBranding,
  type CricketBroadcastMessage,
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
  overlayMatchId?: number;
  overlaySponsorName?: string;
  overlayStageOrGroup?: string;
  setMidOverlay: (
    overlay: CricketObsMidOverlayKind,
    matchId?: number,
    sponsorName?: string,
    stageOrGroup?: string,
  ) => void;
  triggerFlash: (flash: CricketObsFlashKind, detail?: string) => void;
  broadcastMessage: CricketBroadcastMessage | null;
  pushBroadcastMessage: (name: string, details: string) => void;
  closeBroadcastMessage: () => void;
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

  const { data: branding } = useQuery<BadmintonBranding>({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<BadmintonBranding>(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 5000,
  });

  const sponsors = useMemo(
    () => parseTournamentSponsors(branding?.sponsorLogos ?? tournament?.sponsorLogos),
    [branding?.sponsorLogos, tournament?.sponsorLogos],
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

  const [overlayMatchId, setOverlayMatchId] = useState<number | undefined>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      const mId = sp.get("matchId");
      if (mId) {
        const parsed = parseInt(mId, 10);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
    return undefined;
  });

  const [overlaySponsorName, setOverlaySponsorName] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("sponsorName") || undefined;
    }
    return undefined;
  });

  const [overlayStageOrGroup, setOverlayStageOrGroup] = useState<string | undefined>(() => {
    if (typeof window !== "undefined") {
      const sp = new URLSearchParams(window.location.search);
      return sp.get("stageOrGroup") || undefined;
    }
    return undefined;
  });

  const [broadcastMessage, setBroadcastMessage] = useState<CricketBroadcastMessage | null>(null);

  // Query server for active OBS director state (persisted across reloads/new tabs)
  const { data: serverObsState } = useQuery<{
    overlay?: string;
    matchId?: number;
    sponsorName?: string;
    stageOrGroup?: string;
    broadcastMessage?: CricketBroadcastMessage | null;
  }>({
    queryKey: ["cricket-obs-director", tournamentId],
    queryFn: async () => {
      try {
        const res = await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`);
        if (!res.ok) return { overlay: "none", broadcastMessage: null };
        return await res.json();
      } catch {
        return { overlay: "none", broadcastMessage: null };
      }
    },
    enabled: tournamentId > 0,
    staleTime: 5000,
  });

  useEffect(() => {
    if (serverObsState?.overlay) {
      setMidOverlayState(serverObsState.overlay as CricketObsMidOverlayKind);
    }
    if (serverObsState?.matchId !== undefined) {
      setOverlayMatchId(serverObsState.matchId);
    }
    if (serverObsState?.sponsorName !== undefined) {
      setOverlaySponsorName(serverObsState.sponsorName);
    }
    if (serverObsState?.stageOrGroup !== undefined) {
      setOverlayStageOrGroup(serverObsState.stageOrGroup);
    }
    if (serverObsState?.broadcastMessage !== undefined) {
      setBroadcastMessage(serverObsState.broadcastMessage);
    }
  }, [
    serverObsState?.overlay,
    serverObsState?.matchId,
    serverObsState?.sponsorName,
    serverObsState?.stageOrGroup,
    serverObsState?.broadcastMessage,
  ]);

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

  const pushBroadcastMessage = useCallback(
    (name: string, details: string) => {
      const msg: CricketBroadcastMessage = {
        active: true,
        name: name.trim(),
        details: details.trim(),
      };
      setBroadcastMessage(msg);

      // 1. Post to server for cross-device SSE broadcast
      void fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageType: "broadcast_message", broadcastMessage: msg }),
      }).catch(() => {});

      // 2. BroadcastChannel fallback for same-browser tabs
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
          ch.postMessage({ type: "SET_BROADCAST_MESSAGE", broadcastMessage: msg });
          ch.close();
        } catch {
          // ignore
        }
      }
    },
    [tournamentId],
  );

  const closeBroadcastMessage = useCallback(() => {
    const msg: CricketBroadcastMessage = { active: false, name: "", details: "" };
    setBroadcastMessage(null);

    // 1. Post to server for cross-device SSE broadcast
    void fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageType: "broadcast_message", broadcastMessage: msg }),
    }).catch(() => {});

    // 2. BroadcastChannel fallback for same-browser tabs
    if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
      try {
        const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
        ch.postMessage({ type: "CLEAR_BROADCAST_MESSAGE" });
        ch.close();
      } catch {
        // ignore
      }
    }
  }, [tournamentId]);

  const setMidOverlay = useCallback(
    (
      overlay: CricketObsMidOverlayKind,
      matchId?: number,
      sponsorName?: string,
      stageOrGroup?: string,
    ) => {
      setMidOverlayState(overlay);
      setOverlayMatchId(matchId);
      setOverlaySponsorName(sponsorName);
      setOverlayStageOrGroup(stageOrGroup);

      // 1. Post to server for cross-device SSE broadcast (Phone -> Laptop / OBS Studio)
      void fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ overlay, matchId, sponsorName, stageOrGroup }),
      }).catch(() => {});

      // 2. BroadcastChannel fallback for same-browser tabs
      if (typeof window !== "undefined" && typeof BroadcastChannel !== "undefined") {
        try {
          const ch = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
          ch.postMessage({ type: "SET_OVERLAY", overlay, matchId, sponsorName, stageOrGroup });
          ch.close();
        } catch {
          // ignore
        }
      }
    },
    [tournamentId],
  );

  // Timestamp tracker to prevent stale/out-of-order SSE director events from overwriting newer state
  const lastDirectorTimestampRef = useRef<number>(0);

  // Cross-device SSE Director listener (from useScoringSocket)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleSseDirector = (ev: Event) => {
      const detail = (ev as CustomEvent).detail;
      if (!detail) return;

      // Reject stale out-of-order events
      if (
        detail.timestamp &&
        detail.timestamp < lastDirectorTimestampRef.current
      ) {
        return;
      }
      if (detail.timestamp) {
        lastDirectorTimestampRef.current = detail.timestamp;
      }

      if (detail.overlay !== undefined) {
        setMidOverlayState(detail.overlay as CricketObsMidOverlayKind);
      }
      if (detail.matchId !== undefined) {
        setOverlayMatchId(detail.matchId);
      }
      if (detail.sponsorName !== undefined) {
        setOverlaySponsorName(detail.sponsorName);
      }
      if (detail.stageOrGroup !== undefined) {
        setOverlayStageOrGroup(detail.stageOrGroup);
      }
      if (detail.flash) {
        triggerFlash(detail.flash, detail.detail);
      }
      if (detail.broadcastMessage !== undefined) {
        setBroadcastMessage(detail.broadcastMessage);
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
        if (data.matchId !== undefined) {
          setOverlayMatchId(data.matchId);
        }
        if (data.sponsorName !== undefined) {
          setOverlaySponsorName(data.sponsorName);
        }
        if (data.stageOrGroup !== undefined) {
          setOverlayStageOrGroup(data.stageOrGroup);
        }
      } else if (data.type === "TRIGGER_FLASH") {
        triggerFlash(data.flash, data.detail);
      } else if (data.type === "SET_BROADCAST_MESSAGE") {
        setBroadcastMessage(data.broadcastMessage ?? null);
      } else if (data.type === "CLEAR_BROADCAST_MESSAGE") {
        setBroadcastMessage(null);
      }
    };
    return () => {
      channel.close();
    };
  }, [tournamentId, triggerFlash]);

  // Flash auto-clear timer
  useEffect(() => {
    if (!overrideFlash.kind || !overrideFlash.token) return undefined;
    const timer = window.setTimeout(() => {
      setOverrideFlash({ kind: null, token: null });
    }, 3500);
    return () => window.clearTimeout(timer);
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

  // Automatic Event Detection: Real-time ball-by-ball triggers from Scorer actions
  const seenBatsmenRef = useRef<Set<number>>(new Set());
  const prevFreeHitRef = useRef<boolean>(false);
  const prevTossWinnerRef = useRef<number | null>(null);
  const prevWonRef = useRef<boolean>(false);
  const prevSequenceRef = useRef<number | null>(null);

  useEffect(() => {
    const state = mergedLive?.state;
    const match = mergedLive?.match;
    if (!state || !match) return;

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

    // 1. Initial Sequence Bootstrap (don't flash on first page load/refresh)
    if (prevSequenceRef.current === null) {
      prevSequenceRef.current = state.lastSequence ?? 0;
      if (state.strikerId) seenBatsmenRef.current.add(state.strikerId);
      if (state.nonStrikerId) seenBatsmenRef.current.add(state.nonStrikerId);
      prevFreeHitRef.current = !!state.freeHitActive;
      prevTossWinnerRef.current = state.tossWinnerTeamId ?? null;
      return;
    }

    // 2. Real-Time Scorer Ball Trigger: when scorer logs any ball/wicket
    if (state.lastSequence != null && state.lastSequence !== prevSequenceRef.current) {
      prevSequenceRef.current = state.lastSequence;

      const trail = state.thisOver;
      const lastBall = trail.length > 0 ? trail[trail.length - 1] : null;
      if (lastBall) {
        const flashKind = mapBallToFlash(lastBall);
        if (flashKind) {
          let detail: string | undefined = undefined;
          if (flashKind === "FOUR" || flashKind === "SIX") {
            const striker = players.find((p) => p.id === state.strikerId);
            detail = striker
              ? `${striker.name} · ${flashKind === "SIX" ? "MAXIMUM 6" : "BOUNDARY 4"}`
              : undefined;
          } else if (flashKind === "WICKET") {
            const dismissed = players.find(
              (p) => p.id === state.strikerId || p.id === state.nonStrikerId,
            );
            detail = dismissed ? `${dismissed.name} · OUT` : "WICKET BREAKTHROUGH";
          } else if (flashKind === "NO_BALL") {
            detail = "EXTRA RUN + FREE HIT";
          } else if (flashKind === "WIDE") {
            detail = "+1 EXTRA RUN";
          } else if (flashKind === "SUPERBALL") {
            detail = "2X RUNS SCORED";
          }
          triggerFlash(flashKind, detail);
        }
      }
    }

    if (state.matchStatus !== "live") return;

    // 3. Detect Free Hit turn-on
    if (state.freeHitActive && !prevFreeHitRef.current) {
      triggerFlash("FREE_HIT", "CANNOT BE OUT BOWLED / CAUGHT");
    }
    prevFreeHitRef.current = !!state.freeHitActive;

    // 4. Detect Toss Win
    if (state.tossWinnerTeamId && prevTossWinnerRef.current !== state.tossWinnerTeamId) {
      if (prevTossWinnerRef.current === null && bootstrappedFlash.current) {
        const winnerTeam = teams.find((t) => t.id === state.tossWinnerTeamId);
        const decision = state.electedTo ? state.electedTo.toUpperCase() : "BAT";
        triggerFlash(
          "TOSS_WIN",
          winnerTeam ? `${winnerTeam.name} ELECTED TO ${decision}` : undefined,
        );
      }
      prevTossWinnerRef.current = state.tossWinnerTeamId;
    }

    // 5. Detect New Batsman Walking In
    if (bootstrappedFlash.current) {
      const strikerId = state.strikerId;
      if (strikerId && !seenBatsmenRef.current.has(strikerId)) {
        seenBatsmenRef.current.add(strikerId);
        const player = players.find((p) => p.id === strikerId);
        if (player) {
          triggerFlash("NEW_BATSMAN", `${player.name} · WALKING IN`);
        }
      }
    } else {
      if (state.strikerId) seenBatsmenRef.current.add(state.strikerId);
      if (state.nonStrikerId) seenBatsmenRef.current.add(state.nonStrikerId);
    }
  }, [
    mergedLive?.state,
    mergedLive?.match,
    players,
    teams,
    triggerFlash,
  ]);

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
        broadcastMessage,
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
      broadcastMessage,
    ],
  );

  useEffect(() => {
    if (vm.flashToken && vm.flash && !overrideFlash.kind) {
      const token = vm.flashToken;
      const timer = window.setTimeout(() => setSeenFlashToken(token), 3000);
      return () => {
        window.clearTimeout(timer);
      };
    }
    return undefined;
  }, [vm.flashToken, vm.flash, overrideFlash.kind]);

  return {
    vm,
    scoringActive,
    isLoading: tournamentLoading || (scoringActive && liveLoading && !mergedLive?.state),
    overlayMatchId,
    overlaySponsorName,
    overlayStageOrGroup,
    setMidOverlay,
    triggerFlash,
    broadcastMessage,
    pushBroadcastMessage,
    closeBroadcastMessage,
  };
}
