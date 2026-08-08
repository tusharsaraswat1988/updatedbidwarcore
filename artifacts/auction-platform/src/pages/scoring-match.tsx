import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
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
  getCricketMasterTeams,
  getCricketTournamentRoster,
  undoScoringEvent,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";
import {
  cricketMasterTeamToScorerTeam,
  cricketRosterToScorerPlayer,
} from "@/lib/scoring-squad";
import {
  countQueuedScoringEvents,
  enqueueScoringEvent,
  isNetworkScoringError,
  listQueuedScoringEvents,
  removeQueuedScoringEvent,
} from "@/lib/scoring-offline-queue";
import { useToast } from "@/hooks/use-toast";
import { openScoreDisplay } from "@/lib/tournament-navigation";
import { cricketMatchCenterPath, cricketScoreHubPath } from "@/lib/cricket-routes";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Monitor, WifiOff, RefreshCw, AlertTriangle } from "lucide-react";
import { useCricketScoringActive, usePlatformFeatures } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";

export default function ScoringMatchPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId/live");
  const [, navigate] = useLocation();
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");
  const matchCenterHref = cricketMatchCenterPath(tournamentId, matchId);
  const { toast } = useToast();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
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

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: roster } = useQuery({
    queryKey: ["cricket-roster", tournamentId],
    queryFn: () => getCricketTournamentRoster(tournamentId),
    enabled: scoringActive && !!tournamentId,
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

  useEffect(() => {
    if (!data) return;
    // Authoritative sequence only — never advance locally for offline guesses.
    sequenceRef.current = data.state.lastSequence;
    if (data.state.matchStatus !== "live" || data.state.innings.length === 0) return;

    const strikerVacant = data.state.strikerId == null;
    const nonStrikerVacant = data.state.nonStrikerId == null;
    if (!strikerVacant && !nonStrikerVacant) {
      // Crease filled on server — drop local override + gate.
      setPendingNewBatsman(false);
      setLocalStrikerId(null);
      setLocalNonStrikerId(null);
      return;
    }

    // Restore replacement gate after refresh when vacancy is still unfilled locally.
    // Do not re-open the gate after the scorer already picked a local replacement.
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
            if (isNetworkScoringError(e)) {
              return;
            }
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
        const result = await appendScoringEvent(tournamentId, matchId, {
          eventType,
          payload,
          expectedSequence: sequenceRef.current,
          correlationId,
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
        if (result.state.strikerId == null || result.state.nonStrikerId == null) {
          setPendingNewBatsman(true);
        }
        await drainQueue();
      } catch (e) {
        const err = e as Error & { status?: number };
        if (err.status === 409) {
          const refreshed = await refetch();
          if (refreshed.data) {
            sequenceRef.current = refreshed.data.state.lastSequence;
          }
          toast({
            title: "Score conflict",
            description: "Match refreshed to the latest score. Re-enter the ball only if it is missing.",
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
          // Do not advance sequenceRef — server is still at the prior sequence.
          await refreshQueueDepth();
          toast({
            title: "Queued offline",
            description: "Will sync when online. Do not tap the same ball again until synced.",
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

  const home = teams.find((t) => t.id === data?.match.homeTeamId);
  const away = teams.find((t) => t.id === data?.match.awayTeamId);
  const subtitle = home && away ? `${home.shortCode} vs ${away.shortCode}` : undefined;

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
    (
      pendingNewBatsman ||
      creaseFilledForScoring
    );

  const isFinished =
    data?.state.matchStatus === "completed" || data?.state.matchStatus === "abandoned";
  const summary =
    data?.summary ??
    (data && isFinished ? buildCricketMatchSummary(data.state) : null);

  const matchTitle =
    data?.match.status === "live"
      ? "Live Control"
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

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (featuresLoading || tournamentLoading || (isPending && !data)) {
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
        tournamentId={tournamentId}
        eyebrow="Live Control"
        title={matchTitle}
        subtitle={subtitle ?? tournament?.name}
        badge={data?.match.status === "live" ? "LIVE" : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <Link href={matchCenterHref}>
                <ArrowLeft className="w-4 h-4" />
                Match Center
              </Link>
            </Button>
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
              {queueDepth} ball{queueDepth === 1 ? "" : "s"} queued offline — scoring paused until synced.
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
              label: "Back to Match Center",
              onClick: () => navigate(matchCenterHref || cricketScoreHubPath(tournamentId)),
            }}
          />
        ) : (
          <>
            <PreMatchSetup
              tournamentId={tournamentId}
              match={data.match}
              state={data.state}
              teams={teams}
              players={players}
              localBowlerId={localBowlerId}
              busy={busy}
              onEvent={sendEvent}
              onBowlerSelected={setLocalBowlerId}
            />

            {readyToScore && data.state.matchStatus !== "completed" ? (
              <div className="max-w-lg mx-auto w-full">
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

            {!readyToScore &&
            !isFinished &&
            data.state.innings.length > 0 &&
            data.state.tossWinnerTeamId != null ? (
              <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-muted-foreground">
                Complete squad selection and pick openers + bowler to start scoring balls.
              </div>
            ) : null}

            {isFinished && summary ? (
              <MatchSummaryCard summary={summary} teams={teams} compact />
            ) : null}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
