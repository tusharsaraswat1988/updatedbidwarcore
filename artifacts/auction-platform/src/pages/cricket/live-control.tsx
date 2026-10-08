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
  broadcastStageChoices,
  competitionGroupTitle,
  competitionSelectionLabel,
  groupChoiceIsSelected,
  groupSelectorToken,
  isMultiDrawCompetition,
  stageChoiceIsSelected,
} from "@workspace/scoring-core/cricket";
import { listDraws, listFixtures } from "@/lib/scoring-foundation-api";
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
import { SponsorMediaControl } from "@/components/scoring/sponsor-media-control";
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
  const multiDrawStandings = isMultiDrawCompetition(tournamentGroups, standings ?? []);

  const { data: stageDraws } = useQuery({
    queryKey: ["scoring-draws", tournamentId],
    queryFn: () => listDraws(tournamentId),
    enabled: scoringActive && !!tournamentId,
    staleTime: 30_000,
  });
  const { data: stageFixtures } = useQuery({
    queryKey: ["scoring-fixtures", tournamentId],
    queryFn: () => listFixtures(tournamentId),
    enabled: scoringActive && !!tournamentId,
    staleTime: 30_000,
  });

  // Knockout and other rounds are chosen per draw. The round name stays a label.
  const tournamentStages = useMemo(
    () => broadcastStageChoices(stageFixtures ?? [], matches ?? [], stageDraws ?? []),
    [stageFixtures, matches, stageDraws],
  );

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

      const stageLabel = competitionSelectionLabel(stageOrGroup);
      const extraText = sponsorName
        ? ` (${sponsorName})`
        : stageLabel
        ? ` (${stageLabel})`
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

  const matchSwitcher =
    currentMatch && matches && matches.length > 1 ? (
      <select
        aria-label="Switch match"
        value={currentMatch.id}
        onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
        className="h-6 max-w-[220px] bg-black/50 border border-white/10 rounded px-1.5 text-[11px] text-slate-200 font-medium focus:outline-none focus:border-amber-400/50"
      >
        {matches.map((m) => (
          <option key={m.id} value={m.id} className="bg-slate-900 text-white">
            #{m.tournamentMatchNumber ?? m.id}: {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)} ({m.status})
          </option>
        ))}
      </select>
    ) : null;

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId} themeVariant="console">
      {/* Viewport-locked operator deck. The shell clips overflow so this page never scrolls. */}
      <div className="flex-1 min-h-0 w-full overflow-hidden flex flex-col gap-1.5 p-2">
        
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
                <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex items-center gap-1 h-5 px-1.5 rounded-full border text-[10px] font-bold uppercase tracking-wide text-red-300 bg-red-500/15 border-red-500/30 shrink-0">
                      <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />
                      #{currentMatch.tournamentMatchNumber ?? currentMatch.id}
                    </span>
                    <span className="text-[11px] text-slate-400 truncate min-w-0">
                      {currentMatch.rules?.overs ?? 20} ov
                      {currentMatch.roundName ? ` · ${currentMatch.roundName}` : ""}
                      {" · "}
                      <span className="font-semibold text-amber-400">Live</span>
                      {tossText ? ` · ${tossText}` : ""}
                    </span>
                    <div className="ml-auto shrink-0">{matchSwitcher}</div>
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 min-w-0">
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 ring-1 ring-white/20"
                      style={{ backgroundColor: battingTeam?.color || "#f59e0b" }}
                    />
                    <span className="font-black text-[13px] text-foreground truncate max-w-[14rem]">
                      {battingTeam?.name || "Batting"}
                    </span>
                    <span className="font-black text-lg leading-none text-amber-400 tabular-nums shrink-0">
                      {currentRuns}/{currentWickets}
                    </span>
                    <span className="text-[11px] font-semibold text-slate-300 shrink-0">
                      ({currentOver}.{currentBall}/{oversLimit})
                    </span>
                    <span className="text-[11px] text-slate-300 shrink-0">
                      CRR <strong className="text-amber-400">{crr}</strong>
                    </span>
                    {isChase && inn1 ? (
                      <span className="text-[10px] text-slate-300 bg-white/5 px-1.5 h-5 inline-flex items-center rounded border border-white/10 shrink-0">
                        1st {teamLabel(inn1.battingTeamId || bowlingTeam?.id || 0)} {inn1.runs}/{inn1.wickets}
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 truncate">vs {bowlingTeam?.name}</span>
                    )}
                    {isChase && target != null ? (
                      <span className="text-[11px] font-semibold text-amber-300 truncate">
                        Target {target} · {runsNeeded} off {ballsRemaining}{rrr ? ` · RRR ${rrr}` : ""}
                      </span>
                    ) : null}
                    <span className="ml-auto flex items-center gap-1.5 min-w-0 text-[11px] truncate">
                      {striker ? (
                        <span className="font-semibold text-white truncate">
                          <span className="text-emerald-400">*</span> {striker.name}
                        </span>
                      ) : null}
                      {nonStriker ? <span className="text-slate-400 truncate">{nonStriker.name}</span> : null}
                      {bowler ? <span className="font-semibold text-amber-300 truncate">{bowler.name}</span> : null}
                    </span>
                  </div>

                  {liveState?.thisOver && liveState.thisOver.length > 0 ? (
                    <div className="mt-1 flex items-center gap-1 min-w-0 overflow-hidden">
                      <span className="text-[9px] uppercase font-bold text-slate-500 shrink-0">Over</span>
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
                              "min-w-5 h-5 px-1 rounded flex items-center justify-center font-bold text-[10px] shrink-0 border",
                              isWkt && "bg-red-500/30 text-red-300 border-red-500/50",
                              isSix && "bg-purple-500/30 text-purple-300 border-purple-500/50",
                              isFour && "bg-sky-500/30 text-sky-300 border-sky-500/50",
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
                  ) : null}
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
                <div className="shrink-0 rounded-lg border border-white/10 bg-slate-900/70 px-2 py-1.5 flex items-center gap-2 min-w-0 text-[11px]">
                  <span className="font-bold uppercase tracking-wide text-slate-400 shrink-0">Finished</span>
                  <span className="text-slate-500 shrink-0">#{currentMatch.tournamentMatchNumber ?? currentMatch.id}</span>
                  <span className={cn("font-semibold truncate", isT1Winner && "text-foreground")}>
                    {t1?.name ?? "Team 1"} {inn1 ? `${inn1.runs}/${inn1.wickets}` : "—"}
                  </span>
                  <span className="text-slate-600 shrink-0">·</span>
                  <span className={cn("font-semibold truncate", isT2Winner && "text-foreground")}>
                    {t2?.name ?? "Team 2"} {inn2 ? `${inn2.runs}/${inn2.wickets}` : "—"}
                  </span>
                  <span className="text-slate-400 truncate min-w-0">
                    {currentMatch.resultSummary || (summary as any)?.resultText || "Match finished"}
                  </span>
                  <div className="ml-auto shrink-0">{matchSwitcher}</div>
                </div>
              );
            }

            /* ─── CASE C: SCHEDULED / UPCOMING MATCH (HALF-WIDTH) ─── */
            return (
              <div className="shrink-0 rounded-lg border border-white/10 bg-white/[0.03] px-2 py-1.5 flex items-center gap-2 min-w-0 text-[11px]">
                <span className="font-bold text-amber-400 shrink-0">Scheduled</span>
                <span className="font-semibold text-foreground truncate">
                  {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                </span>
                <span className="text-slate-400 truncate min-w-0">
                  {currentMatch.scheduledAt
                    ? new Date(currentMatch.scheduledAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })
                    : "Waiting for toss"}
                  {currentMatch.venue ? ` · ${currentMatch.venue}` : ""}
                </span>
                <div className="ml-auto shrink-0">{matchSwitcher}</div>
              </div>
            );
          })()
        ) : (
          <div className="shrink-0 px-1 text-[11px] text-slate-400">No active match selected.</div>
        )}

        <div className="shrink-0 min-w-0 grid grid-cols-1 lg:grid-cols-12 gap-1.5 items-start">
          <section className="lg:col-span-7 min-w-0 rounded-lg border border-white/10 bg-white/[0.03] p-1.5 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5 min-w-0 px-0.5">
              <h2 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1 shrink-0">
                <Layers className="w-3.5 h-3.5 text-primary" />
                Screen modes
              </h2>
              {lastTriggeredFlash ? (
                <span className="text-[10px] font-semibold text-amber-300 bg-amber-500/10 px-1.5 h-5 inline-flex items-center rounded border border-amber-500/30 truncate max-w-[9rem]">
                  {lastTriggeredFlash}
                </span>
              ) : null}
              <Badge
                variant="outline"
                className={cn(
                  "h-5 px-1.5 text-[10px] uppercase font-bold tracking-wide rounded",
                  currentOverlay === "none"
                    ? "border-emerald-500/40 text-emerald-300 bg-emerald-500/10"
                    : "border-amber-500/40 text-amber-300 bg-amber-500/10",
                )}
              >
                {currentOverlay === "none" ? "Camera" : currentOverlay}
                {currentOverlay !== "none" && overlayMatchId ? ` #${overlayMatchId}` : ""}
              </Badge>
              <div className="ml-auto flex items-center gap-1 shrink-0">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleSetOverlay("none", "Camera Only")}
                  className="h-6 px-1.5 text-[10px] font-semibold rounded border-white/10 hover:bg-white/10 text-slate-200 gap-1"
                  title="Clear overlays and return to the camera"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAnimationsModalOpen(true)}
                  className="h-6 px-1.5 text-[10px] font-semibold rounded border-amber-500/40 text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 gap-1"
                  title="Manual graphic bursts"
                >
                  <Sparkles className="w-3 h-3" />
                  Anims
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                  className="h-6 w-6 p-0 rounded border-white/10 text-slate-300 hover:bg-white/10"
                  title="Refresh state"
                >
                  <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              {OVERLAY_OPTIONS.map((item) => {
                const isActive = currentOverlay === item.id;
                const playsOn = item.id === "none" ? "OBS + scorebug" : item.id === "banner" ? "LED only" : "LED + OBS";
                const timing = item.defaultDurationSec
                  ? `${item.defaultDurationSec}s`
                  : item.id === "sponsors" || item.id === "standings"
                    ? "Loop"
                    : null;
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={`${item.label}. ${item.desc}. ${item.activatesOn}.`}
                    onClick={() => handleOverlayButtonClick(item)}
                    className={cn(
                      "h-[52px] min-w-0 rounded-md border px-1.5 py-1 text-left flex flex-col justify-center gap-0.5",
                      isActive
                        ? "border-emerald-300 bg-emerald-600 text-white"
                        : "border-slate-500/80 bg-slate-800/90 text-slate-50 hover:border-amber-400 hover:bg-slate-800",
                    )}
                  >
                    <span className="flex items-center gap-1 min-w-0">
                      <span className="text-[13px] leading-none shrink-0" aria-hidden>{item.icon}</span>
                      <span className={cn("text-[11px] font-bold leading-tight truncate", isActive ? "text-white" : "text-slate-50")}>
                        {item.label}
                      </span>
                      {isActive && item.id !== "none" ? (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => {
                            e.stopPropagation();
                            void handleSetOverlay("none", "Camera Only");
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              e.stopPropagation();
                              void handleSetOverlay("none", "Camera Only");
                            }
                          }}
                          className="ml-auto h-4 w-4 rounded-sm bg-red-600 text-white text-[10px] font-black flex items-center justify-center shrink-0"
                          title="Back to camera"
                          aria-label="Back to camera"
                        >
                          ×
                        </span>
                      ) : null}
                    </span>
                    <span className={cn("flex items-center gap-1 pl-[18px] min-w-0 text-[10px] leading-none", isActive ? "text-emerald-50" : "text-slate-400")}>
                      <span className={cn(
                        "w-1.5 h-1.5 rounded-full shrink-0",
                        item.id === "banner" ? "bg-purple-400" : item.id === "none" ? "bg-sky-400" : "bg-emerald-400",
                      )} />
                      <span className="truncate">{playsOn}</span>
                      <span className={cn("ml-auto font-bold uppercase tracking-wide shrink-0", isActive ? "text-white" : "text-slate-500")}>
                        {isActive
                          ? autoCloseSecondsRemaining != null && item.id !== "none" && item.id !== "neutral"
                            ? `Live ${autoCloseSecondsRemaining}s`
                            : "Live"
                          : item.tag}
                        {!isActive && timing ? ` · ${timing}` : ""}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          <div className="lg:col-span-5 min-w-0">
            <CricketObsBroadcastMessageControl
              tournamentId={tournamentId}
              density="console"
            />
          </div>

          <div className="lg:col-span-12 min-w-0">
            <SponsorMediaControl tournamentId={tournamentId} density="console" />
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
            {multiDrawStandings ? (
              <p className="text-xs text-slate-600">
                This tournament has more than one competition. Broadcast a group table. There is no combined points table.
              </p>
            ) : (
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
            )}

            {/* Option 2: GROUP-WISE STANDINGS (IF GROUPS EXIST) */}
            {tournamentGroups && tournamentGroups.length > 0 && (
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Group-Wise Points Tables:
                </p>

                {tournamentGroups.map((g) => {
                  const token = groupSelectorToken(g.id);
                  const label = competitionGroupTitle(g);
                  const isCurrentTarget =
                    currentOverlay === "standings" &&
                    groupChoiceIsSelected(overlayStageOrGroup, g, tournamentGroups);

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
                          <span className="font-bold text-slate-900 text-sm">{label}</span>
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
                          void handleSetOverlay("standings", `Points Table (${label})`, undefined, undefined, token);
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
                        <span>{isCurrentTarget ? "Live on Screen" : `Show ${label}`}</span>
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

                {tournamentStages.map((stage) => {
                  const stageLabel =
                    stage.drawName && tournamentStages.some((other) => other.drawId !== stage.drawId)
                      ? `${stage.drawName} — ${stage.roundKey}`
                      : stage.roundKey;
                  const stageMatchCount = stage.fixtureIds.length;
                  const isCurrentTarget =
                    currentOverlay === "standings" &&
                    stageChoiceIsSelected(overlayStageOrGroup, stage, tournamentStages);

                  return (
                    <div
                      key={stage.token}
                      className={cn(
                        "flex items-center justify-between gap-3 p-3.5 rounded-xl border transition shadow-sm",
                        isCurrentTarget
                          ? "border-amber-400 bg-amber-50/80 ring-1 ring-amber-300"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                      )}
                    >
                      <div className="min-w-0 space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 text-sm">{stageLabel}</span>
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
                          void handleSetOverlay("standings", `Stage (${stage.roundKey})`, undefined, undefined, stage.token);
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
                        <span>{isCurrentTarget ? "Live on Screen" : `Show ${stage.roundKey}`}</span>
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
