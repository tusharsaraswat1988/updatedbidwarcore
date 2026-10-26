import { Link } from "wouter";
import { HubSectionHeader, hubCardClass } from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import {
  summarizeManOfTheMatch,
  type MotmAwardInput,
  type MotmMatchInput,
  type MotmTeamInput,
} from "@/lib/motm-players";
import { cricketFanMatchPath, cricketFanPlayerPath } from "@/lib/tournament-navigation";
import { cn } from "@/lib/utils";

export function ManOfTheMatchBoard({
  tournamentId,
  awards,
  matches,
  teams,
  isLoading,
}: {
  tournamentId: number;
  awards: MotmAwardInput[] | undefined;
  matches: MotmMatchInput[] | undefined;
  teams: MotmTeamInput[];
  isLoading?: boolean;
}) {
  const players = summarizeManOfTheMatch(awards ?? [], matches ?? [], teams);
  const awardCount = players.reduce((sum, player) => sum + player.awards.length, 0);

  return (
    <section className={cn(hubCardClass, "p-4 sm:p-6 space-y-4")}>
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/50">
        <HubSectionHeader
          title="Man of the Match"
          subtitle={
            players.length === 0
              ? "Player-wise awards from completed matches"
              : `${players.length} player${players.length === 1 ? "" : "s"} · ${awardCount} award${awardCount === 1 ? "" : "s"}`
          }
        />
      </div>
      {isLoading ? (
        <Skeleton className="h-40 w-full rounded-xl" />
      ) : players.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No Man of the Match awards yet. They appear here after a match is completed.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[40rem] text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2.5 font-semibold">#</th>
                <th className="px-3 py-2.5 font-semibold">Player</th>
                <th className="px-3 py-2.5 font-semibold">Team</th>
                <th className="px-3 py-2.5 font-semibold text-center">Awards</th>
                <th className="px-3 py-2.5 font-semibold">Matches</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player, idx) => (
                <tr
                  key={player.playerId}
                  className="border-b border-border/60 last:border-0 align-top"
                >
                  <td className="px-3 py-2.5 text-muted-foreground tabular-nums">{idx + 1}</td>
                  <td className="px-3 py-2.5 font-medium">
                    <Link
                      href={cricketFanPlayerPath(tournamentId, player.playerId)}
                      className="hover:text-primary"
                    >
                      {player.playerName}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="inline-flex items-center gap-2 min-w-0">
                      {player.color ? (
                        <span
                          className="w-2 h-5 rounded-sm shrink-0"
                          style={{ backgroundColor: player.color }}
                        />
                      ) : null}
                      <span className="truncate">{player.teamName}</span>
                      {player.shortCode && player.shortCode !== player.teamName ? (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {player.shortCode}
                        </span>
                      ) : null}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-center tabular-nums font-semibold text-primary">
                    {player.awards.length}
                  </td>
                  <td className="px-3 py-2.5">
                    <ul className="space-y-1">
                      {player.awards.map((award) => (
                        <li key={award.id} className="min-w-0">
                          <Link
                            href={cricketFanMatchPath(tournamentId, award.matchId)}
                            className="text-foreground hover:text-primary"
                          >
                            {award.matchLabel}
                          </Link>
                          {award.reason ? (
                            <span className="block text-xs text-muted-foreground">{award.reason}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
