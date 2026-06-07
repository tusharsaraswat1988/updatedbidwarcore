import { useCallback, useState } from "react";
import { useRoute } from "wouter";
import {
  useListTeams,
  useListPlayers,
  getListTeamsQueryKey,
  getListPlayersQueryKey,
} from "@workspace/api-client-react";
import { CricketEventType } from "@workspace/scoring-core";
import { ScorerShell } from "@/components/scoring/scorer-shell";
import { PreMatchSetup } from "@/components/scoring/pre-match-setup";
import { LiveScoringPad } from "@/components/scoring/live-scoring-pad";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatch, useInvalidateScoring } from "@/hooks/use-scoring-match";
import {
  appendScoringEvent,
  undoScoringEvent,
  type ScoringMatchDetail,
} from "@/lib/scoring-api";
import { useToast } from "@/hooks/use-toast";

export default function ScoringMatchPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");
  const { toast } = useToast();

  const { data, isLoading, refetch, isFetching } = useScoringMatch(tournamentId, matchId);
  const { invalidateAll, setMatchDetail } = useInvalidateScoring(tournamentId, matchId);

  const { data: teams } = useListTeams(tournamentId, {
    query: { queryKey: getListTeamsQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const { data: players } = useListPlayers(tournamentId, {
    query: { queryKey: getListPlayersQueryKey(tournamentId), enabled: !!tournamentId },
  });

  const [busy, setBusy] = useState(false);
  const [localBowlerId, setLocalBowlerId] = useState<number | null>(null);
  const [pendingNewBatsman, setPendingNewBatsman] = useState(false);
  const [localStrikerId, setLocalStrikerId] = useState<number | null>(null);
  const [localNonStrikerId, setLocalNonStrikerId] = useState<number | null>(null);

  const applyDetail = useCallback(
    (detail: ScoringMatchDetail) => {
      setMatchDetail(detail);
      invalidateAll();
    },
    [setMatchDetail, invalidateAll],
  );

  async function sendEvent(eventType: string, payload: Record<string, unknown>) {
    if (!data) return;
    setBusy(true);
    try {
      const result = await appendScoringEvent(tournamentId, matchId, {
        eventType,
        payload,
        expectedSequence: data.state.lastSequence,
      });
      applyDetail({
        match: result.match,
        state: result.state,
        eventCount: data.eventCount + 1,
        lastSequence: result.state.lastSequence,
      });
      setLocalStrikerId(null);
      setLocalNonStrikerId(null);
    } catch (e) {
      const err = e as Error & { status?: number };
      if (err.status === 409) {
        toast({ title: "Sync conflict", description: "Refreshing match…", variant: "destructive" });
        await refetch();
      } else {
        toast({
          title: "Could not save",
          description: err.message,
          variant: "destructive",
        });
      }
    } finally {
      setBusy(false);
    }
  }

  const home = teams?.find((t) => t.id === data?.match.homeTeamId);
  const away = teams?.find((t) => t.id === data?.match.awayTeamId);
  const subtitle = home && away ? `${home.shortCode} vs ${away.shortCode}` : undefined;

  const readyToScore =
    data &&
    data.state.tossWinnerTeamId != null &&
    data.state.strikerId != null &&
    data.state.nonStrikerId != null &&
    (localBowlerId != null || data.state.bowlerId != null);

  return (
      <ScorerShell
        tournamentId={tournamentId}
        title={data?.match.status === "live" ? "Live" : "Match setup"}
        subtitle={subtitle}
        backHref={`/tournament/${tournamentId}/score`}
        onRefresh={() => void refetch()}
        refreshing={isFetching}
      >
        {isLoading || !data ? (
          <div className="p-4 space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-48 w-full" />
          </div>
        ) : (
          <>
            <PreMatchSetup
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
            ) : null}

            {data.state.matchStatus === "completed" || data.state.matchStatus === "abandoned" ? (
              <LiveScoringPad
                state={data.state}
                teams={teams ?? []}
                players={players ?? []}
                bowlerId={null}
                busy={false}
                pendingNewBatsman={false}
                localStrikerId={null}
                localNonStrikerId={null}
                onBall={async () => {}}
                onUndo={async () => {}}
                onInningsEnd={async () => {}}
                onMatchComplete={async () => {}}
                onBowlerChange={() => {}}
                onNewBatsman={() => {}}
              />
            ) : null}
          </>
        )}
      </ScorerShell>
  );
}
