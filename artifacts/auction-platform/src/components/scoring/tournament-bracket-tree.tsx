import { useMemo } from "react";
import { Link } from "wouter";
import { Trophy, MapPin, CircleDot } from "lucide-react";
import type { PublicFixture, PublicMatch, PublicTeam } from "@/lib/public-tournament-types";
import { cricketFanMatchPath } from "@/lib/tournament-navigation";
import { bracketBoardsByDraw, bracketMatchesByDraw, matchForBracketFixture } from "@workspace/scoring-core/cricket";
import { cn } from "@/lib/utils";

interface TournamentBracketTreeProps {
  tournamentId: number;
  fixtures: PublicFixture[];
  matches: PublicMatch[];
  draws?: Array<{ id: number; name?: string | null }>;
  teamMap: Map<number, PublicTeam>;
  tournamentName?: string;
}

type BracketMatchNode = {
  id: string | number;
  matchId?: number;
  roundName: string;
  roundOrder: number;
  slotIndex: number;
  homeTeam: PublicTeam | null;
  awayTeam: PublicTeam | null;
  winnerTeamId?: number | null;
  status: string;
  resultSummary?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
};

export function TournamentBracketTree({
  tournamentId,
  fixtures,
  matches,
  draws = [],
  teamMap,
}: TournamentBracketTreeProps) {
  const boards = useMemo(() => {
    const fixtureBoards = bracketBoardsByDraw(fixtures, draws);
    const toRounds = (nodes: BracketMatchNode[]) => {
      const roundGroups = new Map<number, { order: number; name: string; matches: BracketMatchNode[] }>();
      nodes.forEach((node) => {
        const existing = roundGroups.get(node.roundOrder);
        if (!existing) {
          roundGroups.set(node.roundOrder, {
            order: node.roundOrder,
            name: node.roundName,
            matches: [node],
          });
        } else {
          existing.matches.push(node);
        }
      });
      return Array.from(roundGroups.values()).sort((a, b) => a.order - b.order);
    };

    if (fixtureBoards.length > 0) {
      return fixtureBoards.map((board) => ({
        drawId: board.drawId,
        drawName: board.drawName,
        rounds: toRounds(
          board.fixtures.map((fixture) => {
            const correspondingMatch = matchForBracketFixture(fixture, matches);
            return {
              id: `fixture-${fixture.id}`,
              matchId: correspondingMatch?.id,
              roundName: fixture.roundName || `Round ${fixture.bracketRound}`,
              roundOrder: fixture.bracketRound ?? 0,
              slotIndex: fixture.bracketSlot ?? 0,
              homeTeam: teamMap.get(fixture.homeTeamId) ?? null,
              awayTeam: teamMap.get(fixture.awayTeamId) ?? null,
              winnerTeamId: fixture.winnerTeamId ?? correspondingMatch?.winnerTeamId,
              status: correspondingMatch?.status ?? fixture.status ?? "scheduled",
              resultSummary: fixture.resultSummary ?? correspondingMatch?.resultSummary,
              scheduledAt: fixture.scheduledAt ?? correspondingMatch?.scheduledAt,
              venue: fixture.venue ?? correspondingMatch?.venue,
            };
          }),
        ),
      }));
    }

    const playoffKeywords = ["final", "semi", "quarter", "eliminator", "qualifier", "playoff"];
    const playoffMatches = matches.filter((m) =>
      playoffKeywords.some((k) => (m.roundName || "").toLowerCase().includes(k)),
    );
    const sourceMatches = playoffMatches.length > 0 ? playoffMatches : matches.slice(0, 8);
    const names = new Map(draws.map((draw) => [draw.id, draw.name?.trim() || `Competition ${draw.id}`]));
    return bracketMatchesByDraw(sourceMatches, fixtures).map((board) => ({
      drawId: board.drawId,
      drawName: board.drawId == null ? "Knockout" : (names.get(board.drawId) ?? `Competition ${board.drawId}`),
      rounds: toRounds(
        board.matches.map((match, idx) => {
          const rName = (match.roundName || "Playoff").toLowerCase();
          let order = 1;
          if (playoffMatches.length === 0) order = Math.floor(idx / 2) + 1;
          else if (rName.includes("quarter")) order = 1;
          else if (rName.includes("semi") || rName.includes("qualifier") || rName.includes("eliminator")) order = 2;
          else if (rName.includes("final")) order = 3;
          return {
            id: `match-${match.id}`,
            matchId: match.id,
            roundName: match.roundName || (playoffMatches.length > 0 ? "Knockout" : `Matchday ${idx + 1}`),
            roundOrder: order,
            slotIndex: idx + 1,
            homeTeam: teamMap.get(match.homeTeamId) ?? null,
            awayTeam: teamMap.get(match.awayTeamId) ?? null,
            winnerTeamId: match.winnerTeamId,
            status: match.status,
            resultSummary: match.resultSummary,
            scheduledAt: match.scheduledAt,
            venue: match.venue,
          };
        }),
      ),
    }));
  }, [fixtures, matches, draws, teamMap]);

  if (boards.every((board) => board.rounds.length === 0)) {
    return (
      <div className="rounded-2xl border border-white/10 bg-card/40 p-8 text-center text-white/60">
        <Trophy className="h-10 w-10 mx-auto text-amber-400/60 mb-2" />
        <p className="font-semibold text-white">Knockout Stage Schedule Pending</p>
        <p className="text-xs mt-1">
          Playoff brackets and qualification fixtures will be unlocked upon completion of the league stage.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-display text-lg font-bold text-white flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-400" />
            Tournament Playoff & Bracket Tree
          </h3>
          <p className="text-xs text-muted-foreground">
            Stage-by-stage progression path to the championship trophy.
          </p>
        </div>
      </div>

      {boards.map((board) => (
      <div key={board.drawId ?? "knockout"} className="space-y-3">
      {boards.length > 1 ? (
        <h4 className="text-sm font-bold text-white">{board.drawName}</h4>
      ) : null}
      <div className="overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-white/15">
        <div className="flex items-stretch gap-6 sm:gap-8 min-w-[700px]">
          {board.rounds.map((round, rIdx) => {
            const isFinalRound = rIdx === board.rounds.length - 1;

            return (
              <div
                key={`${board.drawId ?? "knockout"}-${round.order}`}
                className="flex-1 flex flex-col min-w-[240px] max-w-[320px]"
              >
                {/* Round Header Badge */}
                <div className="mb-4 text-center">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border shadow-sm",
                      isFinalRound
                        ? "bg-gradient-to-r from-amber-500/25 to-yellow-500/25 border-amber-400/50 text-amber-300"
                        : "bg-white/5 border-white/15 text-white/90",
                    )}
                  >
                    {isFinalRound ? <Trophy className="h-3.5 w-3.5 text-amber-400" /> : null}
                    {round.name}
                  </span>
                </div>

                {/* Match Cards in this round */}
                <div className="flex-1 flex flex-col justify-around gap-4">
                  {round.matches.map((m) => {
                    const isLive = m.status === "live";
                    const isCompleted = m.status === "completed";
                    const isHomeWinner = m.winnerTeamId != null && m.winnerTeamId === m.homeTeam?.id;
                    const isAwayWinner = m.winnerTeamId != null && m.winnerTeamId === m.awayTeam?.id;

                    const cardContent = (
                      <div
                        className={cn(
                          "relative rounded-xl border p-3.5 transition-all text-xs shadow-lg backdrop-blur-sm group",
                          isLive
                            ? "bg-emerald-950/40 border-emerald-500/50 hover:border-emerald-400 shadow-emerald-950/50 ring-1 ring-emerald-500/30"
                            : isFinalRound
                            ? "bg-gradient-to-br from-[#1b190f] to-[#12100a] border-amber-500/40 hover:border-amber-400/80"
                            : "bg-card/70 border-white/10 hover:border-white/20",
                        )}
                      >
                        {/* Top Match status */}
                        <div className="flex items-center justify-between text-[10px] text-white/60 mb-2 border-b border-white/10 pb-1.5">
                          <span className="truncate font-medium">{m.roundName}</span>
                          {isLive ? (
                            <span className="flex items-center gap-1 font-bold text-emerald-400 uppercase tracking-wider">
                              <CircleDot className="h-3 w-3 animate-pulse text-emerald-400" />
                              LIVE
                            </span>
                          ) : isCompleted ? (
                            <span className="font-semibold text-white/50 uppercase">Final</span>
                          ) : (
                            <span className="font-medium text-white/40">Upcoming</span>
                          )}
                        </div>

                        {/* Team 1 Slot */}
                        <div
                          className={cn(
                            "flex items-center justify-between py-1.5 px-2 rounded-lg mb-1 transition-colors",
                            isHomeWinner ? "bg-emerald-500/20 font-bold text-white" : "text-white/80",
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.homeTeam?.color || "#10b981" }}
                            />
                            <span className="truncate">{m.homeTeam?.name || "TBD"}</span>
                          </div>
                          {isHomeWinner ? (
                            <span className="text-[10px] text-emerald-400 font-bold ml-1">✓ WIN</span>
                          ) : null}
                        </div>

                        {/* Team 2 Slot */}
                        <div
                          className={cn(
                            "flex items-center justify-between py-1.5 px-2 rounded-lg transition-colors",
                            isAwayWinner ? "bg-emerald-500/20 font-bold text-white" : "text-white/80",
                          )}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: m.awayTeam?.color || "#38bdf8" }}
                            />
                            <span className="truncate">{m.awayTeam?.name || "TBD"}</span>
                          </div>
                          {isAwayWinner ? (
                            <span className="text-[10px] text-emerald-400 font-bold ml-1">✓ WIN</span>
                          ) : null}
                        </div>

                        {/* Result summary or Venue */}
                        {m.resultSummary ? (
                          <p className="mt-2 text-[10px] text-emerald-300 font-medium truncate pt-1 border-t border-white/5">
                            {m.resultSummary}
                          </p>
                        ) : m.venue || m.scheduledAt ? (
                          <div className="mt-2 flex items-center justify-between text-[9px] text-white/40 pt-1 border-t border-white/5">
                            {m.venue ? (
                              <span className="truncate flex items-center gap-1">
                                <MapPin className="h-2.5 w-2.5" /> {m.venue}
                              </span>
                            ) : null}
                            {m.scheduledAt ? (
                              <span>
                                {new Date(m.scheduledAt).toLocaleDateString([], {
                                  month: "short",
                                  day: "numeric",
                                })}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );

                    return (
                      <div key={m.id} className="relative">
                        {m.matchId ? (
                          <Link href={cricketFanMatchPath(tournamentId, m.matchId)} className="block">
                            {cardContent}
                          </Link>
                        ) : (
                          cardContent
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      </div>
      ))}
    </div>
  );
}
