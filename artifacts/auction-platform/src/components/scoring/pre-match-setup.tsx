import { useEffect, useMemo, useRef, useState } from "react";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import {
  CricketEventType,
  executionLimitsFromRules,
} from "@workspace/scoring-core";
import { apiFetch } from "@workspace/api-base/api-fetch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  squadPlayersForTeam,
  type CricketScorerPlayer,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import { getActiveInnings } from "@/lib/scoring-ball";
import type { ScoringMatchJson } from "@/lib/scoring-api";
import { setMatchSquad } from "@/lib/scoring-foundation-api";
import { ScoringPlayerAvatar } from "@/components/scoring/scoring-player-row";
import { cricketRulesPath } from "@/lib/cricket-routes";
import {
  BtnSecondary,
  btnCompactClass,
} from "@/components/scoring/cricket-page-chrome";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Coins,
  Crown,
  Flame,
  HandMetal,
  Loader2,
  Shield,
  Sparkles,
  Swords,
  UserCheck,
  Users,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

type PreMatchSetupProps = {
  tournamentId: number;
  match: ScoringMatchJson;
  state: CricketScoreboardState;
  teams: CricketScorerTeam[];
  players: CricketScorerPlayer[];
  localBowlerId: number | null;
  busy: boolean;
  onEvent: (
    eventType: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onBowlerSelected: (bowlerId: number) => void;
  /** Refresh match after Runtime Prepare so Start match unlocks. */
  onPrepared?: () => void | Promise<void>;
};

/** Limits from RuntimeExecutionPolicy via prepared rulesJson (Phase 2). */
export function executionLimitsFromMatch(match: ScoringMatchJson) {
  return executionLimitsFromRules(match.rules);
}

function teamName(teams: CricketScorerTeam[], id: number) {
  return teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
}

/** Batting/bowling sides from active innings, or from toss when innings not started yet. */
export function resolveCricketSideTeamIds(
  state: CricketScoreboardState,
  match: ScoringMatchJson,
): { battingId: number | null; bowlingId: number | null } {
  const inn = getActiveInnings(state);
  if (inn) {
    return { battingId: inn.battingTeamId, bowlingId: inn.bowlingTeamId };
  }
  if (state.tossWinnerTeamId != null && state.electedTo != null) {
    const other =
      state.tossWinnerTeamId === match.homeTeamId
        ? match.awayTeamId
        : match.homeTeamId;
    return {
      battingId: state.electedTo === "bat" ? state.tossWinnerTeamId : other,
      bowlingId: state.electedTo === "bat" ? other : state.tossWinnerTeamId,
    };
  }
  return { battingId: null, bowlingId: null };
}

export function PreMatchSetup({
  tournamentId,
  match,
  state,
  teams,
  players,
  localBowlerId,
  busy,
  onEvent,
  onBowlerSelected,
  onPrepared,
}: PreMatchSetupProps) {
  const [tossWinner, setTossWinner] = useState<string>(
    String(state.tossWinnerTeamId ?? match.homeTeamId),
  );
  const [electedTo, setElectedTo] = useState<"bat" | "bowl">("bat");
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState<string | null>(null);
  const autoPrepareTried = useRef(false);
  const limits = executionLimitsFromMatch(match);

  const oversLimit = limits.oversLimit ?? state.oversLimit ?? 20;
  const policyReady =
    limits.fromPolicy &&
    typeof limits.oversLimit === "number" &&
    typeof limits.playingSquadSize === "number" &&
    typeof limits.benchSize === "number";
  const playingSquadSize = limits.playingSquadSize ?? 11;
  const benchSize = limits.benchSize ?? 4;

  async function handlePrepare() {
    if (preparing || busy) return;
    setPreparing(true);
    setPrepareError(null);
    try {
      const res = await apiFetch(
        `/tournaments/${tournamentId}/runtime-matches/${match.id}/prepare`,
        { method: "POST" },
      );
      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        validation?: { issues?: Array<{ severity: string; message: string }> };
      };
      if (!res.ok) {
        const blockers = (body.validation?.issues ?? [])
          .filter((i) => i.severity === "ERROR")
          .map((i) => i.message)
          .slice(0, 3);
        throw new Error(
          blockers.length > 0
            ? `${body.error ?? "Could not lock tournament rules"}: ${blockers.join(" · ")}`
            : body.error || "Could not lock tournament rules for this match",
        );
      }
      await onPrepared?.();
    } catch (e) {
      setPrepareError(
        e instanceof Error ? e.message : "Could not lock tournament rules",
      );
    } finally {
      setPreparing(false);
    }
  }

  // Auto prepare match rules once on mount
  useEffect(() => {
    if (limits.fromPolicy || autoPrepareTried.current) return;
    autoPrepareTried.current = true;
    void handlePrepare();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limits.fromPolicy, match.id]);

  const { battingId, bowlingId } = resolveCricketSideTeamIds(state, match);
  const needsToss =
    state.innings.length === 0 &&
    state.matchStatus !== "completed" &&
    state.matchStatus !== "abandoned";
  const needsBattingLineup =
    battingId != null && (state.lineups[battingId]?.length ?? 0) < 2;
  const needsBowlingLineup =
    bowlingId != null && (state.lineups[bowlingId]?.length ?? 0) < 1;
  const needsOpeners =
    !needsToss &&
    !needsBattingLineup &&
    !needsBowlingLineup &&
    state.strikerId == null &&
    state.nonStrikerId == null;
  const needsBowler =
    !needsToss &&
    !needsBattingLineup &&
    !needsBowlingLineup &&
    !needsOpeners &&
    state.bowlerId == null &&
    localBowlerId == null;

  if (
    !needsToss &&
    !needsBattingLineup &&
    !needsBowlingLineup &&
    !needsOpeners &&
    !needsBowler
  ) {
    return null;
  }

  const squadBadgeText =
    playingSquadSize === 11 ? "Playing XI" : `Playing ${playingSquadSize}`;

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      {/* Policy banner */}
      {!limits.fromPolicy ? (
        <div className="text-xs text-amber-200/90 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 space-y-2">
          <p className="font-semibold">
            {preparing
              ? "Applying tournament rules to this match…"
              : "Tournament rules need to lock onto this match before Start."}
          </p>
          {prepareError ? (
            <p className="text-amber-100/95">{prepareError}</p>
          ) : null}
          {!preparing ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button
                type="button"
                size="sm"
                className="h-9 font-semibold"
                disabled={busy}
                onClick={() => {
                  autoPrepareTried.current = true;
                  void handlePrepare();
                }}
              >
                Retry Apply
              </Button>
              <BtnSecondary
                href={cricketRulesPath(tournamentId)}
                className={btnCompactClass}
              >
                Open Rules & format
              </BtnSecondary>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 text-amber-100/80">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              Locking match rules…
            </p>
          )}
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground px-1">
          <span className="font-medium text-foreground">
            Match Format: <strong>{limits.oversLimit} Overs</strong> · <strong>{squadBadgeText}</strong> · Bench {limits.benchSize ?? "—"}
          </span>
          <span>
            {match.rules?.superBallEnabled ? "⭐ Super Ball Active · " : ""}
            {match.rules?.lbwEnabled === false ? "LBW Off · " : "LBW On · "}
            {match.rules?.retireAtRuns != null ? `Retire @ ${match.rules.retireAtRuns}r` : ""}
          </span>
        </div>
      )}

      {/* ─── Step 1: Toss ─── */}
      {needsToss ? (
        <TossStep
          match={match}
          teams={teams}
          tossWinner={tossWinner}
          setTossWinner={setTossWinner}
          electedTo={electedTo}
          setElectedTo={setElectedTo}
          oversLimit={oversLimit}
          busy={busy || preparing}
          policyReady={policyReady}
          onStart={() =>
            onEvent(CricketEventType.MATCH_STARTED, {
              tossWinnerTeamId: parseInt(tossWinner, 10),
              electedTo,
              oversLimit,
              powerplayOvers:
                match.rules?.powerplayOvers ??
                (match.rules?.superBallEnabled ? [1] : undefined),
            })
          }
        />
      ) : null}

      {/* ─── Step 2A: Batting Team Squad Lineup ─── */}
      {needsBattingLineup &&
      battingId &&
      playingSquadSize != null &&
      benchSize != null ? (
        <SquadLineupPicker
          title={`${teamName(teams, battingId)} (Batting Team) — Select ${squadBadgeText}`}
          teamId={battingId}
          players={players}
          playingSquadSize={playingSquadSize}
          benchSize={benchSize}
          busy={busy}
          onConfirm={async (playingXi, bench, battingOrder, captainId, wicketKeeperId) => {
            await setMatchSquad(tournamentId, match.id, battingId, {
              playingXi,
              bench,
              battingOrder,
              captainId,
              wicketKeeperId,
            });
            await onEvent(CricketEventType.LINEUP_SET, {
              teamId: battingId,
              playerIds: playingXi,
              battingOrder,
            });
          }}
        />
      ) : null}

      {/* ─── Step 2B: Bowling Team Squad Lineup ─── */}
      {needsBowlingLineup &&
      bowlingId &&
      playingSquadSize != null &&
      benchSize != null ? (
        <SquadLineupPicker
          title={`${teamName(teams, bowlingId)} (Bowling Team) — Select ${squadBadgeText}`}
          teamId={bowlingId}
          players={players}
          playingSquadSize={playingSquadSize}
          benchSize={benchSize}
          busy={busy}
          onConfirm={async (playingXi, bench, _order, captainId, wicketKeeperId) => {
            await setMatchSquad(tournamentId, match.id, bowlingId, {
              playingXi,
              bench,
              captainId,
              wicketKeeperId,
            });
            await onEvent(CricketEventType.LINEUP_SET, {
              teamId: bowlingId,
              playerIds: playingXi,
            });
          }}
        />
      ) : null}

      {/* ─── Step 3: Openers Picker ─── */}
      {needsOpeners && battingId ? (
        <OpenersPicker
          teamId={battingId}
          teamName={teamName(teams, battingId)}
          players={players}
          lineup={state.lineups[battingId] ?? []}
          busy={busy}
          onConfirm={(strikerId, nonStrikerId) =>
            onEvent(CricketEventType.LINEUP_SET, {
              teamId: battingId,
              playerIds: state.lineups[battingId] ?? [],
              battingOrder: [strikerId, nonStrikerId],
            })
          }
        />
      ) : null}

      {/* ─── Step 4: Opening Bowler Picker ─── */}
      {needsBowler && bowlingId ? (
        <BowlerPicker
          teamId={bowlingId}
          teamName={teamName(teams, bowlingId)}
          players={players}
          lineup={state.lineups[bowlingId] ?? []}
          busy={busy}
          onSelect={onBowlerSelected}
        />
      ) : null}
    </div>
  );
}

