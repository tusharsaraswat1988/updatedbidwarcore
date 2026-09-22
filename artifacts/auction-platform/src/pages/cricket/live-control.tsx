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
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      {/* ─── SINGLE SCREEN VIEWPORT CONTAINER (NO PAGE-LEVEL SCROLL) ─── */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-3 min-h-[calc(100vh-4.5rem)] flex flex-col justify-between gap-3">
        
        {/* ─── 1. TOP HEADER & COMPACT CONSOLIDATED LINKS BAR ─── */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 bg-card/90 border border-border/80 rounded-xl px-3.5 py-2.5 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-red-500 animate-pulse" />
              <h1 className="text-sm sm:text-base font-black tracking-tight text-foreground uppercase">
                Live Broadcast Control Console
              </h1>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[10px] uppercase font-bold tracking-wider px-2 py-0.5",
                currentOverlay === "none"
                  ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                  : "border-amber-500/40 text-amber-400 bg-amber-500/10",
              )}
            >
              Screen: {currentOverlay === "none" ? "CAMERA ONLY" : currentOverlay.toUpperCase()}
            </Badge>
          </div>

          {/* Consolidated Links Strip */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* LED Ground */}
            <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
                className="px-2 py-1 font-semibold hover:bg-muted text-foreground text-[11px] flex items-center gap-1"
                title="Open LED Ground Scoreboard"
              >
                <span>📺 Ground LED</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(ledDisplayUrl, "LED Ground Link")}
                className="p-1 border-l border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Copy LED URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* OBS Stream */}
            <div className="flex items-center rounded-lg border border-sky-500/30 bg-sky-500/5 overflow-hidden">
              <button
                type="button"
                onClick={() => window.open(obsFullUrl, "_blank", "noopener,noreferrer")}
                className="px-2 py-1 font-semibold hover:bg-sky-500/10 text-sky-400 text-[11px] flex items-center gap-1"
                title="Open OBS Overlay Screen"
              >
                <span>🎥 OBS Stream</span>
                <ExternalLink className="w-3 h-3 text-sky-400/70" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(obsFullUrl, "OBS Live Stream Link")}
                className="p-1 border-l border-sky-500/30 hover:bg-sky-500/15 text-sky-400"
                title="Copy OBS URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* Fan Page */}
            <div className="flex items-center rounded-lg border border-border bg-background overflow-hidden">
              <button
                type="button"
                onClick={() => window.open(publicFanUrl, "_blank", "noopener,noreferrer")}
                className="px-2 py-1 font-semibold hover:bg-muted text-foreground text-[11px] flex items-center gap-1"
                title="Open Fan Match Page"
              >
                <span>📱 Fan Page</span>
                <ExternalLink className="w-3 h-3 text-muted-foreground" />
              </button>
              <button
                type="button"
                onClick={() => copyTextToClipboard(publicFanUrl, "Fan Page Link")}
                className="p-1 border-l border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                title="Copy Fan Page URL"
              >
                <Copy className="w-3 h-3" />
              </button>
            </div>

            {/* (i) Help Modal */}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setHelpInfoOpen(true)}
              className="h-7 px-2 text-[11px] text-muted-foreground hover:text-foreground gap-1 rounded-lg"
              title="Setup & Help"
            >
              <Info className="w-3.5 h-3.5 text-primary" />
              <span className="hidden sm:inline">Setup (i)</span>
            </Button>

            {/* Refresh */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={isFetching}
              onClick={() => void refetch()}
              className="h-7 px-2 text-[11px] rounded-lg"
              title="Refresh State"
            >
              <RefreshCw className={cn("w-3 h-3", isFetching && "animate-spin")} />
            </Button>

            {/* Back to Matches */}
            <Link href={cricketScoreHubPath(tournamentId)}>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px] rounded-lg text-muted-foreground">
                Matches Hub
              </Button>
            </Link>
          </div>
        </div>

        {/* ─── 2. MAIN 2-PANE OPERATOR DECK (FITS IN VIEWPORT) ─── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 flex-1 min-h-0">
          
          {/* ─── LEFT PANE: ACTIVE MATCH STATION (4 of 12 cols) ─── */}
          <div className="lg:col-span-4 rounded-xl border border-border/80 bg-card/70 p-3.5 flex flex-col justify-between shadow-xs">
            <div className="space-y-3">
              <div className="flex items-center justify-between border-b border-border/50 pb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Radio className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                  Active Live Match
                </span>
                {currentMatch && (
                  <Badge variant="outline" className="text-[10px] font-bold border-red-500/40 text-red-400 bg-red-500/10">
                    Match #{currentMatch.tournamentMatchNumber ?? currentMatch.id}
                  </Badge>
                )}
              </div>

              {currentMatch ? (
                <div className="space-y-3">
                  {/* Match selector if multiple matches */}
                  {matches && matches.length > 1 && (
                    <div className="flex items-center gap-1.5 text-xs">
                      <span className="text-muted-foreground text-[11px]">Switch:</span>
                      <select
                        value={currentMatch.id}
                        onChange={(e) => setSelectedMatchId(parseInt(e.target.value, 10))}
                        className="bg-background border border-border rounded px-2 py-1 text-xs text-foreground font-semibold flex-1"
                      >
                        {matches.map((m) => (
                          <option key={m.id} value={m.id}>
                            #{m.tournamentMatchNumber ?? m.id}: {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)} ({m.status})
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Teams and Scorebox */}
                  <div className="rounded-xl border border-border/70 bg-background/80 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-display font-black text-base text-foreground">
                        {activeHomeTeam?.shortCode ?? activeHomeTeam?.name ?? "Home"}
                      </span>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {currentHomeScore ?? "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-1.5">
                      <span className="font-display font-black text-base text-foreground">
                        {activeAwayTeam?.shortCode ?? activeAwayTeam?.name ?? "Away"}
                      </span>
                      <span className="font-mono font-bold text-sm text-foreground">
                        {currentAwayScore ?? "—"}
                      </span>
                    </div>

                    <div className="flex items-center justify-between border-t border-border/40 pt-1.5 text-[11px] text-muted-foreground">
                      <span>{currentMatch.rules?.overs ?? 20} Overs Match</span>
                      <span className="capitalize font-semibold text-primary">{currentMatch.status}</span>
                    </div>
                  </div>

                  {/* Scorer Pad Hero Trigger */}
                  <a
                    href={scorerPath}
                    className="flex items-center justify-center gap-2 w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs uppercase tracking-wider transition shadow-md shadow-amber-400/20"
                  >
                    <Radio className="w-4 h-4" />
                    <span>Open Scorer / Umpire Pad ↗</span>
                  </a>
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No active match selected.
                </div>
              )}
            </div>

            {/* Quick Secondary Match Links */}
            <div className="flex items-center gap-2 pt-2 border-t border-border/40 text-xs">
              <Link href={matchCenterPath} className="flex-1">
                <Button variant="outline" size="sm" className="w-full h-8 text-[11px] font-semibold">
                  Match Scorecard
                </Button>
              </Link>
              <a
                href={publicFanUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full h-8 text-[11px] font-semibold gap-1">
                  <span>Fan Page</span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground" />
                </Button>
              </a>
            </div>
          </div>

          {/* ─── RIGHT PANE: SCREEN MODE SELECTOR (8 of 12 cols) ─── */}
          <div className="lg:col-span-8 rounded-xl border border-border/80 bg-card/70 p-3.5 flex flex-col justify-between shadow-xs">
            <div className="space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-border/50 pb-2">
                <div>
                  <h2 className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Layers className="w-4 h-4 text-primary" />
                    Screen Mode Selector (LED &amp; OBS Displays)
                  </h2>
                  <p className="text-[11px] text-muted-foreground">
                    Click any button to switch the live display mode across Ground LED and OBS Live Stream:
                  </p>
                </div>
                {lastTriggeredFlash ? (
                  <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse self-start sm:self-auto">
                    Flash: {lastTriggeredFlash}
                  </span>
                ) : null}
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
                        "flex flex-col items-start p-2.5 rounded-xl border text-left transition relative cursor-pointer select-none",
                        isActive
                          ? "border-primary bg-primary/15 text-primary ring-2 ring-primary/60 shadow-md"
                          : "border-border/80 bg-background/90 hover:bg-muted/70 text-foreground hover:border-border",
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <span className="text-lg">{item.icon}</span>
                        {isActive ? (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase tracking-wider bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full">
                            <CheckCircle2 className="w-2.5 h-2.5" />
                            ACTIVE
                          </span>
                        ) : (
                          <span className="text-[9px] font-semibold text-muted-foreground/70 uppercase">
                            {item.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-xs font-bold leading-tight line-clamp-1">
                        {item.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 leading-snug">
                        {item.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hint Strip */}
            <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-2 border-t border-border/40">
              <span>All score data is automatically fed by the match scorer.</span>
              <button
                type="button"
                onClick={() => handleSetOverlay("none", "Camera Feed Only")}
                className="text-primary hover:underline font-semibold flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                Reset to Camera Only
              </button>
            </div>
          </div>
        </div>

        {/* ─── 3. BOTTOM OVERRIDE & EMERGENCY DECK ─── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-card/90 border border-border/80 rounded-xl p-2.5 shadow-xs text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-400" />
              Manual Triggers &amp; Emergency Tools:
            </span>
            <span className="text-[11px] text-muted-foreground hidden md:inline">
              (Auto-triggered by Scorer on each ball. Use below buttons only for manual override)
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Hidden/Collapsible Manual Animation Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setAnimationsModalOpen(true)}
              className="h-8 text-xs font-bold border-amber-500/40 text-amber-400 hover:bg-amber-500/10 gap-1.5 rounded-lg"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Manual Animation Overrides (10 triggers) ▾</span>
            </Button>

            {/* Emergency Blackout Button */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSetOverlay("none", "Emergency Reset (Camera Only)")}
              className="h-8 text-xs font-bold border-red-500/40 text-red-400 hover:bg-red-500/10 gap-1.5 rounded-lg"
              title="Instantly clear all screen overlays"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Reset Screen (Camera Only)</span>
            </Button>
          </div>
        </div>

      </div>

      {/* ─── MODAL: MANUAL SCORING ANIMATION OVERRIDES (10 BUTTONS HIDDEN BEHIND MODAL) ─── */}
      <Dialog open={animationsModalOpen} onOpenChange={setAnimationsModalOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              Manual Scoring Animation Overrides
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 text-xs">
            <div className="rounded-xl border border-border bg-muted/30 p-3 text-muted-foreground">
              <p className="font-semibold text-foreground mb-0.5">ℹ️ Auto-Trigger Information:</p>
              <p>
                Jab scorer match pad par 4, 6, wicket, ya no-ball score karta hai, to yeh animations OBS stream aur LED scoreboard par automatically play ho jati hain.
              </p>
              <p className="mt-1 text-[11px] text-amber-300">
                Agar kisi emergency ya testing ke liye aapko manully animation trigger karni ho, tabhi niche diye gaye button par click karein (3.5 second on-screen burst).
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
                    "flex flex-col items-start p-2.5 rounded-xl text-left transition active:scale-95 shadow-sm font-bold",
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tv className="w-5 h-5 text-primary" />
              Live Screen &amp; OBS Setup Guide
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1 text-xs text-muted-foreground leading-relaxed">
            <div className="rounded-xl border border-sky-500/30 p-3.5 bg-sky-500/5 space-y-1.5">
              <p className="font-bold text-sky-400 flex items-center gap-1.5">
                <span>🎥 OBS Studio &amp; vMix Live Stream Setup</span>
              </p>
              <p>
                1. OBS me <strong>Add Source (+) &gt; Browser</strong> chunein.
                <br />
                2. Upar ka <strong>OBS Stream URL</strong> copy karke paste karein.
                <br />
                3. Settings: <strong>Width: 1920</strong>, <strong>Height: 1080</strong>, <strong>FPS: 60</strong> set karein.
                <br />
                4. Camera video layer ke upar Browser Source ko place karein. Mid-section 100% transparent rehta hai.
              </p>
            </div>

            <div className="rounded-xl border border-border p-3.5 bg-muted/30 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5">
                <span>📺 Ground LED Screen &amp; Projector Setup</span>
              </p>
              <p>
                LED display laptop par Chrome browser me <strong>Ground LED Link</strong> open karein aur keyboard par <strong>F11</strong> press karke full screen mode on karein. Score auto-sync hota hai.
              </p>
            </div>

            <div className="rounded-xl border border-amber-500/30 p-3.5 bg-amber-500/5 space-y-1.5">
              <p className="font-bold text-amber-400 flex items-center gap-1.5">
                <span>🎛️ Operator Console Instructions</span>
              </p>
              <p>
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
