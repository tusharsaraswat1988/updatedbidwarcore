import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CricketScoreboardState } from "@workspace/scoring-core";
import { availableDismissalTypes, FREE_HIT_DISMISSALS, isOversComplete } from "@workspace/scoring-core";
import { ScoreButton } from "@/components/scoring/score-button";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  getActiveInnings,
  illegalBallPosition,
  nextLegalBallPosition,
  oversText,
  requiredRate,
  runRate,
} from "@/lib/scoring-ball";
import {
  playerNameById,
  squadPlayersForTeam,
  type CricketScorerPlayer,
  type CricketScorerTeam,
} from "@/lib/scoring-squad";
import { isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { CricketEventType } from "@workspace/scoring-core";
import {
  battingTeamId,
  bowlingTeamId,
  buildMatchResult,
  computeDlsApplication,
  suggestInningsEndReason,
} from "@/lib/scoring-match-logic";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  AlertCircle,
  ArrowLeftRight,
  Check,
  CheckCircle2,
  CloudRain,
  Flag,
  Loader2,
  Play,
  RotateCcw,
  RefreshCw,
  SlidersHorizontal,
  Sparkles,
  Star,
  Trophy,
  UserCheck,
  Zap,
} from "lucide-react";
import type { ScoringMatchRulesJson } from "@/lib/scoring-api";
import { cn } from "@/lib/utils";

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
    fielderId?: number;
  } | null;
  isLegalDelivery: boolean;
  isSuperBall?: boolean;
};

type LiveScoringPadProps = {
  state: CricketScoreboardState;
  teams: CricketScorerTeam[];
  players: CricketScorerPlayer[];
  /** RuntimeExecutionPolicy-derived rules from prepared match.rules. */
  rules: ScoringMatchRulesJson | null;
  bowlerId: number | null;
  busy: boolean;
  onBall: (payload: Record<string, unknown>) => Promise<void>;
  onEvent: (
    eventType: string,
    payload: Record<string, unknown>,
  ) => Promise<void>;
  onUndo: () => Promise<void>;
  onInningsEnd: (payload: Record<string, unknown>) => Promise<void>;
  onMatchComplete: (payload: Record<string, unknown>) => Promise<void>;
  onBowlerChange: (bowlerId: number) => void;
  onNewBatsman: (playerId: number) => void;
  onSwapStrike?: () => void;
  onResetMatch?: () => Promise<void>;
  pendingNewBatsman: boolean;
  localStrikerId: number | null;
  localNonStrikerId: number | null;
  /** When true, local crease ids are exact, including null for a vacant end. */
  creaseLocked?: boolean;
  dismissedBatters?: number[];
};