/* ═════════════════════════════════════════════════════════ */
/* ─── Toss Step ─── */
/* ═════════════════════════════════════════════════════════ */
function TossStep({
  match,
  teams,
  tossWinner,
  setTossWinner,
  electedTo,
  setElectedTo,
  oversLimit,
  busy,
  policyReady,
  onStart,
}: {
  match: ScoringMatchJson;
  teams: CricketScorerTeam[];
  tossWinner: string;
  setTossWinner: (v: string) => void;
  electedTo: "bat" | "bowl";
  setElectedTo: (v: "bat" | "bowl") => void;
  oversLimit: number;
  busy: boolean;
  policyReady: boolean;
  onStart: () => void | Promise<void>;
}) {
  const home = teams.find((t) => t.id === match.homeTeamId);
  const away = teams.find((t) => t.id === match.awayTeamId);
  const startBlocked = busy || !policyReady;

  const winnerId = parseInt(tossWinner, 10);
  const winnerTeam = teams.find((t) => t.id === winnerId);

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-sm p-3.5 sm:p-5 md:p-6 shadow-md space-y-4 sm:space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 sm:gap-2.5">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-lg sm:text-xl">
            🪙
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-foreground">Match Toss & Setup</h2>
            <p className="text-[11px] sm:text-xs text-muted-foreground">Select who won the toss and their choice</p>
          </div>
        </div>
        <span className="px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[11px] sm:text-xs font-bold bg-primary/10 text-primary border border-primary/20 shrink-0">
          {oversLimit} Overs
        </span>
      </div>

      {/* Toss Winner Team Selection Cards */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Who Won the Toss?
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          {/* Home Team Card */}
          <div
            onClick={() => !busy && setTossWinner(String(match.homeTeamId))}
            className={cn(
              "p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 select-none",
              tossWinner === String(match.homeTeamId)
                ? "border-amber-400/80 bg-amber-500/15 shadow-md shadow-amber-500/10 ring-2 ring-amber-400/50"
                : "border-border/70 bg-card/40 hover:bg-card/80",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                Home
              </span>
              {tossWinner === String(match.homeTeamId) ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              ) : null}
            </div>
            <p className="font-bold text-xs sm:text-base text-foreground truncate mt-0.5 sm:mt-1">
              {home?.name ?? "Home Team"}
            </p>
            <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
              {home?.shortCode ?? "HOM"}
            </p>
          </div>

          {/* Away Team Card */}
          <div
            onClick={() => !busy && setTossWinner(String(match.awayTeamId))}
            className={cn(
              "p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-1.5 sm:gap-2 select-none",
              tossWinner === String(match.awayTeamId)
                ? "border-amber-400/80 bg-amber-500/15 shadow-md shadow-amber-500/10 ring-2 ring-amber-400/50"
                : "border-border/70 bg-card/40 hover:bg-card/80",
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                Away
              </span>
              {tossWinner === String(match.awayTeamId) ? (
                <CheckCircle2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-400" />
              ) : null}
            </div>
            <p className="font-bold text-xs sm:text-base text-foreground truncate mt-0.5 sm:mt-1">
              {away?.name ?? "Away Team"}
            </p>
            <p className="text-[11px] sm:text-xs font-semibold text-muted-foreground">
              {away?.shortCode ?? "AWY"}
            </p>
          </div>
        </div>
      </div>

      {/* Decision: Bat or Bowl */}
      <div className="space-y-2">
        <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
          Elected To
        </Label>
        <div className="grid grid-cols-2 gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 sm:h-13 font-bold text-xs sm:text-base rounded-xl sm:rounded-2xl transition-all border gap-1.5 sm:gap-2",
              electedTo === "bat"
                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                : "border-border/70 bg-card/50 hover:bg-card",
            )}
            disabled={!policyReady || busy}
            onClick={() => setElectedTo("bat")}
          >
            <span>🏏 Bat First</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "h-11 sm:h-13 font-bold text-xs sm:text-base rounded-xl sm:rounded-2xl transition-all border gap-1.5 sm:gap-2",
              electedTo === "bowl"
                ? "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:bg-primary/90"
                : "border-border/70 bg-card/50 hover:bg-card",
            )}
            disabled={!policyReady || busy}
            onClick={() => setElectedTo("bowl")}
          >
            <span>⚾ Bowl First</span>
          </Button>
        </div>
      </div>

      {/* Toss Statement Preview */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-2.5 sm:p-3 text-xs text-primary font-semibold flex items-center gap-2">
        <Zap className="w-4 h-4 shrink-0 text-primary" />
        <span>
          <strong>{winnerTeam?.name ?? "Team"}</strong> won the toss and elected to <strong>{electedTo.toUpperCase()}</strong> first.
        </span>
      </div>

      <Button
        className="w-full h-11 sm:h-13 font-display font-black text-sm sm:text-base rounded-xl sm:rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-yellow-400 hover:from-amber-300 hover:to-yellow-300 text-slate-950 shadow-xl shadow-amber-400/20 cursor-pointer transition-all active:scale-[0.98]"
        disabled={startBlocked}
        onClick={() => {
          if (startBlocked) return;
          void onStart();
        }}
      >
        {!policyReady ? (
          "Applying Rules…"
        ) : busy ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-slate-950" />
            Starting Match…
          </span>
        ) : (
          <span className="flex items-center gap-2">
            <span>Confirm Toss & Pick Lineups</span>
            <ArrowRight className="w-4 h-4" />
          </span>
        )}
      </Button>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════ */
/* ─── Squad Lineup Picker with Auto-Fill & Captain/WK ─── */
/* ═════════════════════════════════════════════════════════ */
function SquadLineupPicker({
  title,
  teamId,
  players,
  playingSquadSize,
  benchSize,
  busy,
  onConfirm,
}: {
  title: string;
  teamId: number;
  players: CricketScorerPlayer[];
  playingSquadSize: number;
  benchSize: number;
  busy: boolean;
  onConfirm: (
    playingXi: number[],
    bench: number[],
    battingOrder?: number[],
    captainId?: number | null,
    wicketKeeperId?: number | null,
  ) => void | Promise<void>;
}) {
  const squad = useMemo(
    () => squadPlayersForTeam(players, teamId),
    [players, teamId],
  );
  const [playingXi, setPlayingXi] = useState<number[]>([]);
  const [bench, setBench] = useState<number[]>([]);
  const [captainId, setCaptainId] = useState<number | null>(null);
  const [wicketKeeperId, setWicketKeeperId] = useState<number | null>(null);

  // Auto-fill all squad if empty
  function handleAutoFill() {
    const allIds = squad.map((p) => p.id);
    const xi = allIds.slice(0, playingSquadSize);
    const b = allIds.slice(playingSquadSize, playingSquadSize + benchSize);
    setPlayingXi(xi);
    setBench(b);
    if (!captainId && xi.length > 0) setCaptainId(xi[0]!);
    if (!wicketKeeperId && xi.length > 1) setWicketKeeperId(xi[1]!);
  }

  function toggleXi(id: number) {
    setPlayingXi((prev) => {
      if (prev.includes(id)) {
        setBench((b) => b.filter((x) => x !== id));
        if (captainId === id) setCaptainId(null);
        if (wicketKeeperId === id) setWicketKeeperId(null);
        return prev.filter((x) => x !== id);
      }
      if (prev.length >= playingSquadSize) return prev;
      setBench((b) => b.filter((x) => x !== id));
      return [...prev, id];
    });
  }

  function toggleBench(id: number) {
    if (playingXi.includes(id)) return;
    setBench((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= benchSize) return prev;
      return [...prev, id];
    });
  }

  const isComplete = playingXi.length === playingSquadSize;

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-sm p-3.5 sm:p-5 md:p-6 shadow-md space-y-3.5 sm:space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border/60 pb-3">
        <div>
          <h2 className="text-sm sm:text-base font-bold text-foreground">{title}</h2>
          <p className="text-[11px] sm:text-xs text-muted-foreground">
            Select {playingSquadSize} playing players + tag Captain (C) & Keeper (WK)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 text-xs font-semibold gap-1 rounded-xl"
            onClick={handleAutoFill}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            Auto-fill Squad
          </Button>
          <span
            className={cn(
              "text-xs font-bold tabular-nums px-2.5 py-1 rounded-full border",
              isComplete
                ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                : "bg-amber-500/15 text-amber-300 border-amber-500/30",
            )}
          >
            {playingXi.length}/{playingSquadSize} Selected
          </span>
        </div>
      </div>

      {squad.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          No registered players for this team. Add players via Team Roster first.
        </p>
      ) : (
        <ul className="max-h-72 overflow-y-auto space-y-1.5 pr-1">
          {squad.map((p) => {
            const inXi = playingXi.includes(p.id);
            const onBench = bench.includes(p.id);
            const isC = captainId === p.id;
            const isWk = wicketKeeperId === p.id;

            return (
              <li
                key={p.id}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-xl sm:rounded-2xl px-2.5 py-1.5 sm:px-3 sm:py-2 border transition-all",
                  inXi
                    ? "bg-primary/10 border-primary/30"
                    : onBench
                      ? "bg-muted/20 border-border/50"
                      : "bg-card/40 border-border/40 hover:bg-card/70",
                )}
              >
                <label className="flex flex-1 items-center gap-2.5 cursor-pointer min-w-0">
                  <Checkbox
                    checked={inXi}
                    onCheckedChange={() => toggleXi(p.id)}
                  />
                  <ScoringPlayerAvatar
                    name={p.name}
                    photoUrl={p.photoUrl}
                    gender={p.gender}
                    size="sm"
                  />
                  <div className="min-w-0">
                    <p className="font-bold text-xs sm:text-sm text-foreground truncate">
                      {p.name}
                    </p>
                    <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                      {p.role ?? "Player"}
                    </span>
                  </div>
                </label>

                <div className="flex items-center gap-1.5 shrink-0">
                  {inXi ? (
                    <>
                      {/* Captain Toggle */}
                      <button
                        type="button"
                        onClick={() => setCaptainId(isC ? null : p.id)}
                        className={cn(
                          "w-7 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all",
                          isC
                            ? "bg-amber-500 text-slate-950 shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground",
                        )}
                        title="Toggle Captain (C)"
                      >
                        C
                      </button>

                      {/* Wicketkeeper Toggle */}
                      <button
                        type="button"
                        onClick={() => setWicketKeeperId(isWk ? null : p.id)}
                        className={cn(
                          "w-8 h-7 rounded-lg text-xs font-black flex items-center justify-center transition-all",
                          isWk
                            ? "bg-sky-500 text-slate-950 shadow-sm"
                            : "bg-muted/50 text-muted-foreground hover:text-foreground",
                        )}
                        title="Toggle Wicketkeeper (WK)"
                      >
                        WK
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => toggleBench(p.id)}
                      className={cn(
                        "px-2 py-1 rounded-lg text-[10px] font-bold uppercase transition-all",
                        onBench
                          ? "bg-muted text-foreground border border-border"
                          : "text-muted-foreground/60 hover:text-muted-foreground",
                      )}
                    >
                      {onBench ? "Bench ✓" : "+ Bench"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <Button
        className="w-full h-11 sm:h-12 font-bold text-xs sm:text-base rounded-xl sm:rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20"
        disabled={busy || playingXi.length < 2}
        onClick={() =>
          void onConfirm(
            playingXi,
            bench,
            playingXi,
            captainId,
            wicketKeeperId,
          )
        }
      >
        Confirm {playingSquadSize === 11 ? "Playing XI" : `Playing ${playingSquadSize}`} ({playingXi.length} Selected)
      </Button>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════ */
/* ─── Openers Picker Step ─── */
/* ═════════════════════════════════════════════════════════ */
function OpenersPicker({
  teamId,
  teamName,
  players,
  lineup,
  busy,
  onConfirm,
}: {
  teamId: number;
  teamName: string;
  players: CricketScorerPlayer[];
  lineup: number[];
  busy: boolean;
  onConfirm: (strikerId: number, nonStrikerId: number) => void;
}) {
  const squad = useMemo(() => {
    const map = new Map(
      squadPlayersForTeam(players, teamId).map((p) => [p.id, p]),
    );
    return lineup
      .map((id) => map.get(id))
      .filter(Boolean) as CricketScorerPlayer[];
  }, [players, teamId, lineup]);

  const [striker, setStriker] = useState<number | null>(squad[0]?.id ?? null);
  const [nonStriker, setNonStriker] = useState<number | null>(
    squad[1]?.id ?? null,
  );

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-sm p-3.5 sm:p-5 md:p-6 shadow-md space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-sm sm:text-base font-bold text-foreground">Select Opening Batters</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">
          {teamName} · Choose who takes first strike (*) and non-striker
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
        {/* Striker Picker Column */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Striker (*) — Facing 1st Ball
          </Label>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {squad.map((p) => {
              const isSelected = striker === p.id;
              const isOther = nonStriker === p.id;
              return (
                <div
                  key={`striker-${p.id}`}
                  onClick={() => !isOther && setStriker(p.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                      : isOther
                        ? "opacity-35 pointer-events-none bg-muted/20 border-border/40"
                        : "bg-card/40 border-border/60 hover:bg-card/80",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ScoringPlayerAvatar name={p.name} photoUrl={p.photoUrl} gender={p.gender} size="sm" />
                    <span className="text-xs sm:text-sm truncate">{p.name}</span>
                  </div>
                  {isSelected ? <Check className="w-4 h-4 text-primary" /> : null}
                </div>
              );
            })}
          </div>
        </div>

        {/* Non-Striker Picker Column */}
        <div className="space-y-2">
          <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Non-Striker (Runner End)
          </Label>
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {squad.map((p) => {
              const isSelected = nonStriker === p.id;
              const isOther = striker === p.id;
              return (
                <div
                  key={`non-striker-${p.id}`}
                  onClick={() => !isOther && setNonStriker(p.id)}
                  className={cn(
                    "flex items-center justify-between p-2.5 rounded-xl sm:rounded-2xl border transition-all cursor-pointer select-none",
                    isSelected
                      ? "bg-muted border-foreground/40 text-foreground font-bold shadow-sm"
                      : isOther
                        ? "opacity-35 pointer-events-none bg-muted/20 border-border/40"
                        : "bg-card/40 border-border/60 hover:bg-card/80",
                  )}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <ScoringPlayerAvatar name={p.name} photoUrl={p.photoUrl} gender={p.gender} size="sm" />
                    <span className="text-xs sm:text-sm truncate">{p.name}</span>
                  </div>
                  {isSelected ? <Check className="w-4 h-4 text-foreground" /> : null}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <Button
        className="w-full h-11 sm:h-12 font-bold text-xs sm:text-base rounded-xl sm:rounded-2xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md shadow-primary/20 cursor-pointer"
        disabled={busy || !striker || !nonStriker || striker === nonStriker}
        onClick={() => striker && nonStriker && onConfirm(striker, nonStriker)}
      >
        Confirm Openers & Pick Bowler →
      </Button>
    </section>
  );
}

/* ═════════════════════════════════════════════════════════ */
/* ─── Opening Bowler Picker Step ─── */
/* ═════════════════════════════════════════════════════════ */
function BowlerPicker({
  teamId,
  teamName,
  players,
  lineup,
  busy,
  onSelect,
}: {
  teamId: number;
  teamName: string;
  players: CricketScorerPlayer[];
  lineup: number[];
  busy: boolean;
  onSelect: (bowlerId: number) => void;
}) {
  const squad = useMemo(() => {
    const map = new Map(
      squadPlayersForTeam(players, teamId).map((p) => [p.id, p]),
    );
    return lineup
      .map((id) => map.get(id))
      .filter(Boolean) as CricketScorerPlayer[];
  }, [players, teamId, lineup]);

  const [bowler, setBowler] = useState<number | null>(squad[0]?.id ?? null);

  return (
    <section className="rounded-2xl sm:rounded-3xl border border-border/80 bg-card/70 backdrop-blur-sm p-3.5 sm:p-5 md:p-6 shadow-md space-y-4 sm:space-y-5">
      <div>
        <h2 className="text-sm sm:text-base font-bold text-foreground">Select Opening Bowler</h2>
        <p className="text-[11px] sm:text-xs text-muted-foreground">
          {teamName} · Choose who bowls the 1st over
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
        {squad.map((p) => {
          const isSelected = bowler === p.id;
          return (
            <div
              key={p.id}
              onClick={() => setBowler(p.id)}
              className={cn(
                "flex items-center justify-between p-2.5 sm:p-3 rounded-xl sm:rounded-2xl border transition-all cursor-pointer select-none",
                isSelected
                  ? "bg-primary/20 border-primary text-primary font-bold shadow-sm"
                  : "bg-card/40 border-border/60 hover:bg-card/80",
              )}
            >
              <div className="flex items-center gap-2 sm:gap-2.5 min-w-0">
                <ScoringPlayerAvatar name={p.name} photoUrl={p.photoUrl} gender={p.gender} size="sm" />
                <div className="min-w-0">
                  <p className="font-bold text-xs sm:text-sm truncate">{p.name}</p>
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">
                    {p.role ?? "Bowler"}
                  </span>
                </div>
              </div>
              {isSelected ? <Check className="w-4 h-4 text-primary shrink-0" /> : null}
            </div>
          );
        })}
      </div>

      <Button
        className="w-full h-11 sm:h-13 font-display font-black text-sm sm:text-base rounded-xl sm:rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-xl shadow-emerald-500/20 cursor-pointer transition-all active:scale-[0.98]"
        disabled={busy || !bowler}
        onClick={() => bowler && onSelect(bowler)}
      >
        <span>🚀 Start Match & Go Live</span>
      </Button>
    </section>
  );
}
