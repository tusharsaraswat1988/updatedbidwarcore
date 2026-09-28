import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";

function ConnectionBadge({
  status,
  matchStatus,
}: {
  status: "connected" | "reconnecting" | "disconnected";
  matchStatus?: string;
}) {
  if (matchStatus === "paused") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-bold uppercase tracking-wider animate-pulse">
        <Pause className="w-3.5 h-3.5 fill-current" /> Paused
      </span>
    );
  }
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold uppercase tracking-wider">
        <Wifi className="w-3.5 h-3.5" /> Live
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-400 text-xs font-bold uppercase tracking-wider">
        <WifiOff className="w-3.5 h-3.5" /> Offline
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-bold uppercase tracking-wider">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Syncing
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
        "flex items-center gap-2.5 w-44 sm:w-48 md:w-52 h-18 transition-opacity duration-300 ease-in-out shrink-0",
        isFading ? "opacity-0" : "opacity-100",
      )}
    >
      {current.url ? (
        <div className="h-12 w-12 sm:h-14 sm:w-14 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <img
            src={current.url}
            alt={current.name || "Sponsor"}
            className="max-h-full max-w-full object-contain filter drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]"
          />
        </div>
      ) : (
        <div className="h-10 w-10 flex items-center justify-center shrink-0">
          <Award className="w-6 h-6 text-amber-400 drop-shadow" />
        </div>
      )}
      <div className="flex flex-col justify-center min-w-0 flex-1 overflow-hidden">
        <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-white truncate leading-tight drop-shadow">
          {current.name || "Tournament Sponsor"}
        </span>
        <span className="text-[10px] sm:text-xs font-bold uppercase tracking-wider text-amber-400 truncate mt-0.5">
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
      if (detail.stageOrGroup !== undefined) {
        setOverlayStageOrGroup(detail.stageOrGroup);
      }
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
        if (data.stageOrGroup !== undefined) {
          setOverlayStageOrGroup(data.stageOrGroup);
        }
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
    if (len > 55) return "text-sm sm:text-base md:text-lg lg:text-xl";
    if (len > 40) return "text-base sm:text-lg md:text-xl lg:text-2xl";
    if (len > 25) return "text-lg sm:text-xl md:text-2xl lg:text-[1.85rem]";
    return "text-xl sm:text-2xl md:text-3xl lg:text-4xl";
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
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout>
      <div
        className="min-h-screen bg-[#07090e] text-foreground flex flex-col relative dark overflow-hidden select-none"
        style={displayShellStyle}
      >
        {/* Ambient Stadium Lighting Gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-500/15 via-[#07090e] to-[#040507] pointer-events-none" />

        {/* 1. TOP HEADER: Tournament Logo (Left) | BidWar + Title (Center) | Sponsor Showcase (Right) */}
        <header className="relative z-20 h-24 flex items-center justify-between px-4 sm:px-6 md:px-8 border-b border-border/60 bg-card/90 backdrop-blur-md shrink-0">
          {/* Top Left: Tournament Logo (Balanced Fixed Width Anchor) */}
          <div className="flex items-center gap-3 w-56 sm:w-64 md:w-72 shrink-0">
            {tournament?.logoUrl ? (
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl bg-card border-2 border-border p-1.5 flex items-center justify-center overflow-hidden shadow-lg shadow-black/50">
                <img
                  src={tournament.logoUrl}
                  alt={tournament.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-18 md:h-18 rounded-2xl bg-gradient-to-br from-card via-card/80 to-background border-2 border-primary/40 flex flex-col items-center justify-center shadow-lg shadow-black/50">
                <Trophy className="w-7 h-7 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest text-primary/80 mt-1">
                  TOURNEY
                </span>
              </div>
            )}
          </div>

          {/* Top Center: BIDWAR Broadcast Platform Brand + Dynamic Auto-Fitting Tournament Name */}
          <div className="flex-1 flex flex-col items-center justify-center px-2 sm:px-4 max-w-5xl text-center min-w-0 pt-1.5 pb-1">
            <div className="flex items-center justify-center mb-1.5">
              {logoSrc ? (
                <img
                  src={logoSrc}
                  alt={logoAlt || "BidWar"}
                  className="h-7 sm:h-8 md:h-8.5 w-auto object-contain drop-shadow-md"
                />
              ) : (
                <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-primary/20 border border-primary/40">
                  <span className="text-xs sm:text-sm font-black uppercase tracking-[0.25em] text-amber-400 font-display">
                    BIDWAR CRICKET BROADCAST
                  </span>
                </div>
              )}
            </div>
            <h1
              title={tournamentTitle}
              className={cn(
                "w-full font-display font-black uppercase tracking-wider text-white text-center leading-tight mt-0.5 drop-shadow-[0_2px_14px_rgba(0,0,0,0.95)] line-clamp-1 break-words",
                titleFontSizeClass,
              )}
            >
              {tournamentTitle}
            </h1>
          </div>

          {/* Top Right: Sponsor Showcase + Connection Status (Balanced Fixed Width Anchor) */}
          <div className="flex items-center gap-2 sm:gap-3 w-56 sm:w-64 md:w-72 shrink-0 justify-end">
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
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-between px-4 sm:px-8 py-3 sm:py-4 gap-3 sm:gap-4 overflow-hidden">
          {isIdle ? (
            <div className="text-center space-y-4 max-w-xl p-10 rounded-3xl bg-card/60 border border-border/80 backdrop-blur-md my-auto">
              <Trophy className="w-16 h-16 text-primary/60 mx-auto animate-pulse" />
              <h2 className="text-3xl font-display font-black uppercase tracking-wide text-foreground">
                Match Waiting To Begin
              </h2>
              <p className="text-base text-muted-foreground">
                Waiting for the official toss and scorer to start ball delivery.
              </p>
            </div>
          ) : isComplete && summary ? (
            <div className="w-full max-w-4xl space-y-6 my-auto">
              <div className="flex items-center justify-center gap-3">
                <Trophy className="w-8 h-8 text-primary" />
                <h2 className="text-center text-3xl font-display font-black uppercase tracking-widest text-primary">
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
            <div className="w-full max-w-7xl flex-1 min-h-0 flex flex-col items-center justify-between gap-3 sm:gap-4">
              {/* Unified Match Context & Teams Strip (h-[76px]) */}
              <div className="w-full min-h-[72px] max-h-[80px] flex items-center justify-between px-6 py-2.5 rounded-2xl bg-card/90 border border-border/80 backdrop-blur-md shadow-xl gap-4 shrink-0">
                {/* Batting Team Badge */}
                <div className="flex items-center gap-3 min-w-0">
                  <span className="px-3 py-1 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs sm:text-sm font-black uppercase tracking-widest animate-pulse">
                    BAT
                  </span>
                  <div className="text-left min-w-0">
                    <h3 className="text-lg sm:text-2xl font-black uppercase tracking-wider text-white truncate">
                      {battingTeam?.name || home?.name || "Batting Team"}
                    </h3>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                      {battingTeam?.shortCode || home?.shortCode}
                    </p>
                  </div>
                </div>

                {/* Center Match Equation / Free Hit Alert */}
                <div className="flex items-center justify-center text-center px-2">
                  {state?.freeHitActive ? (
                    <div className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-indigo-600 border-2 border-fuchsia-300 text-white flex items-center gap-2 shadow-[0_0_25px_rgba(192,38,211,0.6)] animate-pulse">
                      <Flame className="w-4 h-4 text-yellow-300 animate-bounce" />
                      <span className="text-xs sm:text-sm font-black uppercase tracking-[0.2em]">
                        ⚡ FREE HIT ACTIVE ⚡
                      </span>
                    </div>
                  ) : targetRuns != null ? (
                    <div className="flex items-center gap-3 sm:gap-5 px-4 py-1.5 rounded-xl bg-primary/15 border border-primary/30">
                      <div className="text-xs sm:text-sm font-black uppercase text-primary/90">
                        TARGET: <span className="text-white font-mono text-base sm:text-lg font-black ml-0.5">{targetRuns}</span>
                      </div>
                      <div className="text-xs sm:text-sm font-black uppercase text-white">
                        NEED <span className="text-primary font-mono text-base sm:text-lg font-black">{needRuns}</span> IN <span className="text-primary font-mono text-base sm:text-lg font-black">{ballsRemaining}B</span>
                      </div>
                      {rrr && (
                        <div className="text-xs sm:text-sm font-black uppercase text-amber-300 hidden sm:block">
                          RRR: <span className="font-mono text-base sm:text-lg font-black ml-0.5">{rrr}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="px-4 py-1.5 rounded-xl bg-black/40 border border-border/60">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-muted-foreground">
                        1ST INNINGS IN PROGRESS
                      </span>
                    </div>
                  )}
                </div>

                {/* Bowling Team Badge */}
                <div className="flex items-center gap-3 min-w-0 text-right justify-end">
                  <div className="text-right min-w-0">
                    <h3 className="text-lg sm:text-2xl font-black uppercase tracking-wider text-white truncate">
                      {bowlingTeam?.name || away?.name || "Bowling Team"}
                    </h3>
                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-semibold">
                      {bowlingTeam?.shortCode || away?.shortCode}
                    </p>
                  </div>
                  <span className="px-3 py-1 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest">
                    BOWL
                  </span>
                </div>
              </div>

              {/* HERO SCORING ARENA */}
              <div className="w-full flex-1 min-h-0 p-4 sm:p-6 rounded-3xl bg-gradient-to-b from-card/95 via-card/85 to-background/90 border-2 border-border/80 backdrop-blur-md shadow-2xl flex flex-col items-center justify-between gap-3">
                {/* Hero Numerals + Overs Bar */}
                <div className="flex flex-col items-center justify-center my-auto">
                  {/* Total Score Numerals with Optical Slash */}
                  <div className="text-7xl sm:text-8xl md:text-9xl lg:text-[10.5rem] font-black font-mono tabular-nums tracking-tight text-white leading-none drop-shadow-[0_10px_35px_rgba(0,0,0,0.95)] flex items-center justify-center">
                    <span>{innings?.runs ?? 0}</span>
                    <span className="text-amber-400/50 font-light text-[0.75em] mx-2 sm:mx-3 select-none">
                      /
                    </span>
                    <span>{innings?.wickets ?? 0}</span>
                  </div>

                  {/* Overs & Rates Bar */}
                  <div className="flex items-center gap-3 sm:gap-5 mt-2 flex-wrap justify-center">
                    <div className="px-5 py-1.5 rounded-xl bg-amber-500/15 border-2 border-amber-500/40 shadow-lg flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300/80">
                        OVERS
                      </span>
                      <span className="text-2xl sm:text-3xl font-mono font-black text-amber-400">
                        {innings ? oversText(innings.over, innings.ball) : "0.0"}
                        <span className="text-base sm:text-lg text-muted-foreground font-normal ml-1.5">
                          / {state?.oversLimit ?? 0}
                        </span>
                      </span>
                    </div>

                    {rr && (
                      <div className="px-4 py-1.5 rounded-xl bg-card border border-border flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-muted-foreground">
                          CRR
                        </span>
                        <span className="text-xl sm:text-2xl font-mono font-black text-white">
                          {rr}
                        </span>
                      </div>
                    )}

                    {rrr && (
                      <div className="px-4 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-300/80">
                          REQ RR
                        </span>
                        <span className="text-xl sm:text-2xl font-mono font-black text-amber-300">
                          {rrr}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Crease Cards: Live Batters & Bowler Figures */}
                <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4 my-auto">
                  {/* Batters Card */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-black/45 border border-border/80 flex flex-col justify-between gap-2 shadow-lg">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
                        🏏 Batters at Crease
                      </span>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground">
                        R (B) · 4s/6s · SR
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {/* Striker */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-emerald-400 font-black text-lg sm:text-xl">*</span>
                          <span className="text-base sm:text-xl md:text-2xl font-black uppercase text-white tracking-wide truncate max-w-[200px] sm:max-w-[280px]">
                            {strikerStats?.name || strikerPlayer?.name || "Striker"}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          {strikerStats?.hasStats ? (
                            <>
                              <span className="text-lg sm:text-2xl font-mono font-black text-amber-300">
                                {strikerStats.runs}* ({strikerStats.balls})
                              </span>
                              <span className="text-xs sm:text-sm font-mono text-muted-foreground ml-2 hidden sm:inline-block">
                                {strikerStats.fours}x4 · {strikerStats.sixes}x6 · SR {strikerStats.strikeRate.toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground/70 italic">
                              {strikerPlayer?.role || "Striker"}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Non-Striker */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-muted-foreground/50 font-black text-lg sm:text-xl">·</span>
                          <span className="text-base sm:text-xl md:text-2xl font-bold uppercase text-white/90 tracking-wide truncate max-w-[200px] sm:max-w-[280px]">
                            {nonStrikerStats?.name || nonStrikerPlayer?.name || "Non-Striker"}
                          </span>
                        </div>
                        <div className="text-right shrink-0">
                          {nonStrikerStats?.hasStats ? (
                            <>
                              <span className="text-lg sm:text-2xl font-mono font-bold text-white/90">
                                {nonStrikerStats.runs} ({nonStrikerStats.balls})
                              </span>
                              <span className="text-xs sm:text-sm font-mono text-muted-foreground ml-2 hidden sm:inline-block">
                                {nonStrikerStats.fours}x4 · {nonStrikerStats.sixes}x6 · SR {nonStrikerStats.strikeRate.toFixed(1)}
                              </span>
                            </>
                          ) : (
                            <span className="text-xs sm:text-sm font-medium text-muted-foreground/70 italic">
                              {nonStrikerPlayer?.role || "Non-Striker"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Bowler Card */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-black/45 border border-border/80 flex flex-col justify-between gap-2 shadow-lg">
                    <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
                      <span className="text-xs sm:text-sm font-black uppercase tracking-widest text-amber-400 flex items-center gap-1.5">
                        🎯 Active Bowler
                      </span>
                      <span className="text-[11px] uppercase font-bold text-muted-foreground">
                        O-M-R-W · ECON
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="text-base sm:text-xl md:text-2xl font-black uppercase text-white tracking-wide truncate max-w-[200px] sm:max-w-[280px]">
                          {bowlerStats?.name || bowlerPlayer?.name || "Current Bowler"}
                        </h4>
                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold truncate">
                          {bowlerPlayer?.role || "Right-Arm Pace"}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {bowlerStats?.hasStats ? (
                          <>
                            <div className="text-lg sm:text-2xl font-mono font-black text-amber-300">
                              {bowlerStats.overs}-{bowlerStats.maidens}-{bowlerStats.runsConceded}-{bowlerStats.wickets}
                            </div>
                            <div className="text-xs sm:text-sm font-mono text-muted-foreground">
                              Econ {bowlerStats.economy.toFixed(2)} · Ball {innings?.ball ?? 0}/6
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-sm sm:text-base font-mono font-bold text-amber-300/80">
                              Ball {innings?.ball ?? 0} of 6
                            </div>
                            <div className="text-xs font-mono text-muted-foreground">
                              {bowlerPlayer?.role || "Active Bowler"}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* This Over Deliveries Strip */}
                <div className="w-full flex flex-col items-center gap-1.5 pt-2 border-t border-border/50 shrink-0">
                  <span className="text-xs font-black uppercase tracking-[0.25em] text-muted-foreground">
                    This Over Deliveries
                  </span>
                  <div className="flex items-center justify-center flex-wrap gap-2.5 min-h-[48px]">
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
                              "inline-flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl text-lg sm:text-xl font-mono font-black border-2 transition-all shadow-md",
                              isSix
                                ? "bg-amber-500 text-black border-yellow-200 shadow-[0_0_20px_rgba(245,158,11,0.6)]"
                                : isFour
                                ? "bg-emerald-600 text-white border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)]"
                                : isWkt
                                ? "bg-red-600 text-white border-red-300 shadow-[0_0_20px_rgba(239,68,68,0.7)] animate-pulse"
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
                      <span className="text-xs uppercase tracking-widest text-muted-foreground/60 italic font-semibold">
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
        <footer className="relative z-20 h-20 sm:h-24 bg-[#05070a]/95 border-t border-border/70 overflow-hidden flex items-center select-none shadow-2xl shrink-0 w-full backdrop-blur-md">
          {/* Continuous Infinite Marquee Sponsor Trail (Full Width) */}
          <div className="w-full overflow-hidden relative">
            <div className="flex animate-marquee whitespace-nowrap will-change-transform py-2">
              {[0, 1].map((copyIdx) => (
                <div key={copyIdx} className="flex items-center shrink-0 gap-14 pr-14">
                  {sponsorTrailItems.map((item, idx) => (
                    <div key={`${copyIdx}-${idx}`} className="inline-flex items-center gap-3.5">
                      <span className="text-amber-400 font-black text-xl">✦</span>
                      <span className="text-xl sm:text-2xl md:text-3xl font-black uppercase tracking-wider text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                        {item.name}
                        <span className="text-amber-400 font-bold text-lg sm:text-xl md:text-2xl ml-2.5">
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
      </div>
    </FullscreenLayout>
  );
}

