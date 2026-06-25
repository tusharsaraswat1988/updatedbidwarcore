import { useCallback, useMemo, useRef, useState } from "react";
import type { Player, Team } from "@workspace/api-client-react";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import { ScoreButton } from "@/components/scoring/score-button";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  getActiveInnings,
  illegalBallPosition,
  nextLegalBallPosition,
  oversText,
  requiredRate,
  runRate,
} from "@/lib/scoring-ball";
import { playerNameById, squadPlayersForTeam } from "@/lib/scoring-squad";
import { CricketEventType } from "@workspace/scoring-core";
import {
  battingTeamId,
  bowlingTeamId,
  buildMatchResult,
  computeDlsApplication,
  suggestInningsEndReason,
} from "@/lib/scoring-match-logic";
import { Input } from "@/components/ui/input";
import { CloudRain } from "lucide-react";

type WicketType =
  | "bowled"
  | "caught"
  | "run_out"
  | "stumped"
  | "lbw"
  | "hit_wicket"
  | "timed_out"
  | "obstructing_field"
  | "hit_ball_twice";

type BallInput = {
  runsOffBat: number;
  extras: { type: "wide" | "no_ball" | "bye" | "leg_bye" | null; runs: number };
  wicket: {
    type: WicketType;
    dismissedPlayerId: number;
  } | null;
  isLegalDelivery: boolean;
};

type LiveScoringPadProps = {
  state: CricketScoreboardState;
  teams: Team[];
  players: Player[];
  bowlerId: number | null;
  busy: boolean;
  onBall: (payload: Record<string, unknown>) => Promise<void>;
  onEvent: (eventType: string, payload: Record<string, unknown>) => Promise<void>;
  onUndo: () => Promise<void>;
  onInningsEnd: (payload: Record<string, unknown>) => Promise<void>;
  onMatchComplete: (payload: Record<string, unknown>) => Promise<void>;
  onBowlerChange: (bowlerId: number) => void;
  onNewBatsman: (playerId: number) => void;
  pendingNewBatsman: boolean;
  localStrikerId: number | null;
  localNonStrikerId: number | null;
};

function useDebounceTap(ms = 500) {
  const last = useRef(0);
  return useCallback(() => {
    const now = Date.now();
    if (now - last.current < ms) return false;
    last.current = now;
    return true;
  }, [ms]);
}

