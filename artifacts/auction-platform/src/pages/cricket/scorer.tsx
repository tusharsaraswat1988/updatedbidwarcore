/**
 * Dedicated Cricket Scorer Console
 * Route: /cricket/:matchId/score?tid={tournamentId}
 *
 * Standalone, mobile-first, zero-scroll scoring console for scorers.
 * Features:
 * - Scorer PIN Auth Verification & Match Locking
 * - Viewport-fitted 100dvh layout (NO vertical scrolling on mobile)
 * - Big thumb-friendly keypad with instant tactile feedback
 * - Crease status & 1-tap strike rotation
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useSearch, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { CricketEventType, buildCricketMatchSummary } from "@workspace/scoring-core";
import { useScoringMatch, useInvalidateScoring } from "@/hooks/use-scoring-match";
import {
  appendScoringEvent,
  getCricketMasterTeams,
  getCricketTournamentRoster,
  resetScoringMatch,
  undoScoringEvent,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
  playerNameById,
} from "@/lib/scoring-squad";
import {
  countQueuedScoringEvents,
  enqueueScoringEvent,
  isNetworkScoringError,
  listQueuedScoringEvents,
  removeQueuedScoringEvent,
} from "@/lib/scoring-offline-queue";
import {
  getScorerAuthSession,
  clearScorerAuthSession,
} from "@/lib/badminton-scorer-session";
import {
  acquireScorerMatchLock,
  heartbeatScorerMatchLock,
  releaseScorerMatchLock,
} from "@/lib/scorer-api";
import { cricketScorerHomePath } from "@/lib/cricket-routes";
import { useToast } from "@/hooks/use-toast";
import { PreMatchSetup } from "@/components/scoring/pre-match-setup";
import { LiveScoringPad } from "@/components/scoring/live-scoring-pad";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { CricketPublicBrandMark } from "@/components/scoring/cricket-branding";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  Lock,
  LockOpen,
  LogOut,
  RefreshCw,
  RotateCcw,
  ShieldAlert,
  Smartphone,
  Trophy,
  User,
  WifiOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

const HEARTBEAT_INTERVAL_MS = 20_000;

export default function CricketScorerPage() {
  const [, params] = useRoute("/cricket/:matchId/score");
  const search = useSearch();
  const [, navigate] = useLocation();
  const searchParams = new URLSearchParams(search);

  const matchId = parseInt(params?.matchId || "0", 10);
  const tournamentId = parseInt(searchParams.get("tid") || "0", 10);
  const { toast } = useToast();

  const [session, setSession] = useState(() => getScorerAuthSession());
  const [lockAcquired, setLockAcquired] = useState(false);
  const [lockError, setLockError] = useState("");
  const lockHeldRef = useRef(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useScoringMatch(
    tournamentId,
    matchId,
    true,
  );

  const { invalidateAll, setMatchDetail } = useInvalidateScoring(tournamentId, matchId);

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: !!tournamentId,
  });
  const { data: roster } = useQuery({
    queryKey: ["cricket-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: !!tournamentId,
  });

  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const players = useMemo(
    () => (roster ?? []).map(cricketRosterToScorerPlayer),
    [roster],
  );

  const [busy, setBusy] = useState(false);
  const [queueDepth, setQueueDepth] = useState(0);
  const [localBowlerId, setLocalBowlerId] = useState<number | null>(null);
  const [pendingNewBatsman, setPendingNewBatsman] = useState(false);
  const [localStrikerId, setLocalStrikerId] = useState<number | null>(null);
  const [localNonStrikerId, setLocalNonStrikerId] = useState<number | null>(null);
  const sequenceRef = useRef(0);
  const sendInFlightRef = useRef(false);

  // ─── Scorer Session Check & Lock Acquisition ───
  useEffect(() => {
    const currentSession = getScorerAuthSession();
    if (!currentSession) {
      // Redirect to Scorer Portal Login
      navigate(cricketScorerHomePath(tournamentId));
      return;
    }
    setSession(currentSession);

    if (!matchId || !tournamentId || !currentSession.token) return;

    let heartbeatTimer: NodeJS.Timeout | null = null;
    const token = currentSession.token;

    async function obtainLock() {
      try {
        const lockRes = await acquireScorerMatchLock(matchId, token, {
          tournamentId,
          sport: "cricket",
        });
        if (lockRes.ok) {
          setLockAcquired(true);
          lockHeldRef.current = true;
          setLockError("");

          heartbeatTimer = setInterval(async () => {
            if (!lockHeldRef.current) return;
            try {
              await heartbeatScorerMatchLock(matchId, token);
            } catch {
              // Lock lost or disconnected
            }
          }, HEARTBEAT_INTERVAL_MS);
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : "Match lock could not be acquired";
        setLockError(message);
      }
    }

    void obtainLock();

    return () => {
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (lockHeldRef.current) {
        lockHeldRef.current = false;
        void releaseScorerMatchLock(matchId, token, { tournamentId, sport: "cricket" });
      }
    };
  }, [matchId, navigate, tournamentId]);

  useEffect(() => {
    if (!data) return;
    sequenceRef.current = data.state.lastSequence;
    if (data.state.matchStatus !== "live" || data.state.innings.length === 0) return;

    const strikerVacant = data.state.strikerId == null;
    const nonStrikerVacant = data.state.nonStrikerId == null;
    if (!strikerVacant && !nonStrikerVacant) {
      setPendingNewBatsman(false);
      setLocalStrikerId(null);
      setLocalNonStrikerId(null);
      return;
    }

    const filledLocally =
      (!strikerVacant || localStrikerId != null) &&
      (!nonStrikerVacant || localNonStrikerId != null);
    setPendingNewBatsman(!filledLocally);
  }, [
    data?.state.lastSequence,
    data?.state.strikerId,
    data?.state.nonStrikerId,
    data?.state.matchStatus,
    data?.state.innings.length,
    localStrikerId,
    localNonStrikerId,
  ]);

  const refreshQueueDepth = useCallback(async () => {
    if (!matchId) return;
    setQueueDepth(await countQueuedScoringEvents(matchId));
  }, [matchId]);

  useEffect(() => {
    void refreshQueueDepth();
  }, [refreshQueueDepth]);

  const applyDetail = useCallback(
    (detail: ScoringMatchDetail) => {
      setMatchDetail(detail);
      invalidateAll();
    },
    [setMatchDetail, invalidateAll],
  );

  const drainQueue = useCallback(async () => {
    if (!data || sendInFlightRef.current) return;
    const queued = await listQueuedScoringEvents(matchId);
    if (queued.length === 0) return;

    sendInFlightRef.current = true;
    setBusy(true);
    try {
      for (const item of queued) {
        let synced = false;
        for (let attempt = 0; attempt < 2 && !synced; attempt++) {
          try {
            const result = await appendScoringEvent(tournamentId, matchId, {
              eventType: item.eventType,
              payload: item.payload,
              expectedSequence: sequenceRef.current,
              correlationId: item.correlationId,
            });
            sequenceRef.current = result.state.lastSequence;
            await removeQueuedScoringEvent(item.id);
            applyDetail({
              match: result.match,
              state: result.state,
              eventCount: (data.eventCount ?? 0) + 1,
              lastSequence: result.state.lastSequence,
            });
            synced = true;
          } catch (e) {
            const err = e as Error & { status?: number };
            if (err.status === 409) {
              const refreshed = await refetch();
              if (refreshed.data) {
                sequenceRef.current = refreshed.data.state.lastSequence;
              }
              continue;
            }
            if (isNetworkScoringError(e)) return;
            throw e;
          }
        }
        if (!synced) break;
      }
    } finally {
      sendInFlightRef.current = false;
      setBusy(false);
      await refreshQueueDepth();
    }
  }, [applyDetail, data, matchId, refetch, refreshQueueDepth, tournamentId]);

  useEffect(() => {
    const onOnline = () => void drainQueue();
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [drainQueue]);

  const sendEvent = useCallback(
    async (eventType: string, payload: Record<string, unknown>) => {
      if (!data || sendInFlightRef.current) return;
      sendInFlightRef.current = true;
      setBusy(true);
      const correlationId = crypto.randomUUID();
      try {
        let result: (ScoringMatchDetail & { event: { id: number; eventType: string; sequence: number } }) | null = null;
        try {
          result = await appendScoringEvent(tournamentId, matchId, {
            eventType,
            payload,
            expectedSequence: sequenceRef.current,
            correlationId,
          });
        } catch (initialError) {
          const err = initialError as Error & { status?: number };
          if (
            err.status === 409 &&
            (eventType === CricketEventType.LINEUP_SET ||
              eventType === CricketEventType.MATCH_STARTED)
          ) {
            const refreshed = await refetch();
            const nextSeq =
              refreshed.data?.lastSequence ??
              refreshed.data?.state?.lastSequence ??
              0;
            sequenceRef.current = nextSeq;
            result = await appendScoringEvent(tournamentId, matchId, {
              eventType,
              payload,
              expectedSequence: nextSeq,
              correlationId: crypto.randomUUID(),
            });
          } else {
            throw initialError;
          }
        }

        if (result) {
          sequenceRef.current = result.state.lastSequence;
          applyDetail({
            match: result.match,
            state: result.state,
            eventCount: data.eventCount + 1,
            lastSequence: result.state.lastSequence,
          });
          setLocalStrikerId(null);
          setLocalNonStrikerId(null);
          if (result.state.strikerId == null || result.state.nonStrikerId == null) {
            setPendingNewBatsman(true);
          }
          await drainQueue();
        }
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 409) {
          const refreshed = await refetch();
          if (refreshed.data) {
            sequenceRef.current =
              refreshed.data.lastSequence ??
              refreshed.data.state.lastSequence ??
              0;
          }
          toast({
            title: "Score conflict",
            description: "Match refreshed to the latest score.",
            variant: "destructive",
          });
        } else if (isNetworkScoringError(e)) {
          await enqueueScoringEvent({
            tournamentId,
            matchId,
            eventType,
            payload,
            expectedSequence: sequenceRef.current,
            correlationId,
          });
          await refreshQueueDepth();
          toast({
            title: "Queued offline",
            description: "Will sync automatically when connected.",
          });
        } else {
          toast({
            title: "Could not record ball",
            description: err.message,
            variant: "destructive",
          });
        }
      } finally {
        sendInFlightRef.current = false;
        setBusy(false);
      }
    },
    [applyDetail, data, drainQueue, matchId, refetch, refreshQueueDepth, toast, tournamentId],
  );

  const handleResetMatch = useCallback(async () => {
    if (!data || busy || sendInFlightRef.current) return;
    setBusy(true);
    try {
      const result = await resetScoringMatch(tournamentId, matchId);
      sequenceRef.current = 0;
      applyDetail({
        match: result.match,
        state: result.state,
        eventCount: 0,
        lastSequence: 0,
      });
      setLocalStrikerId(null);
      setLocalNonStrikerId(null);
      setLocalBowlerId(null);
      setPendingNewBatsman(false);
      toast({
        title: "Match reset",
        description: "Toss and setup have been cleared.",
      });
      await refetch();
    } catch (e) {
      toast({
        title: "Could not reset match",
        description: e instanceof Error ? e.message : "Failed",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }, [applyDetail, busy, data, matchId, refetch, toast, tournamentId]);

  const home = teams.find((t) => t.id === data?.match.homeTeamId);
  const away = teams.find((t) => t.id === data?.match.awayTeamId);
  const matchVsText = home && away ? `${home.shortCode} vs ${away.shortCode}` : "Cricket Match";

  const needsCreaseFill =
    !!data &&
    data.state.matchStatus === "live" &&
    data.state.innings.length > 0 &&
    (data.state.strikerId == null || data.state.nonStrikerId == null);

  const creaseFilledForScoring =
    !!data &&
    (data.state.strikerId != null || localStrikerId != null) &&
    (data.state.nonStrikerId != null || localNonStrikerId != null);

  const readyToScore =
    data &&
    data.state.tossWinnerTeamId != null &&
    data.state.innings.length > 0 &&
    (localBowlerId != null || data.state.bowlerId != null) &&
    (pendingNewBatsman || creaseFilledForScoring);

  const isFinished =
    data?.state.matchStatus === "completed" || data?.state.matchStatus === "abandoned";
  const summary =
    data?.summary ?? (data && isFinished ? buildCricketMatchSummary(data.state) : null);

  if (isLoading && !data) {
    return (
      <div className="h-[100dvh] bg-[#070b19] text-white flex flex-col items-center justify-center p-6 space-y-4">
        <Skeleton className="h-12 w-48 rounded-xl bg-white/10" />
        <p className="text-white/50 text-sm">Opening Scorer Console...</p>
      </div>
    );
  }

  if (isError && !data) {
    return (
      <div className="h-[100dvh] bg-[#070b19] text-white flex flex-col items-center justify-center p-6 text-center space-y-4">
        <ShieldAlert className="w-12 h-12 text-red-400" />
        <h2 className="text-xl font-bold">Could not load match</h2>
        <p className="text-sm text-white/50">{error instanceof Error ? error.message : "Error loading match"}</p>
        <Button
          onClick={() => navigate(cricketScorerHomePath(tournamentId))}
          variant="outline"
          className="border-white/20 text-white"
        >
          Back to Match List
        </Button>
      </div>
    );
  }

  return (
    <div className="h-[100dvh] max-h-[100dvh] w-full bg-[#070b19] text-white flex flex-col overflow-hidden select-none touch-manipulation">
      {/* ─── Fixed Header Bar (44px) ─── */}
      <header className="h-11 shrink-0 px-3 border-b border-white/10 bg-[#090e21] flex items-center justify-between gap-2 z-20">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/70 hover:text-white shrink-0 -ml-1"
            onClick={() => navigate(cricketScorerHomePath(tournamentId))}
            title="Back to matches"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <CricketPublicBrandMark variant="scorer-bar" className="h-6 shrink-0" />
          <div className="h-3.5 w-px bg-white/20 shrink-0 hidden xs:block" />
          <div className="min-w-0">
            <span className="text-xs font-black text-white truncate flex items-center gap-1.5 leading-none">
              {matchVsText}
              {data?.match.status === "live" ? (
                <span className="text-[9px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-red-500 text-white flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                  LIVE
                </span>
              ) : null}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {queueDepth > 0 ? (
            <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.5 rounded flex items-center gap-1">
              <WifiOff className="w-3 h-3" />
              {queueDepth}
            </span>
          ) : null}

          {lockError ? (
            <span className="text-[10px] bg-red-500/20 text-red-300 border border-red-500/40 px-1.5 py-0.5 rounded flex items-center gap-1" title={lockError}>
              <Lock className="w-3 h-3" />
              Lock busy
            </span>
          ) : null}

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-white/60 hover:text-white"
            onClick={() => void refetch()}
            disabled={isFetching}
            title="Refresh score"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin")} />
          </Button>
        </div>
      </header>

      {/* ─── Main Scoring Viewport ─── */}
      <main className="flex-1 min-h-0 overflow-hidden flex flex-col p-2 sm:p-3 max-w-lg mx-auto w-full">
        {data && (!readyToScore || data.state.innings.length === 0 || data.state.tossWinnerTeamId == null) && !isFinished ? (
          <div className="flex-1 overflow-y-auto px-1 py-2 space-y-3">
            <PreMatchSetup
              tournamentId={tournamentId}
              match={data.match}
              state={data.state}
              teams={teams}
              players={players}
              localBowlerId={localBowlerId}
              busy={busy}
              onEvent={sendEvent}
              onResetMatch={handleResetMatch}
              onBowlerSelected={setLocalBowlerId}
              onPrepared={async () => {
                await refetch();
              }}
            />
          </div>
        ) : null}

        {readyToScore && data && data.state.matchStatus !== "completed" ? (
          <div className="flex-1 min-h-0 flex flex-col justify-between overflow-hidden">
            <LiveScoringPad
              state={data.state}
              teams={teams}
              players={players}
              rules={data.match.rules}
              bowlerId={localBowlerId}
              busy={busy || queueDepth > 0}
              pendingNewBatsman={pendingNewBatsman || (needsCreaseFill && !creaseFilledForScoring)}
              localStrikerId={localStrikerId}
              localNonStrikerId={localNonStrikerId}
              onBall={(payload) => sendEvent(CricketEventType.BALL_RECORDED, payload)}
              onEvent={sendEvent}
              onResetMatch={handleResetMatch}
              onSwapStrike={() => {
                const currStriker = localStrikerId ?? data.state.strikerId;
                const currNonStriker = localNonStrikerId ?? data.state.nonStrikerId;
                if (currStriker && currNonStriker) {
                  setLocalStrikerId(currNonStriker);
                  setLocalNonStrikerId(currStriker);
                  toast({
                    title: "Strike rotated",
                    description: `Striker: ${playerNameById(players, currNonStriker)}`,
                  });
                }
              }}
              onUndo={async () => {
                if (!data || sendInFlightRef.current || queueDepth > 0) return;
                sendInFlightRef.current = true;
                setBusy(true);
                try {
                  const result = await undoScoringEvent(
                    tournamentId,
                    matchId,
                    sequenceRef.current,
                  );
                  sequenceRef.current = result.state.lastSequence;
                  applyDetail({
                    match: result.match,
                    state: result.state,
                    eventCount: data.eventCount + 1,
                    lastSequence: result.state.lastSequence,
                  });
                  setPendingNewBatsman(
                    result.state.strikerId == null || result.state.nonStrikerId == null,
                  );
                  toast({
                    title: "Undone",
                    description: "Last ball removed.",
                  });
                } catch (e) {
                  toast({
                    title: "Undo failed",
                    description: e instanceof Error ? e.message : "Error",
                    variant: "destructive",
                  });
                } finally {
                  sendInFlightRef.current = false;
                  setBusy(false);
                }
              }}
              onInningsEnd={(payload) => {
                setLocalBowlerId(null);
                setPendingNewBatsman(false);
                return sendEvent(CricketEventType.INNINGS_ENDED, payload);
              }}
              onMatchComplete={(payload) =>
                sendEvent(CricketEventType.MATCH_COMPLETED, payload)
              }
              onBowlerChange={setLocalBowlerId}
              onNewBatsman={(playerId) => {
                if (playerId < 0) {
                  setPendingNewBatsman(true);
                  return;
                }
                if (data.state.strikerId == null) {
                  setLocalStrikerId(playerId);
                } else if (data.state.nonStrikerId == null) {
                  setLocalNonStrikerId(playerId);
                } else {
                  setLocalStrikerId(playerId);
                }
                setPendingNewBatsman(false);
              }}
            />
          </div>
        ) : null}

        {isFinished && summary ? (
          <div className="flex-1 overflow-y-auto p-2 space-y-4">
            <MatchSummaryCard summary={summary} teams={teams} compact />
            <Button
              type="button"
              className="w-full bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold"
              onClick={() => navigate(cricketScorerHomePath(tournamentId))}
            >
              Back to Match Hub
            </Button>
          </div>
        ) : null}
      </main>
    </div>
  );
}