function useDebounceTap(ms = 400) {
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
  rules,
  bowlerId,
  busy,
  onBall,
  onEvent,
  onUndo,
  onInningsEnd,
  onMatchComplete,
  onBowlerChange,
  onNewBatsman,
  onSwapStrike,
  onResetMatch,
  pendingNewBatsman,
  localStrikerId,
  localNonStrikerId,
  creaseLocked = false,
  dismissedBatters,
}: LiveScoringPadProps) {
  const { toast } = useToast();
  const lbwEnabled = rules?.lbwEnabled !== false;
  const legByeEnabled = rules?.legByeEnabled !== false;
  const freeHitEnabled = rules?.freeHitEnabled !== false;
  const superBallEnabled = rules?.superBallEnabled === true;
  const superOverEnabled = rules?.superOverEnabled !== false;
  const retireAtRuns =
    typeof rules?.retireAtRuns === "number" ? rules.retireAtRuns : null;
  const dismissalOptions = availableDismissalTypes(lbwEnabled) as WicketType[];

  // Local batter runs accumulator for retire-at-N prompts.
  const [batterRuns, setBatterRuns] = useState<Record<number, number>>({});
  const [retirePromptPlayerId, setRetirePromptPlayerId] = useState<number | null>(null);

  // Local dismissed batters tracker (to immediately exclude dismissed batters without waiting for refetch)
  const [localDismissedBatters, setLocalDismissedBatters] = useState<number[]>([]);

  // Super ball local intent toggle
  const [localSuperBallArmed, setLocalSuperBallArmed] = useState(false);

  useEffect(() => {
    // Reset when innings changes.
    setBatterRuns({});
    setRetirePromptPlayerId(null);
    setLocalSuperBallArmed(false);
    setLocalDismissedBatters([]);
  }, [state.currentInnings]);

  const canTap = useDebounceTap();
  const innings = getActiveInnings(state);

  // Modals / Sheets
  const [wicketSheet, setWicketSheet] = useState(false);
  const [selectedWicketType, setSelectedWicketType] = useState<WicketType | null>(null);
  const [runOutWho, setRunOutWho] = useState<"striker" | "non_striker">("striker");
  const [runOutRunsCompleted, setRunOutRunsCompleted] = useState<number>(0);
  const [selectedFielderId, setSelectedFielderId] = useState<number | null>(null);

  const [wideSheet, setWideSheet] = useState(false);
  const [noBallSheet, setNoBallSheet] = useState(false);
  const [byeSheet, setByeSheet] = useState(false);
  const [legByeSheet, setLegByeSheet] = useState(false);
  const [customRunsSheet, setCustomRunsSheet] = useState(false);
  const [customRunsValue, setCustomRunsValue] = useState("5");

  const [secondaryOpen, setSecondaryOpen] = useState(false);
  const [abandonConfirmOpen, setAbandonConfirmOpen] = useState(false);
  const [walkoverConfirmOpen, setWalkoverConfirmOpen] = useState(false);
  const [walkoverWinnerTeamId, setWalkoverWinnerTeamId] = useState<number>(state.homeTeamId);
  const [walkoverReason, setWalkoverReason] = useState<string>("");
  const [awardingWalkover, setAwardingWalkover] = useState(false);
  const [bowlerSheet, setBowlerSheet] = useState(false);
  const [overEndPrompt, setOverEndPrompt] = useState(false);
  const [retireSheet, setRetireSheet] = useState(false);
  const [dlsSheet, setDlsSheet] = useState(false);
  const [revisedOvers, setRevisedOvers] = useState(String(state.revisedOversLimit || state.oversLimit || 20));

  const isPaused = state.sessionStatus === "paused";

  const isSuperBallActive =
    localSuperBallArmed ||
    (!!state.superBallPending &&
      state.superBallPending.innings === state.currentInnings);

  // Super Ball reason calculation for button sublabel and toast feedback
  const superBallReason = useMemo(() => {
    if (!superBallEnabled) return "Super Ball is not enabled for this match";
    if (!innings) return "No active innings";
    if (
      state.superBallPending &&
      state.superBallPending.innings === state.currentInnings
    ) {
      return "Super Ball already declared";
    }
    const used = (state.superBallUsed?.[state.currentInnings] ?? []).includes(
      innings.battingTeamId,
    );
    if (used) return "Super Ball already used this innings";
    const powerplay = state.powerplayOvers ?? [];
    if (powerplay.includes(innings.over + 1)) {
      return `Unavailable in Powerplay (Over ${innings.over + 1})`;
    }
    return null;
  }, [
    superBallEnabled,
    innings,
    state.superBallPending,
    state.superBallUsed,
    state.currentInnings,
    state.powerplayOvers,
  ]);

  const canUseSuperBall = superBallReason === null;

  const dlsPreview = useMemo(() => {
    const overs = parseInt(revisedOvers, 10);
    if (!overs || overs < 1 || (state?.innings?.length ?? 0) === 0) return null;
    try {
      return computeDlsApplication(state, overs);
    } catch {
      return null;
    }
  }, [revisedOvers, state]);

  const strikerId = creaseLocked ? localStrikerId : (localStrikerId ?? state?.strikerId ?? null);
  const nonStrikerId = creaseLocked ? localNonStrikerId : (localNonStrikerId ?? state?.nonStrikerId ?? null);
  const activeBowlerId = bowlerId ?? state?.bowlerId;

  const battingId = battingTeamId(state);
  const bowlingId = bowlingTeamId(state);

  const battingTeam = (teams ?? []).find((t) => t.id === battingId);
  const bowlingTeam = (teams ?? []).find((t) => t.id === bowlingId);

  const battingLineup = battingId ? (state?.lineups?.[battingId] ?? []) : [];
  const onlyOneBatsmanAvailable =
    !!innings &&
    battingLineup.length > 0 &&
    battingLineup.length - innings.wickets <= 1;

  const inningsOversLimit = innings?.oversLimit ?? state.oversLimit;
  const isOversLimitReached =
    !!innings && isOversComplete(innings, inningsOversLimit);

  const isTargetReached =
    state.target != null &&
    !!innings &&
    state.currentInnings >= 2 &&
    innings.runs >= state.target;

  const isInnings1Finished =
    state.currentInnings === 1 &&
    !!innings &&
    (innings.phase === "completed" ||
      innings.wickets >= state.maxWickets ||
      isOversLimitReached);

  const isInnings2Finished =
    state.currentInnings >= 2 &&
    !!innings &&
    (innings.phase === "completed" ||
      isTargetReached ||
      innings.wickets >= state.maxWickets ||
      isOversLimitReached);

  const isMatchCompleteState =
    isTerminalCricketMatchStatus(state.matchStatus) || isInnings2Finished;

  useEffect(() => {
    if (isInnings1Finished || isMatchCompleteState) {
      setOverEndPrompt(false);
    }
  }, [isInnings1Finished, isMatchCompleteState]);

  const matchResultPreview = useMemo(() => {
    try {
      return buildMatchResult(state);
    } catch {
      return null;
    }
  }, [state]);

  const availableBatsmen = useMemo(() => {
    if (!battingId) return [];
    const squad = squadPlayersForTeam(players, battingId);
    const atCrease = new Set(
      [strikerId, nonStrikerId].filter(Boolean) as number[],
    );
    const dismissed = new Set([...(dismissedBatters ?? []), ...localDismissedBatters]);

    const notAtCreaseOrDismissed = squad.filter(
      (p) => !atCrease.has(p.id) && !dismissed.has(p.id),
    );

    // If lineup is configured, prioritize players in the lineup
    if (battingLineup.length > 0) {
      const inXi = new Set(battingLineup);
      const xiAvailable = notAtCreaseOrDismissed.filter((p) => inXi.has(p.id));
      if (xiAvailable.length > 0) {
        return xiAvailable;
      }
    }

    // Fall back to any available squad players
    return notAtCreaseOrDismissed;
  }, [
    players,
    battingId,
    battingLineup,
    strikerId,
    nonStrikerId,
    dismissedBatters,
    localDismissedBatters,
  ]);

  const bowlingSquad = useMemo(() => {
    if (!bowlingId) return [];
    const allSquad = squadPlayersForTeam(players, bowlingId);
    const lineup = state?.lineups?.[bowlingId] ?? [];
    if (lineup.length > 0) {
      const map = new Map(allSquad.map((p) => [p.id, p]));
      const matched = lineup
        .map((id) => map.get(id))
        .filter(Boolean) as CricketScorerPlayer[];
      if (matched.length > 0) return matched;
    }
    return allSquad;
  }, [players, bowlingId, state?.lineups]);

  // Record a ball delivery
  async function recordBall(input: BallInput) {
    if (isPaused) {
      toast({
        title: "Match is Paused",
        description: "Click 'Resume Play' in the top banner before recording balls.",
      });
      return;
    }
    if (
      !canTap() ||
      busy ||
      !innings ||
      !strikerId ||
      (!nonStrikerId && !onlyOneBatsmanAvailable) ||
      !activeBowlerId ||
      isOversLimitReached ||
      isInnings1Finished ||
      isInnings2Finished ||
      isMatchCompleteState
    )
      return;

    const pos = input.isLegalDelivery
      ? nextLegalBallPosition(innings)
      : illegalBallPosition(innings);

    const isSuperBall = input.isSuperBall ?? isSuperBallActive;

    await onBall({
      innings: state.currentInnings,
      over: pos.over,
      ball: pos.ball,
      strikerId,
      nonStrikerId: onlyOneBatsmanAvailable ? null : nonStrikerId,
      bowlerId: activeBowlerId,
      runsOffBat: input.runsOffBat,
      extras: input.extras,
      wicket: input.wicket,
      isLegalDelivery: input.isLegalDelivery,
      isSuperBall,
    });

    if (localSuperBallArmed) {
      setLocalSuperBallArmed(false);
    }

    if (input.wicket) {
      setLocalDismissedBatters((prev) => [...prev, input.wicket!.dismissedPlayerId]);
      onNewBatsman(-1);
      setBatterRuns((prev) => {
        const next = { ...prev };
        delete next[strikerId];
        return next;
      });
    } else if (input.runsOffBat > 0 && strikerId) {
      const addedRuns = isSuperBall ? input.runsOffBat * 2 : input.runsOffBat;
      setBatterRuns((prev) => {
        const nextRuns = (prev[strikerId] ?? 0) + addedRuns;
        const updated = { ...prev, [strikerId]: nextRuns };
        if (retireAtRuns != null && nextRuns >= retireAtRuns) {
          setRetirePromptPlayerId(strikerId);
          setRetireSheet(true);
        }
        return updated;
      });
    }

    // Check if over completed (legal ball 6) to trigger new bowler prompt (only if innings continues)
    const willOversComplete = pos.over + 1 >= inningsOversLimit;
    const willAllOut = input.wicket ? innings.wickets + 1 >= state.maxWickets : false;
    const addedTotalRuns = (isSuperBall ? input.runsOffBat * 2 : input.runsOffBat) + input.extras.runs;
    const willTargetReach = state.currentInnings >= 2 && state.target != null && innings.runs + addedTotalRuns >= state.target;
    const willInningsFinish = willOversComplete || willAllOut || willTargetReach;

    if (input.isLegalDelivery && pos.ball === 6 && !willInningsFinish) {
      setOverEndPrompt(true);
    }
  }

  // Wicket submission helper
  async function submitWicket() {
    if (!selectedWicketType) return;
    let outId = strikerId;
    let runsOffBat = 0;

    if (selectedWicketType === "run_out") {
      outId = runOutWho === "non_striker" ? nonStrikerId : strikerId;
      runsOffBat = runOutRunsCompleted;
    }

    if (!outId) return;

    setWicketSheet(false);
    const wicketType = selectedWicketType;
    const fielderId = selectedFielderId ?? undefined;

    // Reset picker state
    setSelectedWicketType(null);
    setSelectedFielderId(null);
    setRunOutRunsCompleted(0);

    setLocalDismissedBatters((prev) => [...prev, outId!]);

    await recordBall({
      runsOffBat,
      extras: { type: null, runs: 0 },
      wicket: {
        type: wicketType,
        dismissedPlayerId: outId,
        fielderId,
      },
      isLegalDelivery: true,
    });
  }

  // Super Ball Cancel
  async function handleCancelSuperBall() {
    if (!superBallEnabled || !battingId || busy) return;
    try {
      if (
        state.superBallPending &&
        state.superBallPending.innings === state.currentInnings
      ) {
        await onEvent(CricketEventType.SUPER_BALL_CANCELLED, {
          innings: state.currentInnings,
          battingTeamId: battingId,
        });
      }
    } catch (e) {
      toast({
        title: "Could not cancel Super Ball",
        description: e instanceof Error ? e.message : "Error cancelling Super Ball",
        variant: "destructive",
      });
    } finally {
      setLocalSuperBallArmed(false);
    }
  }

  // Super Ball Toggle
  async function handleToggleSuperBall() {
    if (!superBallEnabled || !battingId || busy) return;
    if (isSuperBallActive) {
      await handleCancelSuperBall();
      return;
    }
    if (!canUseSuperBall) {
      if (superBallReason) {
        toast({
          title: "Super Ball Unavailable",
          description: superBallReason,
        });
      }
      return;
    }
    try {
      await onEvent(CricketEventType.SUPER_BALL_DECLARED, {
        innings: state.currentInnings,
        battingTeamId: battingId,
      });
      setLocalSuperBallArmed(true);
    } catch (e) {
      // Server rejected — ensure we don't show stale "ACTIVE" banner.
      toast({
        title: "Super Ball declaration failed",
        description: e instanceof Error ? e.message : "Could not declare Super Ball",
        variant: "destructive",
      });
      setLocalSuperBallArmed(false);
    }
  }

  // Keyboard shortcut listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Don't intercept when typing in inputs or when dialogs are open
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA" ||
        wicketSheet ||
        wideSheet ||
        noBallSheet ||
        byeSheet ||
        legByeSheet ||
        customRunsSheet ||
        bowlerSheet ||
        retireSheet ||
        dlsSheet ||
        secondaryOpen ||
        busy
      ) {
        return;
      }

      if (pendingNewBatsman) {
        if ((e.key === "s" || e.key === "S") && onSwapStrike && canTap()) onSwapStrike();
        if ((e.key === "u" || e.key === "U") && canTap()) void onUndo();
        return;
      }

      switch (e.key) {
        case "0":
          void recordBall({
            runsOffBat: 0,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "1":
          void recordBall({
            runsOffBat: 1,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "2":
          void recordBall({
            runsOffBat: 2,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "3":
          void recordBall({
            runsOffBat: 3,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "4":
          void recordBall({
            runsOffBat: 4,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "6":
          void recordBall({
            runsOffBat: 6,
            extras: { type: null, runs: 0 },
            wicket: null,
            isLegalDelivery: true,
          });
          break;
        case "w":
        case "W":
          setWideSheet(true);
          break;
        case "n":
        case "N":
          setNoBallSheet(true);
          break;
        case "b":
        case "B":
          setByeSheet(true);
          break;
        case "l":
        case "L":
          if (legByeEnabled) setLegByeSheet(true);
          break;
        case "k":
        case "K":
        case "x":
        case "X":
          setSelectedWicketType(null);
          setWicketSheet(true);
          break;
        case "u":
        case "U":
          if (canTap()) void onUndo();
          break;
        case "s":
        case "S":
          if (onSwapStrike && canTap()) onSwapStrike();
          break;
        default:
          break;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    busy,
    pendingNewBatsman,
    wicketSheet,
    wideSheet,
    noBallSheet,
    byeSheet,
    legByeSheet,
    customRunsSheet,
    bowlerSheet,
    retireSheet,
    dlsSheet,
    secondaryOpen,
    canTap,
    onUndo,
    onSwapStrike,
    legByeEnabled,
  ]);

  if (
    !innings ||
    isTerminalCricketMatchStatus(state.matchStatus)
  ) {
    return (
      <div className="p-6 text-center space-y-2">
        <p className="text-lg font-semibold">
          {state.resultText ?? "Match ended"}
        </p>
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
    ? requiredRate(
        state.target,
        innings.runs,
        state.oversLimit,
        innings.over,
        innings.ball,
      )
    : null;

  return (
    <div className="flex flex-col h-full justify-between gap-1.5 sm:gap-3 overflow-hidden select-none">
      {isPaused ? (
        <div className="mx-2 mt-1 rounded-xl border border-sky-500/40 bg-sky-500/15 px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-100 shadow-sm">
          <div className="flex items-center gap-2 min-w-0">
            <CloudRain className="w-4 h-4 shrink-0 text-sky-300 animate-pulse" />
            <span>
              <strong>Match Paused</strong> (Rain delay
              {state.interruptionReason ? ` — ${state.interruptionReason}` : ""}).
              Keypad is locked until resumed.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              type="button"
              size="sm"
              className="h-8 px-3 text-xs bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold gap-1 shadow"
              disabled={busy}
              onClick={() => onEvent(CricketEventType.MATCH_RESUMED, {})}
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              Resume Play
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs border-sky-400/40 text-sky-200 hover:bg-sky-500/20"
              disabled={busy}
              onClick={() => setDlsSheet(true)}
            >
              DLS / Overs
            </Button>
          </div>
        </div>
      ) : null}

      {/* Super Ball Banner */}
      {isSuperBallActive ? (
        <div className="mx-2 rounded-xl border border-amber-400/60 bg-gradient-to-r from-amber-500/20 via-yellow-500/15 to-amber-500/20 px-3 py-1.5 flex items-center justify-between text-xs font-bold text-amber-300 shadow-sm animate-pulse">
          <div className="flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
            <span className="text-[11px]">SUPER BALL: ALL runs DOUBLED (2x)!</span>
          </div>
          <button
            type="button"
            onClick={() => void handleCancelSuperBall()}
            className="text-[10px] uppercase font-bold text-muted-foreground hover:text-amber-200 ml-2 cursor-pointer"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {/* Free Hit Banner */}
      {state.freeHitActive ? (
        <div className="mx-2 rounded-xl border border-emerald-500/50 bg-emerald-500/15 px-3 py-1.5 flex items-center gap-1.5 text-xs font-bold text-emerald-300 shadow-sm">
          <Zap className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
          <span className="text-[11px]">FREE HIT ACTIVE: Only Run Out dismissals!</span>
        </div>
      ) : null}

      {/* ─── Scoreboard Strip ─── */}
      <div className="px-3 py-2 sm:px-4 sm:py-3 rounded-2xl border border-white/10 bg-gradient-to-b from-[#111938]/95 via-[#0c132a]/95 to-[#070b19]/98 shadow-xl shadow-black/40 space-y-2 shrink-0 backdrop-blur-md">
        {/* Top Meta Row: Innings/Target & Teams Matchup */}
        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-white/5">
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-400/30 text-amber-300 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider">
              Innings {state.currentInnings}
              {state.target ? ` · Target ${state.target}` : ""}
            </span>
            {retireAtRuns != null ? (
              <span className="text-[9.5px] text-white/50 hidden xs:inline">
                (Retire limit: {retireAtRuns}r)
              </span>
            ) : null}
          </div>

          <div className="flex items-center gap-1.5 text-xs shrink-0">
            <span
              className="font-black text-xs sm:text-sm flex items-center gap-1"
              style={{ color: battingTeam?.color ?? "#38bdf8" }}
            >
              {battingTeam?.shortCode ?? "BAT"}
              <span className="text-xs">🏏</span>
            </span>
            <span className="text-white/40 text-[10px] sm:text-xs">vs</span>
            <span className="text-white/70 font-semibold text-xs sm:text-sm">
              {bowlingTeam?.shortCode ?? "BOWL"}
            </span>
          </div>
        </div>

        {/* Main Score (Left) & CRR / RRR Boxes (Right) */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <p className="text-2xl sm:text-4xl font-black tabular-nums tracking-tight text-white flex items-baseline gap-1.5 sm:gap-2 font-mono">
              <span>{innings.runs}/{innings.wickets}</span>
              <span className="text-xs sm:text-base text-white/60 font-semibold font-sans">
                ({oversText(innings.over, innings.ball)} / {state.oversLimit} ov)
              </span>
            </p>
            {req ? (
              <p className="text-[10px] sm:text-xs text-white/75 mt-0.5 font-medium leading-tight">
                Need <strong className="text-emerald-400 font-bold">{Math.max(0, state.target! - innings.runs)}</strong> off <strong className="text-white">{Math.max(0, state.oversLimit * 6 - (innings.over * 6 + innings.ball))}b</strong>
              </p>
            ) : null}
          </div>

          {/* CRR & RRR displayed to the right of the score */}
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex flex-col items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-white/[0.06] border border-white/12 shadow-sm min-w-[50px] sm:min-w-[60px]">
              <span className="text-[8.5px] sm:text-[9.5px] uppercase font-extrabold text-white/50 tracking-wider leading-none">
                CRR
              </span>
              <span className="text-xs sm:text-sm font-black text-amber-400 font-mono mt-0.5 leading-tight">
                {rr}
              </span>
            </div>
            {req ? (
              <div className="flex flex-col items-center justify-center px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-xl bg-amber-500/15 border border-amber-400/35 shadow-sm min-w-[50px] sm:min-w-[60px]">
                <span className="text-[8.5px] sm:text-[9.5px] uppercase font-extrabold text-amber-300/80 tracking-wider leading-none">
                  RRR
                </span>
                <span className="text-xs sm:text-sm font-black text-amber-300 font-mono mt-0.5 leading-tight">
                  {req}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* ─── Crease / Batters & Bowler Card ─── */}
        <div className="space-y-1.5 pt-2 border-t border-white/10 text-xs">
          {/* Row 1: Striker & Non-Striker (2 Equal Columns) */}
          <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
            {/* Striker */}
            <div className="flex items-center justify-between rounded-xl bg-gradient-to-r from-amber-500/[0.22] via-amber-500/[0.12] to-amber-500/[0.04] border border-amber-400/50 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-sm shadow-amber-950/20 min-w-0">
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] uppercase font-black text-amber-300 tracking-wider flex items-center gap-1.5 leading-none">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/80" />
                  Striker *
                </span>
                {strikerId ? (
                  <p className="font-bold text-white text-xs sm:text-sm truncate mt-1" title={playerNameById(players, strikerId)}>
                    {playerNameById(players, strikerId)}
                  </p>
                ) : (
                  <p className="font-black text-amber-300 text-xs sm:text-sm truncate mt-1 flex items-center gap-1 animate-pulse">
                    <span>Select Batter</span>
                    <span>👇</span>
                  </p>
                )}
              </div>
              {strikerId && batterRuns[strikerId] != null ? (
                <span className="text-xs font-black text-amber-300 tabular-nums shrink-0 ml-1 px-1.5 py-0.5 rounded-lg bg-amber-400/20 border border-amber-400/30">
                  {batterRuns[strikerId]}r
                </span>
              ) : null}
            </div>

            {/* Non-Striker & Swap Button */}
            <div className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/10 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xs min-w-0">
              <div className="min-w-0 flex-1 pr-1">
                <span className="text-[9.5px] uppercase font-bold text-white/50 tracking-wider leading-none block">
                  Non-Striker
                </span>
                <p className="font-semibold text-slate-200 text-xs sm:text-sm truncate mt-1" title={playerNameById(players, nonStrikerId) || "Select Non-Striker"}>
                  {playerNameById(players, nonStrikerId) || "Select Non-Striker"}
                </p>
              </div>
              {onSwapStrike ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-sky-300 hover:text-white hover:bg-sky-500/20 shrink-0 rounded-lg border border-sky-400/30 disabled:opacity-40"
                  onClick={onSwapStrike}
                  disabled={busy || (strikerId == null && nonStrikerId == null)}
                  title="Rotate strike"
                  aria-label="Rotate strike"
                >
                  <ArrowLeftRight className="w-4 h-4" />
                </Button>
              ) : null}
            </div>
          </div>

          {/* Row 2: Dedicated Full-Width Bowler Bar (No name truncation!) */}
          <div className="flex items-center justify-between rounded-xl bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 px-2.5 py-1.5 sm:px-3 sm:py-2 shadow-xs transition-colors">
            <div
              className="min-w-0 flex-1 flex items-center gap-2 cursor-pointer"
              onClick={() => setBowlerSheet(true)}
            >
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-[9.5px] uppercase font-bold text-white/50 tracking-wider leading-none flex items-center gap-1">
                  <span>Bowler</span>
                </span>
                <p
                  className="font-bold text-slate-100 text-xs sm:text-sm mt-1 break-words"
                  title={playerNameById(players, activeBowlerId) || "Select Bowler"}
                >
                  {playerNameById(players, activeBowlerId) || (
                    <span className="text-amber-400 font-bold italic">Select Bowler 👆</span>
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 sm:h-8 px-2.5 sm:px-3 text-[11px] font-bold rounded-lg border-white/20 bg-white/[0.08] text-white hover:bg-white/20 hover:text-white shrink-0 gap-1.5 shadow-xs"
              onClick={() => setBowlerSheet(true)}
            >
              <RefreshCw className="w-3 h-3" />
              <span>Change Bowler</span>
            </Button>
          </div>
        </div>

        {/* ─── This Over Ball Strip ─── */}
        <div className="flex items-center justify-between gap-2 pt-1 border-t border-white/5">
          <span className="text-[10px] sm:text-[11px] font-bold text-white/50 uppercase tracking-wider shrink-0">
            This Over:
          </span>
          <div className="flex flex-wrap items-center gap-1.5 flex-1 justify-end">
            {(state?.thisOver?.length ?? 0) > 0 ? (
              (state?.thisOver ?? []).map((b, i) => {
                const isW = b.isWicket;
                const isFour = b.runsOffBat === 4 || b.runsOffBat === 8;
                const isSix = b.runsOffBat === 6 || b.runsOffBat === 12;
                const isExt = !!b.extrasType;
                return (
                  <span
                    key={`${b.over}-${b.ball}-${i}`}
                    className={cn(
                      "inline-flex h-7 min-w-7 px-1.5 items-center justify-center rounded-lg text-xs font-black tabular-nums shadow-sm border transition-transform",
                      isW
                        ? "bg-rose-600/40 border-rose-400 text-white shadow-rose-600/30"
                        : isSix
                          ? "bg-gradient-to-br from-purple-500/40 to-pink-500/40 border-purple-400 text-purple-100 shadow-purple-500/30"
                          : isFour
                            ? "bg-emerald-500/30 border-emerald-400 text-emerald-200 shadow-emerald-500/20"
                            : isExt
                              ? "bg-amber-500/30 border-amber-400 text-amber-200"
                              : "bg-white/[0.06] border-white/10 text-slate-200",
                    )}
                  >
                    {b.label}
                  </span>
                );
              })
            ) : (
              <span className="text-xs text-white/40 italic font-medium">
                Over started
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ─── Pending Batter Selection Gate ─── */}
      {pendingNewBatsman ? (
        <div className="p-3 sm:p-3.5 rounded-2xl border border-amber-400/50 bg-gradient-to-b from-amber-950/40 via-[#0e162d]/95 to-[#070b18]/95 space-y-2.5 shadow-xl shadow-black/40 backdrop-blur-md flex-1 min-h-0 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-amber-300 font-black text-xs sm:text-sm tracking-wide">
              <span className="p-1 rounded-lg bg-amber-400/20 border border-amber-400/30 flex items-center justify-center">
                <UserCheck className="w-3.5 h-3.5 text-amber-300" />
              </span>
              <span>Select Next Batter to Crease:</span>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-400/15 border border-amber-400/30 text-amber-300">
                {availableBatsmen.length} Available
              </span>
            </div>
            {availableBatsmen.length === 0 ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-7 text-xs font-bold"
                onClick={async () => {
                  const suggest = suggestInningsEndReason(state);
                  await onInningsEnd({
                    innings: state.currentInnings,
                    reason: suggest,
                    runs: innings.runs,
                    wickets: innings.wickets,
                    overs: oversText(innings.over, innings.ball),
                  });
                }}
              >
                End Innings
              </Button>
            ) : null}
          </div>
          {availableBatsmen.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 overflow-y-auto flex-1 min-h-0 pr-0.5 content-start">
              {availableBatsmen.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onNewBatsman(p.id)}
                  className="group flex items-center gap-2 p-2 sm:p-2.5 rounded-xl bg-white/[0.05] hover:bg-amber-500/20 border border-white/10 hover:border-amber-400/50 text-left transition-all duration-150 active:scale-[0.97] cursor-pointer shadow-xs"
                >
                  <span className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-amber-400/20 border border-amber-400/30 text-amber-300 font-black text-xs flex items-center justify-center shrink-0 uppercase group-hover:bg-amber-400 group-hover:text-slate-950 transition-colors">
                    {p.name.slice(0, 2)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-white text-xs sm:text-sm leading-tight truncate group-hover:text-amber-200">
                      {p.name}
                    </p>
                    <span className="text-[10px] text-white/50 truncate block mt-0.5 font-medium">
                      {p.role ? p.role.replace(/_/g, " ") : "Batter"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-xs text-amber-300/90 py-1 font-medium">
              No more batters available (all squad members are at crease or dismissed). You can end this innings now.
            </div>
          )}
        </div>
      ) : null}

      {/* ─── Match / Innings Complete State vs Main Keypad ─── */}
      {isMatchCompleteState ? (
        <div className="relative rounded-2xl sm:rounded-3xl border border-emerald-500/30 bg-gradient-to-b from-[#0b211a] via-[#071611] to-[#040b09] p-4 sm:p-6 flex-1 min-h-0 flex flex-col items-center justify-between text-center shadow-2xl shadow-emerald-950/50 overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-emerald-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Trophy & Status */}
          <div className="space-y-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-emerald-300 bg-emerald-500/15 px-3.5 py-1 rounded-full border border-emerald-500/30 shadow-inner">
              <Trophy className="w-3.5 h-3.5 text-amber-400" />
              {isTargetReached ? "TARGET REACHED · MATCH WON" : "CHASE COMPLETE · MATCH FINISHED"}
            </span>

            <div className="w-14 h-14 sm:w-18 sm:h-18 mx-auto rounded-2xl bg-gradient-to-br from-amber-400/20 via-emerald-500/20 to-emerald-600/30 border border-amber-400/40 flex items-center justify-center shadow-xl shadow-amber-500/10 mt-1">
              <Trophy className="w-7 h-7 sm:w-9 sm:h-9 text-amber-300 drop-shadow-md" />
            </div>

            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-3xl font-black text-white tracking-wide leading-tight">
                {(() => {
                  const winnerTeam = teams.find((t) => t.id === matchResultPreview?.winnerTeamId);
                  if (matchResultPreview?.isTie) return "Match Tied!";
                  if (winnerTeam) return winnerTeam.name;
                  return "Match Complete";
                })()}
              </h3>
              <p className="text-base sm:text-xl font-extrabold text-emerald-400">
                {matchResultPreview?.isTie ? "Scores are Level" : (matchResultPreview?.resultText ?? "Won")}
              </p>
            </div>
          </div>

          {/* Scorecard Stats Grid */}
          <div className="grid grid-cols-3 gap-2 w-full max-w-xs sm:max-w-sm py-2 relative z-10">
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 text-center">
              <span className="text-[9px] uppercase font-bold text-white/50 block">Score</span>
              <span className="text-sm sm:text-base font-black text-white font-mono tabular-nums">
                {innings?.runs}/{innings?.wickets}
              </span>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 text-center">
              <span className="text-[9px] uppercase font-bold text-white/50 block">Overs</span>
              <span className="text-sm sm:text-base font-black text-white font-mono tabular-nums">
                {oversText(innings?.over ?? 0, innings?.ball ?? 0)}
              </span>
            </div>
            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-2 text-center">
              <span className="text-[9px] uppercase font-bold text-white/50 block">Target</span>
              <span className="text-sm sm:text-base font-black text-amber-300 font-mono tabular-nums">
                {state.target ?? "—"}
              </span>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 w-full max-w-sm relative z-10">
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-black bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 shadow-lg shadow-emerald-500/30 rounded-xl active:scale-[0.98] transition-all"
              disabled={busy}
              onClick={async () => {
                const result = buildMatchResult(state);
                await onMatchComplete({
                  winnerTeamId: result.winnerTeamId,
                  margin: result.margin,
                  resultText: result.resultText,
                  isTie: result.isTie,
                });
              }}
            >
              <Trophy className="w-4 h-4 mr-2 text-slate-950 fill-current" />
              Complete Match Now
            </Button>
            <Button
              variant="outline"
              className="w-full h-9 sm:h-10 text-xs font-bold border-white/15 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl active:scale-[0.98]"
              disabled={busy}
              onClick={onUndo}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Undo Last Ball
            </Button>
          </div>
        </div>
      ) : isInnings1Finished ? (
        <div className="relative rounded-2xl sm:rounded-3xl border border-sky-500/30 bg-gradient-to-b from-[#0f2038] via-[#091526] to-[#040a14] p-4 sm:p-6 flex-1 min-h-0 flex flex-col items-center justify-between text-center shadow-2xl shadow-sky-950/50 overflow-hidden">
          {/* Ambient Glow */}
          <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 sm:w-64 sm:h-64 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Flag & Status */}
          <div className="space-y-2 relative z-10">
            <span className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs font-black uppercase tracking-[0.2em] text-sky-300 bg-sky-500/15 px-3.5 py-1 rounded-full border border-sky-500/30 shadow-inner">
              <Flag className="w-3.5 h-3.5 text-sky-400" />
              INNINGS 1 COMPLETE
            </span>

            <div className="w-14 h-14 sm:w-18 sm:h-18 mx-auto rounded-2xl bg-gradient-to-br from-sky-400/20 via-indigo-500/20 to-sky-600/30 border border-sky-400/40 flex items-center justify-center shadow-xl shadow-sky-500/10 mt-1">
              <Flag className="w-7 h-7 sm:w-9 sm:h-9 text-sky-300" />
            </div>

            <div className="space-y-0.5">
              <h3 className="text-xl sm:text-3xl font-black text-white tracking-wide leading-tight">
                {battingTeam?.name ?? "1st Innings"}
              </h3>
              <p className="text-base sm:text-xl font-extrabold text-sky-400 font-mono">
                {innings?.runs}/{innings?.wickets} in {oversText(innings?.over ?? 0, innings?.ball ?? 0)} ov
              </p>
            </div>
          </div>

          {/* Chase Target Pill */}
          <div className="w-full max-w-xs sm:max-w-sm py-2 px-4 rounded-xl bg-sky-500/10 border border-sky-500/30 text-center relative z-10">
            <span className="text-[10px] uppercase font-bold text-sky-300/80 block">Target for 2nd Innings</span>
            <span className="text-lg sm:text-xl font-black text-white font-mono">
              {innings?.runs ? innings.runs + 1 : 1} runs <span className="text-xs text-sky-200 font-semibold">in {state.oversLimit} overs</span>
            </span>
          </div>

          {/* Action CTAs */}
          <div className="flex flex-col gap-2 w-full max-w-sm relative z-10">
            <Button
              className="w-full h-11 sm:h-12 text-sm sm:text-base font-black bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-400 hover:to-indigo-400 text-white shadow-lg shadow-sky-500/30 rounded-xl active:scale-[0.98] transition-all"
              disabled={busy}
              onClick={async () => {
                const reason = suggestInningsEndReason(state);
                await onInningsEnd({
                  innings: 1,
                  reason,
                  runs: innings?.runs ?? 0,
                  wickets: innings?.wickets ?? 0,
                  overs: oversText(innings?.over ?? 0, innings?.ball ?? 0),
                });
              }}
            >
              Start 2nd Innings Chase
            </Button>
            <Button
              variant="outline"
              className="w-full h-9 sm:h-10 text-xs font-bold border-white/15 bg-white/[0.04] text-white/70 hover:text-white hover:bg-white/[0.08] rounded-xl active:scale-[0.98]"
              disabled={busy}
              onClick={onUndo}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Undo Last Ball
            </Button>
          </div>
        </div>
      ) : pendingNewBatsman ? (
        <Button
          variant="outline"
          className="w-full h-10 text-xs font-bold border-white/15 bg-white/[0.04] text-white/80 hover:text-white hover:bg-white/[0.08] rounded-xl shrink-0"
          disabled={busy}
          onClick={() => {
            if (canTap()) void onUndo();
          }}
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
          Undo Last Ball
        </Button>
      ) : (
        /* ─── Main Scorer Keypad Grid ─── */
        <div className="p-1.5 sm:p-2.5 rounded-xl sm:rounded-2xl border border-white/10 bg-gradient-to-b from-[#0c1328]/95 to-[#070b19]/98 flex-1 min-h-0 flex flex-col justify-between gap-1 sm:gap-1.5 shadow-2xl shadow-black/50 backdrop-blur-md">
          {/* Row 1: Primary Runs 0, 1, 2, 3 */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 flex-1 min-h-0">
            <ScoreButton
              label="0"
              sublabel="dot"
              variant="run"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 0,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
            <ScoreButton
              label="1"
              sublabel="single"
              variant="run"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 1,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
            <ScoreButton
              label="2"
              sublabel="double"
              variant="run"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 2,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
            <ScoreButton
              label="3"
              sublabel="three"
              variant="run"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 3,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
          </div>

          {/* Row 2: Boundaries 4, 6, Custom, Super Ball / Byes */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 flex-1 min-h-0">
            <ScoreButton
              label="4"
              sublabel="four"
              variant="boundary"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 4,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
            <ScoreButton
              label="6"
              sublabel="six"
              variant="boundarySix"
              disabled={busy || pendingNewBatsman}
              onClick={() =>
                recordBall({
                  runsOffBat: 6,
                  extras: { type: null, runs: 0 },
                  wicket: null,
                  isLegalDelivery: true,
                })
              }
            />
            <ScoreButton
              label={<span className="text-xl sm:text-2xl font-black text-sky-300">+</span>}
              sublabel="custom"
              variant="default"
              disabled={busy || pendingNewBatsman}
              onClick={() => setCustomRunsSheet(true)}
            />
            {superBallEnabled ? (
              <ScoreButton
                label="⭐"
                sublabel={
                  isSuperBallActive
                    ? "Active 2x"
                    : superBallReason
                      ? (superBallReason.includes("Powerplay") ? "In P-Play" : "Locked")
                      : "Super Ball"
                }
                variant="super_ball"
                disabled={busy || pendingNewBatsman}
                onClick={() => void handleToggleSuperBall()}
                className={cn(
                  isSuperBallActive && "ring-2 ring-amber-400 bg-amber-500/30",
                  !canUseSuperBall && !isSuperBallActive && "opacity-60",
                )}
              />
            ) : (
              <ScoreButton
                label="B"
                sublabel="byes"
                variant="extra"
                disabled={busy || pendingNewBatsman}
                onClick={() => setByeSheet(true)}
              />
            )}
          </div>

          {/* Row 3: Extras (Wide, No Ball, Byes, Leg Byes / Swap Strike) */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 flex-1 min-h-0">
            <ScoreButton
              label="Wd"
              sublabel="wide"
              variant="extra"
              disabled={busy || pendingNewBatsman}
              onClick={() => setWideSheet(true)}
            />
            <ScoreButton
              label="Nb"
              sublabel={freeHitEnabled ? "no ball + FH" : "no ball"}
              variant="extra"
              disabled={busy || pendingNewBatsman}
              onClick={() => setNoBallSheet(true)}
            />
            {superBallEnabled ? (
              <ScoreButton
                label="Bye"
                sublabel="byes"
                variant="extra"
                disabled={busy || pendingNewBatsman}
                onClick={() => setByeSheet(true)}
              />
            ) : (
              <ScoreButton
                label="LB"
                sublabel={legByeEnabled ? "leg bye" : "disabled"}
                variant="extra"
                disabled={busy || pendingNewBatsman || !legByeEnabled}
                onClick={() => {
                  if (legByeEnabled) setLegByeSheet(true);
                }}
              />
            )}
            {superBallEnabled && legByeEnabled ? (
              <ScoreButton
                label="LB"
                sublabel="leg bye"
                variant="extra"
                disabled={busy || pendingNewBatsman}
                onClick={() => setLegByeSheet(true)}
              />
            ) : (
              <ScoreButton
                label={<ArrowLeftRight className="w-5 h-5 text-sky-300 mx-auto" />}
                sublabel="swap strike"
                variant="default"
                disabled={busy || pendingNewBatsman || !onSwapStrike}
                onClick={() => {
                  if (onSwapStrike) onSwapStrike();
                }}
              />
            )}
          </div>

          {/* Row 4: Wicket & Undo Action Buttons */}
          <div className="grid grid-cols-2 gap-1 sm:gap-1.5 flex-1 min-h-0">
            <ScoreButton
              label={
                <span className="flex items-center justify-center gap-1.5 text-base sm:text-lg tracking-wider font-black">
                  <span>⚡</span> OUT / WICKET
                </span>
              }
              sublabel="how out?"
              variant="wicket"
              disabled={busy || pendingNewBatsman}
              onClick={() => {
                if (isPaused) {
                  toast({
                    title: "Match is Paused",
                    description: "Click 'Resume Play' in the top banner before recording wickets.",
                  });
                  return;
                }
                setSelectedWicketType(null);
                setSelectedFielderId(null);
                setWicketSheet(true);
              }}
            />
            <ScoreButton
              label={
                <span className="flex items-center justify-center gap-1.5 text-sm sm:text-base font-black tracking-wider text-slate-100">
                  <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-sky-400 shrink-0" />
                  <span>UNDO</span>
                </span>
              }
              sublabel="last ball"
              variant="undo"
              disabled={busy}
              onClick={() => {
                if (canTap()) void onUndo();
              }}
            />
          </div>
        </div>
      )}

      {/* ─── Bottom Actions Bar (only when match is active) ─── */}
      {!isMatchCompleteState && !isInnings1Finished ? (
        <div className="flex gap-1.5 shrink-0">
          <Button
            variant="outline"
            className="w-full h-9 sm:h-10 text-xs font-bold rounded-xl border-white/15 bg-gradient-to-r from-[#141e38] to-[#0f172b] hover:from-[#1c2a4f] hover:to-[#16213d] text-slate-200 hover:text-white shadow-sm gap-2"
            disabled={busy}
            onClick={() => setSecondaryOpen(true)}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
            <span>More Actions & Settings</span>
          </Button>
        </div>
      ) : null}

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Wide Runs Selector Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={wideSheet} onOpenChange={setWideSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-amber-400 flex items-center gap-2">
              <span>Wide Ball Options</span>
            </SheetTitle>
            <SheetDescription>
              Select total runs scored on this Wide delivery:
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mt-4 pb-6">
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold text-base border-amber-500/30 hover:border-amber-500/60"
              onClick={() => {
                setWideSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "wide", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>1 Wd</span>
              <span className="text-[10px] font-normal text-muted-foreground">Standard 1 Extra</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold text-base border-amber-500/30 hover:border-amber-500/60"
              onClick={() => {
                setWideSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "wide", runs: 2 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Wd + 1 run</span>
              <span className="text-[10px] font-normal text-muted-foreground">2 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold text-base border-amber-500/30 hover:border-amber-500/60"
              onClick={() => {
                setWideSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "wide", runs: 3 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Wd + 2 runs</span>
              <span className="text-[10px] font-normal text-muted-foreground">3 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold text-base border-amber-500/30 hover:border-amber-500/60"
              onClick={() => {
                setWideSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "wide", runs: 4 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Wd + 3 runs</span>
              <span className="text-[10px] font-normal text-muted-foreground">4 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold text-base border-emerald-500/40 text-emerald-400 hover:border-emerald-500 col-span-2 sm:col-span-2"
              onClick={() => {
                setWideSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "wide", runs: 5 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Wd + 4 BOUNDARY</span>
              <span className="text-[10px] font-normal text-muted-foreground">5 runs total (Wide boundary)</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── No Ball Runs Selector Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={noBallSheet} onOpenChange={setNoBallSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle className="text-amber-400 flex items-center gap-2">
              <span>No Ball Delivery</span>
            </SheetTitle>
            <SheetDescription>
              Select runs scored off bat / byes on this No Ball (Triggers Free Hit):
            </SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4 pb-6">
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-amber-500/30"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "no_ball", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 0</span>
              <span className="text-[10px] font-normal text-muted-foreground">1 run total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-amber-500/30"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 1,
                  extras: { type: "no_ball", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 1 run</span>
              <span className="text-[10px] font-normal text-muted-foreground">2 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-amber-500/30"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 2,
                  extras: { type: "no_ball", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 2 runs</span>
              <span className="text-[10px] font-normal text-muted-foreground">3 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-emerald-500/40 text-emerald-400"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 4,
                  extras: { type: "no_ball", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 4 (FOUR)</span>
              <span className="text-[10px] font-normal text-muted-foreground">5 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-purple-500/40 text-purple-300"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 6,
                  extras: { type: "no_ball", runs: 1 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 6 (SIX)</span>
              <span className="text-[10px] font-normal text-muted-foreground">7 runs total</span>
            </Button>
            <Button
              variant="outline"
              className="h-14 flex flex-col items-center justify-center font-bold border-amber-500/30"
              onClick={() => {
                setNoBallSheet(false);
                void recordBall({
                  runsOffBat: 0,
                  extras: { type: "no_ball", runs: 2 },
                  wicket: null,
                  isLegalDelivery: false,
                });
              }}
            >
              <span>Nb + 1 Bye</span>
              <span className="text-[10px] font-normal text-muted-foreground">2 runs total</span>
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Byes Selector Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={byeSheet} onOpenChange={setByeSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>Byes (Extras)</SheetTitle>
            <SheetDescription>Select runs taken as byes:</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-2 mt-4 pb-6">
            {[1, 2, 3, 4].map((r) => (
              <Button
                key={r}
                variant="outline"
                className="h-12 font-bold text-base"
                onClick={() => {
                  setByeSheet(false);
                  void recordBall({
                    runsOffBat: 0,
                    extras: { type: "bye", runs: r },
                    wicket: null,
                    isLegalDelivery: true,
                  });
                }}
              >
                {r} {r === 1 ? "Bye" : "Byes"}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Leg Byes Selector Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={legByeSheet} onOpenChange={setLegByeSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>Leg Byes (Extras)</SheetTitle>
            <SheetDescription>Select runs taken as leg byes:</SheetDescription>
          </SheetHeader>
          <div className="grid grid-cols-4 gap-2 mt-4 pb-6">
            {[1, 2, 3, 4].map((r) => (
              <Button
                key={r}
                variant="outline"
                className="h-12 font-bold text-base"
                onClick={() => {
                  setLegByeSheet(false);
                  void recordBall({
                    runsOffBat: 0,
                    extras: { type: "leg_bye", runs: r },
                    wicket: null,
                    isLegalDelivery: true,
                  });
                }}
              >
                {r} {r === 1 ? "Leg Bye" : "Leg Byes"}
              </Button>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Custom Runs Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={customRunsSheet} onOpenChange={setCustomRunsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>Custom Runs / Overthrow</SheetTitle>
            <SheetDescription>Enter custom runs off bat scored on this delivery:</SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            <div className="grid grid-cols-4 gap-2">
              {[5, 7, 8, 10].map((num) => (
                <Button
                  key={num}
                  variant="outline"
                  className="h-12 font-bold text-base"
                  onClick={() => {
                    setCustomRunsSheet(false);
                    void recordBall({
                      runsOffBat: num,
                      extras: { type: null, runs: 0 },
                      wicket: null,
                      isLegalDelivery: true,
                    });
                  }}
                >
                  {num} runs
                </Button>
              ))}
            </div>
            <div className="flex gap-2 items-center">
              <Input
                type="number"
                min={0}
                max={20}
                value={customRunsValue}
                onChange={(e) => setCustomRunsValue(e.target.value)}
                className="h-12 text-lg font-bold"
              />
              <Button
                className="h-12 px-6 font-bold"
                onClick={() => {
                  const val = parseInt(customRunsValue, 10) || 0;
                  setCustomRunsSheet(false);
                  void recordBall({
                    runsOffBat: val,
                    extras: { type: null, runs: 0 },
                    wicket: null,
                    isLegalDelivery: true,
                  });
                }}
              >
                Submit
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Enhanced Wicket Modal ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet
        open={wicketSheet}
        onOpenChange={(open) => {
          setWicketSheet(open);
          if (!open) {
            setSelectedWicketType(null);
            setSelectedFielderId(null);
            setRunOutRunsCompleted(0);
          }
        }}
      >
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto max-h-[85dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-red-400">
              {!selectedWicketType
                ? "Wicket — How Out?"
                : selectedWicketType === "run_out"
                  ? "Run Out Details"
                  : selectedWicketType === "caught"
                    ? "Catch Details — Select Fielder"
                    : selectedWicketType === "stumped"
                      ? "Stumping Details — Select Keeper"
                      : "Confirm Dismissal"}
            </SheetTitle>
            <SheetDescription>
              {state.freeHitActive ? (
                <span className="text-amber-400 font-semibold">
                  ⚠️ Free Hit Active: Only Run Out, Obstructing Field, or Hit Ball Twice is legal.
                </span>
              ) : isSuperBallActive ? (
                <span className="text-amber-400 font-semibold">
                  ⚠️ Super Ball Active: Bowled and Caught are NOT out on Super Ball. Only Run Out is valid.
                </span>
              ) : (
                "Select dismissal type and involved fielders."
              )}
            </SheetDescription>
          </SheetHeader>

          {/* Step 1: Pick Dismissal Type */}
          {!selectedWicketType ? (
            <div className="grid grid-cols-2 gap-2 mt-4 pb-6">
              {dismissalOptions.map((type) => {
                const isIllegalOnFreeHit =
                  state.freeHitActive && !FREE_HIT_DISMISSALS.includes(type);
                const isIllegalOnSuperBall =
                  isSuperBallActive && (type === "caught" || type === "bowled");
                const isDisabled = isIllegalOnFreeHit || isIllegalOnSuperBall;

                return (
                  <Button
                    key={type}
                    variant="outline"
                    className={cn(
                      "h-12 capitalize font-semibold border-border/70 hover:border-red-500/50",
                      isDisabled && "opacity-35 pointer-events-none line-through",
                    )}
                    onClick={() => {
                      if (type === "caught" || type === "run_out" || type === "stumped") {
                        setSelectedWicketType(type);
                      } else {
                        setSelectedWicketType(type);
                        // Instant dismiss for bowled/lbw/hit_wicket
                        setWicketSheet(false);
                        if (strikerId) {
                          setLocalDismissedBatters((prev) => [...prev, strikerId]);
                        }
                        void recordBall({
                          runsOffBat: 0,
                          extras: { type: null, runs: 0 },
                          wicket: {
                            type,
                            dismissedPlayerId: strikerId!,
                          },
                          isLegalDelivery: true,
                        });
                      }
                    }}
                  >
                    {type.replace(/_/g, " ")}
                  </Button>
                );
              })}
            </div>
          ) : selectedWicketType === "run_out" ? (
            /* Run Out Specific Flow */
            <div className="space-y-4 mt-4 pb-6">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Who is out?</label>
                <div className="grid grid-cols-2 gap-2 mt-1.5">
                  <Button
                    variant={runOutWho === "striker" ? "default" : "outline"}
                    className="h-12 font-semibold truncate"
                    onClick={() => setRunOutWho("striker")}
                  >
                    Striker ({playerNameById(players, strikerId)})
                  </Button>
                  <Button
                    variant={runOutWho === "non_striker" ? "default" : "outline"}
                    className="h-12 font-semibold truncate"
                    disabled={!nonStrikerId}
                    onClick={() => setRunOutWho("non_striker")}
                  >
                    Non-Striker ({playerNameById(players, nonStrikerId)})
                  </Button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Runs completed before run out?</label>
                <div className="grid grid-cols-3 gap-2 mt-1.5">
                  {[0, 1, 2].map((r) => (
                    <Button
                      key={r}
                      variant={runOutRunsCompleted === r ? "default" : "outline"}
                      className="h-11 font-bold"
                      onClick={() => setRunOutRunsCompleted(r)}
                    >
                      {r} {r === 1 ? "run" : "runs"}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">Fielder (Optional)</label>
                <div className="grid grid-cols-2 gap-1.5 mt-1.5 max-h-36 overflow-y-auto">
                  <Button
                    variant={selectedFielderId === null ? "secondary" : "outline"}
                    className="h-9 text-xs justify-start"
                    onClick={() => setSelectedFielderId(null)}
                  >
                    Direct Hit / None
                  </Button>
                  {bowlingSquad.map((f) => (
                    <Button
                      key={f.id}
                      variant={selectedFielderId === f.id ? "default" : "outline"}
                      className="h-9 text-xs justify-start truncate"
                      onClick={() => setSelectedFielderId(f.id)}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              </div>

              <Button
                className="w-full h-12 font-bold bg-red-600 hover:bg-red-700 text-white"
                onClick={() => void submitWicket()}
              >
                Confirm Run Out
              </Button>
            </div>
          ) : (
            /* Caught or Stumped Fielder Picker */
            <div className="space-y-4 mt-4 pb-6">
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase">
                  Select Fielder / Catcher
                </label>
                <div className="grid grid-cols-2 gap-2 mt-2 max-h-48 overflow-y-auto">
                  {bowlingSquad.map((f) => (
                    <Button
                      key={f.id}
                      variant={selectedFielderId === f.id ? "default" : "outline"}
                      className="h-10 text-xs justify-start truncate font-semibold"
                      onClick={() => setSelectedFielderId(f.id)}
                    >
                      {f.name}
                      {f.id === activeBowlerId ? " (c&b)" : ""}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setSelectedWicketType(null)}
                >
                  Back
                </Button>
                <Button
                  className="flex-1 h-12 font-bold bg-red-600 hover:bg-red-700 text-white"
                  onClick={() => void submitWicket()}
                >
                  Confirm Out
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Bowler Selection Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={bowlerSheet} onOpenChange={setBowlerSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto max-h-[75dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Select Bowler</SheetTitle>
            <SheetDescription>Pick the bowler for this over:</SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 mt-4 pb-6">
            {bowlingSquad.map((p) => {
              const isCurrent = activeBowlerId === p.id;
              return (
                <Button
                  key={p.id}
                  variant={isCurrent ? "default" : "outline"}
                  className="h-12 justify-between px-4 font-semibold"
                  onClick={() => {
                    onBowlerChange(p.id);
                    setBowlerSheet(false);
                  }}
                >
                  <span>{p.name}</span>
                  {isCurrent ? <Check className="w-4 h-4 text-primary-foreground" /> : null}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Over Complete Next Bowler Prompt Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={overEndPrompt} onOpenChange={setOverEndPrompt}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto max-h-[75dvh] overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-primary flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>Over Complete! Select Next Bowler</span>
            </SheetTitle>
            <SheetDescription>
              Strike has rotated. Choose bowler for the next over:
            </SheetDescription>
          </SheetHeader>
          <div className="grid gap-2 mt-4 pb-6">
            {bowlingSquad.map((p) => {
              const justBowled = activeBowlerId === p.id && bowlingSquad.length > 1;
              return (
                <Button
                  key={p.id}
                  variant="outline"
                  disabled={justBowled}
                  className={cn(
                    "h-12 justify-between px-4 font-semibold border-border/70",
                    justBowled && "opacity-40 line-through",
                  )}
                  onClick={() => {
                    onBowlerChange(p.id);
                    setOverEndPrompt(false);
                  }}
                >
                  <span>{p.name}</span>
                  {justBowled ? (
                    <span className="text-[10px] text-muted-foreground uppercase font-normal">
                      Just bowled
                    </span>
                  ) : null}
                </Button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Secondary / Match Actions Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={secondaryOpen} onOpenChange={setSecondaryOpen}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>Match Actions & Admin</SheetTitle>
          </SheetHeader>
          <div className="grid gap-2 mt-4 pb-6">
            {!isPaused ? (
              <Button
                variant="outline"
                className="h-12 border-sky-500/40 text-sky-300 font-semibold"
                disabled={busy}
                onClick={async () => {
                  setSecondaryOpen(false);
                  await onEvent(CricketEventType.MATCH_INTERRUPTED, {
                    reason: "Rain",
                  });
                }}
              >
                <CloudRain className="w-4 h-4 mr-2" />
                Rain delay / Interruption
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-12 font-semibold"
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
              className="h-12 font-semibold"
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
              className="h-12 font-semibold"
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
              className="h-12 font-semibold"
              disabled={busy || !strikerId}
              onClick={() => {
                setSecondaryOpen(false);
                setRetireSheet(true);
              }}
            >
              Retired batter (Hurt / Out)
            </Button>
            {superOverEnabled ? (
              <Button
                variant="outline"
                className="h-12 font-semibold"
                disabled={busy}
                onClick={async () => {
                  if (!battingId || !bowlingId) return;
                  setSecondaryOpen(false);
                  await onEvent(CricketEventType.SUPER_OVER_STARTED, {
                    innings: Math.max(state.innings.length + 1, 3),
                    battingTeamId: battingId,
                    bowlingTeamId: bowlingId,
                    oversLimit: rules?.superOverOvers ?? 1,
                  });
                }}
              >
                Start Super Over
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="h-12 font-bold border-amber-500/40 text-amber-300"
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
              End Current Innings
            </Button>
            <Button
              variant="destructive"
              className="h-12 font-bold"
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
              Complete Match
            </Button>
            {onResetMatch &&
            (state.innings ?? []).reduce(
              (acc, inn) => acc + (inn.over ?? 0) * 6 + (inn.ball ?? 0),
              0,
            ) === 0 &&
            (state.innings ?? []).reduce(
              (acc, inn) => acc + (inn.runs ?? 0),
              0,
            ) === 0 ? (
              <Button
                variant="outline"
                className="h-12 font-bold border-red-500/40 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                disabled={busy}
                onClick={async () => {
                  setSecondaryOpen(false);
                  await onResetMatch();
                }}
              >
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset Toss & Match to Scheduled
              </Button>
            ) : null}
            <Button
              variant="outline"
              className="h-12 font-bold border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              disabled={busy || awardingWalkover}
              onClick={() => {
                setSecondaryOpen(false);
                setWalkoverWinnerTeamId(state.homeTeamId);
                setWalkoverReason("");
                setWalkoverConfirmOpen(true);
              }}
            >
              <Trophy className="w-4 h-4 mr-2" />
              Award Walkover
            </Button>
            <Button
              variant="ghost"
              className="h-11 text-muted-foreground hover:text-red-400"
              disabled={busy}
              onClick={() => {
                setSecondaryOpen(false);
                setAbandonConfirmOpen(true);
              }}
            >
              Abandon Match
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ─── Abandon Match Confirmation Modal ─── */}
      <AlertDialog open={abandonConfirmOpen} onOpenChange={setAbandonConfirmOpen}>
        <AlertDialogContent className="bg-[#0b1026] border border-red-500/40 text-white max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-red-400 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400" />
              Abandon Match?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-white/70 text-xs sm:text-sm">
              Are you sure you want to abandon this match? This will immediately end the match with <strong>No Result</strong>. Use this only if the match cannot be played due to rain or unavoidable ground conditions.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="border-white/20 text-white hover:bg-white/10">
              Cancel (Keep Playing)
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-500 text-white font-bold"
              onClick={async () => {
                setAbandonConfirmOpen(false);
                await onEvent(CricketEventType.MATCH_ABANDONED, {
                  reason: "Match abandoned — no result",
                });
              }}
            >
              Yes, Abandon Match
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Walkover Confirmation Dialog ─── */}
      <Dialog open={walkoverConfirmOpen} onOpenChange={setWalkoverConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-400">
              <Trophy className="w-5 h-5 text-amber-400" />
              Award Cricket Walkover
            </DialogTitle>
            <DialogDescription className="space-y-2 pt-2 text-left">
              <p>
                Awarding a walkover immediately concludes the match and declares the chosen team as the winner.
              </p>
              <p className="text-xs text-muted-foreground">
                The winning team receives 2 tournament standings points, the losing team receives 0 points, and no individual statistics or NRR adjustments are added.
              </p>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Select Winning Team
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div
                  onClick={() => setWalkoverWinnerTeamId(state.homeTeamId)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 select-none",
                    walkoverWinnerTeamId === state.homeTeamId
                      ? "border-amber-400/80 bg-amber-500/15 shadow-md ring-2 ring-amber-400/50"
                      : "border-border/70 bg-card/40 hover:bg-card/80",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted/60 text-muted-foreground">
                      Home
                    </span>
                    {walkoverWinnerTeamId === state.homeTeamId ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    ) : null}
                  </div>
                  <p className="font-bold text-xs text-foreground truncate mt-1">
                    {(teams ?? []).find((t) => t.id === state.homeTeamId)?.name ?? `Team ${state.homeTeamId}`}
                  </p>
                </div>

                <div
                  onClick={() => setWalkoverWinnerTeamId(state.awayTeamId)}
                  className={cn(
                    "p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-1 select-none",
                    walkoverWinnerTeamId === state.awayTeamId
                      ? "border-amber-400/80 bg-amber-500/15 shadow-md ring-2 ring-amber-400/50"
                      : "border-border/70 bg-card/40 hover:bg-card/80",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground">
                      Away
                    </span>
                    {walkoverWinnerTeamId === state.awayTeamId ? (
                      <CheckCircle2 className="w-4 h-4 text-amber-400" />
                    ) : null}
                  </div>
                  <p className="font-bold text-xs text-foreground truncate mt-1">
                    {(teams ?? []).find((t) => t.id === state.awayTeamId)?.name ?? `Team ${state.awayTeamId}`}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground">
                Reason / Note (Optional)
              </Label>
              <Input
                placeholder="e.g. Team conceded / Forfeited"
                value={walkoverReason}
                onChange={(e) => setWalkoverReason(e.target.value)}
                className="h-9 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="flex flex-row justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={awardingWalkover}
              onClick={() => setWalkoverConfirmOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold"
              disabled={awardingWalkover || !walkoverWinnerTeamId}
              onClick={async () => {
                setAwardingWalkover(true);
                try {
                  await onEvent(CricketEventType.WALKOVER_AWARDED, {
                    winnerTeamId: walkoverWinnerTeamId,
                    reason: walkoverReason.trim() || undefined,
                  });
                  setWalkoverConfirmOpen(false);
                } finally {
                  setAwardingWalkover(false);
                }
              }}
            >
              {awardingWalkover ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
                  Awarding…
                </>
              ) : (
                "Confirm Walkover"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── DLS Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={dlsSheet} onOpenChange={setDlsSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto bg-card border-t-2 border-sky-500/40">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2 text-sky-400">
              <CloudRain className="w-5 h-5" />
              DLS Method — Rain Target Revision
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-4 pb-6">
            {/* Match Situation Context */}
            {state.innings.length > 0 && (() => {
              const firstInn = state.innings.find((i) => i.innings === 1);
              const secondInn = state.innings.find((i) => i.innings === 2);
              return (
                <div className="rounded-xl bg-muted/40 p-3 text-xs space-y-1.5 border border-border/60">
                  {firstInn && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">1st Innings Score:</span>
                      <span className="font-bold text-foreground">
                        {firstInn.runs}/{firstInn.wickets} ({oversText(firstInn.over, firstInn.ball)} ov)
                      </span>
                    </div>
                  )}
                  {secondInn && (
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground font-medium">2nd Innings Current:</span>
                      <span className="font-bold text-foreground">
                        {secondInn.runs}/{secondInn.wickets} ({oversText(secondInn.over, secondInn.ball)} ov)
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground font-medium">Original Match Overs:</span>
                    <span className="font-semibold text-foreground">{state.oversLimit} overs</span>
                  </div>
                </div>
              );
            })()}

            <div>
              <label className="text-xs text-muted-foreground font-semibold">
                Revised Match Overs per Innings
              </label>
              <Input
                type="number"
                min={1}
                max={state.oversLimit || 50}
                value={revisedOvers}
                onChange={(e) => setRevisedOvers(e.target.value)}
                className="mt-1 h-12 text-xl font-black tracking-wider text-sky-400 border-sky-500/40"
              />
            </div>

            {/* DLS Preview Card */}
            {dlsPreview ? (
              <div className="rounded-xl border-2 border-sky-400/40 bg-sky-500/10 p-4 space-y-2">
                <div className="flex items-baseline justify-between">
                  <span className="text-xs uppercase font-black tracking-wider text-sky-300">
                    Revised Target
                  </span>
                  <span className="text-3xl font-black text-white font-mono">
                    {dlsPreview.target}{" "}
                    <span className="text-sm font-semibold text-sky-200">
                      runs in {revisedOvers} ov
                    </span>
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-sky-500/20 text-[11px] text-muted-foreground">
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-sky-300">Par Score</span>
                    <strong className="text-foreground text-sm font-mono">{dlsPreview.parScore}</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-sky-300">R1 Used</span>
                    <strong className="text-foreground text-sm font-mono">{dlsPreview.resourceFirst}%</strong>
                  </div>
                  <div>
                    <span className="block text-[10px] uppercase font-bold text-sky-300">R2 Available</span>
                    <strong className="text-foreground text-sm font-mono">{dlsPreview.resourceSecond}%</strong>
                  </div>
                </div>
              </div>
            ) : null}

            <Button
              className="w-full h-12 font-bold bg-sky-500 hover:bg-sky-600 text-slate-950 text-base shadow-lg shadow-sky-500/20"
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
                toast({
                  title: "DLS Target Applied",
                  description: `Target set to ${dlsPreview.target} runs in ${revisedOvers} overs.`,
                });
              }}
            >
              {dlsPreview
                ? `Apply DLS Target ${dlsPreview.target} (${revisedOvers} ov)`
                : "Apply DLS Target"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ═══════════════════════════════════════════════════ */}
      {/* ─── Retire Batter Sheet ─── */}
      {/* ═══════════════════════════════════════════════════ */}
      <Sheet open={retireSheet} onOpenChange={setRetireSheet}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-lg mx-auto">
          <SheetHeader>
            <SheetTitle>
              Retired — {playerNameById(players, retirePromptPlayerId ?? strikerId)}
            </SheetTitle>
          </SheetHeader>
          {retireAtRuns != null && retirePromptPlayerId != null ? (
            <p className="text-xs text-muted-foreground mt-2">
              Policy retire at {retireAtRuns} — striker reached{" "}
              {batterRuns[retirePromptPlayerId] ?? retireAtRuns} runs.
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-2 mt-4 pb-6">
            <Button
              variant="outline"
              className="h-12 font-semibold"
              disabled={busy || !(retirePromptPlayerId ?? strikerId) || !battingId}
              onClick={async () => {
                const playerId = retirePromptPlayerId ?? strikerId;
                setRetireSheet(false);
                setRetirePromptPlayerId(null);
                await onEvent(CricketEventType.PLAYER_RETIRED, {
                  innings: state.currentInnings,
                  teamId: battingId,
                  playerId,
                  type: "hurt",
                });
                onNewBatsman(-1);
              }}
            >
              Retired Hurt
            </Button>
            <Button
              variant="outline"
              className="h-12 font-semibold text-red-400"
              disabled={busy || !(retirePromptPlayerId ?? strikerId) || !battingId}
              onClick={async () => {
                const playerId = retirePromptPlayerId ?? strikerId;
                setRetireSheet(false);
                setRetirePromptPlayerId(null);
                await onEvent(CricketEventType.PLAYER_RETIRED, {
                  innings: state.currentInnings,
                  teamId: battingId,
                  playerId,
                  type: "out",
                });
                onNewBatsman(-1);
              }}
            >
              Retired Out
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
