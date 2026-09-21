import { useMemo } from "react";
import { Link } from "wouter";
import { Trophy, Calendar, MapPin, CircleDot, ArrowRight, Shield } from "lucide-react";
import type { PublicFixture, PublicMatch, PublicTeam } from "@/lib/public-tournament-types";
import { cricketFanMatchPath } from "@/lib/tournament-navigation";
import { cn } from "@/lib/utils";

interface TournamentBracketTreeProps {
  tournamentId: number;
  fixtures: PublicFixture[];
  matches: PublicMatch[];
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
  teamMap,
  tournamentName,
}: TournamentBracketTreeProps) {
  // Normalize matches map for quick lookup
  const matchMap = useMemo(() => {
    const map = new Map<number, PublicMatch>();
    matches.forEach((m) => map.set(m.id, m));
    return map;
  }, [matches]);

  // Derive bracket rounds from fixtures or matches
  const rounds = useMemo(() => {
    const nodes: BracketMatchNode[] = [];

    // 1. Try from fixtures with bracketRound
    const bracketFixtures = fixtures.filter((f) => f.bracketRound != null && f.bracketRound > 0);

    if (bracketFixtures.length > 0) {
      bracketFixtures.forEach((f) => {
        const correspondingMatch = matches.find(
          (m) =>
            (m.homeTeamId === f.homeTeamId && m.awayTeamId === f.awayTeamId) ||
            m.roundName === f.roundName,
        );

        nodes.push({
          id: `fixture-${f.id}`,
          matchId: correspondingMatch?.id,
          roundName: f.roundName || `Round ${f.bracketRound}`,
          roundOrder: f.bracketRound ?? 1,
          slotIndex: f.bracketSlot ?? 1,
          homeTeam: teamMap.get(f.homeTeamId) ?? null,
          awayTeam: teamMap.get(f.awayTeamId) ?? null,
          winnerTeamId: f.winnerTeamId ?? correspondingMatch?.winnerTeamId,
          status: correspondingMatch?.status ?? f.status ?? "scheduled",
          resultSummary: f.resultSummary ?? correspondingMatch?.resultSummary,
          scheduledAt: f.scheduledAt ?? correspondingMatch?.scheduledAt,
          venue: f.venue ?? correspondingMatch?.venue,
        });
      });
    } else {
      // 2. Fallback: Identify knockout / playoff rounds by name from matches
      const playoffKeywords = ["final", "semi", "quarter", "eliminator", "qualifier", "playoff"];
      const playoffMatches = matches.filter((m) =>
        playoffKeywords.some((k) => (m.roundName || "").toLowerCase().includes(k)),
      );

      if (playoffMatches.length > 0) {
        playoffMatches.forEach((m, idx) => {
          const rName = (m.roundName || "Playoff").toLowerCase();
          let order = 1;
          if (rName.includes("quarter")) order = 1;
          else if (rName.includes("semi") || rName.includes("qualifier") || rName.includes("eliminator")) order = 2;
          else if (rName.includes("final")) order = 3;

          nodes.push({
            id: `match-${m.id}`,
            matchId: m.id,
            roundName: m.roundName || "Knockout",
            roundOrder: order,
            slotIndex: idx + 1,
            homeTeam: teamMap.get(m.homeTeamId) ?? null,
            awayTeam: teamMap.get(m.awayTeamId) ?? null,
            winnerTeamId: m.winnerTeamId,
            status: m.status,
            resultSummary: m.resultSummary,
            scheduledAt: m.scheduledAt,
            venue: m.venue,
          });
        });
      } else {
        // 3. If tournament is early or round-robin, group existing matches into stages
        const groupMatches = matches.slice(0, 8);
        groupMatches.forEach((m, idx) => {
          nodes.push({
            id: `match-${m.id}`,
            matchId: m.id,
            roundName: m.roundName || `Matchday ${idx + 1}`,
            roundOrder: Math.floor(idx / 2) + 1,
            slotIndex: (idx % 2) + 1,
            homeTeam: teamMap.get(m.homeTeamId) ?? null,
            awayTeam: teamMap.get(m.awayTeamId) ?? null,
            winnerTeamId: m.winnerTeamId,
            status: m.status,
            resultSummary: m.resultSummary,
            scheduledAt: m.scheduledAt,
            venue: m.venue,
          });
        });
      }
    }

    // Group nodes into distinct rounds ordered by roundOrder
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
  }, [fixtures, matches, teamMap]);

  if (rounds.length === 0) {
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

      {/* Horizontal scrolling tree canvas */}
      <div className="overflow-x-auto pb-4 pt-2 scrollbar-thin scrollbar-thumb-white/15">
        <div className="flex items-stretch gap-6 sm:gap-8 min-w-[700px]">
          {rounds.map((round, rIdx) => {
            const isFinalRound = rIdx === rounds.length - 1;

            return (
              <div
                key={`round-${round.order}`}
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
  );
}
