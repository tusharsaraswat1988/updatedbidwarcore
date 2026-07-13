/**
 * Champion celebration card — surfaced when a category is finished.
 * Shows Team → Player when auction franchise data exists on the winner.
 */

import { Trophy } from "lucide-react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";
import { hubCardClass } from "@/components/badminton/page-chrome";
import { TeamPlayerCard } from "@/components/badminton/team-player-card";
import { badmintonMatchControlPath } from "@/lib/badminton-routes";
import type { ChampionInfo } from "@/lib/badminton-results";

export function ChampionCard({
  champion,
  tournamentId,
}: {
  champion: ChampionInfo;
  tournamentId: number;
}) {
  return (
    <div
      className={cn(
        hubCardClass,
        "p-5 border-amber-500/35 bg-gradient-to-br from-amber-500/15 via-amber-500/5 to-transparent",
      )}
    >
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center flex-none">
          <Trophy className="h-6 w-6 text-amber-300" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-amber-200/80 text-[10px] font-bold uppercase tracking-[0.2em]">
            Champion
          </p>
          <p className="text-white/50 text-sm mt-0.5">{champion.categoryName}</p>
          <div className="mt-2">
            <TeamPlayerCard
              identity={{
                playerName: champion.winnerLabel,
                teamName: champion.winnerTeamName,
                teamLogoUrl: champion.winnerTeamLogoUrl,
                teamColor: champion.winnerTeamColor,
              }}
              size="lg"
              tone="muted"
              layout="stack"
              playerClassName="text-white font-bold text-2xl sm:text-3xl"
              teamClassName="text-amber-200/80"
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="text-white/55">{champion.roundLabel}</span>
            <span className="text-emerald-300 font-semibold">{champion.gamesWonLine}</span>
            {champion.outcomeLabel !== "Completed" ? (
              <span className="text-amber-200/70 text-xs">{champion.outcomeLabel}</span>
            ) : null}
          </div>
          {champion.gameScoreLines.length > 0 ? (
            <p className="text-white/40 text-sm mt-1 font-mono tracking-wide">
              Final score · {champion.gameScoreLines.join("  ·  ")}
            </p>
          ) : (
            <p className="text-white/40 text-sm mt-1 font-mono tracking-wide">
              Final score · {champion.gamesWonLine}
            </p>
          )}
          <Link
            href={badmintonMatchControlPath(tournamentId, champion.matchId)}
            className="inline-block mt-3 text-[#4fc3f7] text-xs font-semibold hover:underline"
          >
            View match
          </Link>
        </div>
      </div>
    </div>
  );
}
