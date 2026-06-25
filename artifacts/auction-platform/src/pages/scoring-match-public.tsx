import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicMatchScorecard } from "@/lib/scoring-api";
import { ScorecardView } from "@/components/scoring/scorecard-view";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft } from "lucide-react";
import { cricketPublicPath } from "@/lib/tournament-navigation";
import { ShareButtons } from "@/components/scoring/share-buttons";

export default function ScoringMatchPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/match/:matchId");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-scorecard", tournamentId, matchId],
    queryFn: () => getPublicMatchScorecard(tournamentId, matchId),
    enabled: !!tournamentId && !!matchId,
  });

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournamentId}/cricket/match/${matchId}`
      : "";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-foreground">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Skeleton className="h-8 w-48 bg-white/10" />
          <Skeleton className="h-64 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex flex-col items-center justify-center gap-4 text-muted-foreground">
        <p>Scorecard not available.</p>
        <Link href={cricketPublicPath(tournamentId)} className="text-amber-400 hover:underline text-sm">
          Back to tournament
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6">
        <Link
          href={cricketPublicPath(tournamentId)}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white mb-4"
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
      </div>
    </div>
  );
}
