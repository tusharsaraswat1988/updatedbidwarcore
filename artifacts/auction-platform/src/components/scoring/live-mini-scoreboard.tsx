import { useMemo } from "react";
import { Link } from "wouter";
import { CircleDot, Flame, Target, Zap, ArrowRight, Activity, Crosshair, Tv } from "lucide-react";
import type { CricketScoreboardState, BallDisplayOutcome } from "@workspace/scoring-core";
import type { PublicMatch, PublicTeam } from "@/lib/public-tournament-types";
import type { ScoringLiveDisplay, PublicScorecardResponse } from "@/lib/scoring-api";
import { cricketFanMatchPath } from "@/lib/tournament-navigation";
import { cn } from "@/lib/utils";

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

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-gradient-to-br from-[#0c2419] via-[#091e15] to-[#08151f] p-4 sm:p-6 shadow-xl text-white">
      {/* Dynamic ambient background glow */}
      <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-emerald-500/15 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-amber-500/10 blur-3xl" />

      {/* Top Ticker Bar */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3 mb-4 text-xs">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-500/20 px-2.5 py-0.5 font-bold uppercase tracking-wider text-emerald-300">
            <CircleDot className="h-3 w-3 animate-pulse text-emerald-400" />
            LIVE INNINGS {activeInnings?.innings ?? 1}
          </span>

          {state?.freeHitActive ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-400/50 bg-amber-500/25 px-2.5 py-0.5 font-bold uppercase tracking-wider text-amber-300 animate-bounce">
              <Zap className="h-3 w-3 text-amber-300" />
              FREE HIT
            </span>
          ) : null}

          {match.roundName ? (
            <span className="hidden sm:inline-block text-white/60">• {match.roundName}</span>
          ) : null}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-white/80">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            <span>CRR: <strong className="text-white">{crr}</strong></span>
            {rrr ? (
              <span className="ml-2 border-l border-white/20 pl-2">
                RRR: <strong className="text-amber-300">{rrr}</strong>
              </span>
            ) : null}
          </div>

          <Link
            href={cricketFanMatchPath(tournamentId, match.id)}
            className="hidden sm:inline-flex items-center gap-1 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
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
                className="h-12 w-12 rounded-xl object-cover border border-white/20 bg-black/40"
              />
            ) : (
              <div
                className="h-12 w-12 rounded-xl flex items-center justify-center font-bold text-sm border border-emerald-400/30"
                style={{ backgroundColor: battingTeam?.color ? `${battingTeam.color}33` : "#10b98126" }}
              >
                {battingTeam?.shortCode || battingTeam?.name.slice(0, 3).toUpperCase() || "BAT"}
              </div>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl font-bold tracking-tight text-white">
                  {battingTeam?.name ?? "Batting Team"}
                </span>
                <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 uppercase">
                  Batting
                </span>
              </div>
              <p className="text-xs text-white/60">
                vs {bowlingTeam?.name ?? "Bowling Team"}
              </p>
            </div>
          </div>

          {/* Big Scoreline Counter */}
          <div className="flex items-baseline gap-3 pt-1">
            <div className="text-4xl sm:text-5xl font-black tabular-nums tracking-tight text-white font-display">
              {runs}
              <span className="text-white/50 text-3xl sm:text-4xl font-normal">/{wickets}</span>
            </div>
            <div className="text-base sm:text-lg font-semibold text-white/70 tabular-nums">
              ({oversStr} <span className="text-xs font-normal text-white/50">/ {oversLimit} ov</span>)
            </div>
          </div>

          {/* Over Train (Runs per ball in current over) */}
          <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-xl bg-black/30 border border-white/10 w-fit max-w-full overflow-x-auto scrollbar-none">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 shrink-0">
              Over {over + 1}:
            </span>
            {thisOverDeliveries.length === 0 ? (
              <span className="text-white/40 italic text-xs">Over starting...</span>
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
                          ? "bg-red-600 text-white border border-red-400 animate-pulse"
                          : isSix
                          ? "bg-gradient-to-r from-amber-500 to-yellow-400 text-black border border-yellow-300 font-black"
                          : isFour
                          ? "bg-emerald-600 text-white border border-emerald-400"
                          : isDot
                          ? "bg-white/10 text-white/60 border border-white/10"
                          : "bg-white/20 text-white border border-white/20",
                      )}
                    >
                      {isSix ? (
                        <span className="flex items-center gap-0.5">
                          <Flame className="h-2.5 w-2.5 text-red-900 inline" /> 6
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
            <div className="flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200">
              <Target className="h-4 w-4 text-amber-400 shrink-0" />
              <span>
                {runsNeeded != null && runsNeeded > 0 ? (
                  <>
                    Need <strong>{runsNeeded}</strong> runs from <strong>{ballsRemaining}</strong> balls
                    {rrr ? <> (Req: <strong>{rrr}</strong>/ov)</> : null}
                  </>
                ) : (
                  <strong className="text-emerald-300">Target reached!</strong>
                )}
              </span>
            </div>
          ) : totalBallsBowled >= 6 ? (
            <p className="text-xs text-white/70">
              1st Innings • Projected score: ~<strong className="text-emerald-300">{Math.round(parseFloat(crr) * oversLimit)}</strong> (at {crr} rpo)
            </p>
          ) : (
            <p className="text-xs text-white/50">
              1st Innings • In progress
            </p>
          )}
        </div>

        {/* Right: Active Batsmen & Bowler Cards */}
        <div className="lg:col-span-6 space-y-3 bg-white/5 border border-white/10 rounded-xl p-3 sm:p-4">
          {/* Batsmen on crease */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-400/90 flex items-center justify-between">
              <span>Batter</span>
              <span className="text-white/50 font-normal">R (B) • 4s • 6s • SR</span>
            </p>

            {/* Striker */}
            <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-emerald-500/15 border border-emerald-400/20 font-medium">
              <span className="flex items-center gap-1.5 text-emerald-200 truncate max-w-[140px] sm:max-w-[180px]">
                <span className="text-emerald-400 font-bold">*</span>
                <strong className="text-white truncate">{strikerName}</strong>
              </span>
              <span className="tabular-nums font-semibold text-white">
                {strikerStats ? (
                  <>
                    {strikerStats.runs} <span className="text-white/60">({strikerStats.balls})</span>
                    <span className="text-white/40 mx-1">·</span>
                    <span className="text-white/70">{strikerStats.fours} · {strikerStats.sixes}</span>
                    <span className="text-white/40 mx-1">·</span>
                    <span className="text-emerald-300">{strikerStats.strikeRate.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-white/60">On strike</span>
                )}
              </span>
            </div>

            {/* Non-Striker */}
            <div className="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/5 font-medium">
              <span className="text-white/80 truncate max-w-[140px] sm:max-w-[180px]">
                {nonStrikerName}
              </span>
              <span className="tabular-nums font-semibold text-white/70">
                {nonStrikerStats ? (
                  <>
                    {nonStrikerStats.runs} <span className="text-white/50">({nonStrikerStats.balls})</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="text-white/60">{nonStrikerStats.fours} · {nonStrikerStats.sixes}</span>
                    <span className="text-white/30 mx-1">·</span>
                    <span className="text-white/80">{nonStrikerStats.strikeRate.toFixed(1)}</span>
                  </>
                ) : (
                  <span className="text-white/40">Non-striker</span>
                )}
              </span>
            </div>
          </div>

          {/* Current Bowler */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-white/80 truncate max-w-[140px] sm:max-w-[180px]">
              <Crosshair className="h-3.5 w-3.5 text-amber-400 shrink-0" />
              <strong className="text-white truncate">{bowlerName}</strong>
            </span>
            <span className="tabular-nums text-white/80">
              {bowlerStats ? (
                <>
                  <span className="font-semibold text-amber-300">{bowlerStats.wickets}/{bowlerStats.runs}</span>
                  <span className="text-white/50 text-[11px] ml-1.5">({bowlerStats.overs} ov · Econ {bowlerStats.economy.toFixed(1)})</span>
                </>
              ) : (
                <span className="text-white/50 text-[11px]">Bowling</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Scoreboard Bottom Bar */}
      <div className="relative z-10 mt-4 pt-3 border-t border-white/10 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {streamUrl ? (
            <button
              type="button"
              onClick={() => window.open(streamUrl, "_blank", "noopener,noreferrer")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold px-3 py-1.5 text-xs transition-colors shadow-lg shadow-red-900/40 cursor-pointer"
            >
              <CircleDot className="h-3 w-3 animate-ping text-white" />
              Watch Live Stream
            </button>
          ) : hideMissingStreamHint ? null : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/50">
              <Tv className="h-3 w-3 text-white/40 shrink-0" />
              Stream link not provided by organizer yet
            </span>
          )}
        </div>

        <Link
          href={cricketFanMatchPath(tournamentId, match.id)}
          className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/25 hover:bg-emerald-500/35 border border-emerald-400/40 text-emerald-200 font-semibold px-3 py-1.5 text-xs transition-colors"
        >
          Full Match Center <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
