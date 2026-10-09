import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import { getActiveInnings, oversText, requiredRate, runRate } from "@/lib/scoring-ball";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { CricketPublicBrandMark, useCricketBidWarTheme } from "@/components/scoring/cricket-branding";
import { buildCricketMatchSummary } from "@workspace/scoring-core";
import { retainStageSelection } from "@workspace/scoring-core/cricket";
import {
  getCricketMasterTeams,
  getCricketTournamentRoster,
  getPublicMatchScorecard,
  isTerminalCricketMatchStatus,
  type ScoringMatchJson,
} from "@/lib/scoring-api";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import {
  getDisplayThemeFromPresentationPaint,
  type PresentationPaintJson,
} from "@/lib/display-theme";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import {
  cricketBrandingQueryKey,
  getCricketBranding,
} from "@/lib/scoring-api";
import type { BadmintonBranding, ScoreBoardSponsor } from "@/hooks/use-badminton-branding";
import {
  LedEventAnimationOverlay,
  type LedMatchEvent,
} from "@/components/scoring/led-event-animation-overlay";
import { SuperBallActivationOverlay } from "@/components/scoring/super-ball-activation-overlay";
import { SponsorMediaLayer } from "@/components/scoring/sponsor-media-layer";
import { CricketLedMidOverlays } from "@/components/scoring/cricket-led-mid-overlays";
import { CricketLedNeutralScreen } from "@/components/scoring/cricket-led-neutral-screen";
import {
  resolveBatterView,
  resolveBowlerView,
  type CricketObsMidOverlayKind,
} from "@/lib/cricket-obs-view-model";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Trophy,
  Flame,
  Award,
  Pause,
  Sparkles,
  User,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";

function TeamLogoBadge({
  logoUrl,
  name,
  className,
  borderColor = "border-border/80",
  fallbackIconColor = "text-primary",
}: {
  logoUrl?: string | null;
  name?: string;
  className?: string;
  borderColor?: string;
  fallbackIconColor?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [logoUrl]);

  return (
    <div
      className={cn(
        "w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-xl sm:rounded-2xl bg-card/95 border-2 p-1 flex items-center justify-center overflow-hidden shrink-0 shadow-lg shadow-black/40",
        borderColor,
        className,
      )}
    >
      {logoUrl && !hasError ? (
        <img
          src={logoUrl}
          alt={name || "Team"}
          className="w-full h-full object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <Shield className={cn("w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7", fallbackIconColor)} />
      )}
    </div>
  );
}

function PlayerAvatar({
  photoUrl,
  name,
  className,
}: {
  photoUrl?: string | null;
  name?: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [photoUrl]);

  return (
    <div
      className={cn(
        "w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-xl sm:rounded-2xl bg-card/90 border-2 border-border/80 flex items-center justify-center overflow-hidden shrink-0 shadow-md relative bg-gradient-to-br from-card to-background",
        className,
      )}
    >
      {photoUrl && !hasError ? (
        <img
          src={photoUrl}
          alt={name || "Player"}
          className="w-full h-full object-cover object-top"
          onError={() => setHasError(true)}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-primary/70">
          <User className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8" />
        </div>
      )}
    </div>
  );
}

function ConnectionBadge({
  status,
  matchStatus,
}: {
  status: "connected" | "reconnecting" | "disconnected";
  matchStatus?: string;
}) {
  if (matchStatus === "paused") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xl md:text-2xl font-black uppercase tracking-wider animate-pulse">
        <Pause className="w-5 h-5 fill-current" /> Paused
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xl md:text-2xl font-black uppercase tracking-wider">
        <Wifi className="w-5 h-5" /> Live
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xl md:text-2xl font-black uppercase tracking-wider">
        <WifiOff className="w-5 h-5" /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xl md:text-2xl font-black uppercase tracking-wider">
      <RefreshCw className="w-5 h-5 animate-spin" /> Syncing
    </span>
  );
}

export function getSponsorCategoryLabel(s?: {
  priorityType?: string | null;
  type?: string | null;
  isTitleSponsor?: boolean;
  isCoSponsor?: boolean;
} | null): string {
  if (!s) return "Official Partner";
  // 1. Prioritize user-defined Category / Designation (e.g. "Boundary Sponsor", "Gifting Sponsor")
  const custom = s.type?.trim();
  if (custom && !["normal", "standard"].includes(custom.toLowerCase())) {
    return custom;
  }
  // 2. Title & Co-Sponsor checks
  if (s.isTitleSponsor || s.priorityType === "TITLE" || (custom && /title\s*sponsor|gold/i.test(custom))) {
    return "Title Sponsor";
  }
  if (s.isCoSponsor || s.priorityType === "CO_SPONSOR" || (custom && /co[\s-]*sponsor|silver/i.test(custom))) {
    return "Co-Sponsor";
  }
  // 3. Named priority tiers (e.g. PLATINUM, GOLD, SILVER, BRONZE)
  if (s.priorityType && typeof s.priorityType === "string") {
    const clean = s.priorityType.replace(/_/g, " ").trim().toLowerCase();
    if (!["normal", "standard"].includes(clean)) {
      return clean
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
        .join(" ");
    }
  }
  return "Official Partner";
}

