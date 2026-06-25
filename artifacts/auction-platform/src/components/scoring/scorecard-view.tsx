import { Link } from "wouter";
import type { PublicScorecardResponse } from "@/lib/scoring-api";
import { cricketPlayerPublicPath } from "@/lib/tournament-navigation";
import { Award } from "lucide-react";

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
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {match.roundName ?? "Match"} · {match.status}
        </p>
        <h1 className="text-2xl font-bold text-white">
          {match.homeTeam?.name ?? "Home"} vs {match.awayTeam?.name ?? "Away"}
        </h1>
        {match.resultSummary ? (
          <p className="text-sm text-amber-300/90">{match.resultSummary}</p>
        ) : null}
        {manOfTheMatch ? (
          <p className="text-sm text-amber-200/90 flex items-center gap-2 pt-1">
            <Award className="h-4 w-4 shrink-0" />
            Player of the Match:{" "}
            {tournamentId ? (
              <Link
                href={cricketPlayerPublicPath(tournamentId, manOfTheMatch.playerId)}
                className="font-semibold hover:underline"
              >
                {manOfTheMatch.playerName}
              </Link>
            ) : (
              <span className="font-semibold">{manOfTheMatch.playerName}</span>
            )}
            {manOfTheMatch.reason ? (
              <span className="text-muted-foreground">({manOfTheMatch.reason})</span>
            ) : null}
          </p>
        ) : null}
      </header>

      {scorecard.innings.map((inn) => (
        <section key={inn.innings} className="space-y-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Innings {inn.innings} — {teamLabel(match, inn.battingTeamId)}
            </h2>
            <p className="text-lg font-bold tabular-nums text-white">
              {inn.totalRuns}/{inn.totalWickets}{" "}
              <span className="text-sm font-normal text-muted-foreground">({inn.overs} ov)</span>
            </p>
          </div>

          <div className="overflow-x-auto rounded-xl border border-white/10">
            <table className="w-full text-sm min-w-[28rem]">
              <thead>
                <tr className="border-b border-white/10 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Batter</th>
                  <th className="px-3 py-2 font-medium text-right">R</th>
                  <th className="px-3 py-2 font-medium text-right">B</th>
                  <th className="px-3 py-2 font-medium text-right">4s</th>
                  <th className="px-3 py-2 font-medium text-right">6s</th>
                  <th className="px-3 py-2 font-medium text-right">SR</th>
                </tr>
              </thead>
              <tbody>
                {inn.batting.map((b) => (
                  <tr key={b.playerId} className="border-b border-white/5">
                    <td className="px-3 py-2">
                      <span className="font-medium text-white/95">
                        {playerName(players, b.playerId)}
                        {b.notOut ? " *" : ""}
                      </span>
                      {b.dismissalType ? (
                        <span className="block text-xs text-muted-foreground capitalize">
                          {b.dismissalType.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.runs}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.balls}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.fours}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.sixes}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{b.strikeRate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            Extras {inn.extras.total}
            {inn.extras.wides ? ` (w ${inn.extras.wides})` : ""}
            {inn.extras.noBalls ? ` (nb ${inn.extras.noBalls})` : ""}
            {inn.extras.penalties ? ` (pen ${inn.extras.penalties})` : ""}
          </p>

          {inn.bowling.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm min-w-[24rem]">
                <thead>
                  <tr className="border-b border-white/10 text-left text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Bowler</th>
                    <th className="px-3 py-2 font-medium text-right">O</th>
                    <th className="px-3 py-2 font-medium text-right">R</th>
                    <th className="px-3 py-2 font-medium text-right">W</th>
                    <th className="px-3 py-2 font-medium text-right">Econ</th>
                  </tr>
                </thead>
                <tbody>
                  {inn.bowling.map((b) => (
                    <tr key={b.playerId} className="border-b border-white/5">
                      <td className="px-3 py-2 font-medium text-white/95">
                        {playerName(players, b.playerId)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.overs}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.runs}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.wickets}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{b.economy}</td>
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
