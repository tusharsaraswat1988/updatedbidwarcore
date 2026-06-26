import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicMatchScorecard } from "@/lib/scoring-api";
import { ScorecardView } from "@/components/scoring/scorecard-view";
import { ArrowLeft } from "lucide-react";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { ShareButtons } from "@/components/scoring/share-buttons";
import {
  CricketEmptyState,
  CricketLoadingShell,
  CricketPublicShell,
} from "@/components/scoring/cricket-page-chrome";

export default function ScoringMatchPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/match/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId),
    enabled: !!tournamentId && !!matchId,
    refetchInterval: (query) => {
      const status = query.state.data?.match?.status;
      return status === "live" ? 10000 : false;
    },
  });

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournamentId}/cricket/match/${matchId}`
      : "";

  if (isLoading) return <CricketLoadingShell lines={2} />;

  if (error || !data) {
    return (
      <CricketEmptyState message="Scorecard not available.">
        <Link href={cricketPublicPath(tournamentId)} className="text-primary hover:underline text-sm mt-4 inline-block">
          Back to tournament
        </Link>
      </CricketEmptyState>
    );
  }

  return (
    <CricketPublicShell>
      <Link
        href={cricketPublicPath(tournamentId)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Tournament
      </Link>
      {pageUrl ? (
        <div className="mb-4">
          <ShareButtons
            url={pageUrl}
            shareText={`${data.match.homeTeam?.name ?? "Home"} vs ${data.match.awayTeam?.name ?? "Away"} — scorecard`}
            compact
          />
        </div>
      ) : null}
      <ScorecardView data={data} tournamentId={tournamentId} />
    </CricketPublicShell>
  );
}