/** Top-Right Showcase: Displays sponsors prominently without box frames with smooth pure opacity transition */
function HeaderSponsorShowcase({
  sponsors,
  scoreBoardSponsor,
}: {
  sponsors: SponsorLogo[];
  scoreBoardSponsor?: ScoreBoardSponsor | null;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFading, setIsFading] = useState(false);

  const activeSponsors = useMemo(() => {
    const list: SponsorLogo[] = [];
    if (scoreBoardSponsor && (scoreBoardSponsor.logoUrl || scoreBoardSponsor.name || scoreBoardSponsor.title)) {
      list.push({
        url: scoreBoardSponsor.logoUrl || "",
        name: scoreBoardSponsor.name || "",
        type: scoreBoardSponsor.title || "Scoreboard Sponsor",
        priorityType: scoreBoardSponsor.title || "Scoreboard Sponsor",
        isTitleSponsor: true,
      });
    }
    for (const s of sponsors) {
      if (!list.some((existing) => (existing.name && existing.name === s.name) || (existing.url && existing.url === s.url))) {
        list.push(s);
      }
    }
    return list;
  }, [scoreBoardSponsor, sponsors]);

  useEffect(() => {
    if (activeSponsors.length <= 1) return;
    const interval = setInterval(() => {
      setIsFading(true);
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % activeSponsors.length);
        setIsFading(false);
      }, 300);
    }, 6000);
    return () => clearInterval(interval);
  }, [activeSponsors.length]);

  if (activeSponsors.length === 0) {
    return null;
  }

  const current = activeSponsors[currentIndex] || activeSponsors[0];
  const typeText = getSponsorCategoryLabel(current);

  return (
    <div
      className={cn(
        "flex items-center gap-3 sm:gap-4 max-w-[380px] sm:max-w-[460px] md:max-w-[560px] transition-opacity duration-300 ease-in-out shrink-0",
        isFading ? "opacity-0" : "opacity-100",
      )}
    >
      {current.url ? (
        <div className="h-16 w-16 sm:h-20 sm:w-20 md:h-24 md:w-24 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <img
            src={current.url}
            alt={current.name || "Sponsor"}
            className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
          />
        </div>
      ) : (
        <div className="h-16 w-16 sm:h-20 sm:w-20 flex items-center justify-center shrink-0">
          <Award className="w-10 h-10 sm:w-12 sm:h-12 text-amber-400 drop-shadow" />
        </div>
      )}
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <span
          title={current.name || "Tournament Sponsor"}
          className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wide text-white leading-tight drop-shadow break-words line-clamp-2"
        >
          {current.name || "Tournament Sponsor"}
        </span>
        <span
          title={typeText}
          className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider text-amber-300 truncate mt-1"
        >
          {typeText}
        </span>
      </div>
    </div>
  );
}

