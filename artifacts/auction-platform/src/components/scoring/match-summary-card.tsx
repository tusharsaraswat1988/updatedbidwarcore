import type { CricketMatchSummary } from "@workspace/scoring-core";
import type { CricketScorerTeam } from "@/lib/scoring-squad";

type MatchSummaryCardProps = {
  summary: CricketMatchSummary;
  teams: CricketScorerTeam[];
  compact?: boolean;
};

function teamLabel(teams: CricketScorerTeam[], id: number) {
  return teams.find((t) => t.id === id)?.name ?? `Team ${id}`;
}

export function MatchSummaryCard({ summary, teams, compact }: MatchSummaryCardProps) {
  return (
    <div className={`rounded-xl border border-border bg-card/80 ${compact ? "p-4" : "p-6"} space-y-4`}>
      {summary.resultText ? (
        <p className={`font-bold text-center ${compact ? "text-lg" : "text-2xl"}`}>
          {summary.resultText}
        </p>
      ) : null}

      <div className="space-y-2">
        {summary.innings.map((inn) => (
          <div
            key={inn.innings}
            className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5 text-sm"
          >
            <span className="font-medium truncate">
              Inn {inn.innings} — {teamLabel(teams, inn.battingTeamId)}
            </span>
            <span className="font-mono font-bold tabular-nums shrink-0">
              {inn.runs}/{inn.wickets} ({inn.overs})
            </span>
          </div>
        ))}
      </div>

      {summary.target ? (
        <p className="text-xs text-center text-muted-foreground">
          Target: {summary.target}
        </p>
      ) : null}
    </div>
  );
}
