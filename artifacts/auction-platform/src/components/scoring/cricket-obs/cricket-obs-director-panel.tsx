import { useState, useCallback, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { CricketObsFlashKind, CricketObsMidOverlayKind } from "@/lib/cricket-obs-view-model";
import { cricketObsLivePath } from "@/lib/tournament-navigation";
import { listScoringMatches, getScoringStandings, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { parseTournamentSponsors } from "@/components/scoring/public-sponsors-strip";
import { CricketObsBroadcastMessageControl } from "@/components/scoring/cricket-obs/cricket-obs-broadcast-message-control";
import { Tv, Radio, Sparkles, Eye, CheckCircle2, Copy, ExternalLink, Calendar, Trophy, Handshake, Table, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  tournamentId: number;
  auctionCode?: string | null;
};

export function CricketObsDirectorPanel({ tournamentId, auctionCode }: Props) {
  const { toast } = useToast();
  const [currentOverlay, setCurrentOverlay] = useState<CricketObsMidOverlayKind>("none");
  const [overlayMatchId, setOverlayMatchId] = useState<number | undefined>(undefined);
  const [overlaySponsorName, setOverlaySponsorName] = useState<string | undefined>(undefined);
  const [overlayStageOrGroup, setOverlayStageOrGroup] = useState<string | undefined>(undefined);
  const [lastTriggeredFlash, setLastTriggeredFlash] = useState<string | null>(null);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [matchSelectModalOpen, setMatchSelectModalOpen] = useState(false);
  const [sponsorSelectModalOpen, setSponsorSelectModalOpen] = useState(false);
  const [standingsSelectModalOpen, setStandingsSelectModalOpen] = useState(false);
  const [targetOverlayForMatch, setTargetOverlayForMatch] = useState<{ id: CricketObsMidOverlayKind; label: string; icon?: string } | null>(null);
  const [matchFilterStatus, setMatchFilterStatus] = useState<"all" | "live" | "upcoming" | "completed">("all");

  const obsPath = cricketObsLivePath(tournamentId, auctionCode);
  const obsUrl = typeof window !== "undefined" ? `${window.location.origin}${obsPath}` : obsPath;

  // Tournament details for sponsors
  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: tournamentId > 0 },
  });
  const sponsors = useMemo(
    () => parseTournamentSponsors(tournament?.sponsorLogos),
    [tournament?.sponsorLogos],
  );

  // Standings query for groups
  const { data: standings } = useQuery({
    queryKey: ["cricket-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 30_000,
  });
  const availableGroups = useMemo(() => {
    if (!standings?.groups || standings.groups.length === 0) return [];
    return standings.groups.map((g) => g.groupName).filter(Boolean);
  }, [standings?.groups]);

  // Sync active overlay state with server on mount / refetch
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

  // Matches query
  const { data: matches } = useQuery({
    queryKey: ["scoring-matches", tournamentId],
    queryFn: () => listScoringMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 15_000,
  });

  const liveMatches = useMemo(() => (matches ?? []).filter((m) => m.status === "live"), [matches]);
  const upcomingMatches = useMemo(() => (matches ?? []).filter((m) => m.status === "upcoming" || m.status === "scheduled"), [matches]);
  const completedMatches = useMemo(() => (matches ?? []).filter((m) => isTerminalCricketMatchStatus(m.status)), [matches]);

  const filteredMatches = useMemo(() => {
    if (!matches) return [];
    if (matchFilterStatus === "live") return liveMatches;
    if (matchFilterStatus === "upcoming") return upcomingMatches;
    if (matchFilterStatus === "completed") return completedMatches;
    return matches;
  }, [matches, matchFilterStatus, liveMatches, upcomingMatches, completedMatches]);

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
  }, [serverState?.overlay, serverState?.matchId, serverState?.sponsorName, serverState?.stageOrGroup]);

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
    async (
      overlay: CricketObsMidOverlayKind,
      label: string,
      matchId?: number,
      options?: { sponsorName?: string; stageOrGroup?: string },
    ) => {
      setCurrentOverlay(overlay);
      setOverlayMatchId(matchId);
      setOverlaySponsorName(options?.sponsorName);
      setOverlayStageOrGroup(options?.stageOrGroup);

      // 1. Send to server so remote OBS Studio on streaming PC updates via SSE
      try {
        await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            overlay,
            matchId,
            sponsorName: options?.sponsorName,
            stageOrGroup: options?.stageOrGroup,
          }),
        });
      } catch (err) {
        console.error("Failed to send OBS director overlay to server:", err);
      }

      // 2. BroadcastChannel for instant local tab sync
      broadcastCommand({
        type: "SET_OVERLAY",
        overlay,
        matchId,
        sponsorName: options?.sponsorName,
        stageOrGroup: options?.stageOrGroup,
      });

      const extraText = options?.sponsorName
        ? ` (${options.sponsorName})`
        : options?.stageOrGroup
        ? ` (${options.stageOrGroup})`
        : matchId
        ? ` (Match #${matchId})`
        : "";

      toast({
        title: `OBS Screen: ${label}`,
        description:
          overlay === "none"
            ? "Overlay closed. Camera feed 100% visible."
            : `Pushed ${label}${extraText} to OBS screen in real time.`,
      });
    },
    [tournamentId, broadcastCommand, toast],
  );

  const handleOverlayButtonClick = (item: { id: CricketObsMidOverlayKind; label: string; icon: string }) => {
    if (item.id === "none") {
      void handleSetOverlay("none", "Camera Feed Only");
      return;
    }
    if (item.id === "neutral") {
      void handleSetOverlay("neutral", "Neutral Screen");
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
    setTargetOverlayForMatch(item);
    setMatchSelectModalOpen(true);
  };

  const handleTriggerFlash = useCallback(
    async (flash: CricketObsFlashKind, label: string) => {
      setLastTriggeredFlash(label);

      // 1. Send to server for remote streaming PC via SSE
      try {
        await fetch(`/api/tournaments/${tournamentId}/scoring/obs-director`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ flash }),
        });
      } catch (err) {
        console.error("Failed to send flash trigger to server:", err);
      }

      // 2. BroadcastChannel for local tabs
      broadcastCommand({ type: "TRIGGER_FLASH", flash });

      toast({
        title: `Triggered Animation: ${label}`,
        description: "Sent to OBS screen (holds on-screen for 3.5s).",
      });
      setTimeout(() => {
        setLastTriggeredFlash(null);
      }, 3500);
    },
    [tournamentId, broadcastCommand, toast],
  );

  const handleCopyLink = useCallback(() => {
    void navigator.clipboard.writeText(obsUrl).then(
      () => {
        setCopiedUrl(true);
        toast({
          title: "OBS Screen URL Copied!",
          description: "Paste into OBS Studio as a Browser Source (1920×1080).",
        });
        setTimeout(() => setCopiedUrl(false), 2500);
      },
      () => {
        toast({ title: "Could not copy link", variant: "destructive" });
      },
    );
  }, [obsUrl, toast]);

  const overlayOptions: { id: CricketObsMidOverlayKind; label: string; desc: string; icon: string }[] = [
    { id: "none", label: "Camera Feed Only", desc: "No mid overlay. Camera feed 100% visible.", icon: "🎥" },
    { id: "neutral", label: "Neutral Screen", desc: "Tournament & Sponsor plate between matches / intervals", icon: "⏸️" },
    { id: "sponsors", label: "Sponsor Showcase", desc: "All sponsors or single sponsor spotlight", icon: "★" },
    { id: "standings", label: "Points Table", desc: "Overall, group-wise, or stage rankings", icon: "📊" },
    { id: "fixtures", label: "Upcoming Matches", desc: "Next Fixtures & Schedule", icon: "📅" },
    { id: "scorecard", label: "Full Scorecard", desc: "Bowling Card & Fall of Wickets", icon: "📋" },
    { id: "summary", label: "Match Summary", desc: "Post-Match Summary & Top Performers", icon: "🏆" },
    { id: "intro", label: "Match Intro / VS", desc: "Team Badges & Match Details", icon: "⚔️" },
  ];

  const animationOptions: { flash: CricketObsFlashKind; label: string; color: string }[] = [
    { flash: "FOUR", label: "Four (Boundary)", color: "bg-blue-600 hover:bg-blue-500 text-white" },
    { flash: "SIX", label: "Six (Maximum)", color: "bg-purple-600 hover:bg-purple-500 text-white" },
    { flash: "SUPERBALL", label: "Superball", color: "bg-orange-600 hover:bg-orange-500 text-white" },
    { flash: "WICKET", label: "Wicket (Out)", color: "bg-rose-600 hover:bg-rose-500 text-white" },
    { flash: "FREE_HIT", label: "Free Hit", color: "bg-cyan-600 hover:bg-cyan-500 text-white" },
    { flash: "NO_BALL", label: "No Ball", color: "bg-amber-600 hover:bg-amber-500 text-white" },
    { flash: "WIDE", label: "Wide", color: "bg-slate-700 hover:bg-slate-600 text-white" },
    { flash: "NEW_BATSMAN", label: "New Batsman", color: "bg-emerald-600 hover:bg-emerald-500 text-white" },
    { flash: "TOSS_WIN", label: "Toss Win", color: "bg-yellow-700 hover:bg-yellow-600 text-white" },
    { flash: "MATCH_WON", label: "Match Won (Victory)", color: "bg-amber-500 hover:bg-amber-400 text-black font-black" },
  ];

  return (
    <section className="rounded-xl border border-border bg-card/90 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-border/40 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              Cricket OBS Screen Director &amp; Triggers
            </h2>
            <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
              Cloud SSE Synced
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Trigger full-screen 80% broadcast overlays and instant scoring animations on your streaming team&apos;s OBS screen in real time from mobile or PC.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 bg-muted/70 rounded-lg px-2.5 py-1 text-xs border border-border">
            <span className="text-muted-foreground">OBS:</span>
            <Badge
              variant={currentOverlay === "none" ? "outline" : "default"}
              className="text-[11px] font-black uppercase tracking-wider"
            >
              {currentOverlay === "none"
                ? "Camera Only"
                : `${currentOverlay.toUpperCase()}${overlaySponsorName ? ` · ${overlaySponsorName}` : ""}${overlayStageOrGroup ? ` · ${overlayStageOrGroup}` : ""}`}
            </Badge>
          </div>

          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1 text-xs font-semibold hover:bg-muted transition"
            title="Copy OBS Screen URL"
          >
            {copiedUrl ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
            <span>{copiedUrl ? "Copied" : "Copy Link"}</span>
          </button>

          <a
            href={obsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1 text-xs font-bold text-primary-foreground hover:bg-primary/90 shadow-sm transition"
          >
            <Tv className="w-3.5 h-3.5" />
            <span>Open OBS ↗</span>
          </a>
        </div>
      </div>

      {/* 1. 80% SCREEN OVERLAYS */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5" />
            80% Screen Mid Overlays (Frosted Broadcast Cards)
          </span>
          <span className="text-[11px] text-muted-foreground">
            Click any button to switch the OBS screen display
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {overlayOptions.map((item) => {
            const isActive = currentOverlay === item.id;
            const isMatchSpecific = ["fixtures", "summary", "intro", "scorecard"].includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleOverlayButtonClick(item)}
                className={`relative flex flex-col items-start p-3.5 rounded-xl border-2 text-left transition-all duration-150 active:scale-[0.98] shadow-sm ${
                  isActive
                    ? "border-emerald-400 bg-gradient-to-b from-emerald-600 via-emerald-700 to-emerald-800 text-white shadow-emerald-500/20 shadow-md ring-2 ring-emerald-400/40"
                    : "border-border bg-card hover:bg-muted/70 text-foreground hover:border-primary/40"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black shadow-inner ${
                    isActive ? "bg-white/20 text-white border border-white/30" : "bg-muted text-foreground border border-border"
                  }`}>
                    {item.icon}
                  </div>
                  {isActive ? (
                    <span className="text-[10px] font-black uppercase tracking-wider bg-white/25 px-2 py-0.5 rounded-md text-white flex items-center gap-1 border border-white/30">
                      <CheckCircle2 className="w-3 h-3 text-emerald-200" />
                      {overlayMatchId ? `#${overlayMatchId}` : overlaySponsorName ? "SPONSOR" : overlayStageOrGroup ? "GROUP" : "ACTIVE"}
                    </span>
                  ) : isMatchSpecific ? (
                    <span className="text-[9px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border uppercase">▾ Match</span>
                  ) : item.id === "sponsors" ? (
                    <span className="text-[9px] font-bold text-amber-600 bg-amber-50 dark:bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800 uppercase">▾ Choose</span>
                  ) : item.id === "standings" ? (
                    <span className="text-[9px] font-bold text-blue-600 bg-blue-50 dark:bg-blue-950/40 px-1.5 py-0.5 rounded border border-blue-300 dark:border-blue-800 uppercase">▾ Choose</span>
                  ) : null}
                </div>
                <span className={`text-xs font-bold mt-2 line-clamp-1 ${isActive ? "text-white" : "text-foreground"}`}>{item.label}</span>
                <span className={`text-[10px] line-clamp-2 mt-0.5 leading-snug ${isActive ? "text-emerald-100" : "text-muted-foreground"}`}>
                  {item.desc}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. REAL-TIME SCORING ANIMATIONS */}
      <div className="space-y-3 pt-2 border-t border-border/40">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Instant Scoring Animations (3.5s On-Screen Burst)
          </span>
          {lastTriggeredFlash ? (
            <span className="text-[11px] font-bold text-amber-500 animate-pulse">
              Sent: {lastTriggeredFlash}
            </span>
          ) : (
            <span className="text-[11px] text-muted-foreground">
              Auto-triggers on scorer actions, or test manually below
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {animationOptions.map((item) => (
            <button
              key={item.flash}
              type="button"
              onClick={() => handleTriggerFlash(item.flash, item.label)}
              className={`rounded-lg px-3 py-1.5 text-xs font-bold shadow-sm transition active:scale-95 ${item.color}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 3. BROADCAST MESSAGE CARD CONTROL */}
      <div className="pt-2 border-t border-border/40">
        <CricketObsBroadcastMessageControl tournamentId={tournamentId} />
      </div>

      {/* MATCH SELECTION DIALOG FOR OBS DIRECTOR */}
      <Dialog open={matchSelectModalOpen} onOpenChange={setMatchSelectModalOpen}>
        <DialogContent className="max-w-2xl bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div>
                <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
                  <Tv className="w-5 h-5 text-indigo-600" />
                  <span>Select Match for {targetOverlayForMatch?.label || "OBS Screen"}</span>
                </DialogTitle>
                <p className="text-xs text-slate-500 mt-1">
                  Choose which match details to broadcast on the live screen.
                </p>
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 pt-3 overflow-x-auto">
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
                      "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                      matchFilterStatus === tab
                        ? "bg-indigo-600 text-white shadow-sm"
                        : "bg-slate-200/70 text-slate-600 hover:bg-slate-200 hover:text-slate-900"
                    )}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 bg-slate-50/40">
            {filteredMatches && filteredMatches.length > 0 ? (
              filteredMatches.map((m) => {
                const home = m.homeTeam?.name || `Team ${m.homeTeamId}`;
                const away = m.awayTeam?.name || `Team ${m.awayTeamId}`;
                const isScreenTarget = m.id === overlayMatchId && currentOverlay === targetOverlayForMatch?.id;

                const statusBadge =
                  m.status === "live"
                    ? "bg-emerald-50 text-emerald-700 border-emerald-300 font-black ring-1 ring-emerald-400/40 animate-pulse"
                    : m.status === "walkover"
                    ? "bg-amber-50 text-amber-700 border-amber-300 font-semibold"
                    : m.status === "completed"
                    ? "bg-purple-50 text-purple-700 border-purple-300 font-semibold"
                    : "bg-blue-50 text-blue-700 border-blue-300 font-semibold";

                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl border transition-all shadow-sm",
                      isScreenTarget
                        ? "border-indigo-400 bg-indigo-50/50 shadow-indigo-100"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-md"
                    )}
                  >
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono font-black text-indigo-700 bg-indigo-100/70 px-2 py-0.5 rounded border border-indigo-200">
                          MATCH #{m.id}
                        </span>
                        {m.roundName && (
                          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {m.roundName}
                          </span>
                        )}
                        <span className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border", statusBadge)}>
                          {m.status.toUpperCase()}
                        </span>
                        {isScreenTarget && (
                          <span className="text-[10px] font-black uppercase text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded border border-indigo-300">
                            Active on OBS
                          </span>
                        )}
                      </div>

                      <div className="text-sm font-black text-slate-900 flex items-center gap-2 flex-wrap">
                        <span>{home}</span>
                        <span className="text-indigo-600 font-bold text-xs bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">VS</span>
                        <span>{away}</span>
                      </div>

                      <div className="text-xs text-slate-500 flex items-center gap-3 flex-wrap">
                        {m.venue && <span className="flex items-center gap-1">📍 {m.venue}</span>}
                        {m.scheduledAt && (
                          <span className="flex items-center gap-1 font-medium">🕒 {new Date(m.scheduledAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</span>
                        )}
                        {m.resultSummary && (
                          <span className="text-amber-700 font-bold bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-xs flex items-center gap-1">
                            🏆 {m.resultSummary}
                          </span>
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
                        "shrink-0 text-xs font-bold gap-1.5 h-9 px-4 rounded-lg shadow-sm transition-all",
                        isScreenTarget
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                          : "bg-indigo-600 hover:bg-indigo-700 text-white"
                      )}
                    >
                      <Tv className="w-3.5 h-3.5" />
                      <span>{isScreenTarget ? "Active on OBS" : "Push to OBS"}</span>
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="text-center py-12 text-slate-400 text-xs font-medium">
                No matches found under this filter.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* SPONSOR SHOWCASE SELECTION DIALOG */}
      <Dialog open={sponsorSelectModalOpen} onOpenChange={setSponsorSelectModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Handshake className="w-5 h-5 text-amber-500" />
              <span>Select Sponsor Showcase Option</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Choose between rotating through all tournament sponsors or spotlighting an individual brand.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/40">
            {/* Option 1: All Sponsors */}
            <div
              onClick={() => {
                void handleSetOverlay("sponsors", "All Sponsors Showcase");
                setSponsorSelectModalOpen(false);
              }}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black text-base group-hover:scale-105 transition">
                  ★
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 group-hover:text-amber-700 transition">
                    All Sponsors (Auto Rotation)
                  </div>
                  <div className="text-xs text-slate-500">
                    Displays Title, Powered-By, and Associate sponsors in a broadcast grid.
                  </div>
                </div>
              </div>
              <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs">
                Push All
              </Button>
            </div>

            {/* Individual Sponsor Options */}
            {sponsors && sponsors.length > 0 ? (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Spotlight Single Sponsor:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {sponsors.map((sp, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        void handleSetOverlay("sponsors", `Sponsor Spotlight: ${sp.name}`, undefined, { sponsorName: sp.name });
                        setSponsorSelectModalOpen(false);
                      }}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-amber-400 hover:shadow-sm cursor-pointer transition group"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {sp.url ? (
                          <img src={sp.url} alt={sp.name} className="w-8 h-8 object-contain rounded bg-slate-50 p-1 border border-slate-200 shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded bg-slate-100 text-slate-600 font-bold text-xs flex items-center justify-center shrink-0">
                            {sp.name.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-slate-900 truncate group-hover:text-amber-700 transition">
                            {sp.name}
                          </div>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            {sp.category || "Official Partner"}
                          </div>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 shrink-0">
                        Show
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

      {/* POINTS TABLE / STANDINGS SELECTION DIALOG */}
      <Dialog open={standingsSelectModalOpen} onOpenChange={setStandingsSelectModalOpen}>
        <DialogContent className="max-w-xl bg-white border border-slate-200 text-slate-900 shadow-2xl rounded-2xl p-0 overflow-hidden max-h-[85vh] flex flex-col">
          <DialogHeader className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50/90 shrink-0">
            <DialogTitle className="text-base sm:text-lg font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Table className="w-5 h-5 text-blue-600" />
              <span>Select Points Table Standings</span>
            </DialogTitle>
            <p className="text-xs text-slate-500 mt-1">
              Display overall tournament table, a specific group, or knockout bracket status.
            </p>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-50/40">
            {/* Option 1: Overall Standings */}
            <div
              onClick={() => {
                void handleSetOverlay("standings", "Overall Points Table");
                setStandingsSelectModalOpen(false);
              }}
              className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-md cursor-pointer transition group"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center font-black text-base group-hover:scale-105 transition">
                  🏆
                </div>
                <div>
                  <div className="text-sm font-black text-slate-900 group-hover:text-blue-700 transition">
                    Overall Points Table (All Teams)
                  </div>
                  <div className="text-xs text-slate-500">
                    Full league rankings, Net Run Rates (NRR), Won/Lost points.
                  </div>
                </div>
              </div>
              <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs">
                Push All
              </Button>
            </div>

            {/* Group-Wise Options */}
            {availableGroups && availableGroups.length > 0 && (
              <div className="space-y-2 pt-2">
                <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                  Group-Wise Standings:
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {availableGroups.map((grp) => (
                    <div
                      key={grp}
                      onClick={() => {
                        void handleSetOverlay("standings", `Points Table: ${grp}`, undefined, { stageOrGroup: grp });
                        setStandingsSelectModalOpen(false);
                      }}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm cursor-pointer transition group"
                    >
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition">
                        {grp} Standings
                      </div>
                      <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300">
                        Select
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Knockout Stages Options */}
            <div className="space-y-2 pt-2">
              <div className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">
                Knockout Stages &amp; Play-offs:
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {[
                  { key: "Quarter-Finals", label: "Quarter Finals" },
                  { key: "Semi-Finals", label: "Semi Finals" },
                  { key: "Finals", label: "Grand Final" },
                ].map((stg) => (
                  <div
                    key={stg.key}
                    onClick={() => {
                      void handleSetOverlay("standings", `Play-offs: ${stg.label}`, undefined, { stageOrGroup: stg.key });
                      setStandingsSelectModalOpen(false);
                    }}
                    className="flex flex-col items-center text-center p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-500 hover:shadow-sm cursor-pointer transition group"
                  >
                    <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition">
                      {stg.label}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Stage Matches</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

