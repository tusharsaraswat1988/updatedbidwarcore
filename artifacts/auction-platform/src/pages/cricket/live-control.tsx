/**
 * Match Day Live Control Console — Single-screen operator deck for live broadcast & display.
 * Controls what is shown on LED scoreboards and OBS Live Stream.
 * Route: /tournament/:id/score/live-control
 */
import { useMemo, useState, useCallback, useEffect } from "react";
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
import { useScoringMatches, useScoringMatch } from "@/hooks/use-scoring-match";
import { getCricketMasterTeams, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketMatchCenterPath,
  cricketScoreHubPath,
  cricketScorerConsolePath,
} from "@/lib/cricket-routes";
import {
  cricketMatchPublicPath,
  cricketObsLivePath,
  cricketPublicPath,
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
  Info,
  Sparkles,
  Layers,
  Flame,
  ShieldAlert,
  RotateCcw,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

const OVERLAY_OPTIONS: { id: CricketObsMidOverlayKind; label: string; desc: string; icon: string; tag: string }[] = [
  { id: "none", label: "Camera Feed Only", desc: "Transparent feed with lower scorebug", icon: "🎥", tag: "LIVE STREAM" },
  { id: "sponsors", label: "Sponsor Showcase", desc: "Full sponsor wall & commercial ad cards", icon: "★", tag: "COMMERCIAL" },
  { id: "standings", label: "Points Table", desc: "Tournament rankings & standings", icon: "📊", tag: "STANDINGS" },
  { id: "fixtures", label: "Upcoming Matches", desc: "Next fixtures & tournament schedule", icon: "📅", tag: "SCHEDULE" },
  { id: "scorecard", label: "Full Scorecard", desc: "Detailed innings & bowling figures", icon: "📋", tag: "SCORECARD" },
  { id: "summary", label: "Match Summary", desc: "Post-match result & top performers", icon: "🏆", tag: "RESULT" },
  { id: "intro", label: "Match Intro / VS", desc: "3D team badges & pre-match build-up", icon: "⚔️", tag: "PRE-MATCH" },
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

  // OBS & LED live control state
  const [currentOverlay, setCurrentOverlay] = useState<CricketObsMidOverlayKind>("none");
  const [lastTriggeredFlash, setLastTriggeredFlash] = useState<string | null>(null);
  const [animationsModalOpen, setAnimationsModalOpen] = useState(false);
  const [helpInfoOpen, setHelpInfoOpen] = useState(false);

  // Sync active overlay state with server
  const { data: serverState } = useQuery<{ overlay?: string }>({
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
  }, [serverState?.overlay]);

  const broadcastCommand = useCallback(
    (message: { type: string; overlay?: CricketObsMidOverlayKind; flash?: CricketObsFlashKind; detail?: string }) => {
      if (typeof window === "undefined" || typeof BroadcastChannel === "undefined") return;
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

  const handleSetOverlay = useCallback(
    async (overlay: CricketObsMidOverlayKind, label: string) => {
      setCurrentOverlay(overlay);

      try {
        await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ overlay }),
        });
      } catch (err) {
        console.error("Failed to send OBS director overlay to server:", err);
      }

      broadcastCommand({ type: "SET_OVERLAY", overlay });

      toast({
        title: `Screen Mode: ${label}`,
        description:
          overlay === "none"
            ? "Camera feed active. Overlays hidden."
            : `Pushed ${label} to live displays.`,
      });
    },
    [tournamentId, broadcastCommand, toast],
  );

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
  const publicFanUrl = currentMatch
    ? cricketMatchPublicPath(tournamentId, currentMatch.id)
    : cricketPublicPath(tournamentId);

  const obsFullUrl =
    typeof window !== "undefined"
      ? scoringAppPublicUrl(window.location.origin, obsStreamUrl)
      : obsStreamUrl;

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
    ? `${matchState.innings[1]?.runs ?? 0}/${matchState.innings[1]?.wickets ?? 0} (${Math.floor((matchState.innings[1]?.balls ?? 0) / 6)}.${(matchState.innings[1]?.balls ?? 0) % 6} ov)`
    : null;

  const currentAwayScore = matchState && matchState.awayTeamId
    ? `${matchState.innings[2]?.runs ?? 0}/${matchState.innings[2]?.wickets ?? 0} (${Math.floor((matchState.innings[2]?.balls ?? 0) / 6)}.${(matchState.innings[2]?.balls ?? 0) % 6} ov)`
    : null;

  const scorerPath = currentMatch
    ? cricketScorerConsolePath(tournamentId, currentMatch.id)
    : cricketScoreHubPath(tournamentId);

  const matchCenterPath = currentMatch
    ? cricketMatchCenterPath(tournamentId, currentMatch.id)
    : cricketScoreHubPath(tournamentId);

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId} themeVariant="console">
      {/* ─── MAIN CONTAINER: FLUID SCROLL ON MOBILE, FIT-VIEWPORT ON DESKTOP ─── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3 w-full flex flex-col gap-3 pb-16 sm:pb-8 lg:pb-0 lg:flex-1 lg:min-h-0 lg:overflow-hidden lg:justify-between">
        
        {/* ─── 1. ACTIVE MATCH SCORE CARD (CLEAN 2-LINE DISPLAY) ─── */}
        <div className="bg-slate-900/85 border border-slate-800/90 rounded-xl p-3 sm:p-3.5 text-xs shadow-sm">
          {currentMatch ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              {/* Left: 2-Line Scores with Team names & Overs */}
              <div className="flex-1 min-w-0 space-y-1.5">
                {/* Meta row: Match #, Overs, Status & Match Switcher */}
                <div className="flex items-center justify-between gap-2 flex-wrap text-[10px] text-slate-400">
                  <div className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1 font-bold text-red-400 bg-red-500/10 border border-red-500/25 px-1.5 py-0.5 rounded">
                      <Radio className="w-2.5 h-2.5 text-red-500 animate-pulse" />
                      Match #{currentMatch.tournamentMatchNumber ?? currentMatch.id}
                    </span>
                    <span>{currentMatch.rules?.overs ?? 20} Overs Match</span>
                    <span className="text-amber-400 font-semibold capitalize">• {currentMatch.status}</span>
                  </div>

                  {matches && matches.length > 1 && (
                    <div className="flex items-center gap-1">
                      <span className="text-slate-500">Switch:</span>
                      <select
                        value={currentMatch.id}
                        onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
                        className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-medium focus:outline-none"
                      >
                        {matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            #{m.tournamentMatchNumber ?? m.id}: {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {/* Team 1 Score Line */}
                <div className="flex items-center justify-between pt-0.5">
                  <span className="font-semibold text-sm sm:text-base text-slate-100 truncate pr-2">
                    {activeHomeTeam?.name ?? activeHomeTeam?.shortCode ?? "Home Team"}
                  </span>
                  <span className="font-mono font-medium text-xs sm:text-sm text-slate-200 shrink-0">
                    {currentHomeScore ?? "0/0 (0.0 ov)"}
                  </span>
                </div>

                {/* Team 2 Score Line */}
                <div className="flex items-center justify-between border-t border-slate-800/40 pt-1">
                  <span className="font-semibold text-sm sm:text-base text-slate-100 truncate pr-2">
                    {activeAwayTeam?.name ?? activeAwayTeam?.shortCode ?? "Away Team"}
                  </span>
                  <span className="font-mono font-medium text-xs sm:text-sm text-slate-200 shrink-0">
                    {currentAwayScore ?? "0/0 (0.0 ov)"}
                  </span>
                </div>
              </div>

              {/* Right / Bottom on Mobile: Scorer Pad CTA */}
              <div className="flex sm:flex-col items-center justify-between sm:justify-center gap-2 pt-1.5 sm:pt-0 sm:pl-3.5 border-t sm:border-t-0 sm:border-l border-slate-800/60 shrink-0">
                <a
                  href={scorerPath}
                  className="flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-sm active:scale-[0.99] flex-1 sm:flex-none"
                >
                  <Radio className="w-3.5 h-3.5" />
                  <span>Scorer Pad ↗</span>
                </a>
                <Link href={matchCenterPath} className="text-slate-400 hover:text-slate-200 text-[11px] underline sm:no-underline">
                  Full Scorecard ↗
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-3 text-xs text-slate-400">
              No active match selected.
            </div>
          )}
        </div>

        {/* ─── 2. SCREEN MODE SELECTOR (PRIMARY CONTROL DECK) ─── */}
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/70 p-3.5 flex flex-col justify-between shadow-sm">
          <div className="space-y-2.5">
            {/* Header with Title + Screen Status Badge + Refresh Button */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/60 pb-2.5">
              <div className="flex items-center justify-between w-full sm:w-auto gap-2">
                <div>
                  <h2 className="text-xs sm:text-sm font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-slate-400" />
                    Screen Mode Selector (LED &amp; OBS Displays)
                  </h2>
                  <p className="text-[11px] text-slate-400 hidden sm:block">
                    Switch the live display mode across Ground LED and OBS Live Stream:
                  </p>
                </div>

                {/* Mobile-only status & refresh in header */}
                <div className="flex sm:hidden items-center gap-1.5 shrink-0">
                  <Badge
                    variant="outline"
                    className={cn(
                      "text-[9px] uppercase font-semibold tracking-wider px-1.5 py-0.5",
                      currentOverlay === "none"
                        ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                        : "border-amber-500/30 text-amber-400 bg-amber-500/10",
                    )}
                  >
                    {currentOverlay === "none" ? "CAMERA ONLY" : currentOverlay.toUpperCase()}
                  </Badge>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={isFetching}
                    onClick={() => void refetch()}
                    className="h-6 w-6 p-0 text-slate-400 hover:text-slate-200"
                    title="Refresh State"
                  >
                    <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                  </Button>
                </div>
              </div>

              {/* Desktop status & refresh */}
              <div className="hidden sm:flex items-center gap-2 shrink-0">
                {lastTriggeredFlash ? (
                  <span className="text-[11px] font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25 animate-pulse">
                    Flash: {lastTriggeredFlash}
                  </span>
                ) : null}

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] uppercase font-semibold tracking-wider px-2 py-0.5",
                    currentOverlay === "none"
                      ? "border-emerald-500/30 text-emerald-400 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-400 bg-amber-500/10",
                  )}
                >
                  Screen: {currentOverlay === "none" ? "CAMERA ONLY" : currentOverlay.toUpperCase()}
                </Badge>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isFetching}
                  onClick={() => void refetch()}
                  className="h-7 px-2 text-[11px] rounded-lg border-slate-800 bg-slate-950/40 text-slate-300 hover:bg-slate-800/60"
                  title="Refresh State"
                >
                  <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
                </Button>
              </div>
            </div>

            {/* Tactical 7-Scene Selector Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 pt-1">
              {OVERLAY_OPTIONS.map((item) => {
                const isActive = currentOverlay === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSetOverlay(item.id, item.label)}
                    className={cn(
                      "flex flex-col items-start p-2.5 rounded-xl border text-left transition relative cursor-pointer select-none min-h-[76px]",
                      isActive
                        ? "border-emerald-500/70 bg-emerald-950/25 text-emerald-300 ring-1 ring-emerald-500/40 shadow-sm"
                        : "border-slate-800/80 bg-slate-950/60 hover:bg-slate-800/50 text-slate-300 hover:border-slate-700",
                    )}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <span className="text-base">{item.icon}</span>
                      {isActive ? (
                        <span className="flex items-center gap-1 text-[9px] font-semibold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-1.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          ACTIVE
                        </span>
                      ) : (
                        <span className="text-[9px] font-medium text-slate-500 uppercase">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-200 leading-tight line-clamp-1">
                      {item.label}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal line-clamp-2 mt-0.5 leading-snug">
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Hint Strip */}
          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2.5 mt-2 border-t border-slate-800/60">
            <span className="truncate pr-2">Scores auto-sync from match scorer.</span>
            <button
              type="button"
              onClick={() => handleSetOverlay("none", "Camera Feed Only")}
              className="text-slate-300 hover:text-white hover:underline font-medium flex items-center gap-1 shrink-0"
            >
              <RotateCcw className="w-3 h-3" />
              Reset to Camera
            </button>
          </div>
        </div>

        {/* ─── 3. EMERGENCY & MANUAL OVERRIDE TOOLS ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-900/80 border border-slate-800/90 rounded-xl p-3 shadow-sm text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              Manual Animation &amp; Emergency Tools
            </span>
            <span className="text-[11px] text-slate-400 hidden md:inline">
              (Scorer auto-triggers boundaries. Use below for manual overrides)
            </span>
          </div>

          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2">
            {/* Manual Animation Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAnimationsModalOpen(true)}
              className="h-8 text-xs font-medium border-amber-500/30 text-amber-400 bg-amber-500/5 hover:bg-amber-500/15 gap-1.5 rounded-lg flex-1 sm:flex-none justify-center"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Animation Overrides (10) ▾</span>
            </Button>

            {/* Emergency Reset Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSetOverlay("none", "Emergency Reset (Camera Only)")}
              className="h-8 text-xs font-medium border-red-500/30 text-red-400 bg-red-500/5 hover:bg-red-500/15 gap-1.5 rounded-lg flex-1 sm:flex-none justify-center"
              title="Instantly clear all screen overlays"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Reset Screen (Camera Only)</span>
            </Button>
          </div>
        </div>

        {/* ─── 4. SHARABLE BROADCAST LINKS SECTION (BOTTOM) ─── */}
        <div className="bg-slate-900/80 border border-slate-800/90 rounded-xl p-3.5 shadow-sm text-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-800/60 pb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Tv className="w-4 h-4 text-slate-400" />
              Broadcast &amp; Display Screen Links
            </span>
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              Open on external display or copy URL
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {/* Ground LED */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">📺</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 text-xs truncate">Ground LED Screen</p>
                  <p className="text-[10px] text-slate-400 truncate">Scoreboard display feed</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
                  title="Open LED Display"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => copyTextToClipboard(ledDisplayUrl, "LED Ground URL")}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors"
                  title="Copy Link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* OBS Live Stream */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-sky-500/25 bg-sky-950/20 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">🎥</span>
                <div className="min-w-0">
                  <p className="font-semibold text-sky-400 text-xs truncate">OBS Live Stream Feed</p>
                  <p className="text-[10px] text-slate-400 truncate">Browser source for OBS/vMix</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(obsFullUrl, "_blank", "noopener,noreferrer")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 flex items-center gap-1 transition-colors"
                  title="Open OBS Feed"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3 text-sky-400" />
                </button>
                <button
                  type="button"
                  onClick={() => copyTextToClipboard(obsFullUrl, "OBS Live Stream URL")}
                  className="p-1.5 text-sky-400 hover:text-sky-200 rounded-md hover:bg-sky-500/20 transition-colors"
                  title="Copy Link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Public Fan Center */}
            <div className="flex items-center justify-between p-2.5 rounded-xl border border-slate-800 bg-slate-950/60 gap-2 sm:col-span-2 lg:col-span-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-base shrink-0">📱</span>
                <div className="min-w-0">
                  <p className="font-semibold text-slate-200 text-xs truncate">Public Fan Center</p>
                  <p className="text-[10px] text-slate-400 truncate">Mobile viewer match page</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => window.open(publicFanUrl, "_blank", "noopener,noreferrer")}
                  className="px-2.5 py-1 text-[11px] font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1 transition-colors"
                  title="Open Fan Page"
                >
                  <span>Open</span>
                  <ExternalLink className="w-3 h-3 text-slate-400" />
                </button>
                <button
                  type="button"
                  onClick={() => copyTextToClipboard(publicFanUrl, "Fan Page URL")}
                  className="p-1.5 text-slate-400 hover:text-slate-200 rounded-md hover:bg-slate-800 transition-colors"
                  title="Copy Link"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Secondary Actions Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setHelpInfoOpen(true)}
              className="h-8 px-3 text-xs text-slate-300 border-slate-800 bg-slate-950/40 hover:bg-slate-800/60 gap-1.5 rounded-lg flex-1 sm:flex-none justify-center"
            >
              <Info className="w-3.5 h-3.5 text-slate-300" />
              <span>OBS &amp; LED Setup Guide (i)</span>
            </Button>

            <Link href={cricketScoreHubPath(tournamentId)} className="flex-1 sm:flex-none">
              <Button variant="ghost" size="sm" className="w-full h-8 px-3 text-xs rounded-lg text-slate-400 hover:text-slate-200 font-medium">
                Matches Hub ↗
              </Button>
            </Link>
          </div>
        </div>

      </div>

      {/* ─── MODAL: MANUAL SCORING ANIMATION OVERRIDES (10 BUTTONS HIDDEN BEHIND MODAL) ─── */}
      <Dialog open={animationsModalOpen} onOpenChange={setAnimationsModalOpen}>
        <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100 font-semibold text-base">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Manual Scoring Animation Overrides
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 text-xs">
            <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 text-slate-300">
              <p className="font-medium text-slate-100 mb-0.5">ℹ️ Auto-Trigger Information:</p>
              <p className="text-slate-400">
                Jab scorer match pad par 4, 6, wicket, ya no-ball score karta hai, to yeh animations OBS stream aur LED scoreboard par automatically play ho jati hain.
              </p>
              <p className="mt-1 text-[11px] text-amber-400 font-medium">
                Agar kisi emergency ya testing ke liye aapko manually animation trigger karni ho, tabhi niche diye gaye button par click karein (3.5 second on-screen burst).
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
                    "flex flex-col items-start p-2.5 rounded-xl text-left transition active:scale-95 shadow-sm font-medium",
                    item.color,
                  )}
                >
                  <span className="text-xs leading-tight">{item.label}</span>
                  <span className="text-[10px] opacity-80 font-normal mt-0.5">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ─── MODAL: SETUP & BROADCAST HELP GUIDE (i) ─── */}
      <Dialog open={helpInfoOpen} onOpenChange={setHelpInfoOpen}>
        <DialogContent className="max-w-lg bg-slate-900 border-slate-800 text-slate-200">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-100 font-semibold text-base">
              <Tv className="w-5 h-5 text-sky-400" />
              Live Screen &amp; OBS Setup Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 text-xs text-slate-300 leading-relaxed">
            <div className="rounded-xl border border-sky-500/25 p-3.5 bg-sky-950/20 space-y-1.5">
              <p className="font-semibold text-sky-400 flex items-center gap-1.5">
                <span>🎥 OBS Studio &amp; vMix Live Stream Setup</span>
              </p>
              <p className="text-slate-300">
                1. OBS me <strong>Add Source (+) &gt; Browser</strong> chunein.
                <br />
                2. Upar ka <strong>OBS Stream URL</strong> copy karke paste karein.
                <br />
                3. Settings: <strong>Width: 1920</strong>, <strong>Height: 1080</strong>, <strong>FPS: 60</strong> set karein.
                <br />
                4. Camera video layer ke upar Browser Source ko place karein. Mid-section 100% transparent rehta hai.
              </p>
            </div>

            <div className="rounded-xl border border-slate-800 p-3.5 bg-slate-950/60 space-y-1.5">
              <p className="font-semibold text-slate-200 flex items-center gap-1.5">
                <span>📺 Ground LED Screen &amp; Projector Setup</span>
              </p>
              <p className="text-slate-400">
                LED display laptop par Chrome browser me <strong>Ground LED Link</strong> open karein aur keyboard par <strong>F11</strong> press karke full screen mode on karein. Score auto-sync hota hai.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/25 p-3.5 bg-amber-500/10 space-y-1.5">
              <p className="font-semibold text-amber-400 flex items-center gap-1.5">
                <span>🎛️ Operator Console Instructions</span>
              </p>
              <p className="text-slate-300">
                • Scorer ground se match score karta rahega.
                <br />
                • Operator is page se LED &amp; OBS screen ka mode switch karega (Playing XI, Points Table, Sponsors, Match Summary).
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </CricketOrganizerPageShell>
  );
}
