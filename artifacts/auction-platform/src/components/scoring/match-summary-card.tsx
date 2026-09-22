import type { CricketMatchSummary } from "@workspace/scoring-core";
import type { CricketScorerTeam } from "@/lib/scoring-squad";
import { Trophy, Target, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type MatchSummaryCardProps = {
  summary: CricketMatchSummary;
  teams: CricketScorerTeam[];
  compact?: boolean;
};

function getTeam(teams: CricketScorerTeam[], id: number): CricketScorerTeam | undefined {
  return teams.find((t) => t.id === id);
}

export function MatchSummaryCard({ summary, teams, compact }: MatchSummaryCardProps) {
  const winnerTeam = summary.winnerTeamId ? getTeam(teams, summary.winnerTeamId) : null;

  return (
    <div
      className={cn(
        "rounded-2xl border border-white/10 bg-gradient-to-b from-[#111938]/95 via-[#0c132a]/95 to-[#070b19]/98 shadow-2xl shadow-black/50 overflow-hidden backdrop-blur-md",
        compact ? "p-4 sm:p-5 space-y-4" : "p-6 space-y-6",
      )}
    >
      {/* ─── Match Status & Result Headline ─── */}
      <div className="text-center space-y-2 pb-2 border-b border-white/10">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-400/30 text-amber-300 text-[11px] font-bold uppercase tracking-wider shadow-sm">
          <Trophy className="w-3.5 h-3.5 text-amber-400" />
          <span>Match Completed</span>
        </div>

        {summary.resultText ? (
          <h2
            className={cn(
              "font-black tracking-tight text-white",
              compact ? "text-lg sm:text-xl" : "text-2xl sm:text-3xl",
            )}
          >
            {summary.resultText}
          </h2>
        ) : winnerTeam ? (
          <h2 className="text-xl sm:text-2xl font-black text-amber-300">
            {winnerTeam.name} Won
          </h2>
        ) : null}
      </div>

      {/* ─── Innings Score Breakdown ─── */}
      <div className="space-y-2.5">
        <span className="text-[10px] font-bold uppercase tracking-wider text-white/50 block px-1">
          Innings Breakdown
        </span>

        {summary.innings.map((inn) => {
          const team = getTeam(teams, inn.battingTeamId);
          const isWinner = summary.winnerTeamId === inn.battingTeamId;

          return (
            <div
              key={inn.innings}
              className={cn(
                "flex items-center justify-between gap-3 rounded-xl p-3 sm:p-3.5 transition-all border",
                isWinner
                  ? "bg-gradient-to-r from-amber-500/[0.12] via-amber-500/[0.06] to-transparent border-amber-400/40 shadow-sm"
                  : "bg-white/[0.04] border-white/10",
              )}
            >
              <div className="min-w-0 flex items-center gap-2.5">
                <span
                  className="w-2.5 h-8 rounded-full shrink-0"
                  style={{ backgroundColor: team?.color ?? (isWinner ? "#f59e0b" : "#64748b") }}
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] uppercase font-bold text-white/50 tracking-wider">
                      Inn {inn.innings}
                    </span>
                    {isWinner ? (
                      <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30">
                        Winner
                      </span>
                    ) : null}
                  </div>
                  <p className="font-bold text-white text-sm sm:text-base truncate mt-0.5">
                    {team?.name || `Team ${inn.battingTeamId}`}
                  </p>
                </div>
              </div>

              <div className="text-right shrink-0">
                <p className="text-base sm:text-xl font-black font-mono text-white tabular-nums tracking-tight">
                  {inn.runs}/{inn.wickets}
                </p>
                <p className="text-[11px] sm:text-xs text-white/60 font-semibold font-sans">
                  ({inn.overs} ov)
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Target / Additional Info ─── */}
      {summary.target ? (
        <div className="flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-xs text-white/70">
          <Target className="w-3.5 h-3.5 text-amber-400" />
          <span>
            Target Set: <strong className="text-white font-bold">{summary.target} runs</strong>
          </span>
        </div>
      ) : null}
    </div>
  );
}