export function ScoreDisplayShell({ tournamentId }: { tournamentId: number }) {
  const { shellStyle, logoSrc, logoAlt } = useCricketBidWarTheme();
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { connectionStatus } = useScoringSocket(tournamentId, scoringActive);
  const { data: live } = useScoringLive(tournamentId, scoringActive, connectionStatus);

  const { data: branding } = useQuery<BadmintonBranding>({
    queryKey: cricketBrandingQueryKey(tournamentId),
    queryFn: () => getCricketBranding<BadmintonBranding>(tournamentId),
    enabled: !!tournamentId,
    staleTime: 5000,
  });

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: !!tournamentId,
  });
  const teams: CricketScorerTeam[] = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );

  const { data: roster } = useQuery({
    queryKey: ["cricket-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: !!tournamentId && scoringActive,
  });
  const players = useMemo(
    () => (roster ?? []).map(cricketRosterToScorerPlayer),
    [roster],
  );

  const sponsors = useMemo(
    () => parseTournamentSponsors(branding?.sponsorLogos ?? tournament?.sponsorLogos),
    [branding?.sponsorLogos, tournament?.sponsorLogos],
  );

  const match = live?.match;
  const state = live?.state;
  const isComplete =
    (state?.matchStatus ? isTerminalCricketMatchStatus(state.matchStatus) : false) ||
    (match?.status ? isTerminalCricketMatchStatus(match.status) : false);
  const summary =
    live?.summary ?? (state && isComplete ? buildCricketMatchSummary(state) : null);
  const innings = state ? getActiveInnings(state) : null;

  const matchId = match?.id;
  const { data: scorecardData } = useQuery({
    queryKey: ["public-match-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId!),
    enabled: !!tournamentId && !!matchId,
    staleTime: 2000,
  });

  const strikerStats = useMemo(() => {
    if (!state?.strikerId) return null;
    return resolveBatterView(
      state.strikerId,
      true,
      players,
      scorecardData?.scorecard,
      innings?.innings ?? 1,
    );
  }, [state?.strikerId, players, scorecardData?.scorecard, innings?.innings]);

  const nonStrikerStats = useMemo(() => {
    if (!state?.nonStrikerId) return null;
    return resolveBatterView(
      state.nonStrikerId,
      false,
      players,
      scorecardData?.scorecard,
      innings?.innings ?? 1,
    );
  }, [state?.nonStrikerId, players, scorecardData?.scorecard, innings?.innings]);

  const bowlerStats = useMemo(() => {
    if (!state?.bowlerId) return null;
    return resolveBowlerView(
      state.bowlerId,
      players,
      scorecardData?.scorecard,
      innings?.innings ?? 1,
    );
  }, [state?.bowlerId, players, scorecardData?.scorecard, innings?.innings]);

  // Broadcast Screen Mode State (Canonical cricket_obs_director)
  const [currentOverlay, setCurrentOverlay] = useState<CricketObsMidOverlayKind>("none");
  const [overlayMatchId, setOverlayMatchId] = useState<number | undefined>(undefined);
  const [overlaySponsorName, setOverlaySponsorName] = useState<string | undefined>(undefined);
  const [overlayStageOrGroup, setOverlayStageOrGroup] = useState<string | undefined>(undefined);

  // Initial server state hydration & periodic sync
  const { data: serverDirectorState } = useQuery<{
    overlay?: string;
    matchId?: number;
    sponsorName?: string;
    stageOrGroup?: string;
  }>({
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
    if (serverDirectorState?.overlay) {
      setCurrentOverlay(serverDirectorState.overlay as CricketObsMidOverlayKind);
    }
    if (serverDirectorState?.matchId !== undefined) {
      setOverlayMatchId(serverDirectorState.matchId);
    }
    if (serverDirectorState?.sponsorName !== undefined) {
      setOverlaySponsorName(serverDirectorState.sponsorName);
    }
    if (serverDirectorState?.stageOrGroup !== undefined) {
      setOverlayStageOrGroup(serverDirectorState.stageOrGroup);
    }
  }, [
    serverDirectorState?.overlay,
    serverDirectorState?.matchId,
    serverDirectorState?.sponsorName,
    serverDirectorState?.stageOrGroup,
  ]);

  // Timestamp tracker to prevent stale/out-of-order SSE director events from overwriting newer state
  const lastDirectorTimestampRef = useRef<number>(0);

  // SSE event listener (dispatched from useScoringSocket)
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
        setCurrentOverlay(detail.overlay as CricketObsMidOverlayKind);
      }
      if (detail.matchId !== undefined) {
        setOverlayMatchId(detail.matchId);
      }
      if (detail.sponsorName !== undefined) {
        setOverlaySponsorName(detail.sponsorName);
      }
      setOverlayStageOrGroup((current) => retainStageSelection(current, detail));
    };
    window.addEventListener("cricket_obs_director", handleSseDirector);
    return () => window.removeEventListener("cricket_obs_director", handleSseDirector);
  }, []);

  // BroadcastChannel listener for 0ms cross-tab updates on same browser/machine
  useEffect(() => {
    if (typeof window === "undefined" || typeof BroadcastChannel === "undefined" || !tournamentId) {
      return;
    }
    const channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
    channel.onmessage = (ev) => {
      const data = ev.data;
      if (!data) return;
      if (data.type === "SET_OVERLAY") {
        setCurrentOverlay(data.overlay ?? "none");
        if (data.matchId !== undefined) {
          setOverlayMatchId(data.matchId);
        }
        if (data.sponsorName !== undefined) {
          setOverlaySponsorName(data.sponsorName);
        }
        setOverlayStageOrGroup((current) => retainStageSelection(current, data));
      }
    };
    return () => {
      channel.close();
    };
  }, [tournamentId]);

  // Active event animation state
  const [activeEvent, setActiveEvent] = useState<LedMatchEvent | null>(null);

  // Set of already-seen event tokens to prevent replaying on reconnect / re-render
  const seenEventTokensRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef<boolean>(false);
  const mountTimeRef = useRef<number>(Date.now());

  // Presentation theme paint
  const presentationPaint = match?.branding as PresentationPaintJson | null | undefined;
  const paintTheme = getDisplayThemeFromPresentationPaint(presentationPaint);
  const displayShellStyle = useMemo(() => {
    if (presentationPaint?.source !== "presentation_execution_policy") {
      return shellStyle;
    }
    return {
      ...shellStyle,
      ["--accent" as string]: paintTheme.accentColor,
      ["--background" as string]: paintTheme.bg,
      backgroundColor: paintTheme.bg,
    } as CSSProperties;
  }, [shellStyle, presentationPaint, paintTheme]);

  const home = teams.find((t) => t.id === match?.homeTeamId);
  const away = teams.find((t) => t.id === match?.awayTeamId);
  const battingTeam = teams.find((t) => t.id === innings?.battingTeamId);
  const bowlingTeam = teams.find((t) => t.id === innings?.bowlingTeamId);

  const strikerPlayer = players.find((p) => p.id === state?.strikerId);
  const nonStrikerPlayer = players.find((p) => p.id === state?.nonStrikerId);
  const bowlerPlayer = players.find((p) => p.id === state?.bowlerId);

  const rr = innings ? runRate(innings.runs, innings.over, innings.ball) : null;
  const rrr =
    state && innings && state.target
      ? requiredRate(state.target, innings.runs, state.oversLimit, innings.over, innings.ball)
      : null;

  const isIdle = !match || !state || state.matchStatus === "scheduled";

  const targetRuns = state?.target ?? null;
  const needRuns = targetRuns != null && innings ? Math.max(0, targetRuns - innings.runs) : null;
  const ballsRemaining =
    targetRuns != null && innings && state?.oversLimit
      ? Math.max(0, state.oversLimit * 6 - (innings.over * 6 + innings.ball))
      : null;

  const partnershipRuns =
    state?.currentPartnership?.runs ?? ((strikerStats?.runs ?? 0) + (nonStrikerStats?.runs ?? 0));
  const partnershipBalls =
    state?.currentPartnership?.balls ?? ((strikerStats?.balls ?? 0) + (nonStrikerStats?.balls ?? 0));

  // Score glow pulse trigger on score increment (tight around numbers: white normally, gold on 25/50/75/100 milestones)
  const [scoreGlowType, setScoreGlowType] = useState<"white" | "gold" | null>(null);
  const prevScoreRef = useRef<{ runs: number; wickets: number } | null>(null);

  useEffect(() => {
    const currentRuns = innings?.runs ?? 0;
    const currentWickets = innings?.wickets ?? 0;

    if (prevScoreRef.current !== null) {
      if (
        prevScoreRef.current.runs !== currentRuns ||
        prevScoreRef.current.wickets !== currentWickets
      ) {
        const isMilestone = currentRuns > 0 && currentRuns % 25 === 0;
        setScoreGlowType(isMilestone ? "gold" : "white");
        const timer = setTimeout(() => {
          setScoreGlowType(null);
        }, 1600);
        prevScoreRef.current = { runs: currentRuns, wickets: currentWickets };
        return () => {
          clearTimeout(timer);
        };
      }
    } else {
      prevScoreRef.current = { runs: currentRuns, wickets: currentWickets };
    }
    return undefined;
  }, [innings?.runs, innings?.wickets]);

  // 1. Bootstrap: Record current event as seen on initial mount to suppress historical replay
  useEffect(() => {
    if (!bootstrappedRef.current) {
      if (live?.broadcastEvent?.id) {
        seenEventTokensRef.current.add(live.broadcastEvent.id);
      }
      bootstrappedRef.current = true;
    }
  }, [live?.broadcastEvent?.id]);

  const dispatchAuthoritativeEvent = useCallback(
    (ev: import("@workspace/scoring-core").CricketAuthoritativeBroadcastEvent) => {
      if (!ev || !ev.id) return;
      if (ev.matchId != null && matchId != null && ev.matchId !== matchId) return;
      if (seenEventTokensRef.current.has(ev.id)) return;

      // Suppress stale historical events that occurred prior to hook mount
      if (ev.timestamp && ev.timestamp < mountTimeRef.current - 4000) {
        seenEventTokensRef.current.add(ev.id);
        return;
      }

      seenEventTokensRef.current.add(ev.id);
      if (seenEventTokensRef.current.size > 100) {
        const [first] = seenEventTokensRef.current;
        seenEventTokensRef.current.delete(first);
      }

      if (process.env.NODE_ENV !== "production") {
        console.log(`[SCOREBOARD] Authoritative presentation event=${ev.type} id=${ev.id}`);
      }

      switch (ev.type) {
        case "NEW_BATTER":
          setActiveEvent({
            type: "NEW_BATTER",
            batsmanName: ev.batter || strikerPlayer?.name || "Batter",
            role: ev.detail || "New Batter at Crease",
          });
          break;
        case "NEW_BOWLER":
          setActiveEvent({
            type: "BOWLER_CHANGE",
            bowlerName: ev.bowler || bowlerPlayer?.name || "Bowler",
            figures: ev.detail || "Into the Attack",
          });
          break;
        case "INNINGS_COMPLETE":
          setActiveEvent({
            type: "INNINGS_COMPLETE",
            innings: ev.innings ?? (innings?.innings ?? 1),
            runs: ev.runs ?? (innings?.runs ?? 0),
            wickets: ev.wickets ?? (innings?.wickets ?? 0),
            overs: ev.overs ?? (innings ? oversText(innings.over, innings.ball) : "0.0"),
            target: ev.target,
            battingTeam: ev.battingTeam || battingTeam?.name,
          });
          break;
        case "MATCH_WON":
          setActiveEvent({
            type: "MATCH_RESULT",
            winnerName:
              ev.winnerName ||
              (teams.find((t) => t.id === ev.winnerTeamId)?.name) ||
              "Champions",
            marginText: ev.marginText || ev.detail || "Match Completed",
          });
          break;
        case "WICKET":
          setActiveEvent({
            type: "WICKET",
            dismissal: ev.dismissal || ev.detail || "OUT",
            batsmanName: ev.batter || strikerPlayer?.name || "Batter",
            bowlerName: ev.bowler || bowlerPlayer?.name || "Bowler",
          });
          break;
        case "SIX":
          setActiveEvent({
            type: "SIX",
            runs: 6,
            batsmanName: ev.batter || strikerPlayer?.name,
          });
          break;
        case "FOUR":
          setActiveEvent({
            type: "FOUR",
            runs: 4,
            batsmanName: ev.batter || strikerPlayer?.name,
          });
          break;
        case "SUPERBALL":
          setActiveEvent({
            type: "SUPER_BALL",
            runsOffBat: ev.runs ?? 0,
            totalRuns: ev.totalRuns ?? ((ev.runs ?? 0) * 2),
            batsmanName: ev.batter || strikerPlayer?.name || "Batter",
            battingTeam: ev.battingTeam || battingTeam?.name,
          });
          break;
        case "NO_BALL":
          setActiveEvent({ type: "NO_BALL" });
          break;
        case "WIDE":
          setActiveEvent({ type: "WIDE", runs: ev.runs });
          break;
        default:
          break;
      }
    },
    [matchId, strikerPlayer?.name, bowlerPlayer?.name, innings, battingTeam?.name, teams],
  );

  // 2. Consume live.broadcastEvent from REST/SSE query snapshot
  useEffect(() => {
    if (live?.broadcastEvent) {
      dispatchAuthoritativeEvent(live.broadcastEvent);
    }
  }, [live?.broadcastEvent, dispatchAuthoritativeEvent]);

  // 3. Consume real-time SSE broadcast event via window custom event
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleBroadcastEvent = (ev: Event) => {
      const detail = (ev as CustomEvent).detail as import("@workspace/scoring-core").CricketAuthoritativeBroadcastEvent;
      if (detail) {
        dispatchAuthoritativeEvent(detail);
      }
    };

    window.addEventListener("cricket_scoring_broadcast_event", handleBroadcastEvent);
    return () => {
      window.removeEventListener("cricket_scoring_broadcast_event", handleBroadcastEvent);
    };
  }, [dispatchAuthoritativeEvent]);

  // Sponsor Trail list for footer marquee
  const sponsorTrailItems = useMemo(() => {
    const items: Array<{ name: string; type: string }> = [];

    if (branding?.scoreBoardSponsor && (branding.scoreBoardSponsor.name || branding.scoreBoardSponsor.title)) {
      items.push({
        name: branding.scoreBoardSponsor.name || "Scoreboard Sponsor",
        type: branding.scoreBoardSponsor.title || "Scoreboard Sponsor",
      });
    }

    if (sponsors.length > 0) {
      for (const s of sponsors) {
        const typeText = getSponsorCategoryLabel(s);
        if (!items.some((it) => it.name.toLowerCase() === (s.name || "").toLowerCase())) {
          items.push({
            name: s.name || "Tournament Partner",
            type: typeText,
          });
        }
      }
    }

    if (items.length > 0) {
      return items;
    }

    return [
      { name: tournament?.name || "Cricket Championship", type: "Official Tournament" },
      { name: "BidWar Scoring Engine", type: "Powered By" },
      { name: "Stadium Ground Display", type: "Live Broadcast" },
    ];
  }, [branding?.scoreBoardSponsor, sponsors, tournament?.name]);

  const tournamentTitle = tournament?.name || "LIVE CRICKET TOURNAMENT";
  const titleFontSizeClass = useMemo(() => {
    const len = tournamentTitle.length;
    if (len > 50) return "text-xl sm:text-2xl md:text-3xl lg:text-4xl";
    if (len > 32) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl";
    if (len > 18) return "text-3xl sm:text-4xl md:text-5xl lg:text-6xl";
    return "text-4xl sm:text-5xl md:text-6xl lg:text-7xl";
  }, [tournamentTitle]);

  const isLiveMatch =
    Boolean(match && state && state.matchStatus === "live" && !isComplete);

  const isNeutralActive =
    currentOverlay === "neutral" ||
    (currentOverlay === "none" && !isLiveMatch);

  if (isNeutralActive) {
    return (
      <FullscreenLayout>
        <CricketLedNeutralScreen
          tournamentName={tournament?.name || "Cricket Championship"}
          tournamentLogoUrl={tournament?.logoUrl}
          sponsors={sponsors}
          scoreBoardSponsor={branding?.scoreBoardSponsor}
          connectionStatus={connectionStatus}
          logoSrc={logoSrc}
          logoAlt={logoAlt}
          displayShellStyle={displayShellStyle}
        />

        {/* 4. GROUND LED MID-SCREEN OVERLAYS (Sponsors, Points Table, Fixtures, Scorecard, Summary, Intro) */}
        <CricketLedMidOverlays
          overlay={currentOverlay}
          overlayMatchId={overlayMatchId}
          overlaySponsorName={overlaySponsorName}
          overlayStageOrGroup={overlayStageOrGroup}
          tournamentId={tournamentId}
          tournamentName={tournament?.name}
          tournamentLogoUrl={tournament?.logoUrl}
          match={match}
          state={state}
          summary={summary}
          teams={teams}
          players={players}
          sponsors={sponsors}
          onClose={() => setCurrentOverlay("none")}
        />

        {/* 5. MODULAR LED EVENT ANIMATION OVERLAY */}
        <LedEventAnimationOverlay
          currentEvent={activeEvent}
          onDismiss={() => setActiveEvent(null)}
        />

        {/* 6. SUPER BALL FULL-SCREEN BROADCAST ACTIVATION */}
        {tournamentId > 0 ? (
          <SuperBallActivationOverlay tournamentId={tournamentId} />
        ) : null}
        {tournamentId > 0 ? (
          <SponsorMediaLayer tournamentId={tournamentId} surface="led" cover="fixed" />
        ) : null}
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout className="h-screen max-h-screen overflow-hidden">
      <div
        className="h-screen max-h-screen w-full bg-[#07090e] text-foreground flex flex-col justify-between relative dark overflow-hidden select-none"
        style={displayShellStyle}
      >
        {/* Ambient Stadium Lighting Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-[#07090e] to-[#040507] pointer-events-none" />

        {/* 1. TOP HEADER: Tournament Logo + Name (Left) | BidWar Logo (Center) | Sponsor Showcase (Right) */}
        <header className="relative z-20 min-h-[7.25rem] sm:min-h-[8.5rem] md:min-h-[9.75rem] flex items-center justify-between px-4 sm:px-8 md:px-10 py-3 border-b border-border/60 bg-card/90 backdrop-blur-md shrink-0 gap-4 sm:gap-8">
          {/* Top Left: Tournament Logo + Tournament Name in CAPITAL with generous space reaching towards center */}
          <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0 max-w-[40%] shrink-0">
            {tournament?.logoUrl ? (
              <img
                src={tournament.logoUrl}
                alt={tournament.name || "Tournament Logo"}
                className="h-16 sm:h-20 md:h-24 w-auto max-w-[120px] sm:max-w-[150px] md:max-w-[190px] object-contain drop-shadow-[0_2px_10px_rgba(0,0,0,0.7)] shrink-0"
              />
            ) : (
              <Trophy className="w-12 h-12 sm:w-16 sm:h-16 text-primary drop-shadow-md shrink-0" />
            )}
            <div className="min-w-0 flex-1">
              <h2
                title={tournamentTitle}
                className={cn(
                  "font-display font-black uppercase tracking-wide text-white leading-tight line-clamp-2 drop-shadow-md break-words",
                  titleFontSizeClass,
                )}
              >
                {tournamentTitle}
              </h2>
            </div>
          </div>

          {/* Top Center: Prominent Large BIDWAR Logo */}
          <div className="shrink-0 flex items-center justify-center px-2 sm:px-4">
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={logoAlt || "BidWar"}
                className="h-16 sm:h-20 md:h-24 lg:h-28 w-auto max-w-[280px] sm:max-w-[380px] md:max-w-[480px] lg:max-w-[560px] object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.85)]"
              />
            ) : (
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full bg-primary/20 border border-primary/40">
                <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-[0.18em] text-amber-400 font-display">
                  BIDWAR CRICKET
                </span>
              </div>
            )}
          </div>

          {/* Top Right: Sponsor Showcase + Connection Status (Balanced Fixed Width Anchor) */}
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 max-w-[42%] shrink-0 justify-end">
            <HeaderSponsorShowcase
              sponsors={sponsors}
              scoreBoardSponsor={branding?.scoreBoardSponsor}
            />
            <ConnectionBadge
              status={connectionStatus}
              matchStatus={state?.matchStatus}
            />
          </div>
        </header>

        {/* 2. MAIN SCORING ARENA */}
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-between px-3 sm:px-6 md:px-8 py-2 sm:py-3 gap-2 sm:gap-3 overflow-hidden">
          {isIdle ? (
            <div className="text-center space-y-4 max-w-xl p-8 rounded-3xl bg-card/60 border border-border/80 backdrop-blur-md my-auto">
              <Trophy className="w-14 h-14 text-primary/60 mx-auto animate-pulse" />
              <h2 className="text-4xl sm:text-5xl font-display font-black uppercase tracking-wide text-foreground">
                Match Waiting To Begin
              </h2>
              <p className="text-xl sm:text-2xl font-black text-white/80">
                Waiting for the official toss and scorer to start ball delivery.
              </p>
            </div>
          ) : isComplete && summary ? (
            <div className="w-full max-w-4xl space-y-4 my-auto">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="w-7 h-7 text-primary" />
                <h2 className="text-center text-4xl sm:text-5xl font-display font-black uppercase tracking-widest text-primary">
                  {state?.matchStatus === "walkover" || match?.status === "walkover"
                    ? "Walkover Awarded"
                    : state?.matchStatus === "abandoned" || match?.status === "abandoned"
                    ? "Match Abandoned"
                    : "Match Completed"}
                </h2>
              </div>
              <MatchSummaryCard summary={summary} teams={teams} />
            </div>
          ) : (
            <div className="w-full max-w-7xl flex-1 min-h-0 flex flex-col items-center justify-between gap-2 sm:gap-2.5">
              {/* Unified Match Context & Teams Strip */}
              <div className="w-full min-h-[4.5rem] sm:min-h-[5.25rem] flex items-center justify-between px-4 sm:px-6 py-2 rounded-xl sm:rounded-2xl bg-card/95 border border-border/80 backdrop-blur-md shadow-xl gap-3 sm:gap-5 shrink-0">
                {/* Batting Team Badge */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                  <span className="px-3 py-1.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider shrink-0">
                    BAT
                  </span>
                  <TeamLogoBadge
                    logoUrl={battingTeam?.logoUrl || home?.logoUrl}
                    name={battingTeam?.name || home?.name || "Batting Team"}
                    borderColor="border-emerald-500/40"
                    fallbackIconColor="text-emerald-400"
                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0"
                  />
                  <div className="text-left min-w-0 flex-1">
                    <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-wide text-white leading-tight truncate drop-shadow-sm">
                      {battingTeam?.name || home?.name || "Batting Team"}
                    </h3>
                    <p className="text-xl md:text-2xl lg:text-3xl uppercase tracking-widest text-emerald-300 font-black leading-none mt-1">
                      {battingTeam?.shortCode || home?.shortCode}
                    </p>
                  </div>
                </div>

                {/* Center Match Equation / Free Hit Alert */}
                <div className="flex items-center justify-center text-center px-2 shrink-0">
                  {state?.freeHitActive ? (
                    <div className="px-5 py-2.5 rounded-lg bg-amber-500 text-black border border-yellow-200 font-black text-2xl md:text-3xl lg:text-4xl uppercase tracking-widest flex items-center gap-2 shadow-md animate-pulse">
                      <Flame className="w-5 h-5 sm:w-6 sm:h-6 text-black fill-current animate-bounce" />
                      FREE HIT ACTIVE
                    </div>
                  ) : targetRuns != null ? (
                    <div className="flex items-center gap-3 sm:gap-4 px-4 py-2 rounded-lg bg-card border border-border/80">
                      <div className="text-2xl md:text-3xl font-black uppercase text-amber-300">
                        TARGET: <span className="text-white font-mono text-3xl md:text-4xl font-black ml-1">{targetRuns}</span>
                      </div>
                      <div className="text-2xl md:text-3xl font-black uppercase text-white">
                        NEED <span className="text-amber-300 font-mono text-3xl md:text-4xl font-black">{needRuns}</span> IN <span className="text-amber-300 font-mono text-3xl md:text-4xl font-black">{ballsRemaining}B</span>
                      </div>
                      {rrr && (
                        <div className="text-2xl md:text-3xl font-black uppercase text-amber-200">
                          RRR: <span className="font-mono text-3xl md:text-4xl font-black ml-1">{rrr}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-2 rounded-lg bg-card/80 border border-border/80">
                      <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-widest text-white">
                        1ST INNINGS IN PROGRESS
                      </span>
                    </div>
                  )}
                </div>

                {/* Bowling Team Badge */}
                <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1 text-right justify-end">
                  <div className="text-right min-w-0 flex-1">
                    <h3 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-wide text-white leading-tight truncate drop-shadow-sm">
                      {bowlingTeam?.name || away?.name || "Bowling Team"}
                    </h3>
                    <p className="text-xl md:text-2xl lg:text-3xl uppercase tracking-widest text-amber-300 font-black leading-none mt-1">
                      {bowlingTeam?.shortCode || away?.shortCode}
                    </p>
                  </div>
                  <TeamLogoBadge
                    logoUrl={bowlingTeam?.logoUrl || away?.logoUrl}
                    name={bowlingTeam?.name || away?.name || "Bowling Team"}
                    borderColor="border-amber-500/40"
                    fallbackIconColor="text-amber-400"
                    className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 shrink-0"
                  />
                  <span className="px-3 py-1.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider shrink-0">
                    BOWL
                  </span>
                </div>
              </div>

              {/* HERO SCORING ARENA */}
              <div className="w-full flex-1 min-h-0 p-3 sm:p-4 rounded-2xl sm:rounded-3xl bg-gradient-to-b from-card/95 via-card/85 to-background/90 border-2 border-border/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-between gap-2 overflow-hidden">
                {/* Hero Numerals + Overs Bar */}
                <div className="flex flex-col items-center justify-center my-auto relative">
                  {/* Total Score Numerals with Optical Slash and tight number-focused glow (50% Larger) */}
                  <div
                    className={cn(
                      "text-[clamp(6rem,22vh,15rem)] font-black font-mono tabular-nums tracking-tight leading-none flex items-center justify-center transition-all duration-300 ease-out select-none relative drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)]",
                      scoreGlowType === "gold"
                        ? "text-amber-300 drop-shadow-[0_0_32px_rgba(251,191,36,0.95)] scale-[1.03]"
                        : scoreGlowType === "white"
                        ? "text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.95)] scale-[1.02]"
                        : "text-white",
                    )}
                  >
                    <span>{innings?.runs ?? 0}</span>
                    <span
                      className={cn(
                        "font-light text-[0.7em] mx-3 sm:mx-6 select-none transition-colors duration-300",
                        scoreGlowType === "gold"
                          ? "text-amber-300/80 drop-shadow-[0_0_18px_rgba(251,191,36,0.7)]"
                          : scoreGlowType === "white"
                          ? "text-white/80 drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]"
                          : "text-amber-400/50",
                      )}
                    >
                      /
                    </span>
                    <span>{innings?.wickets ?? 0}</span>
                  </div>

                  {/* Overs, Rates & Partnership Bar (~50% Larger) */}
                  <div className="flex items-center gap-3 sm:gap-5 mt-2 sm:mt-3 flex-wrap justify-center">
                    {/* Overs */}
                    <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-card/95 border-2 border-border shadow-lg flex items-center gap-2.5 sm:gap-3.5">
                      <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-widest text-white">
                        OVERS
                      </span>
                      <span className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-mono font-black text-amber-400">
                        {innings ? oversText(innings.over, innings.ball) : "0.0"}
                        <span className="text-xl sm:text-2xl md:text-3xl text-white/80 font-black ml-1.5">
                          / {state?.oversLimit ?? 0}
                        </span>
                      </span>
                    </div>

                    {/* CRR */}
                    {rr && (
                      <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-card/95 border-2 border-border flex items-center gap-2.5 sm:gap-3.5 shadow-lg">
                        <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-widest text-white">
                          CRR
                        </span>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-black text-white">
                          {rr}
                        </span>
                      </div>
                    )}

                    {/* REQ RR */}
                    {rrr && (
                      <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-card/95 border-2 border-border flex items-center gap-2.5 sm:gap-3.5 shadow-lg">
                        <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-widest text-amber-200">
                          REQ RR
                        </span>
                        <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-black text-amber-400">
                          {rrr}
                        </span>
                      </div>
                    )}

                    {/* Partnership */}
                    <div className="px-4 sm:px-6 py-2 sm:py-2.5 rounded-2xl bg-card/95 border-2 border-border flex items-center gap-2.5 sm:gap-3.5 shadow-lg">
                      <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-widest text-white">
                        PARTNERSHIP
                      </span>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-mono font-black text-white">
                        {partnershipRuns}
                        <span className="text-2xl md:text-3xl lg:text-4xl text-amber-200 font-black ml-2">
                          ({partnershipBalls} {partnershipBalls === 1 ? "ball" : "balls"})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Crease (Both Batters in 1 Line) & Bowler Area */}
                <div className="w-full flex flex-col gap-2.5 my-auto shrink-0">
                  {/* 1. Both Batters in ONE Horizontal Row (Side-by-Side with Large High-Visibility Scores) */}
                  <div className="w-full p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-black/60 border border-border/80 shadow-xl flex flex-col gap-1.5">
                    <div className="flex items-center justify-between pb-1 border-b border-border/40">
                      <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-[0.12em] text-white flex items-center gap-2">
                        🏏 BATTERS AT CREASE
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 sm:gap-4">
                      {/* Striker */}
                      <div className="flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-card/70 border-2 border-emerald-500/50 shadow-md min-w-0">
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                          <PlayerAvatar
                            photoUrl={strikerStats?.photoUrl || strikerPlayer?.photoUrl}
                            name={strikerStats?.name || strikerPlayer?.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl border-2 border-emerald-400 shrink-0 shadow-md"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-emerald-400 font-black text-2xl sm:text-3xl shrink-0 leading-none animate-pulse">*</span>
                              <span
                                className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase text-white tracking-wide truncate leading-tight drop-shadow-md"
                                title={strikerStats?.name || strikerPlayer?.name}
                              >
                                {strikerStats?.name || strikerPlayer?.name || "Striker"}
                              </span>
                            </div>
                            {strikerPlayer?.role && (
                              <p className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider text-emerald-200 ml-4 sm:ml-5 truncate">
                                {strikerPlayer.role}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pr-1 sm:pr-2">
                          {strikerStats?.hasStats ? (
                            <div className="flex items-baseline gap-1 sm:gap-2">
                              <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-mono font-black text-amber-400 leading-none drop-shadow-[0_2px_14px_rgba(245,158,11,0.6)]">
                                {strikerStats.runs}*
                              </span>
                              <span className="text-base sm:text-xl md:text-2xl font-mono font-bold text-white/80">
                                ({strikerStats.balls})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xl sm:text-2xl font-black text-white/80">
                              {strikerPlayer?.role || "Striker"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Non-Striker */}
                      <div className="flex items-center justify-between gap-3 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-card/40 border border-border/80 shadow-md min-w-0">
                        <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                          <PlayerAvatar
                            photoUrl={nonStrikerStats?.photoUrl || nonStrikerPlayer?.photoUrl}
                            name={nonStrikerStats?.name || nonStrikerPlayer?.name}
                            className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl border-2 border-border/80 shrink-0 shadow-md"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1">
                              <span className="text-white/40 font-black text-2xl sm:text-3xl shrink-0 leading-none">·</span>
                              <span
                                className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black uppercase text-white tracking-wide truncate leading-tight drop-shadow-md"
                                title={nonStrikerStats?.name || nonStrikerPlayer?.name}
                              >
                                {nonStrikerStats?.name || nonStrikerPlayer?.name || "Non-Striker"}
                              </span>
                            </div>
                            {nonStrikerPlayer?.role && (
                              <p className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider text-white ml-4 sm:ml-5 truncate">
                                {nonStrikerPlayer.role}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0 pr-1 sm:pr-2">
                          {nonStrikerStats?.hasStats ? (
                            <div className="flex items-baseline gap-1 sm:gap-2">
                              <span className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-mono font-black text-white leading-none drop-shadow-md">
                                {nonStrikerStats.runs}
                              </span>
                              <span className="text-base sm:text-xl md:text-2xl font-mono font-bold text-white/60">
                                ({nonStrikerStats.balls})
                              </span>
                            </div>
                          ) : (
                            <span className="text-xl sm:text-2xl font-black text-white/80">
                              {nonStrikerPlayer?.role || "Non-Striker"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 2. Active Bowler Row (Order: White 'ACTIVE BOWLER' label -> Bowler Photo -> Bowler Name -> Large Bowling Figures) */}
                  <div className="w-full px-2 py-1 flex items-center justify-between gap-3 sm:gap-4 shrink-0">
                    <div className="flex items-center gap-2.5 sm:gap-3.5 min-w-0 flex-1">
                      {/* Active Bowler in crisp white text / badge */}
                      <span className="px-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white font-black text-xl md:text-2xl lg:text-3xl uppercase tracking-wider shrink-0 shadow-sm">
                        ACTIVE BOWLER
                      </span>

                      {/* Bowler Photo */}
                      <PlayerAvatar
                        photoUrl={bowlerStats?.photoUrl || bowlerPlayer?.photoUrl}
                        name={bowlerStats?.name || bowlerPlayer?.name}
                        className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-xl border-2 border-amber-400 shrink-0 shadow-md"
                      />

                      {/* Bowler Name */}
                      <div className="min-w-0 flex-1">
                        <h4
                          className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-black uppercase text-white tracking-wide truncate leading-tight drop-shadow-md"
                          title={bowlerStats?.name || bowlerPlayer?.name}
                        >
                          {bowlerStats?.name || bowlerPlayer?.name || "Current Bowler"}
                        </h4>
                        {bowlerPlayer?.role && (
                          <p className="text-xl md:text-2xl lg:text-3xl font-black uppercase tracking-wider text-amber-200 mt-1 truncate">
                            {bowlerPlayer.role}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Bowler Figures */}
                    <div className="text-right shrink-0 pr-1 sm:pr-2">
                      {bowlerStats?.hasStats ? (
                        <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono font-black text-amber-400 tracking-wider drop-shadow-md">
                          {bowlerStats.overs}-{bowlerStats.maidens}-{bowlerStats.runsConceded}-{bowlerStats.wickets}
                        </div>
                      ) : (
                        <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-mono font-black text-amber-300">
                          BALL {innings?.ball ?? 0} OF 6
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* This Over Deliveries Strip (Centered in Middle & Double Text Size) */}
                <div className="w-full flex flex-col items-center justify-center gap-1.5 pt-2 border-t border-border/40 shrink-0">
                  <span className="text-2xl md:text-3xl lg:text-4xl font-black uppercase tracking-[0.12em] text-white">
                    THIS OVER DELIVERIES
                  </span>
                  <div className="flex items-center justify-center flex-wrap gap-2.5 sm:gap-3.5">
                    {state && state.thisOver.length > 0 ? (
                      state.thisOver.map((b, i) => {
                        const isSix = b.runsOffBat === 6 || b.label === "6";
                        const isFour = b.runsOffBat === 4 || b.label === "4";
                        const isWkt = b.isWicket || b.label.includes("W");
                        const isExtra =
                          b.extrasType != null ||
                          b.label.includes("wd") ||
                          b.label.includes("nb");

                        return (
                          <span
                            key={`${b.over}-${b.ball}-${i}`}
                            className={cn(
                              "inline-flex h-12 min-w-12 sm:h-16 sm:min-w-16 md:h-20 md:min-w-20 px-2 items-center justify-center rounded-2xl text-2xl sm:text-4xl md:text-5xl font-mono font-black border-2 transition-all shadow-lg leading-none",
                              isSix
                                ? "bg-amber-500 text-black border-yellow-200 shadow-[0_0_24px_rgba(245,158,11,0.7)]"
                                : isFour
                                ? "bg-emerald-600 text-white border-emerald-300 shadow-[0_0_24px_rgba(16,185,129,0.6)]"
                                : isWkt
                                ? "bg-red-600 text-white border-red-300 shadow-[0_0_24px_rgba(239,68,68,0.8)] animate-pulse"
                                : isExtra
                                ? "bg-purple-700 text-white border-purple-300"
                                : "bg-card text-foreground border-border/90",
                            )}
                          >
                            {b.label}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xl sm:text-2xl uppercase tracking-widest text-white/80 font-black">
                        Over commencing...
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>

        {/* 3. FOOTER: Full-Width Broadcast Sponsor Marquee */}
        <footer className="relative z-20 h-16 sm:h-20 bg-[#05070a]/95 border-t border-border/70 overflow-hidden flex items-center select-none shadow-2xl shrink-0 w-full backdrop-blur-md">
          {/* Continuous Infinite Marquee Sponsor Trail (Full Width) */}
          <div className="w-full overflow-hidden relative">
            <div className="flex animate-marquee whitespace-nowrap will-change-transform py-2">
              {[0, 1].map((copyIdx) => (
                <div key={copyIdx} className="flex items-center shrink-0 gap-14 pr-14">
                  {sponsorTrailItems.map((item, idx) => (
                    <div key={`${copyIdx}-${idx}`} className="inline-flex items-center gap-3.5">
                      <span className="text-amber-400 font-black text-xl">✦</span>
                      <span className="text-2xl sm:text-3xl md:text-4xl font-black uppercase tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        {item.name}
                        <span className="text-amber-300 font-black text-xl sm:text-2xl md:text-3xl ml-2.5">
                          ({item.type})
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </footer>

        {/* 4. GROUND LED MID-SCREEN OVERLAYS (Sponsors, Points Table, Fixtures, Scorecard, Summary, Intro) */}
        <CricketLedMidOverlays
          overlay={currentOverlay}
          overlayMatchId={overlayMatchId}
          overlaySponsorName={overlaySponsorName}
          overlayStageOrGroup={overlayStageOrGroup}
          tournamentId={tournamentId}
          tournamentName={tournament?.name}
          tournamentLogoUrl={tournament?.logoUrl}
          match={match}
          state={state}
          summary={summary}
          teams={teams}
          players={players}
          sponsors={sponsors}
          onClose={() => setCurrentOverlay("none")}
        />

        {/* 5. MODULAR LED EVENT ANIMATION OVERLAY */}
        <LedEventAnimationOverlay
          currentEvent={activeEvent}
          onDismiss={() => setActiveEvent(null)}
        />

        {/* 6. SUPER BALL FULL-SCREEN BROADCAST ACTIVATION */}
        {tournamentId > 0 ? (
          <SuperBallActivationOverlay tournamentId={tournamentId} />
        ) : null}
        {tournamentId > 0 ? (
          <SponsorMediaLayer tournamentId={tournamentId} surface="led" cover="fixed" />
        ) : null}
      </div>
    </FullscreenLayout>
  );
}

