import { useCallback, useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  useListTeams,
  useListPlayers,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { buildCricketMatchSummary, CricketEventType } from "@workspace/scoring-core";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import { EmptyState, PageHeader } from "@/components/badminton/page-chrome";
import { MatchSummaryCard } from "@/components/scoring/match-summary-card";
import { PreMatchSetup } from "@/components/scoring/pre-match-setup";
import { LiveScoringPad } from "@/components/scoring/live-scoring-pad";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatch, useInvalidateScoring } from "@/hooks/use-scoring-match";
import {
  appendScoringEvent,
  undoScoringEvent,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";
import {
  countQueuedScoringEvents,
  enqueueScoringEvent,
  isNetworkScoringError,
  listQueuedScoringEvents,
  removeQueuedScoringEvent,
} from "@/lib/scoring-offline-queue";
import { useToast } from "@/hooks/use-toast";
import { openScoreDisplay } from "@/lib/tournament-navigation";
import { Button } from "@/components/ui/button";
import { Monitor, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useCricketScoringActive, usePlatformFeatures } from "@/hooks/use-platform-features";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";

export default function ScoringMatchPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");
  const { toast } = useToast();

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { loading: featuresLoading } = usePlatformFeatures();
  const { data, isLoading, isError, error, refetch, isFetching, isPending } = useScoringMatch(
    tournamentId,
    matchId,
    scoringActive,
  );

  const { invalidateAll, setMatchDetail } = useInvalidateScoring(tournamentId, matchId);

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [busy, setBusy] = useState(false);
  const [queueDepth, setQueueDepth] = useState(0);
  const [localBowlerId, setLocalBowlerId] = useState<number | null>(null);
  const [pendingNewBatsman, setPendingNewBatsman] = useState(false);
  const [localStrikerId, setLocalStrikerId] = useState<number | null>(null);
  const [localNonStrikerId, setLocalNonStrikerId] = useState<number | null>(null);
  const sequenceRef = useRef(0);
  const sendInFlightRef = useRef(false);

  useEffect(() => {
    if (data) sequenceRef.current = data.state.lastSequence;
  }, [data?.state.lastSequence]);

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
            eventCount: data.eventCount + 1,
            lastSequence: result.state.lastSequence,
          });
        } catch (e) {
          const err = e as Error & { status?: number };
          if (err.status === 409) {
            const refreshed = await refetch();
            if (refreshed.data) {
              sequenceRef.current = refreshed.data.state.lastSequence;
            }
            break;
          }
          if (isNetworkScoringError(e)) break;
          throw e;
        }
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
      try {
        const result = await appendScoringEvent(tournamentId, matchId, {
          eventType,
          payload,
          expectedSequence: sequenceRef.current,
        });
        sequenceRef.current = result.state.lastSequence;
        applyDetail({
          match: result.match,
          state: result.state,
          eventCount: data.eventCount + 1,
          lastSequence: result.state.lastSequence,
        });
        setLocalStrikerId(null);
        setLocalNonStrikerId(null);
        await drainQueue();
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 409) {
          const refreshed = await refetch();
          if (refreshed.data) {
            sequenceRef.current = refreshed.data.state.lastSequence;
          }
          toast({
            title: "Already saved",
            description: "Match synced — continue from the latest step.",
          });
        } else if (isNetworkScoringError(e)) {
          await enqueueScoringEvent({
            tournamentId,
            matchId,
            eventType,
            payload,
            expectedSequence: sequenceRef.current,
          });
          sequenceRef.current += 1;
          await refreshQueueDepth();
          toast({
            title: "Saved offline",
            description: "Ball queued — will sync when connection returns.",
          });
        } else {
          toast({
            title: "Could not save",
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

  const home = teams?.find((t) => t.id === data?.match.homeTeamId);
  const away = teams?.find((t) => t.id === data?.match.awayTeamId);
  const subtitle = home && away ? `${home.shortCode} vs ${away.shortCode}` : undefined;

  const readyToScore =
    data &&
    data.state.tossWinnerTeamId != null &&
    data.state.strikerId != null &&
    data.state.nonStrikerId != null &&
    (localBowlerId != null || data.state.bowlerId != null);

  const isFinished =
    data?.state.matchStatus === "completed" || data?.state.matchStatus === "abandoned";
  const summary =
    data?.summary ??
    (data && isFinished ? buildCricketMatchSummary(data.state) : null);

  const matchTitle =
    data?.match.status === "live"
      ? "Live scoring"
      : data?.match.status === "completed"
        ? "Match result"
        : "Match setup";

  const loadingShell = (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    </CricketOrganizerPageShell>
  );

  if (featuresLoading || (isPending && !data)) {
    return loadingShell;
  }

  if (!scoringActive) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament in auction settings, then return here."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  if (isError && !data) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <EmptyState
            icon={AlertTriangle}
            title="Could not load match"
            desc={error instanceof Error ? error.message : "Something went wrong. Try again."}
            action={{ label: "Retry", onClick: () => void refetch() }}
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        eyebrow="Cricket Scorer"
        title={matchTitle}
        subtitle={subtitle ?? tournament?.name}
        badge={data?.match.status === "live" ? "LIVE" : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
            >
              <Monitor className="w-4 h-4" />
              LED display
            </Button>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-4">
        {queueDepth > 0 ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 flex items-center gap-2 text-sm text-amber-100">
            <WifiOff className="w-4 h-4 shrink-0" />
            <span>
              {queueDepth} ball{queueDepth === 1 ? "" : "s"} queued offline — will sync when online.
            </span>
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 text-xs"
              onClick={() => void drainQueue()}
            >
              Sync now
            </Button>
          </div>
        ) : null}

        {isLoading && !data ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : !data ? (
          <EmptyState
            icon={AlertTriangle}
            title="Match not found"
            desc="This match may have been removed. Go back to the match list."
            action={{
              label: "Back to matches",
              onClick: () => navigate(`/tournament/${tournamentId}/score`),
            }}
          />
        ) : (
          <>
            <PreMatchSetup
              tournamentId={tournamentId}
              match={data.match}
              state={data.state}
              teams={teams ?? []}
              players={players ?? []}
              localBowlerId={localBowlerId}
              busy={busy}
              onEvent={sendEvent}
              onBowlerSelected={setLocalBowlerId}
            />

            {readyToScore && data.state.matchStatus !== "completed" ? (
              <div className="max-w-lg mx-auto w-full">
                <LiveScoringPad
                state={data.state}
                teams={teams ?? []}
                players={players ?? []}
                bowlerId={localBowlerId}
                busy={busy}
                pendingNewBatsman={pendingNewBatsman}
                localStrikerId={localStrikerId}
                localNonStrikerId={localNonStrikerId}
                onBall={(payload) => sendEvent(CricketEventType.BALL_RECORDED, payload)}
                onEvent={sendEvent}
                onUndo={async () => {
                  if (!data) return;
                  setBusy(true);
                  try {
                    const result = await undoScoringEvent(
                      tournamentId,
                      matchId,
                      data.state.lastSequence,
                    );
                    applyDetail({
                      match: result.match,
                      state: result.state,
                      eventCount: data.eventCount + 1,
                      lastSequence: result.state.lastSequence,
                    });
                    setPendingNewBatsman(false);
                  } catch (e) {
                    toast({
                      title: "Undo failed",
                      description: e instanceof Error ? e.message : "Error",
                      variant: "destructive",
                    });
                  } finally {
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
                  setLocalStrikerId(playerId);
                  setPendingNewBatsman(false);
                }}
              />
              </div>
            ) : null}

            {!readyToScore &&
            !isFinished &&
            data.state.innings.length > 0 &&
            data.state.tossWinnerTeamId != null ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                Complete squad selection and pick openers + bowler to start scoring balls.
              </div>
            ) : null}

            {isFinished && summary ? (
              <MatchSummaryCard summary={summary} teams={teams ?? []} compact />
            ) : null}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
