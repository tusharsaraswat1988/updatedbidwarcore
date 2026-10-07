/**
 * Match Day Live Control Console — Single-screen operator deck for live broadcast & display.
 * Controls what is shown on LED scoreboards and OBS Live Stream.
 * Route: /tournament/:id/score/live-control
 */
import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  PageHeader,
  btnCompactClass,
} from "@/components/scoring/cricket-page-chrome";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatches, useScoringMatch, useScoringLive } from "@/hooks/use-scoring-match";
import { useScoringSocket } from "@/hooks/use-scoring-socket";
import {
  getCricketMasterTeams,
  getCricketTournamentRoster,
  getScoringStandings,
  isTerminalCricketMatchStatus,
} from "@/lib/scoring-api";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
} from "@/lib/scoring-squad";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { CricketObsBroadcastMessageControl } from "@/components/scoring/cricket-obs/cricket-obs-broadcast-message-control";
import {
  cricketMatchCenterPath,
  cricketScoreHubPath,
  cricketScorerConsolePath,
} from "@/lib/cricket-routes";
import {
  cricketMatchPublicPath,
  cricketObsLivePath,
  cricketObsV2Path,
  cricketObsV2PreviewPath,
  cricketPublicPath,
  openCricketObsV2,
  openCricketObsV2Preview,
  openScoreDisplay,
  scoreDisplayPath,
} from "@/lib/tournament-navigation";
import type { CricketObsFlashKind, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import {
  Copy,
  Monitor,
  Radio,
  RefreshCw,
  Tv,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Eye,
  Info,
  Sparkles,
  Layers,
  Flame,
  ShieldAlert,
  RotateCcw,
  Zap,
  Handshake,
  Table,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OVERLAY_OPTIONS: { 
  id: CricketObsMidOverlayKind; 
  label: string; 
  desc: string; 
  activatesOn: string;
  icon: string; 
  tag: string; 
  defaultDurationSec?: number; 
}[] = [
  { 
    id: "none", 
    label: "Camera Feed Only", 
    desc: "Live stream camera feed with lower transparent scorebug", 
    activatesOn: "OBS Live Stream + Scorebug",
    icon: "🎥", 
    tag: "LIVE STREAM" 
  },
  { 
    id: "neutral", 
    label: "Neutral Screen", 
    desc: "Standby graphic plate between matches and innings", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "⏸️", 
    tag: "INTERVAL" 
  },
  { 
    id: "banner", 
    label: "Tournament Banner", 
    desc: "100% full-screen zero-margin branding banner", 
    activatesOn: "LED Scoreboard ONLY",
    icon: "🖼️", 
    tag: "BANNER" 
  },
  { 
    id: "sponsors", 
    label: "Sponsor Showcase", 
    desc: "Sponsor brand ads (auto-loop all or single spotlight)", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "★", 
    tag: "COMMERCIAL" 
  },
  { 
    id: "standings", 
    label: "Points Table", 
    desc: "Points table, stage rankings & group standings board", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "📊", 
    tag: "STANDINGS" 
  },
  { 
    id: "fixtures", 
    label: "Upcoming Matches", 
    desc: "Upcoming match schedule & next fixtures card", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "📅", 
    tag: "SCHEDULE", 
    defaultDurationSec: 10 
  },
  { 
    id: "scorecard", 
    label: "Full Scorecard", 
    desc: "Complete innings batting, bowling & fall of wickets card", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "📋", 
    tag: "SCORECARD", 
    defaultDurationSec: 15 
  },
  { 
    id: "summary", 
    label: "Match Summary", 
    desc: "Post-match result summary & top performers spotlight", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "🏆", 
    tag: "RESULT", 
    defaultDurationSec: 15 
  },
  { 
    id: "intro", 
    label: "Match Intro / VS", 
    desc: "Pre-match 3D team badges build-up & match details card", 
    activatesOn: "LED Scoreboard & OBS",
    icon: "⚔️", 
    tag: "PRE-MATCH", 
    defaultDurationSec: 10 
  },
];

const ANIMATION_OPTIONS: { flash: CricketObsFlashKind; label: string; color: string; desc: string }[] = [
  { flash: "FOUR", label: "⚡ Four (Boundary)", color: "bg-blue-600 hover:bg-blue-500 text-white", desc: "Boundary 4 burst" },
  { flash: "SIX", label: "💥 Six (Maximum)", color: "bg-purple-600 hover:bg-purple-500 text-white", desc: "Maximum 6 burst" },
  { flash: "SUPERBALL", label: "🔥 Superball", color: "bg-orange-600 hover:bg-orange-500 text-white", desc: "2x Run Superball burst" },
  { flash: "WICKET", label: "🚨 Wicket (Out)", color: "bg-red-600 hover:bg-red-500 text-white", desc: "Wicket fall graphic" },
  { flash: "FREE_HIT", label: "🎯 Free Hit", color: "bg-cyan-600 hover:bg-cyan-500 text-white", desc: "Free hit indicator" },
  { flash: "NO_BALL", label: "⚠️ No Ball", color: "bg-amber-600 hover:bg-amber-500 text-white", desc: "No ball siren" },
  { flash: "WIDE", label: "↔️ Wide", color: "bg-slate-700 hover:bg-slate-600 text-white", desc: "Wide ball signal" },
  { flash: "NEW_BATSMAN", label: "🏏 New Batsman", color: "bg-emerald-600 hover:bg-emerald-500 text-white", desc: "New player entry card" },
  { flash: "TOSS_WIN", label: "🪙 Toss Win", color: "bg-yellow-700 hover:bg-yellow-600 text-white", desc: "Toss result banner" },
  { flash: "MATCH_WON", label: "🏆 Match Won (Victory)", color: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-black", desc: "Champions victory fanfare" },
];

export default function CricketLiveControlPage() {
  const [, params] = useRoute("/tournament/:id/score/live-control");
  const tournamentId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { connectionStatus } = useScoringSocket(tournamentId, scoringActive);
  const { data: liveData } = useScoringLive(tournamentId, scoringActive, connectionStatus);

  const { data: matches, isLoading, isFetching, refetch } = useScoringMatches(
    tournamentId,
    scoringActive,
  );

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const { data: roster } = useQuery({
    queryKey: ["cricket-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const players = useMemo(
    () => (roster ?? []).map(cricketRosterToScorerPlayer),
    [roster],
  );
  const playerMap = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);

  // Active match selection
  const liveMatches = useMemo(
    () => (matches ?? []).filter((m) => m.status === "live"),
    [matches],
  );
  const [selectedMatchId, setSelectedMatchId] = useState<number | null>(null);

  const currentMatch = useMemo(() => {
    if (!matches || matches.length === 0) return null;
    if (selectedMatchId) {
      const found = matches.find((m) => m.id === selectedMatchId);
      if (found) return found;
    }
    return liveMatches[0] ?? matches[0] ?? null;
  }, [matches, selectedMatchId, liveMatches]);

  const { data: currentMatchDetail } = useScoringMatch(
    tournamentId,
    currentMatch?.id ?? 0,
    scoringActive && !!currentMatch?.id,
  );

  // Tournament Sponsors
  const sponsors = useMemo(
    () => parseTournamentSponsors(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  // Standings & Groups query
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: scoringActive && !!tournamentId,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });

  const tournamentGroups = useMemo(() => standings?.groups ?? [], [standings?.groups]);

  // Tournament Knockout Stages / Distinct Rounds (e.g. Quarter-Final, Semi-Final, Final)
  const tournamentStages = useMemo(() => {
    if (!matches) return [];
    const set = new Set<string>();
    for (const m of matches) {
      if (m.roundName && m.roundName.trim()) {
        set.add(m.roundName.trim());
      }
    }
    return Array.from(set);
  }, [matches]);

  // OBS & LED live control state
  const [currentOverlay, setCurrentOverlay] = useState<CricketObsMidOverlayKind>("none");
  const [overlayMatchId, setOverlayMatchId] = useState<number | undefined>(undefined);
  const [overlaySponsorName, setOverlaySponsorName] = useState<string | undefined>(undefined);
  const [overlayStageOrGroup, setOverlayStageOrGroup] = useState<string | undefined>(undefined);

  const [lastTriggeredFlash, setLastTriggeredFlash] = useState<string | null>(null);
  const [animationsModalOpen, setAnimationsModalOpen] = useState(false);
  const [helpInfoOpen, setHelpInfoOpen] = useState(false);
  const [matchSelectModalOpen, setMatchSelectModalOpen] = useState(false);
  const [sponsorSelectModalOpen, setSponsorSelectModalOpen] = useState(false);
  const [standingsSelectModalOpen, setStandingsSelectModalOpen] = useState(false);

  const [targetOverlayForMatch, setTargetOverlayForMatch] = useState<{ id: CricketObsMidOverlayKind; label: string; icon?: string } | null>(null);
  const [matchFilterStatus, setMatchFilterStatus] = useState<"all" | "live" | "upcoming" | "completed">("all");

  const upcomingMatches = useMemo(
    () => (matches ?? []).filter((m) => m.status === "upcoming" || m.status === "scheduled"),
    [matches],
  );
  const completedMatches = useMemo(
    () => (matches ?? []).filter((m) => m.status === "completed"),
    [matches],
  );

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    if (matchFilterStatus === "live") return liveMatches;
    if (matchFilterStatus === "upcoming") return upcomingMatches;
    if (matchFilterStatus === "completed") return completedMatches;
    return matches;
  }, [matches, matchFilterStatus, liveMatches, upcomingMatches, completedMatches]);

  // Sync active overlay state with server
  const { data: serverState } = useQuery<{
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
    if (serverState?.overlay) {
      setCurrentOverlay(serverState.overlay as CricketObsMidOverlayKind);
    }
    if (serverState?.matchId !== undefined) {
      setOverlayMatchId(serverState.matchId);
    }
    if (serverState?.sponsorName !== undefined) {
      setOverlaySponsorName(serverState.sponsorName);
    }
    if (serverState?.stageOrGroup !== undefined) {
      setOverlayStageOrGroup(serverState.stageOrGroup);
    }
  }, [
    serverState?.overlay,
    serverState?.matchId,
    serverState?.sponsorName,
    serverState?.stageOrGroup,
  ]);

  const broadcastCommand = useCallback(
    (message: {
      type: string;
      overlay?: CricketObsMidOverlayKind;
      matchId?: number;
      sponsorName?: string;
      stageOrGroup?: string;
      flash?: CricketObsFlashKind;
      detail?: string;
    }) => {
      if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
      try {
        const v2Chan = new BroadcastChannel(`bidwar_v2_${tournamentId}`);
        v2Chan.postMessage(message);
        v2Chan.close();
      } catch (err) {
        console.error("Failed to broadcast to V2 channel:", err);
      }
      try {
        const channel = new BroadcastChannel(`bidwar_cricket_obs_${tournamentId}`);
        channel.postMessage(message);
        channel.close();
      } catch (err) {
        console.error("Failed to broadcast to OBS channel:", err);
      }
    },
    [tournamentId],
  );

  const [autoCloseSecondsRemaining, setAutoCloseSecondsRemaining] = useState<number | null>(null);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const autoCloseIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const clearAutoCloseTimers = useCallback(() => {
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    if (autoCloseIntervalRef.current) {
      clearInterval(autoCloseIntervalRef.current);
      autoCloseIntervalRef.current = null;
    }
    setAutoCloseSecondsRemaining(null);
  }, []);

  const handleSetOverlay = useCallback(
    async (
      overlay: CricketObsMidOverlayKind,
      label: string,
      matchId?: number,
      sponsorName?: string,
      stageOrGroup?: string,
    ) => {
      setCurrentOverlay(overlay);
      setOverlayMatchId(matchId);
      setOverlaySponsorName(sponsorName);
      setOverlayStageOrGroup(stageOrGroup);

      clearAutoCloseTimers();

      // Calculate exact dynamic duration based on selection mode
      let dur: number | undefined = undefined;
      if (overlay === "none" || overlay === "neutral" || overlay === "banner") {
        dur = undefined;
      } else if (overlay === "intro") {
        dur = 10;
      } else if (overlay === "fixtures") {
        dur = 10;
      } else if (overlay === "summary") {
        dur = 15;
      } else if (overlay === "scorecard") {
        dur = 15;
      } else if (overlay === "sponsors") {
        if (!sponsorName || sponsorName === "all") {
          // All sponsors: show every sponsor for 5s, then close after full rotation
          const sponsorCount = Math.max(1, sponsors.length);
          dur = Math.max(15, sponsorCount * 5);
        } else {
          dur = 10;
        }
      } else if (overlay === "standings") {
        if (!stageOrGroup || stageOrGroup === "all") {
          // Standings paginates every 8s (up to 12 teams/page)
          const totalTeams = teams.length || standings?.groups?.reduce((acc, g) => acc + (g.rows?.length || 0), 0) || 8;
          const pages = Math.max(1, Math.ceil(totalTeams / 12));
          dur = Math.max(15, pages * 8);
        } else {
          dur = 15;
        }
      }

      if (dur && dur > 0) {
        setAutoCloseSecondsRemaining(dur);

        autoCloseIntervalRef.current = setInterval(() => {
          setAutoCloseSecondsRemaining((prev) => {
            if (prev === null || prev <= 1) return 0;
            return prev - 1;
          });
        }, 1000);

        autoCloseTimerRef.current = setTimeout(() => {
          clearAutoCloseTimers();
          setCurrentOverlay("none");
          try {
            void fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ overlay: "none" }),
            });
          } catch {}
          broadcastCommand({ type: "SET_OVERLAY", overlay: "none" });
          toast({
            title: "Screen Returned to Camera",
            description: `${label} cycle completed (${dur}s) & automatically returned to Camera View.`,
          });
        }, dur * 1000);
      }

      try {
        await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overlay, matchId, sponsorName, stageOrGroup }),
        });
      } catch (err) {
        console.error("Failed to send OBS director overlay to server:", err);
      }

      broadcastCommand({ type: "SET_OVERLAY", overlay, matchId, sponsorName, stageOrGroup });

      const extraText = sponsorName
        ? ` (${sponsorName})`
        : stageOrGroup
        ? ` (${stageOrGroup})`
        : matchId
        ? ` (Match #${matchId})`
        : "";

      toast({
        title: `Screen Mode: ${label}`,
        description:
          overlay === "none"
            ? "Camera feed active. Overlays hidden."
            : `Pushed ${label}${extraText} to live displays.${dur ? ` (Auto-closes in ${dur}s)` : ""}`,
      });
    },
    [tournamentId, broadcastCommand, toast, clearAutoCloseTimers],
  );

  useEffect(() => {
    return () => {
      clearAutoCloseTimers();
    };
  }, [clearAutoCloseTimers]);

  const handleOverlayButtonClick = (item: typeof OVERLAY_OPTIONS[0]) => {
    if (item.id === "none") {
      void handleSetOverlay("none", item.label);
      return;
    }
    if (item.id === "neutral") {
      void handleSetOverlay("neutral", item.label);
      return;
    }
    if (item.id === "banner") {
      void handleSetOverlay("banner", item.label);
      return;
    }
    if (item.id === "sponsors") {
      setSponsorSelectModalOpen(true);
      return;
    }
    if (item.id === "standings") {
      setStandingsSelectModalOpen(true);
      return;
    }
    // Match-dependent overlays: open match selection dialog
    setTargetOverlayForMatch(item);
    setMatchSelectModalOpen(true);
  };

  const handleTriggerFlash = useCallback(
    async (flash: CricketObsFlashKind, label: string) => {
      setLastTriggeredFlash(label);

      try {
        await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flash }),
        });
      } catch (err) {
        console.error("Failed to send flash trigger to server:", err);
      }

      broadcastCommand({ type: "TRIGGER_FLASH", flash });

      toast({
        title: `Triggered: ${label}`,
        description: "Sent on-screen graphic burst to OBS & LED displays.",
      });

      setTimeout(() => {
        setLastTriggeredFlash(null);
      }, 3500);
    },
    [tournamentId, broadcastCommand, toast],
  );

  // Link URLs
  const ledDisplayUrl = scoreDisplayPath(tournamentId, tournament?.auctionCode);
  const obsStreamUrl = cricketObsLivePath(tournamentId, tournament?.auctionCode);
  const obsV2Url = cricketObsV2Path(tournamentId);
  const obsV2PreviewUrl = cricketObsV2PreviewPath(tournamentId);
  const publicFanUrl = currentMatch
    ? cricketMatchPublicPath(tournamentId, currentMatch.id)
    : cricketPublicPath(tournamentId);

  const obsFullUrl =
    typeof window !== "undefined"
      ? scoringAppPublicUrl(window.location.origin, obsStreamUrl)
      : obsStreamUrl;

  const obsV2FullUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}${obsV2Url}`
      : obsV2Url;

  const [copiedV2, setCopiedV2] = useState(false);

  function handleCopyObsV2() {
    copyTextToClipboard(obsV2Url, "OBS V2 Broadcast Overlay Link");
    setCopiedV2(true);
    setTimeout(() => setCopiedV2(false), 2000);
  }

  function copyTextToClipboard(text: string, label: string) {
    const fullUrl =
      typeof window !== "undefined" && text.startsWith("/")
        ? `${window.location.origin}${text}`
        : text;
    void navigator.clipboard.writeText(fullUrl).then(
      () => toast({ title: `${label} copied to clipboard!` }),
      () => toast({ title: "Could not copy link", variant: "destructive" }),
    );
  }

  function teamLabel(id: number) {
    const t = teamMap.get(id);
    return t?.shortCode ?? t?.name ?? `Team ${id}`;
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (!scoringActive && !tournamentLoading) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <PageHeader
          tournamentId={tournamentId}
          eyebrow="Match day"
          title="Live Control Console"
          subtitle="Scoreboard, OBS, and match queues."
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <EmptyState
            icon={AlertTriangle}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament, then return here."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  const activeHomeTeam = currentMatch ? teamMap.get(currentMatch.homeTeamId) : null;
  const activeAwayTeam = currentMatch ? teamMap.get(currentMatch.awayTeamId) : null;
  const matchState = currentMatchDetail?.state;

  const currentHomeScore = matchState && matchState.homeTeamId
    ? `${matchState.innings[1]?.runs ?? 0}/${matchState.innings[1]?.wickets ?? 0} (${matchState.innings[1]?.over ?? 0}.${matchState.innings[1]?.ball ?? 0} ov)`
    : null;

  const currentAwayScore = matchState && matchState.awayTeamId
    ? `${matchState.innings[2]?.runs ?? 0}/${matchState.innings[2]?.wickets ?? 0} (${matchState.innings[2]?.over ?? 0}.${matchState.innings[2]?.ball ?? 0} ov)`
    : null;

  const scorerPath = currentMatch
    ? cricketScorerConsolePath(tournamentId, currentMatch.id)
    : cricketScoreHubPath(tournamentId);

  const matchCenterPath = currentMatch
    ? cricketMatchCenterPath(tournamentId, currentMatch.id)
    : cricketScoreHubPath(tournamentId);

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId} themeVariant="console">
      {/* ─── MAIN CONTAINER: FULLY SCROLLABLE CONSOLE LAYOUT ─── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4 w-full flex flex-col gap-4 pb-20 sm:pb-16">
        
        {/* ─── 1. ACTIVE MATCH SCORE CARD / COMPLETED HALF-WIDTH SUMMARY ─── */}
        {currentMatch ? (
          (() => {
            const liveState = (
              (liveData?.match?.id === currentMatch.id ? liveData.state : null) ||
              currentMatchDetail?.state ||
              currentMatch?.stateJson
            ) as any;
            const summary = (
              (liveData?.match?.id === currentMatch.id ? liveData.summary : null) ||
              currentMatchDetail?.summary ||
              currentMatch?.summaryJson
            );
            const isLive = currentMatch.status === "live";
            const isCompleted = currentMatch.status === "completed" || isTerminalCricketMatchStatus(currentMatch.status);

            const home = activeHomeTeam;
            const away = activeAwayTeam;

            const inn1 = Array.isArray(liveState?.innings)
              ? liveState.innings.find((i: any) => i && i.innings === 1) || liveState.innings[0]
              : (summary as any)?.innings?.[0];
            const inn2 = Array.isArray(liveState?.innings)
              ? liveState.innings.find((i: any) => i && i.innings === 2) || liveState.innings[1]
              : (summary as any)?.innings?.[1];

            // Toss text
            const tossWinnerId = liveState?.tossWinnerTeamId;
            const tossWinner = tossWinnerId ? teamMap.get(tossWinnerId) : null;
            const tossDecision = liveState?.electedTo || liveState?.tossDecision;
            const tossText = tossWinner && tossDecision
              ? `${tossWinner.shortCode || tossWinner.name} won toss & chose to ${tossDecision}`
              : null;

            /* ─── CASE A: LIVE MATCH REAL-TIME DETAILS (FULL WIDTH COLORFUL) ─── */
            if (isLive) {
              const currentInningsNum = liveState?.currentInnings || (inn2 ? 2 : 1);
              const activeInn = currentInningsNum === 2 ? (inn2 || inn1) : (inn1 || inn2);

              const battingTeamId =
                activeInn?.battingTeamId ||
                liveState?.battingTeamId ||
                currentMatch.homeTeamId;

              const battingTeam = teamMap.get(battingTeamId) || home;
              const bowlingTeam =
                battingTeamId === home?.id ? away : home;

              const currentRuns = activeInn?.runs ?? 0;
              const currentWickets = activeInn?.wickets ?? 0;
              const currentOver =
                activeInn?.over ?? (activeInn?.balls != null ? Math.floor(activeInn.balls / 6) : 0);
              const currentBall =
                activeInn?.ball ?? (activeInn?.balls != null ? activeInn.balls % 6 : 0);
              const oversLimit =
                currentMatch.rules?.overs ?? activeInn?.oversLimit ?? liveState?.oversLimit ?? 20;

              const ballsBowled = currentOver * 6 + currentBall;
              const crr =
                ballsBowled > 0
                  ? ((currentRuns / ballsBowled) * 6).toFixed(2)
                  : "0.00";

              const isChase = currentInningsNum >= 2;
              const target = liveState?.target ?? (inn1 ? inn1.runs + 1 : null);
              const totalBalls = oversLimit * 6;
              const ballsRemaining = Math.max(0, totalBalls - ballsBowled);
              const runsNeeded =
                target != null ? Math.max(0, target - currentRuns) : null;
              const rrr =
                runsNeeded != null && ballsRemaining > 0
                  ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
                  : null;

              // Active Batters & Bowler
              const striker = liveState?.strikerId ? playerMap.get(liveState.strikerId) : null;
              const nonStriker = liveState?.nonStrikerId ? playerMap.get(liveState.nonStrikerId) : null;
              const bowler = liveState?.bowlerId ? playerMap.get(liveState.bowlerId) : null;

              return (
                <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4 text-xs shadow-sm space-y-3">
                  <div className="space-y-2.5">
                    {/* Meta row: Match #, Overs, Status & Match Switcher */}
                    <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400 border-b border-white/[0.05] pb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="flex items-center gap-1 font-bold px-2 py-0.5 rounded-full border text-[10px] uppercase tracking-wider text-red-400 bg-red-500/15 border-red-500/30">
                          <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />
                          Match #{currentMatch.tournamentMatchNumber ?? currentMatch.id}
                        </span>
                        <span className="text-slate-300 font-medium">
                          {currentMatch.rules?.overs ?? 20} Overs Match
                        </span>
                        {currentMatch.roundName ? (
                          <span className="text-slate-400">• {currentMatch.roundName}</span>
                        ) : null}
                        <span className="capitalize font-semibold text-amber-400">
                          • Live
                        </span>
                        {tossText && (
                          <span className="text-slate-400 hidden sm:inline">• 🪙 {tossText}</span>
                        )}
                      </div>

                      {matches && matches.length > 1 && (
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="text-slate-400 text-xs font-medium">Switch Match:</span>
                          <select
                            value={currentMatch.id}
                            onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
                            className="bg-black/40 border border-white/10 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium focus:outline-none focus:border-primary/50"
                          >
                            {matches.map((m) => (
                              <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                                #{m.tournamentMatchNumber ?? m.id}: {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)} ({m.status})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* Batting Team Live Score Header */}
                    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.05] p-3 sm:p-3.5 space-y-2.5">
                      <div className="flex flex-col sm:flex-row sm:items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-4 h-4 rounded-full shrink-0 ring-1 ring-white/20"
                            style={{ backgroundColor: battingTeam?.color || "#f59e0b" }}
                          />
                          <span className="font-display font-black text-lg sm:text-xl text-foreground tracking-tight truncate">
                            {battingTeam?.name || "Batting"}
                          </span>
                          <span className="font-display font-black text-2xl sm:text-3xl text-amber-400 tracking-tight ml-1 shrink-0 tabular-nums">
                            {currentRuns}/{currentWickets}
                          </span>
                          <span className="text-xs font-semibold text-slate-300 shrink-0">
                            ({currentOver}.{currentBall} / {oversLimit} ov)
                          </span>
                        </div>

                        {/* Innings 1 / Bowling Team info */}
                        <div className="flex items-center gap-3 text-xs text-slate-300">
                          <span className="font-medium">
                            CRR: <strong className="text-amber-400">{crr}</strong>
                          </span>
                          {isChase && inn1 ? (
                            <span className="text-[11px] text-slate-300 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                              1st Inn: {teamLabel(inn1.battingTeamId || bowlingTeam?.id || 0)} {inn1.runs}/{inn1.wickets} ({inn1.over ?? Math.floor((inn1.balls || 0)/6)}.{inn1.ball ?? ((inn1.balls || 0)%6)} ov)
                            </span>
                          ) : (
                            <span className="text-[11px] text-slate-400">
                              vs {bowlingTeam?.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Chase Required Equation Banner */}
                      {isChase && target != null ? (
                        <div className="rounded-lg bg-amber-500/15 border border-amber-500/30 px-3 py-1.5 text-xs flex items-center justify-between text-amber-300 font-semibold gap-2">
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span>🎯 Target: <strong>{target}</strong></span>
                          </span>
                          <span className="truncate text-right">
                            Need <strong>{runsNeeded}</strong> runs in <strong>{ballsRemaining}</strong> balls{rrr ? ` (RRR: ${rrr})` : ""}
                          </span>
                        </div>
                      ) : null}

                      {/* Crease Batters & Active Bowler */}
                      {(striker || nonStriker || bowler) && (
                        <div className="flex items-center justify-between gap-2 flex-wrap pt-1 border-t border-white/[0.06] text-xs text-slate-300">
                          <div className="flex items-center gap-3">
                            <span className="text-slate-400 text-[11px] font-semibold">Batters:</span>
                            {striker && (
                              <span className="font-semibold text-white flex items-center gap-1">
                                <span className="text-emerald-400 font-bold">🏏</span> {striker.name} <span className="text-amber-400 font-bold">*</span>
                              </span>
                            )}
                            {nonStriker && (
                              <span className="text-slate-300">
                                {nonStriker.name}
                              </span>
                            )}
                          </div>
                          {bowler && (
                            <div className="flex items-center gap-1.5 text-[11px]">
                              <span className="text-slate-400 font-semibold">Bowler:</span>
                              <span className="text-amber-300 font-bold">⚾ {bowler.name}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Recent Deliveries of Current Over */}
                      {liveState?.thisOver && liveState.thisOver.length > 0 ? (
                        <div className="flex items-center gap-2 pt-0.5 text-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400 shrink-0">
                            This Over:
                          </span>
                          <div className="flex items-center gap-1.5 overflow-x-auto py-0.5 scrollbar-none">
                            {liveState.thisOver.map((b: any, bIdx: number) => {
                              const isWkt = b.isWicket;
                              const isSix = b.runsOffBat === 6;
                              const isFour = b.runsOffBat === 4;
                              const isDot = b.runsOffBat === 0 && !b.extrasType && !b.isWicket;
                              const isExtra = Boolean(b.extrasType);
                              return (
                                <span
                                  key={bIdx}
                                  className={cn(
                                    "min-w-6 h-6 px-1.5 rounded-md flex items-center justify-center font-bold text-[11px] shrink-0 border shadow-xs",
                                    isWkt && "bg-red-500/30 text-red-300 border-red-500/50 font-black",
                                    isSix && "bg-purple-500/30 text-purple-300 border-purple-500/50 font-black",
                                    isFour && "bg-sky-500/30 text-sky-300 border-sky-500/50 font-black",
                                    isDot && "bg-white/5 text-slate-400 border-white/10",
                                    isExtra && "bg-amber-500/30 text-amber-300 border-amber-500/50",
                                    !isWkt && !isSix && !isFour && !isDot && !isExtra && "bg-white/10 text-white border-white/20",
                                  )}
                                >
                                  {b.label || (isWkt ? "W" : b.runsOffBat)}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            }

            /* ─── CASE B: COMPLETED MATCH (GREYSCALE & HALF-WIDTH SUMMARY) ─── */
            if (isCompleted) {
              const t1 = teamMap.get(inn1?.battingTeamId) || home;
              const t2 = teamMap.get(inn2?.battingTeamId) || away;
              const isT1Winner = currentMatch.winnerTeamId === t1?.id;
              const isT2Winner = currentMatch.winnerTeamId === t2?.id;

              return (
                <div className="w-full md:max-w-2xl rounded-2xl border border-white/[0.08] bg-slate-900/60 p-3 sm:p-3.5 text-xs shadow-sm space-y-2.5 grayscale opacity-85 hover:grayscale-0 hover:opacity-100 transition-all">
                  {/* Meta row */}
                  <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] text-slate-400 border-b border-white/[0.06] pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold px-2 py-0.5 rounded-full border border-slate-600 bg-slate-800 text-slate-300 text-[10px] uppercase tracking-wider">
                        🏁 Last Match Completed
                      </span>
                      <span className="text-slate-400 font-medium">
                        Match #{currentMatch.tournamentMatchNumber ?? currentMatch.id} • {currentMatch.rules?.overs ?? 20} Ov
                      </span>
                      <span className="text-slate-500 text-[10px]">
                        (Standby until next match begins)
                      </span>
                    </div>

                    {matches && matches.length > 1 && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-slate-400 text-xs">Switch:</span>
                        <select
                          value={currentMatch.id}
                          onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
                          className="bg-black/40 border border-white/10 rounded px-2 py-0.5 text-xs text-slate-300 font-medium focus:outline-none"
                        >
                          {matches.map((m) => (
                            <option key={m.id} value={m.id} className="bg-slate-900 text-white">
                              #{m.tournamentMatchNumber ?? m.id}: {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)} ({m.status})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  {/* Summary Scores Box */}
                  <div className="rounded-xl border border-white/[0.06] bg-black/20 p-2.5 space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: t1?.color || "#3b82f6" }}
                        />
                        <span className={cn("font-bold truncate", isT1Winner ? "text-foreground font-black" : "text-muted-foreground")}>
                          {t1?.name ?? "Team 1"}
                        </span>
                        {isT1Winner && <span className="text-amber-400 font-bold text-xs shrink-0">🏆 WINNER</span>}
                      </div>
                      <div className="font-mono font-bold text-foreground text-sm shrink-0 tabular-nums">
                        {inn1 ? `${inn1.runs}/${inn1.wickets} (${inn1.overs || `${inn1.over}.${inn1.ball}`} ov)` : "—"}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-3.5 h-3.5 rounded-full shrink-0"
                          style={{ backgroundColor: t2?.color || "#10b981" }}
                        />
                        <span className={cn("font-bold truncate", isT2Winner ? "text-foreground font-black" : "text-muted-foreground")}>
                          {t2?.name ?? "Team 2"}
                        </span>
                        {isT2Winner && <span className="text-amber-400 font-bold text-xs shrink-0">🏆 WINNER</span>}
                      </div>
                      <div className="font-mono font-bold text-foreground text-sm shrink-0 tabular-nums">
                        {inn2 ? `${inn2.runs}/${inn2.wickets} (${inn2.overs || `${inn2.over}.${inn2.ball}`} ov)` : "—"}
                      </div>
                    </div>
                  </div>

                  {/* Result Highlight Banner */}
                  <div className="rounded-lg bg-white/[0.04] border border-white/10 px-2.5 py-1 flex items-center gap-2 text-xs text-slate-300 font-semibold">
                    <span>🏆</span>
                    <span className="truncate">
                      {currentMatch.resultSummary || (summary as any)?.resultText || "Match Finished"}
                    </span>
                  </div>
                </div>
              );
            }

            /* ─── CASE C: SCHEDULED / UPCOMING MATCH (HALF-WIDTH) ─── */
            return (
              <div className="w-full md:max-w-2xl rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4 text-xs shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-display font-bold text-base text-foreground">
                    {home?.name ?? "Home Team"} vs {away?.name ?? "Away Team"}
                  </span>
                  <span className="text-xs text-amber-400 font-medium">Scheduled</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {currentMatch.scheduledAt ? (
                    <>Starts: {new Date(currentMatch.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</>
                  ) : (
                    "Match schedule pending toss & start"
                  )}
                  {currentMatch.venue ? ` • Venue: ${currentMatch.venue}` : ""}
                </p>
              </div>
            );
          })()
        ) : (
          <div className="text-center py-3 text-xs text-slate-400">
            No active match selected.
          </div>
        )}

        {/* ─── 2. DIRECTOR WORKSPACE: SIDE-BY-SIDE (LEFT: SCREEN MODES, RIGHT: BROADCAST CHYRON) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          
          {/* ─── LEFT COLUMN: SCREEN MODE SELECTOR (PRIMARY CONTROL DECK - 8 COLS) ─── */}
          <div className="lg:col-span-8 xl:col-span-8">
            <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-3.5 sm:p-4 flex flex-col justify-between shadow-sm space-y-3 h-full">
              <div className="space-y-2.5">
                {/* Header with Title + Screen Status Badge + Reset + Overrides + Refresh */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-white/[0.05] pb-2.5">
                  <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                    <div>
                      <h2 className="text-xs sm:text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary" />
                        Screen Mode Selector
                      </h2>
                      <p className="text-[11px] text-slate-400 hidden sm:block mt-0.5">
                        Switch live scenes across Ground LED &amp; OBS Live Stream:
                      </p>
                    </div>
                  </div>

                  {/* Action Toolbar: Screen Status, Reset Camera, Animation Overrides, Refresh */}
                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {lastTriggeredFlash ? (
                      <span className="text-[10px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/25 animate-pulse">
                        Flash: {lastTriggeredFlash}
                      </span>
                    ) : null}

                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md",
                        currentOverlay === "none"
                          ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                          : "border-amber-500/30 text-amber-400 bg-amber-500/10",
                      )}
                    >
                      {currentOverlay === "none" ? "CAMERA ONLY" : currentOverlay.toUpperCase()}
                      {currentOverlay !== "none" && overlayMatchId ? ` (#${overlayMatchId})` : ""}
                    </Badge>

                    {/* Reset to Camera Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleSetOverlay("none", "Camera Only")}
                      className="h-7 px-2 text-[11px] font-semibold rounded-md border-white/10 hover:bg-white/10 text-slate-300 gap-1"
                      title="Instantly clear all screen overlays"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Reset</span>
                    </Button>

                    {/* Manual Animation Overrides Button */}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAnimationsModalOpen(true)}
                      className="h-7 px-2 text-[11px] font-semibold rounded-md border-amber-500/30 text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 gap-1"
                      title="Manual Graphic Overrides"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Anims</span>
                    </Button>

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isFetching}
                      onClick={() => void refetch()}
                      className="h-7 w-7 p-0 rounded-md border-white/10 text-slate-300 hover:bg-white/10"
                      title="Refresh State"
                    >
                      <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                    </Button>
                  </div>
                </div>

                {/* 3x3 Grid of 9 Screen Mode Selector Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-1">
                  {OVERLAY_OPTIONS.map((item) => {
                    const isActive = currentOverlay === item.id;
                    const isSpecialSelector = item.id !== "none";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleOverlayButtonClick(item)}
                        className={cn(
                          "group flex flex-col justify-between p-3 rounded-xl border-2 text-left transition-all duration-150 relative cursor-pointer select-none min-h-[105px] shadow-sm",
                          isActive
                            ? "border-emerald-400 bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 text-white shadow-[0_0_20px_rgba(16,185,129,0.35)] ring-2 ring-emerald-400/30 font-bold scale-[1.01]"
                            : "border-slate-700/80 bg-gradient-to-b from-slate-800 to-slate-900/95 hover:from-slate-750 hover:to-slate-850 hover:border-amber-400/70 text-slate-100 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                        )}
                      >
                        <div className="w-full">
                          <div className="flex items-center justify-between w-full mb-1.5">
                            <div className="h-7 w-7 rounded-lg bg-black/30 border border-white/10 flex items-center justify-center text-sm shrink-0 shadow-inner">
                              {item.icon}
                            </div>
                            {isActive ? (
                              <div className="flex items-center gap-1.5">
                                <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-white text-emerald-900 px-2 py-0.5 rounded-full shadow-sm">
                                  <CheckCircle2 className="w-2.5 h-2.5 text-emerald-700" />
                                  LIVE{overlayMatchId ? ` (#${overlayMatchId})` : ""}
                                  {autoCloseSecondsRemaining != null && item.id !== "none" && item.id !== "neutral" && (
                                    <span className="ml-1 text-emerald-800 font-bold">({autoCloseSecondsRemaining}s)</span>
                                  )}
                                </span>
                                {item.id !== "none" && (
                                  <span
                                    role="button"
                                    tabIndex={0}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void handleSetOverlay("none", "Camera Only");
                                    }}
                                    className="h-6 w-6 rounded-full bg-red-600 hover:bg-red-500 text-white font-black flex items-center justify-center text-xs shadow-md transition-all hover:scale-110 active:scale-95 cursor-pointer ring-1 ring-white/50"
                                    title="Close & return to Camera View"
                                    aria-label="Close & return to Camera View"
                                  >
                                    ✕
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[9px] font-bold text-slate-400 uppercase group-hover:text-amber-300 flex items-center gap-0.5 bg-slate-950/60 px-1.5 py-0.5 rounded border border-slate-700/50">
                                {item.tag}
                                {isSpecialSelector && <span className="text-[9px]">▾</span>}
                              </span>
                            )}
                          </div>
                          <span className={cn("text-xs font-bold leading-tight line-clamp-1", isActive ? "text-white" : "text-slate-100 group-hover:text-amber-300")}>
                            {item.label}
                          </span>
                          <span className={cn("text-[10px] font-normal line-clamp-2 mt-0.5 leading-snug", isActive ? "text-emerald-100" : "text-slate-400")}>
                            {item.desc}
                          </span>
                        </div>

                        {/* Displays / Activates Micro-Badge */}
                        <div className={cn(
                          "w-full mt-2 pt-1.5 border-t flex items-center justify-between text-[9.5px]",
                          isActive ? "border-white/20 text-emerald-100" : "border-white/[0.07] text-slate-400"
                        )}>
                          <span className="flex items-center gap-1 truncate">
                            <span className={cn(
                              "w-1.5 h-1.5 rounded-full shrink-0",
                              item.id === "banner"
                                ? "bg-purple-400 ring-2 ring-purple-400/30"
                                : item.id === "none"
                                ? "bg-blue-400"
                                : "bg-emerald-400"
                            )} />
                            <span className={cn("truncate font-semibold", isActive ? "text-white" : item.id === "banner" ? "text-purple-300" : "text-slate-300")}>
                              {item.activatesOn}
                            </span>
                          </span>
                          {item.defaultDurationSec ? (
                            <span className={cn("text-[9px] px-1 py-0.2 rounded font-mono shrink-0 font-bold ml-1", isActive ? "bg-black/30 text-white" : "bg-black/50 text-amber-300/90")}>
                              ⏱ {item.defaultDurationSec}s
                            </span>
                          ) : item.id === "sponsors" || item.id === "standings" ? (
                            <span className={cn("text-[9px] px-1 py-0.2 rounded font-mono shrink-0 ml-1", isActive ? "bg-black/30 text-white" : "bg-black/50 text-blue-300/90")}>
                              🔄 Loop
                            </span>
                          ) : null}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hint Strip */}
              <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-white/[0.05] mt-2">
                <span className="truncate pr-2">Scores auto-sync in real-time.</span>
                <span className="text-slate-400 text-[10px] shrink-0">
                  OBS &amp; LED displays update immediately
                </span>
              </div>
            </div>
          </div>

          {/* ─── RIGHT COLUMN: BROADCAST MESSAGE / CHYRON (COMPACT SECONDARY - 4 COLS) ─── */}
          <div className="lg:col-span-4 xl:col-span-4 flex flex-col">
            <CricketObsBroadcastMessageControl 
              tournamentId={tournamentId} 
              className="rounded-2xl border border-white/[0.08] bg-white/[0.03] text-xs shadow-sm h-full flex flex-col justify-between"
            />
          </div>

        </div>

      </div>

      {/* ─── MODAL: MANUAL SCORING ANIMATION OVERRIDES (LIGHT THEME) ─── */}
      <Dialog open={animationsModalOpen} onOpenChange={setAnimationsModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/80">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Sparkles className="w-5 h-5 text-amber-500" />
              Manual Scoring Animation Overrides
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Trigger on-screen graphic burst to OBS &amp; Ground LED scoreboard (3.5s hold).
            </p>
          </DialogHeader>
          <div className="space-y-4 p-5 text-xs">
            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-3.5 text-amber-900">
              <p className="font-bold text-amber-950 mb-0.5">ℹ️ Auto-Trigger Information:</p>
              <p className="text-slate-700">
                Jab scorer match pad par 4, 6, wicket, ya no-ball score karta hai, to animations displays par automatically play hoti hain. Emergency ya manual demonstration ke liye niche click karein.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {ANIMATION_OPTIONS.map((item) => (
                <button
                  key={item.flash}
                  type="button"
                  onClick={() => {
                    void handleTriggerFlash(item.flash, item.label);
                  }}
                  className={cn(
                    "flex flex-col items-start p-3 rounded-xl text-left transition active:scale-95 shadow-sm font-medium border border-black/10",
                    item.color,
                  )}
                >
                  <span className="text-xs leading-tight font-bold">{item.label}</span>
                  <span className="text-[10px] opacity-90 font-normal mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: SETUP & BROADCAST HELP GUIDE (LIGHT THEME) ─── */}
      <Dialog open={helpInfoOpen} onOpenChange={setHelpInfoOpen}>
        <DialogContent className="max-w-lg bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/80">
            <DialogTitle className="flex items-center gap-2 text-slate-900 font-bold text-base">
              <Tv className="w-5 h-5 text-sky-600" />
              Live Screen &amp; OBS Setup Guide
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Setup instructions for streaming PCs and stadium display screens.
            </p>
          </DialogHeader>
          <div className="space-y-3.5 p-5 text-xs text-slate-700 leading-relaxed">
            <div className="rounded-xl border border-sky-200 p-3.5 bg-sky-50/60 space-y-1.5">
              <p className="font-bold text-sky-950 flex items-center gap-1.5">
                <span>🎥 OBS Studio &amp; vMix Live Stream Setup</span>
              </p>
              <p className="text-slate-700">
                1. OBS me <strong>Add Source (+) &gt; Browser</strong> chunein.
                <br />
                2. Upar ka <strong>OBS Stream URL</strong> copy karke paste karein.
                <br />
                3. Settings: <strong>Width: 1920</strong>, <strong>Height: 1080</strong>, <strong>FPS: 60</strong> set karein.
                <br />
                4. Camera layer ke upar Browser Source ko rakhein. Mid viewport 100% transparent rehta hai.
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 p-3.5 bg-slate-50 space-y-1.5">
              <p className="font-bold text-slate-900 flex items-center gap-1.5">
                <span>📺 Ground LED Screen &amp; Projector Setup</span>
              </p>
              <p className="text-slate-600">
                LED display laptop par Chrome browser me <strong>Ground LED Link</strong> open karein aur keyboard par <strong>F11</strong> press karke full screen mode on karein. Score auto-sync hota hai.
              </p>
            </div>

            <div className="rounded-xl border border-amber-200 p-3.5 bg-amber-50/60 space-y-1.5">
              <p className="font-bold text-amber-950 flex items-center gap-1.5">
                <span>🎛️ Operator Console Instructions</span>
              </p>
              <p className="text-slate-700">
                • Scorer ground se match score karta rahega.
                <br />
                • Operator is page se displays ka mode switch karega (Playing XI, Points Table, Sponsors, Match Summary).
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: MATCH SELECTION FOR BROADCAST OVERLAYS (LIGHT THEME) ─── */}
      <Dialog open={matchSelectModalOpen} onOpenChange={setMatchSelectModalOpen}>
        <DialogContent className="max-w-2xl bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/90">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{targetOverlayForMatch?.icon || "📺"}</span>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                    Select Match for {targetOverlayForMatch?.label || "Broadcast"}
                  </DialogTitle>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Choose which match to broadcast across Ground LED and OBS Live Stream.
                  </p>
                </div>
              </div>
            </div>
            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-3">
              {(["all", "live", "upcoming", "completed"] as const).map((tab) => {
                const count =
                  tab === "all"
                    ? matches?.length || 0
                    : tab === "live"
                    ? liveMatches.length
                    : tab === "upcoming"
                    ? upcomingMatches.length
                    : completedMatches.length;

                return (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setMatchFilterStatus(tab)}
                    className={cn(
                      "px-3 py-1 rounded-lg text-xs font-bold uppercase tracking-wider transition",
                      matchFilterStatus === tab
                        ? "bg-amber-500 text-slate-950 shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:text-slate-900 hover:bg-slate-200"
                    )}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5">
            {/* Quick Action: Use Active Match */}
            {currentMatch && matchFilterStatus === "all" && (
              <div className="p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/80 mb-3 flex items-center justify-between gap-3 shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase text-emerald-800 tracking-wider">
                      Currently Active Match
                    </span>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                      Match #{currentMatch.id}: {teamLabel(currentMatch.homeTeamId)} vs {teamLabel(currentMatch.awayTeamId)}
                    </p>
                  </div>
                </div>
                <Button
                  size="sm"
                  onClick={() => {
                    if (targetOverlayForMatch) {
                      void handleSetOverlay(targetOverlayForMatch.id, targetOverlayForMatch.label, currentMatch.id);
                      setMatchSelectModalOpen(false);
                    }
                  }}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0 shadow-sm"
                >
                  Broadcast Active ⚡
                </Button>
              </div>
            )}

            {filteredMatches && filteredMatches.length > 0 ? (
              filteredMatches.map((m) => {
                const home = teamLabel(m.homeTeamId);
                const away = teamLabel(m.awayTeamId);
                const isCurrentActive = m.id === currentMatch?.id;
                const isScreenTarget = m.id === overlayMatchId && currentOverlay === targetOverlayForMatch?.id;

                const statusColor =
                  m.status === "live"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                    : m.status === "completed"
                    ? "bg-purple-50 text-purple-700 border-purple-300"
                    : "bg-blue-50 text-blue-700 border-blue-300";

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl transition border",
                      isScreenTarget
                        ? "border-amber-400 bg-amber-50/80 shadow-sm ring-1 ring-amber-300"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70 shadow-sm"
                    )}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-bold text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          MATCH #{m.id}
                        </span>
                        {m.roundName && (
                          <span className="text-[11px] font-medium text-slate-500 border-l border-slate-200 pl-2">
                            {m.roundName}
                          </span>
                        )}
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", statusColor)}>
                          {m.status.toUpperCase()}
                        </span>
                        {isCurrentActive && (
                          <span className="text-[10px] font-bold uppercase text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            Active Scorer
                          </span>
                        )}
                        {isScreenTarget && (
                          <span className="text-[10px] font-bold uppercase text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-300">
                            On Screen
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        <span>{home}</span>
                        <span className="text-amber-600 italic text-xs font-semibold">VS</span>
                        <span>{away}</span>
                      </div>

                      <div className="text-[11px] text-slate-500 flex items-center gap-3 flex-wrap">
                        {m.venue && <span>📍 {m.venue}</span>}
                        {m.scheduledAt && (
                          <span>🕒 {new Date(m.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                        )}
                        {m.resultSummary && (
                          <span className="text-amber-800 font-semibold">🏆 {m.resultSummary}</span>
                        )}
                      </div>
                    </div>

                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (targetOverlayForMatch) {
                          void handleSetOverlay(targetOverlayForMatch.id, targetOverlayForMatch.label, m.id);
                          setMatchSelectModalOpen(false);
                        }
                      }}
                      className={cn(
                        "shrink-0 text-xs font-bold gap-1.5 shadow-sm",
                        isScreenTarget
                          ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                          : "bg-slate-900 hover:bg-slate-800 text-white"
                      )}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>{isScreenTarget ? "Active on Screen" : "Broadcast Match"}</span>
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-10 text-slate-400 text-xs font-medium">
                No matches found under this filter.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: SPONSOR SELECTION (LIGHT THEME) ─── */}
      <Dialog open={sponsorSelectModalOpen} onOpenChange={setSponsorSelectModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/90">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-amber-500">★</span>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Select Sponsor for Broadcast Showcase
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Broadcast all sponsors in rotation or spotlight a specific sponsor on displays.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Option 1: ALL SPONSORS (WALL / ROTATING) */}
            <div className="p-4 rounded-xl border-2 border-amber-300 bg-amber-50/60 flex items-center justify-between gap-3 shadow-sm">
              <div className="space-y-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-amber-500 text-slate-950">
                  ★ Full Showcase
                </span>
                <p className="text-sm font-bold text-slate-900">
                  All Sponsors (Auto-Rotating Wall)
                </p>
                <p className="text-xs text-slate-600">
                  Displays all {sponsors.length} tournament sponsors with automatic rotation and tier branding.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  void handleSetOverlay("sponsors", "Sponsor Showcase (All Sponsors)", undefined, "all");
                  setSponsorSelectModalOpen(false);
                }}
                className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shrink-0 shadow-sm"
              >
                Broadcast All ★
              </Button>
            </div>

            {/* Individual Sponsors Grid */}
            <div className="space-y-2 pt-1">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Or Select Single Sponsor Spotlight ({sponsors.length}):
              </p>

              {sponsors.length > 0 ? (
                sponsors.map((sp, idx) => {
                  const isCurrentTarget =
                    currentOverlay === "sponsors" &&
                    overlaySponsorName?.toLowerCase().trim() === sp.name?.toLowerCase().trim();

                  return (
                    <div
                      key={idx}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3 rounded-xl border transition shadow-sm",
                        isCurrentTarget
                          ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {sp.url ? (
                          <div className="h-10 w-12 rounded-lg bg-slate-50 border border-slate-200 p-1 flex items-center justify-center shrink-0">
                            <img src={sp.url} alt="" className="max-h-full max-w-full object-contain" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-lg bg-amber-100 text-amber-900 font-bold text-sm flex items-center justify-center shrink-0">
                            {sp.name?.[0] || "S"}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-bold text-slate-900 text-xs sm:text-sm truncate">
                            {sp.name || `Sponsor #${idx + 1}`}
                          </p>
                          <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
                            {sp.type || (sp.isTitleSponsor ? "Title Sponsor" : sp.isCoSponsor ? "Co-Sponsor" : "Official Partner")}
                          </span>
                        </div>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          void handleSetOverlay("sponsors", `Sponsor (${sp.name})`, undefined, sp.name);
                          setSponsorSelectModalOpen(false);
                        }}
                        className={cn(
                          "shrink-0 text-xs font-bold gap-1.5 shadow-sm",
                          isCurrentTarget
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        )}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>{isCurrentTarget ? "Live on Screen" : "Showcase This"}</span>
                      </Button>
                    </div>
                  );
                })
              ) : (
                <div className="text-center py-6 text-slate-400 text-xs">
                  No sponsors configured in tournament settings yet.
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: POINTS TABLE / STANDINGS SELECTION (LIGHT THEME) ─── */}
      <Dialog open={standingsSelectModalOpen} onOpenChange={setStandingsSelectModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 p-0 overflow-hidden max-h-[85vh] flex flex-col shadow-2xl rounded-2xl">
          <DialogHeader className="p-5 border-b border-slate-100 bg-slate-50/90">
            <div className="flex items-center gap-3">
              <span className="text-2xl text-blue-500">📊</span>
              <div>
                <DialogTitle className="text-base sm:text-lg font-bold text-slate-900">
                  Select Points Table View for Broadcast
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-0.5">
                  Display overall tournament standings, specific group table, or stage rankings.
                </p>
              </div>
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Option 1: OVERALL STANDINGS */}
            <div className="p-4 rounded-xl border-2 border-blue-300 bg-blue-50/60 flex items-center justify-between gap-3 shadow-sm">
              <div className="space-y-1 min-w-0">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white">
                  📊 Overall
                </span>
                <p className="text-sm font-bold text-slate-900">
                  Overall Points Table (All Teams)
                </p>
                <p className="text-xs text-slate-600">
                  Full leaderboard ranking all teams across the tournament by points and net run rate.
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  void handleSetOverlay("standings", "Points Table (Overall)", undefined, undefined, "all");
                  setStandingsSelectModalOpen(false);
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shrink-0 shadow-sm"
              >
                Broadcast Overall ⚡
              </Button>
            </div>

            {/* Option 2: GROUP-WISE STANDINGS (IF GROUPS EXIST) */}
            {tournamentGroups && tournamentGroups.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Group-Wise Points Tables:
                </p>

                {tournamentGroups.map((g) => {
                  const isCurrentTarget =
                    currentOverlay === "standings" &&
                    overlayStageOrGroup?.toLowerCase().trim() === g.name?.toLowerCase().trim();

                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition shadow-sm",
                        isCurrentTarget
                          ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      )}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{g.name}</span>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                            {g.rows?.length || 0} Teams
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                          Top: {g.rows?.[0]?.teamName || "—"} ({g.rows?.[0]?.points ?? 0} pts)
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          void handleSetOverlay("standings", `Points Table (${g.name})`, undefined, undefined, g.name);
                          setStandingsSelectModalOpen(false);
                        }}
                        className={cn(
                          "shrink-0 text-xs font-bold gap-1.5 shadow-sm",
                          isCurrentTarget
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        )}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>{isCurrentTarget ? "Live on Screen" : `Show ${g.name}`}</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Option 3: KNOCKOUT STAGES / ROUNDS (IF KNOCKOUTS EXIST) */}
            {tournamentStages && tournamentStages.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Knockout &amp; Tournament Stages:
                </p>

                {tournamentStages.map((stageName) => {
                  const stageMatchCount = (matches ?? []).filter((m) => m.roundName === stageName).length;
                  const isCurrentTarget =
                    currentOverlay === "standings" &&
                    overlayStageOrGroup?.toLowerCase().trim() === stageName.toLowerCase().trim();

                  return (
                    <div
                      key={stageName}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition shadow-sm",
                        isCurrentTarget
                          ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      )}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{stageName}</span>
                          <span className="text-[10px] font-semibold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                            {stageMatchCount} Matches
                          </span>
                        </div>
                        <p className="text-xs text-slate-500">
                          Knockout round matches &amp; bracket status
                        </p>
                      </div>

                      <Button
                        size="sm"
                        onClick={() => {
                          void handleSetOverlay("standings", `Stage (${stageName})`, undefined, undefined, stageName);
                          setStandingsSelectModalOpen(false);
                        }}
                        className={cn(
                          "shrink-0 text-xs font-bold gap-1.5 shadow-sm",
                          isCurrentTarget
                            ? "bg-amber-500 hover:bg-amber-400 text-slate-950"
                            : "bg-slate-900 hover:bg-slate-800 text-white"
                        )}
                      >
                        <Tv className="w-3.5 h-3.5" />
                        <span>{isCurrentTarget ? "Live on Screen" : `Show ${stageName}`}</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </CricketOrganizerPageShell>
  );
}
