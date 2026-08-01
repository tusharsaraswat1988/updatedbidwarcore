/**
 * Shared match-points summary for owners: points table first, then recent results.
 * Used on Results page, Scorer Points tab, and public standings.
 */

import { Link } from "wouter";
import {
  formatPointDifference,
  gameScoreLines,
  gamesWonDisplayLine,
  listRecentCompleted,
  loserLabel,
  outcomeLabel,
  winnerLabel,
  winnerPointDifference,
  winnerTeamFields,
  type ResultsMatch,
} from "@/lib/badminton-results";
import type { LeaderboardBoard } from "@/lib/badminton-leaderboards";
import { formatTeamPlayerLine } from "@/lib/team-player-identity";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import { cn } from "@/lib/utils";

const DEFAULT_RECENT_LIMIT = 12;

export function MatchPointsSummary({
  boards,
  matches,
  loading,
  tournamentId,
  className,
  showMatchControlLinks = false,
  emptyStandingsHint,
}: {
  boards: LeaderboardBoard[];
  matches: ResultsMatch[];
  loading?: boolean;
  tournamentId?: number;
  className?: string;
  /** Organizer Results page — link into match control. */
  showMatchControlLinks?: boolean;
  emptyStandingsHint?: string;
}) {
  const recent = listRecentCompleted(matches, DEFAULT_RECENT_LIMIT);

  if (loading && boards.length === 0 && recent.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="h-28 rounded-2xl bg-white/4 animate-pulse" />
        <div className="h-40 rounded-2xl bg-white/4 animate-pulse" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-8", className)}>
      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            Match points
          </p>
          <h2 className="text-white font-bold text-xl">Points table</h2>
          <p className="text-white/35 text-sm">
            Ranked by wins, then Diff · updates after each finished league match
          </p>
        </div>
        {boards.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white/35 text-sm">
            {emptyStandingsHint ??
              "No league standings yet — finish a league match and the table appears here."}
          </p>
        ) : (
          <div className="space-y-4">
            {boards.map((board) => (
              <div
                key={board.key}
                className="rounded-2xl border border-white/10 bg-white/[0.03] overflow-hidden"
              >
                <div className="px-4 py-3 border-b border-white/8">
                  <p className="text-white font-semibold text-sm">{board.boardTitle}</p>
                  <p className="text-white/35 text-xs mt-0.5">{board.subtitle}</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-white/35 text-[10px] uppercase tracking-wider border-b border-white/6">
                        <th className="text-left py-2 pl-4 pr-2 font-bold">#</th>
                        <th className="text-left py-2 pr-2 font-bold">Pair</th>
                        <th className="text-center py-2 px-1 font-bold">P</th>
                        <th className="text-center py-2 px-1 font-bold">W</th>
                        <th className="text-center py-2 px-1 font-bold">L</th>
                        <th className="text-right py-2 pr-4 font-bold">Diff</th>
                      </tr>
                    </thead>
                    <tbody>
                      {board.rows.map((row) => (
                        <tr
                          key={`${board.key}-${row.registrationId}`}
                          className="border-b border-white/5 last:border-0"
                        >
                          <td className="py-2.5 pl-4 pr-2 tabular-nums text-white/50">
                            {row.rank}
                          </td>
                          <td className="py-2.5 pr-2 text-white/90 truncate max-w-[14rem]">
                            {row.label}
                          </td>
                          <td className="py-2.5 px-1 text-center tabular-nums text-white/60">
                            {row.played}
                          </td>
                          <td className="py-2.5 px-1 text-center tabular-nums text-[#ffd700]/85">
                            {row.won}
                          </td>
                          <td className="py-2.5 px-1 text-center tabular-nums text-white/45">
                            {row.lost}
                          </td>
                          <td className="py-2.5 pr-4 text-right tabular-nums font-bold text-cyan-200">
                            {formatPointDifference(row.marginPoints)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-4">
        <div className="space-y-1">
          <p className="text-white/40 text-[10px] font-bold uppercase tracking-widest">
            Recent results
          </p>
          <h2 className="text-white font-bold text-xl">Finished matches</h2>
          <p className="text-white/35 text-sm">
            Winner · games · point difference — scored matches only
          </p>
        </div>
        {recent.length === 0 ? (
          <p className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-white/35 text-sm">
            No completed matches yet.
          </p>
        ) : (
          <ul className="rounded-2xl border border-white/10 bg-white/[0.03] divide-y divide-white/6">
            {recent.map((m) => {
              const winner = winnerLabel(m);
              const loser = loserLabel(m);
              const winnerTeam = winnerTeamFields(m);
              const winnerDisplay = winner
                ? formatTeamPlayerLine({
                    playerName: winner,
                    teamName: winnerTeam.teamName,
                    teamLogoUrl: winnerTeam.teamLogoUrl,
                    teamColor: winnerTeam.teamColor,
                  })
                : null;
              const games = gameScoreLines(m);
              const gamesLine = gamesWonDisplayLine(m);
              const diff = formatPointDifference(winnerPointDifference(m));
              const outcome = outcomeLabel(m);
              const vsLine =
                winner && loser ? `${winner} def ${loser}` : winner ?? `Match #${m.id}`;
              return (
                <li
                  key={m.id}
                  className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-white/85 text-sm truncate">{vsLine}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-0.5 text-xs text-white/40">
                      {winnerDisplay ? (
                        <span className="text-emerald-400/90">Won by {winnerDisplay}</span>
                      ) : null}
                      {outcome !== "Completed" ? (
                        <span className="text-amber-200/70">{outcome}</span>
                      ) : null}
                      {games.length > 0 ? (
                        <span className="font-mono text-white/30">{games.join(" · ")}</span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-none">
                    {gamesLine ? (
                      <span className="text-white/60 font-mono text-sm">{gamesLine}</span>
                    ) : null}
                    <span className="text-cyan-200/90 font-mono text-sm tabular-nums">
                      {diff}
                    </span>
                    {showMatchControlLinks && tournamentId ? (
                      <Link
                        href={badmintonMatchControlPath(tournamentId, m.id)}
                        className="text-[#4fc3f7] text-xs font-semibold hover:underline"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
