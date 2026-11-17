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
    <div className="space-y-6">
      <header className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm space-y-3">
        <div className="flex items-start justify-between gap-4">
            <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-[hsl(var(--muted-foreground))]">
                {match.roundName ?? "Match"} · {match.status}
                </p>
                <h1 className="text-xl sm:text-2xl font-black text-[hsl(var(--foreground))] mt-0.5 tracking-tight">
                {match.homeTeam?.name ?? "Home"} <span className="text-[hsl(var(--muted-foreground))]">vs</span> {match.awayTeam?.name ?? "Away"}
                </h1>
            </div>
            {match.resultSummary ? (
                <div className="px-3 py-1 rounded-full bg-[hsl(var(--primary))/10] text-[11px] font-bold text-[hsl(var(--primary))] border border-[hsl(var(--primary))/20]">
                    {match.resultSummary}
                </div>
            ) : null}
        </div>
        
        {manOfTheMatch ? (
          <div className="flex items-center gap-3 pt-2 text-sm border-t border-[hsl(var(--border))]">
            <div className="p-2 rounded-lg bg-[hsl(var(--muted))] text-[hsl(var(--primary))]">
                <Award className="h-4 w-4" />
            </div>
            <div>
                <p className="text-[11px] font-bold uppercase text-[hsl(var(--muted-foreground))]">Player of the Match</p>
                <p className="font-semibold text-[hsl(var(--foreground))]">
                {tournamentId ? (
                    <Link
                    href={cricketPlayerPublicPath(tournamentId, manOfTheMatch.playerId)}
                    className="hover:text-[hsl(var(--primary))] hover:underline"
                    >
                    {manOfTheMatch.playerName}
                    </Link>
                ) : (
                    <span>{manOfTheMatch.playerName}</span>
                )}
                {manOfTheMatch.reason ? (
                    <span className="text-[hsl(var(--muted-foreground))] ml-2 text-xs font-normal">({manOfTheMatch.reason})</span>
                ) : null}
                </p>
            </div>
          </div>
        ) : null}
      </header>

      {scorecard.innings.map((inn) => (
        <section key={inn.innings} className="space-y-3 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-sm">
          <div className="flex items-center justify-between gap-4 pb-2 border-b border-[hsl(var(--border))]">
            <h2 className="text-xs font-bold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
              Innings {inn.innings} — {teamLabel(match, inn.battingTeamId)}
            </h2>
            <div className="text-right">
                <p className="text-lg font-black tabular-nums text-[hsl(var(--foreground))] tracking-tight">
                {inn.totalRuns}/{inn.totalWickets}
                </p>
                <p className="text-xs text-[hsl(var(--muted-foreground))] font-medium">({inn.overs} ov)</p>
            </div>
          </div>


          <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] uppercase text-[10px] tracking-widest font-bold">
                  <th className="px-3 py-2.5 text-left">Batter</th>
                  <th className="px-3 py-2.5 text-right">R</th>
                  <th className="px-3 py-2.5 text-right">B</th>
                  <th className="px-3 py-2.5 text-right">4s</th>
                  <th className="px-3 py-2.5 text-right">6s</th>
                  <th className="px-3 py-2.5 text-right">SR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]">
                {inn.batting.map((b) => (
                  <tr key={b.playerId} className="hover:bg-[hsl(var(--muted))/50] transition-colors">
                    <td className="px-3 py-3">
                      <span className="font-semibold text-[hsl(var(--foreground))]">
                        {playerName(players, b.playerId)}
                        {b.notOut ? " *" : ""}
                      </span>
                      {b.dismissalType ? (
                        <span className="block text-[10px] text-[hsl(var(--muted-foreground))] uppercase tracking-tight">
                          {b.dismissalType.replace(/_/g, " ")}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums font-bold text-[hsl(var(--foreground))]">{b.runs}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.balls}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.fours}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.sixes}</td>
                    <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.strikeRate}</td>
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
            <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))] uppercase text-[10px] tracking-widest font-bold">
                    <th className="px-3 py-2.5 text-left">Bowler</th>
                    <th className="px-3 py-2.5 text-right">O</th>
                    <th className="px-3 py-2.5 text-right">R</th>
                    <th className="px-3 py-2.5 text-right">W</th>
                    <th className="px-3 py-2.5 text-right">Econ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[hsl(var(--border))]">
                  {inn.bowling.map((b) => (
                    <tr key={b.playerId} className="hover:bg-[hsl(var(--muted))/50] transition-colors">
                      <td className="px-3 py-3 font-semibold text-[hsl(var(--foreground))]">
                        {playerName(players, b.playerId)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--foreground))]">{b.overs}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--foreground))]">{b.runs}</td>
                      <td className="px-3 py-3 text-right tabular-nums font-black text-[hsl(var(--primary))]">{b.wickets}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-[hsl(var(--muted-foreground))]">{b.economy}</td>
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
