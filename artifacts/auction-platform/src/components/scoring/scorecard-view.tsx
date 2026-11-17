import { Link } from "wouter";
import type { PublicScorecardResponse } from "@/lib/scoring-api";
import { cricketPlayerPublicPath } from "@/lib/tournament-navigation";
import { Award } from "lucide-react";
import { cn } from "@/lib/utils";

function playerName(map: Record<string, string>, id: number): string {
  return map[String(id)] ?? `Player ${id}`;
}

function teamLabel(
  match: PublicScorecardResponse["match"],
  teamId: number,
): string {
  if (teamId === match.homeTeamId) return match.homeTeam?.shortCode ?? "HOME";
  if (teamId === match.awayTeamId) return match.awayTeam?.shortCode ?? "AWAY";
  return "—";
}

type ScorecardViewProps = {
  data: PublicScorecardResponse;
  tournamentId?: number;
};

export function ScorecardView({ data, tournamentId }: ScorecardViewProps) {
  const { match, scorecard, players, manOfTheMatch } = data;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <p className="text-xs uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {match.roundName ?? "Match"} · {match.status}
        </p>
        <h1 className="text-2xl font-display font-bold text-[hsl(var(--foreground))]">
          {match.homeTeam?.name ?? "Home"} vs {match.awayTeam?.name ?? "Away"}
        </h1>
        {match.resultSummary ? (
          <p className="text-sm text-[hsl(var(--primary)) font-semibold">{match.resultSummary}</p>
        ) : null}
        {manOfTheMatch ? (
          <p className="text-sm text-[hsl(var(--foreground))] flex items-center gap-2 pt-1">
            <Award className="h-4 w-4 shrink-0 text-[hsl(var(--primary))]" />
            Player of the Match:{" "}
            {tournamentId ? (
              <Link
                href={cricketPlayerPublicPath(tournamentId, manOfTheMatch.playerId)}
                className="font-semibold text-[hsl(var(--primary))] hover:underline"
              >
                {manOfTheMatch.playerName}
              </Link>
            ) : (
              <span className="font-semibold text-[hsl(var(--primary))]">{manOfTheMatch.playerName}</span>
            )}
            {manOfTheMatch.reason ? (
              <span className="text-[hsl(var(--muted-foreground))]">({manOfTheMatch.reason})</span>
            ) : null}
          </p>
        ) : null}
      </header>

      {scorecard.innings.map((inn) => (
        <section key={inn.innings} className="space-y-4 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 shadow-sm">
          <div className="flex items-baseline justify-between gap-4 pb-2 border-b border-[hsl(var(--border))]">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Innings {inn.innings} — {teamLabel(match, inn.battingTeamId)}
            </h2>
            <p className="text-lg font-bold tabular-nums text-[hsl(var(--foreground))]">
              {inn.totalRuns}/{inn.totalWickets}{" "}
              <span className="text-sm font-normal text-[hsl(var(--muted-foreground))]">({inn.overs} ov)</span>
            </p>
          </div>

          <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--muted))/50] text-[hsl(var(--muted-foreground))] uppercase text-xs tracking-wider">
                  <th className="px-3 py-2 font-medium text-left">Batter</th>
                  <th className="px-3 py-2 font-medium text-right">R</th>
                  <th className="px-3 py-2 font-medium text-right">B</th>
                  <th className="px-3 py-2 font-medium text-right">4s</th>
                  <th className="px-3 py-2 font-medium text-right">6s</th>
                  <th className="px-3 py-2 font-medium text-right">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {inn.batting.map((b) => (
                  <tr key={b.playerId} className="hover:bg-[hsl(var(--muted))/30] transition-colors">
                    <td className="px-3 py-2">
                      <span className="font-medium text-[hsl(var(--foreground))]">
                        {playerName(players, b.playerId)}
                        {b.notOut ? " *" : ""}
                      </span>
                      {b.dismissalType ? (
                        <span className="block text-xs text-[hsl(var(--muted-foreground))] capitalize">
                          {b.dismissalType.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--foreground))]">{b.runs}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.balls}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.fours}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.sixes}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.strikeRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-[hsl(var(--muted-foreground))] pt-1">
            Extras {inn.extras.total}
            {inn.extras.byes ? ` (b ${inn.extras.byes})` : ""}
            {inn.extras.legByes ? ` (lb ${inn.extras.legByes})` : ""}
            {inn.extras.wides ? ` (w ${inn.extras.wides})` : ""}
            {inn.extras.noBalls ? ` (nb ${inn.extras.noBalls})` : ""}
            {inn.extras.penalties ? ` (pen ${inn.extras.penalties})` : ""}
          </p>

          {inn.bowling.length > 0 ? (
            <div className="rounded-lg border border-[hsl(var(--border))] overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--muted))/50] text-[hsl(var(--muted-foreground))] uppercase text-xs tracking-wider">
                    <th className="px-3 py-2 font-medium text-left">Bowler</th>
                    <th className="px-3 py-2 font-medium text-right">O</th>
                    <th className="px-3 py-2 font-medium text-right">R</th>
                    <th className="px-3 py-2 font-medium text-right">W</th>
                    <th className="px-3 py-2 font-medium text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {inn.bowling.map((b) => (
                    <tr key={b.playerId} className="hover:bg-[hsl(var(--muted))/30] transition-colors">
                      <td className="px-3 py-2 font-medium text-[hsl(var(--foreground))]">
                        {playerName(players, b.playerId)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--foreground))]">{b.overs}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--foreground))]">{b.runs}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--primary))] font-semibold">{b.wickets}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.economy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