export function LiveScoringPad({
  state,
  teams,
  players,
  bowlerId,
  busy,
  onBall,
  onEvent,
  onUndo,
  onInningsEnd,
  onMatchComplete,
  onBowlerChange,
  onNewBatsman,
  pendingNewBatsman,
  localStrikerId,
  localNonStrikerId,
}: LiveScoringPadProps) {
  const canTap = useDebounceTap();
  const innings = getActiveInnings(state);
  const [wicketSheet, setWicketSheet] = useState(false);
  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [bowlerSheet, setBowlerSheet] = useState(false);
  const [retireSheet, setRetireSheet] = useState(false);
  const [dlsSheet, setDlsSheet] = useState(false);
  const [revisedOvers, setRevisedOvers] = useState("15");

  const isPaused = state.sessionStatus === "paused";

  const dlsPreview = useMemo(() => {
    const overs = parseInt(revisedOvers, 10);
    if (!overs || overs < 1 || state.innings.length === 0) return null;
    try {
      return computeDlsApplication(state, overs);
    } catch {
      return null;
    }
  }, [revisedOvers, state]);

  const strikerId = localStrikerId ?? state.strikerId;
  const nonStrikerId = localNonStrikerId ?? state.nonStrikerId;
  const activeBowlerId = bowlerId ?? state.bowlerId;

  const battingId = battingTeamId(state);
  const bowlingId = bowlingTeamId(state);

  const battingTeam = teams.find((t) => t.id === battingId);
  const bowlingTeam = teams.find((t) => t.id === bowlingId);

  const battingLineup = battingId ? (state.lineups[battingId] ?? []) : [];

  const availableBatsmen = useMemo(() => {
    if (!battingId) return [];
    const squad = squadPlayersForTeam(players, battingId);
    const inXi = new Set(battingLineup);
    const atCrease = new Set([strikerId, nonStrikerId].filter(Boolean) as number[]);
    return squad.filter((p) => inXi.has(p.id) && !atCrease.has(p.id));
  }, [players, battingId, battingLineup, strikerId, nonStrikerId]);

  const bowlingSquad = useMemo(() => {
    if (!bowlingId) return [];
    const lineup = state.lineups[bowlingId] ?? [];
    const map = new Map(squadPlayersForTeam(players, bowlingId).map((p) => [p.id, p]));
    return lineup.map((id) => map.get(id)).filter(Boolean) as Player[];
  }, [players, bowlingId, state.lineups]);

  async function recordBall(input: BallInput) {
    if (!canTap() || busy || isPaused || !innings || !strikerId || !nonStrikerId || !activeBowlerId) return;

    const pos = input.isLegalDelivery
      ? nextLegalBallPosition(innings)
      : illegalBallPosition(innings);

    await onBall({
      innings: state.currentInnings,
      over: pos.over,
      ball: pos.ball,
      strikerId,
      nonStrikerId,
      bowlerId: activeBowlerId,
      runsOffBat: input.runsOffBat,
      extras: input.extras,
      wicket: input.wicket,
      isLegalDelivery: input.isLegalDelivery,
    });

    if (input.wicket) {
      onNewBatsman(-1);
    }
  }

  async function recordWicket(type: BallInput["wicket"] extends infer W ? (W extends { type: infer T } ? T : never) : never) {
    if (!strikerId) return;
    setWicketSheet(false);
    await recordBall({
      runsOffBat: 0,
      extras: { type: null, runs: 0 },
      wicket: { type, dismissedPlayerId: strikerId },
      isLegalDelivery: true,
    });
  }

  if (!innings || state.matchStatus === "completed" || state.matchStatus === "abandoned") {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-lg font-semibold">{state.resultText ?? "Match ended"}</p>
        {state.winnerTeamId ? (
          <p className="text-sm text-muted-foreground">
            Winner: {teams.find((t) => t.id === state.winnerTeamId)?.name}
          </p>
        ) : null}
      </div>
    );
  }

  const rr = runRate(innings.runs, innings.over, innings.ball);
  const req = state.target
    ? requiredRate(state.target, innings.runs, state.oversLimit, innings.over, innings.ball)
    : null;

  return (
    <div className="flex flex-col">
      {isPaused ? (
        <div className="mx-4 mt-3 rounded-lg border border-sky-500/40 bg-sky-500/10 px-3 py-2 flex items-center gap-2 text-sm text-sky-100">
          <CloudRain className="w-4 h-4 shrink-0" />
          <span>
            Rain delay{state.interruptionReason ? ` — ${state.interruptionReason}` : ""}. Resume play or apply DLS.
          </span>
        </div>
      ) : null}
      {/* Scoreboard strip */}
      <div className="px-4 py-3 border-b border-border/60 bg-card/50">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              Inn {state.currentInnings}
              {state.target ? ` · Target ${state.target}` : ""}
              {state.freeHitActive ? (
                <span className="ml-2 text-amber-400 font-semibold">FREE HIT</span>
              ) : null}
            </p>
            <p className="text-3xl font-bold tabular-nums tracking-tight">
              {innings.runs}/{innings.wickets}
              <span className="text-lg text-muted-foreground font-normal ml-2">
                ({oversText(innings.over, innings.ball)})
              </span>
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              RR {rr}
              {req ? ` · RRR ${req}` : ""}
            </p>
          </div>
          <div className="text-right text-xs space-y-1 shrink-0">
            <p className="font-medium truncate max-w-[8rem]" style={{ color: battingTeam?.color ?? undefined }}>
              {battingTeam?.shortCode ?? "BAT"}
            </p>
            <p className="text-muted-foreground truncate max-w-[8rem]">
              vs {bowlingTeam?.shortCode ?? "BOWL"}
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="rounded-lg bg-muted/30 px-2.5 py-2">
            <span className="text-muted-foreground">Striker </span>
            <span className="font-medium">{playerNameById(players, strikerId)} *</span>
          </div>
          <div className="rounded-lg bg-muted/30 px-2.5 py-2">
            <span className="text-muted-foreground">Non-str </span>
            <span className="font-medium">{playerNameById(players, nonStrikerId)}</span>
          </div>
        </div>

        {state.thisOver.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {state.thisOver.map((b, i) => (
              <span
                key={`${b.over}-${b.ball}-${i}`}
                className="inline-flex h-7 min-w-7 items-center justify-center rounded-md bg-muted text-xs font-bold tabular-nums"
              >
                {b.label}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      {pendingNewBatsman ? (
        <div className="p-4 border-b border-amber-500/30 bg-amber-500/5 space-y-2">
          <p className="text-sm font-medium text-amber-200">New batter</p>
          <div className="grid grid-cols-2 gap-2">
            {availableBatsmen.slice(0, 8).map((p) => (
              <Button
                key={p.id}
                variant="outline"
                className="h-11 text-sm justify-start truncate"
                disabled={busy}
                onClick={() => onNewBatsman(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      {/* Scoring pad */}
      <div className="p-3 grid grid-cols-4 gap-2">
        <ScoreButton label="0" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 0, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="1" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 1, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="2" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 2, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="3" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 3, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="4" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 4, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="6" variant="run" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 6, extras: { type: null, runs: 0 }, wicket: null, isLegalDelivery: true })} />
        <ScoreButton label="Wd" sublabel="wide" variant="extra" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 0, extras: { type: "wide", runs: 1 }, wicket: null, isLegalDelivery: false })} />
        <ScoreButton label="Nb" sublabel="no ball" variant="extra" disabled={busy || pendingNewBatsman} onClick={() => recordBall({ runsOffBat: 0, extras: { type: "no_ball", runs: 1 }, wicket: null, isLegalDelivery: false })} />
        <ScoreButton label="W" sublabel="wicket" variant="wicket" disabled={busy || pendingNewBatsman} onClick={() => setWicketSheet(true)} className="col-span-2" />
        <ScoreButton label="↩" sublabel="undo" variant="undo" disabled={busy} onClick={() => { if (canTap()) void onUndo(); }} className="col-span-2" />
      </div>

      <div className="px-3 pb-4 flex gap-2">
        <Button variant="outline" className="flex-1 h-11" disabled={busy} onClick={() => setBowlerSheet(true)}>
          Change bowler
        </Button>
        <Button variant="outline" className="flex-1 h-11" disabled={busy} onClick={() => setSecondaryOpen(true)}>
          More…
        </Button>
      </div>

      <Sheet open={wicketSheet} onOpenChange={setWicketSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Wicket — how out?</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 mt-4 pb-6">
            {(
              [
                "bowled",
                "caught",
                "lbw",
                "run_out",
                "stumped",
                "hit_wicket",
                "timed_out",
                "obstructing_field",
                "hit_ball_twice",
              ] as const
            ).map((type) => (
              <Button
                key={type}
                variant="outline"
                className="h-12 capitalize"
                onClick={() => void recordWicket(type)}
              >
                {type.replace("_", " ")}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={bowlerSheet} onOpenChange={setBowlerSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-h-[70dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Select bowler</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 mt-4 pb-6">
            {bowlingSquad.map((p) => (
              <Button
                key={p.id}
                variant={activeBowlerId === p.id ? "default" : "outline"}
                className="h-11 justify-start"
                onClick={() => {
                  onBowlerChange(p.id);
                  setBowlerSheet(false);
                }}
              >
                {p.name}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={secondaryOpen} onOpenChange={setSecondaryOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Match actions</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 mt-4 pb-6">
            {!isPaused ? (
              <Button
                variant="outline"
                className="h-12 border-sky-500/40"
                disabled={busy}
                onClick={async () => {
                  setSecondaryOpen(false);
                  await onEvent(CricketEventType.MATCH_INTERRUPTED, { reason: "Rain" });
                }}
              >
                <CloudRain className="w-4 h-4 mr-2" />
                Rain delay
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-12"
                disabled={busy}
                onClick={async () => {
                  setSecondaryOpen(false);
                  await onEvent(CricketEventType.MATCH_RESUMED, {});
                }}
              >
                Resume play
              </Button>
            )}
            <Button
              variant="outline"
              className="h-12"
              disabled={busy || state.innings.length === 0}
              onClick={() => {
                setSecondaryOpen(false);
                setDlsSheet(true);
              }}
            >
              Apply DLS (revised overs)
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy || !battingId}
              onClick={async () => {
                setSecondaryOpen(false);
                await onEvent(CricketEventType.PENALTY_AWARDED, {
                  innings: state.currentInnings,
                  battingTeamId: battingId,
                  runs: 5,
                });
              }}
            >
              Penalty +5 runs
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy || !strikerId}
              onClick={() => {
                setSecondaryOpen(false);
                setRetireSheet(true);
              }}
            >
              Retired batter
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy}
              onClick={async () => {
                if (!battingId || !bowlingId) return;
                setSecondaryOpen(false);
                await onEvent(CricketEventType.SUPER_OVER_STARTED, {
                  innings: Math.max(state.innings.length + 1, 3),
                  battingTeamId: battingId,
                  bowlingTeamId: bowlingId,
                  oversLimit: 1,
                });
              }}
            >
              Start super over
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy}
              onClick={async () => {
                setSecondaryOpen(false);
                const reason = suggestInningsEndReason(state);
                await onInningsEnd({
                  innings: state.currentInnings,
                  reason,
                  runs: innings.runs,
                  wickets: innings.wickets,
                  overs: oversText(innings.over, innings.ball),
                });
              }}
            >
              End innings
            </Button>
            <Button
              variant="destructive"
              className="h-12"
              disabled={busy}
              onClick={async () => {
                setSecondaryOpen(false);
                const result = buildMatchResult(state);
                await onMatchComplete({
                  winnerTeamId: result.winnerTeamId,
                  margin: result.margin,
                  resultText: result.resultText,
                  isTie: result.isTie,
                });
              }}
            >
              End match
            </Button>
            <Button
              variant="destructive"
              className="h-12"
              disabled={busy}
              onClick={async () => {
                setSecondaryOpen(false);
                await onEvent(CricketEventType.MATCH_ABANDONED, { reason: "Rain — no result" });
              }}
            >
              Abandon (no result)
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={dlsSheet} onOpenChange={setDlsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>DLS — revised overs</SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div>
              <label className="text-xs text-muted-foreground">Overs per innings (revised)</label>
              <Input
                type="number"
                min={1}
                max={50}
                value={revisedOvers}
                onChange={(e) => setRevisedOvers(e.target.value)}
                className="mt-1 h-12 text-lg"
              />
            </div>
            <Button
              className="w-full h-12"
              disabled={busy || !dlsPreview}
              onClick={async () => {
                if (!dlsPreview) return;
                setDlsSheet(false);
                await onEvent(CricketEventType.DLS_APPLIED, {
                  innings: dlsPreview.innings,
                  revisedOvers: parseInt(revisedOvers, 10),
                  parScore: dlsPreview.parScore,
                  target: dlsPreview.target,
                  reason: "Rain — DLS",
                });
              }}
            >
              {dlsPreview
                ? `Apply DLS target ${dlsPreview.target} (${revisedOvers} overs)`
                : "Apply DLS target"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={retireSheet} onOpenChange={setRetireSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl">
          <SheetHeader>
            <SheetTitle>Retired — {playerNameById(players, strikerId)}</SheetTitle>
          </SheetHeader>
          <div className="grid grid-cols-2 gap-2 mt-4 pb-6">
            <Button
              variant="outline"
              className="h-12"
              disabled={busy || !strikerId || !battingId}
              onClick={async () => {
                setRetireSheet(false);
                await onEvent(CricketEventType.PLAYER_RETIRED, {
                  innings: state.currentInnings,
                  teamId: battingId,
                  playerId: strikerId,
                  type: "hurt",
                });
                onNewBatsman(-1);
              }}
            >
              Retired hurt
            </Button>
            <Button
              variant="outline"
              className="h-12"
              disabled={busy || !strikerId || !battingId}
              onClick={async () => {
                setRetireSheet(false);
                await onEvent(CricketEventType.PLAYER_RETIRED, {
                  innings: state.currentInnings,
                  teamId: battingId,
                  playerId: strikerId,
                  type: "out",
                });
                onNewBatsman(-1);
              }}
            >
              Retired out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
