import { useMemo } from "react";
import { Link } from "wouter";
import { CircleDot, Flame, Target, Zap, ArrowRight, Activity, Crosshair, Tv } from "lucide-react";
import type { CricketScoreboardState, BallDisplayOutcome } from "@workspace/scoring-core";
import type { PublicMatch, PublicTeam } from "@/lib/public-tournament-types";
import type { ScoringLiveDisplay, PublicScorecardResponse } from "@/lib/scoring-api";
import { cricketFanMatchPath } from "@/lib/tournament-navigation";
import { cn } from "@/lib/utils";
import { CricketTossResultPanel } from "@/components/scoring/cricket-toss-result-panel";
import { buildTossResultCopy, isTossResultHold } from "@/lib/cricket-toss-result";

interface LiveMiniScoreboardProps {
  tournamentId: number;
  match: PublicMatch;
  liveDisplay?: ScoringLiveDisplay | null;
  teamMap: Map<number, PublicTeam>;
  scorecardData?: PublicScorecardResponse | null;
  streamUrl?: string | null;
  /** Organizers set the link above the scoreboard, so the public placeholder stays off. */
  hideMissingStreamHint?: boolean;
  tournamentPlayers?: Array<{ id: number; name: string }>;
}

function calculateOversToBalls(over: number, ball: number): number {
  return over * 6 + ball;
}

