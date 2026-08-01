/**
 * Public match-points summary for franchise owners / share links.
 * Route: /badminton/standings?tid={tournamentId}
 */

import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { FullscreenLayout } from "@/components/fullscreen-layout";
import { BadmintonPublicBrandMark } from "@/components/badminton/bidwar-badminton-branding";
import { MatchPointsSummary } from "@/components/badminton/match-points-summary";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { useBadmintonLeaderboardBoards } from "@/hooks/use-badminton-leaderboard-boards";
import { fetchBadmintonMatches } from "@/lib/badminton-api";
import type { ResultsMatch } from "@/lib/badminton-results";

export default function BadmintonPublicStandingsPage() {
  const search = useSearch();
  const tournamentId = parseInt(new URLSearchParams(search).get("tid") ?? "0", 10);

  const { data: branding } = useBadmintonBranding(tournamentId > 0 ? tournamentId : 0);
  const tournamentName =
    branding?.displayName ?? (tournamentId > 0 ? `Tournament #${tournamentId}` : "Badminton");

  const leaderboards = useBadmintonLeaderboardBoards(tournamentId, tournamentId > 0);
  const { data: matches = [], isLoading: matchesLoading } = useQuery<ResultsMatch[]>({
    queryKey: ["badminton-matches", tournamentId],
    queryFn: () => fetchBadmintonMatches(tournamentId),
    enabled: tournamentId > 0,
    staleTime: 15_000,
  });

  if (!tournamentId) {
    return (
      <FullscreenLayout className="lovable-theme">
        <div className="min-h-[100dvh] bg-background flex flex-col items-center justify-center p-6 gap-3">
          <BadmintonPublicBrandMark variant="scorer-bar" />
          <p className="text-white/70 text-sm">Add ?tid= to open standings for a tournament.</p>
        </div>
      </FullscreenLayout>
    );
  }

  return (
    <FullscreenLayout className="lovable-theme">
      <div className="min-h-[100dvh] bg-background flex flex-col">
        <header className="sticky top-0 z-10 border-b border-white/8 bg-background/95 backdrop-blur px-4 py-3">
          <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
            <div className="min-w-0">
              <BadmintonPublicBrandMark variant="scorer-bar" />
              <p className="text-white font-bold text-lg mt-2 truncate">{tournamentName}</p>
              <p className="text-white/40 text-xs mt-0.5">Points table · Recent results</p>
            </div>
          </div>
        </header>
        <main className="flex-1 px-4 py-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          <div className="max-w-lg mx-auto">
            <MatchPointsSummary
              boards={leaderboards.boards}
              matches={matches}
              loading={leaderboards.loading || matchesLoading}
              emptyStandingsHint={
                leaderboards.leagueCategoryCount === 0
                  ? "No league / group events yet. Knockout-only categories do not show a points table here."
                  : undefined
              }
            />
          </div>
        </main>
      </div>
    </FullscreenLayout>
  );
}