export function LiveMiniScoreboard({
  tournamentId,
  match,
  liveDisplay,
  teamMap,
  scorecardData,
  streamUrl,
  hideMissingStreamHint = false,
  tournamentPlayers,
}: LiveMiniScoreboardProps) {
  const state = (liveDisplay?.state as CricketScoreboardState | null) ?? null;

  // Resolve teams
  const homeTeam = teamMap.get(match.homeTeamId);
  const awayTeam = teamMap.get(match.awayTeamId);

  // Active innings
  const activeInnings = useMemo(() => {
    if (!state?.innings || state.innings.length === 0) return null;
    return state.innings.find((i) => i.innings === state.currentInnings) ?? state.innings[state.innings.length - 1];
  }, [state]);

  const battingTeam = activeInnings ? teamMap.get(activeInnings.battingTeamId) : homeTeam;
  const bowlingTeam = activeInnings ? teamMap.get(activeInnings.bowlingTeamId) : awayTeam;

  // Runs, Wickets, Overs
  const runs = activeInnings?.runs ?? 0;
  const wickets = activeInnings?.wickets ?? 0;
  const over = activeInnings?.over ?? 0;
  const ball = activeInnings?.ball ?? 0;
  const oversStr = `${over}.${ball}`;
  const totalBallsBowled = calculateOversToBalls(over, ball);

  // Run rates
  const crr = totalBallsBowled > 0 ? ((runs / totalBallsBowled) * 6).toFixed(2) : "0.00";
  const target = state?.target ?? null;
  const oversLimit = activeInnings?.oversLimit ?? state?.oversLimit ?? 20;
  const totalMaxBalls = oversLimit * 6;
  const ballsRemaining = Math.max(0, totalMaxBalls - totalBallsBowled);
  const runsNeeded = target != null ? Math.max(0, target - runs) : null;
  const rrr =
    target != null && ballsRemaining > 0 && runsNeeded != null
      ? ((runsNeeded / ballsRemaining) * 6).toFixed(2)
      : null;

  // Player Name resolver: prioritize tournament roster, then scorecard
  const playerNameMap = useMemo(() => {
    const map = new Map<number, string>();
    if (tournamentPlayers) {
      tournamentPlayers.forEach((p) => {
        map.set(p.id, p.name);
      });
    }
    if (scorecardData?.players) {
      Object.entries(scorecardData.players).forEach(([id, name]) => {
        map.set(Number(id), name);
      });
    }
    return map;
  }, [tournamentPlayers, scorecardData]);

  // Striker & Non-Striker stats (never show serial numbers like Batsman #372)
  const strikerId = state?.strikerId ?? null;
  const nonStrikerId = state?.nonStrikerId ?? null;
  const bowlerId = state?.bowlerId ?? null;

  const strikerName = strikerId ? (playerNameMap.get(strikerId) || "Striker") : "Striker";
  const nonStrikerName = nonStrikerId ? (playerNameMap.get(nonStrikerId) || "Non-Striker") : "Non-Striker";
  const bowlerName = bowlerId ? (playerNameMap.get(bowlerId) || "Current Bowler") : "Current Bowler";

  // Detailed batsman stats if available in scorecard
  const strikerStats = useMemo(() => {
    if (!strikerId || !scorecardData?.scorecard?.batting) return null;
    const allBatting = Object.values(scorecardData.scorecard.batting).flat();
    return allBatting.find((b) => b.playerId === strikerId);
  }, [strikerId, scorecardData]);

  const nonStrikerStats = useMemo(() => {
    if (!nonStrikerId || !scorecardData?.scorecard?.batting) return null;
    const allBatting = Object.values(scorecardData.scorecard.batting).flat();
    return allBatting.find((b) => b.playerId === nonStrikerId);
  }, [nonStrikerId, scorecardData]);

  const bowlerStats = useMemo(() => {
    if (!bowlerId || !scorecardData?.scorecard?.bowling) return null;
    const allBowling = Object.values(scorecardData.scorecard.bowling).flat();
    return allBowling.find((b) => b.playerId === bowlerId);
  }, [bowlerId, scorecardData]);

  // Deliveries in current over
  const thisOverDeliveries: BallDisplayOutcome[] = state?.thisOver ?? [];

  const tossCopy =
    state && isTossResultHold(state)
      ? buildTossResultCopy(
          state,
          [...teamMap.values()],
          match.homeTeamId,
          match.awayTeamId,
        )
      : null;

  if (tossCopy) {
    return <CricketTossResultPanel variant="fan" copy={tossCopy} />;
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 sm:p-6 shadow-sm text-[hsl(var(--foreground))]">
      {/* Dynamic ambient background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-[hsl(var(--primary))/10] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-[hsl(var(--primary))/5] blur-3xl" />

      {/* Top Ticker Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-[hsl(var(--border))] pb-3 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-[hsl(var(--live))/40] bg-[hsl(var(--live))/15] px-2.5 py-0.5 font-bold uppercase tracking-wider text-[hsl(var(--live))]">
            <CircleDot className="h-3 w-3 animate-pulse" />
            LIVE INNINGS {activeInnings?.innings ?? 1}
          </span>

          {state?.freeHitActive ? (
            <span className="flex items-center gap-1 rounded-full border border-[hsl(var(--warning))/50] bg-[hsl(var(--warning))/25] px-2.5 py-0.5 font-bold uppercase tracking-wider text-[hsl(var(--warning))] animate-bounce">
              <Zap className="h-3 w-3" />
              FREE HIT
            </span>
          ) : null}

          {match.roundName ? (
            <span className="hidden sm:inline-block text-[hsl(var(--muted-foreground))]">• {match.roundName}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[hsl(var(--muted-foreground))]">
            <Activity className="h-3.5 w-3.5 text-[hsl(var(--primary))]" />
            <span>CRR: <strong className="text-[hsl(var(--foreground))]">{crr}</strong></span>
            {rrr ? (
              <span className="ml-2 border-l border-[hsl(var(--border))] pl-2">
                RRR: <strong className="text-[hsl(var(--warning))]">{rrr}</strong>
              </span>
            ) : null}
          </div>

          <Link
            href={cricketFanMatchPath(tournamentId, match.id)}
            className="hidden sm:inline-flex items-center gap-1 font-semibold text-[hsl(var(--primary))] hover:underline transition-colors"
          >
            Match Center <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Main Scoreboard Display Grid */}
      <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-5 items-center">
        {/* Left: Score, Ball Train & Chasing Target */}
        <div className="lg:col-span-6 space-y-3">
          <div className="flex items-center gap-3">
            {battingTeam?.logoUrl ? (
              <img
                src={battingTeam.logoUrl}
                alt=""
                className="h-12 w-12 rounded-xl object-cover border border-[hsl(var(--border))] bg-[hsl(var(--card))]"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-sm border border-[hsl(var(--primary))/30]"
                style={{ backgroundColor: battingTeam?.color ? `${battingTeam.color}33` : "hsl(var(--primary)/0.2)" }}
              >
                {battingTeam?.shortCode || battingTeam?.name.slice(0, 3).toUpperCase() || "BAT"}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-[hsl(var(--foreground))]">
                  {battingTeam?.name ?? "Batting Team"}
                </span>
                <span className="rounded bg-[hsl(var(--primary))/20] px-1.5 py-0.5 text-[10px] font-semibold text-[hsl(var(--primary))] uppercase">
                  Batting
                </span>
              </div>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                vs {bowlingTeam?.name ?? "Bowling Team"}
              </p>
            </div>
          </div>

          {/* Big Scoreline Counter */}
          <div className="flex items-baseline gap-3 pt-1">
            <div className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-[hsl(var(--foreground))] font-display">
              {runs}
              <span className="text-[hsl(var(--muted-foreground))] text-3xl sm:text-4xl font-normal">/{wickets}</span>
            </div>
            <div className="text-base sm:text-lg font-semibold text-[hsl(var(--muted-foreground))] tabular-nums">
              ({oversStr} <span className="text-xs font-normal text-[hsl(var(--muted-foreground))]">/ {oversLimit} ov</span>)
            </div>
          </div>

          {/* Over Train (Runs per ball in current over) */}
          <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl bg-[hsl(var(--card))/50] border border-[hsl(var(--border))] w-fit max-w-full overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[hsl(var(--primary))] shrink-0">
              Over {over + 1}:
            </span>
            {thisOverDeliveries.length === 0 ? (
              <span className="text-[hsl(var(--muted-foreground))] italic text-xs">Over starting...</span>
            ) : (
              <div className="flex items-center gap-1.5">
                {thisOverDeliveries.map((delivery, index) => {
                  const label = delivery.label || `${delivery.runsOffBat}`;
                  const isWicket = delivery.isWicket;
                  const isSix = delivery.runsOffBat === 6;
                  const isFour = delivery.runsOffBat === 4;
                  const isDot = delivery.runsOffBat === 0 && !delivery.extrasType && !isWicket;

                  return (
                    <span
                      key={`deliv-${index}`}
                      className={cn(
                        "flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-[11px] font-bold tabular-nums shadow-sm",
                        isWicket
                          ? "bg-[hsl(var(--destructive))] text-[hsl(var(--destructive-foreground))] border border-[hsl(var(--destructive))] animate-pulse"
                          : isSix
                          ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border border-[hsl(var(--primary))] font-black"
                          : isFour
                          ? "bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))] border border-[hsl(var(--success))]"
                          : isDot
                          ? "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] border border-[hsl(var(--border))]"
                          : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] border border-[hsl(var(--border))]",
                      )}
                    >
                      {isSix ? (
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5 text-[hsl(var(--primary-foreground))] inline" /> 6
                        </span>
                      ) : isWicket ? (
                        "W"
                      ) : (
                        label
                      )}
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {/* Target Equation Notice or Projected Score (Only after 1 full over) */}
          {target != null ? (
            <div className="flex items-center gap-2 rounded-xl border border-[hsl(var(--warning))/30] bg-[hsl(var(--warning))/10] px-3 py-1.5 text-xs text-[hsl(var(--warning))]">
              <Target className="h-4 w-4 text-[hsl(var(--warning))] shrink-0" />
              <span>
                {runsNeeded != null && runsNeeded > 0 ? (
                  <>
                    Need <strong>{runsNeeded}</strong> runs from <strong>{ballsRemaining}</strong> balls
                    {rrr ? <> (Req: <strong>{rrr}</strong>/ov)</> : null}
                  </>
                ) : (
                  <strong className="text-[hsl(var(--success))]">Target reached!</strong>
                )}
              </span>
            </div>
          ) : totalBallsBowled >= 6 ? (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              1st Innings • Projected score: ~<strong className="text-[hsl(var(--success))]">{Math.round(parseFloat(crr) * oversLimit)}</strong> (at {crr} rpo)
            </p>
          ) : (
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              1st Innings • In progress
            </p>
          )}
        </div>

        {/* Right: Active Batsmen & Bowler Cards */}
        <div className="lg:col-span-6 space-y-3 bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-3 sm:p-4">
          {/* Batsmen on crease */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[hsl(var(--primary))] flex items-center justify-between">
              <span>Batter</span>
              <span className="text-[hsl(var(--muted-foreground))] font-normal">R (B) • 4s • 6s • SR</span>
            </p>

            {/* Striker */}
            <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[hsl(var(--primary))/15] border border-[hsl(var(--primary))/20] font-medium">
              <span className="flex items-center gap-1.5 text-[hsl(var(--primary))] truncate max-w-[140px] sm:max-w-[180px]">
                <span className="text-[hsl(var(--primary))] font-bold">*</span>
                <strong className="text-[hsl(var(--foreground))] truncate">{strikerName}</strong>
              </span>
              <span className="tabular-nums font-semibold text-[hsl(var(--foreground))]">
                {strikerStats ? (
                  <>
                    {strikerStats.runs} <span className="text-[hsl(var(--muted-foreground))]">({strikerStats.balls})</span>
                    <span className="text-[hsl(var(--muted-foreground))] mx-1">·</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{strikerStats.fours} · {strikerStats.sixes}</span>
                    <span className="text-[hsl(var(--muted-foreground))] mx-1">·</span>
                    <span className="text-[hsl(var(--primary))]">{strikerStats.strikeRate.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-[hsl(var(--muted-foreground))]">On strike</span>
                )}
              </span>
            </div>

            {/* Non-Striker */}
            <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-[hsl(var(--muted))/50] font-medium">
              <span className="text-[hsl(var(--muted-foreground))] truncate max-w-[140px] sm:max-w-[180px]">
                {nonStrikerName}
              </span>
              <span className="tabular-nums font-semibold text-[hsl(var(--muted-foreground))]">
                {nonStrikerStats ? (
                  <>
                    {nonStrikerStats.runs} <span className="text-[hsl(var(--muted-foreground))]">({nonStrikerStats.balls})</span>
                    <span className="text-[hsl(var(--muted-foreground))] mx-1">·</span>
                    <span className="text-[hsl(var(--muted-foreground))]">{nonStrikerStats.fours} · {nonStrikerStats.sixes}</span>
                    <span className="text-[hsl(var(--muted-foreground))] mx-1">·</span>
                    <span className="text-[hsl(var(--foreground))]">{nonStrikerStats.strikeRate.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-[hsl(var(--muted-foreground))]">Non-striker</span>
                )}
              </span>
            </div>
          </div>

          {/* Current Bowler */}
          <div className="pt-2 border-t border-[hsl(var(--border))] flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-[hsl(var(--foreground))] truncate max-w-[140px] sm:max-w-[180px]">
              <Crosshair className="h-3.5 w-3.5 text-[hsl(var(--warning))] shrink-0" />
              <strong className="text-[hsl(var(--foreground))] truncate">{bowlerName}</strong>
            </span>
            <span className="tabular-nums text-[hsl(var(--foreground))]">
              {bowlerStats ? (
                <>
                  <span className="font-semibold text-[hsl(var(--warning))]">{bowlerStats.wickets}/{bowlerStats.runs}</span>
                  <span className="text-[hsl(var(--muted-foreground))] text-[11px] ml-1.5">({bowlerStats.overs} ov · Econ {bowlerStats.economy.toFixed(1)})</span>
                </>
              ) : (
                <span className="text-[hsl(var(--muted-foreground))] text-[11px]">Bowling</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Scoreboard Bottom Bar */}
      <div className="relative z-10 mt-4 pt-3 border-t border-[hsl(var(--border))] flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {streamUrl ? (
            <button
              type="button"
              onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[hsl(var(--destructive))] hover:bg-[hsl(var(--destructive)/0.9)] text-[hsl(var(--destructive-foreground))] font-semibold px-3 py-1.5 text-xs transition-colors shadow-md cursor-pointer"
            >
              <CircleDot className="h-3 w-3 animate-ping text-white" />
              Watch Live Stream
            </button>
          ) : hideMissingStreamHint ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))/50] px-2.5 py-1 text-[11px] text-[hsl(var(--muted-foreground))]">
              <Tv className="h-3 w-3 text-[hsl(var(--muted-foreground))] shrink-0" />
              Stream link not provided by organizer yet
            </span>
          )}
        </div>

        <Link
          href={cricketFanMatchPath(tournamentId, match.id)}
          className="inline-flex items-center gap-1 rounded-lg bg-[hsl(var(--primary))/25] hover:bg-[hsl(var(--primary))/35] border border-[hsl(var(--primary))/40] text-[hsl(var(--primary))] font-semibold px-3 py-1.5 text-xs transition-colors"
        >
          Full Match Center <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
