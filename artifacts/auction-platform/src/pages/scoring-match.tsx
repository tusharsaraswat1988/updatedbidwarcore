/**
 * Cricket Scorer Redirect — organizer view for /tournament/:id/score/:matchId/live
 *
 * The scoring pad has been permanently migrated to the Dedicated Scorer (Empire) model.
 * Organizers can no longer score from this page.
 *
 * This page shows organizers:
 * - A clear explanation that scoring has moved
 * - The direct link to the dedicated scorer console for this match
 * - A "Copy Scorer Link" button to share with the assigned Empire scorer
 */
import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CricketOrganizerPageShell,
  PageHeader,
} from "@/components/scoring/cricket-page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { getCricketMasterTeams } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { cricketScorerConsolePath, cricketMatchCenterPath } from "@/lib/cricket-routes";
import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Copy, Radio, ShieldCheck } from "lucide-react";
import { useMemo } from "react";

export default function ScoringMatchPage() {
  const [, params] = useRoute("/tournament/:id/score/:matchId/live");
  const tournamentId = parseInt(params?.id || "0");
  const matchId = parseInt(params?.matchId || "0");
  const { toast } = useToast();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const teams = useMemo(
    () => (Array.isArray(masterTeams) ? masterTeams.map(cricketMasterTeamToScorerTeam) : []),
    [masterTeams],
  );
  const home = teams.find((t) => t.id === undefined); // resolved after match load
  void home; // unused but avoids unused-var lint

  const scorerConsoleUrl = cricketScorerConsolePath(tournamentId, matchId);
  const scorerFullUrl =
    typeof window !== "undefined"
      ? scoringAppPublicUrl(window.location.origin, scorerConsoleUrl)
      : scorerConsoleUrl;

  const matchCenterHref = cricketMatchCenterPath(tournamentId, matchId);

  function copyLink() {
    void navigator.clipboard.writeText(scorerFullUrl).then(
      () => toast({ title: "Scorer link copied" }),
      () => toast({ title: "Could not copy link", variant: "destructive" }),
    );
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (tournamentLoading) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Match"
        title="Empire Scorer"
        subtitle={tournament?.name}
        actions={
          <Button variant="outline" size="sm" asChild>
            <a href={matchCenterHref}>
              <ArrowLeft className="w-4 h-4 mr-1" />
              Match Center
            </a>
          </Button>
        }
      />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-16 space-y-6">
        {/* Explanation card */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 space-y-3">
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-7 h-7 text-primary shrink-0" />
            <div>
              <h2 className="font-bold text-base">Scoring has moved to Empire Scorer</h2>
              <p className="text-sm text-muted-foreground">
                Cricket scoring is now exclusively done by the assigned Dedicated Scorer (Empire).
                Organizers cannot score from this page.
              </p>
            </div>
          </div>
        </div>

        {/* Action card */}
        <div className="rounded-xl border bg-card p-6 space-y-4">
          <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wide">
            Open Scorer Console
          </h3>
          <p className="text-sm text-muted-foreground">
            Share this link with the assigned Empire Scorer. They will log in with their
            mobile number and PIN, acquire the match lock, and begin scoring.
          </p>

          <div className="rounded-lg bg-muted/60 border px-3 py-2 text-xs font-mono text-muted-foreground break-all select-all">
            {scorerFullUrl}
          </div>

          <div className="flex flex-wrap gap-3">
            <Button
              asChild
              className="gap-2"
            >
              <a href={scorerConsoleUrl} target="_blank" rel="noopener noreferrer">
                <Radio className="w-4 h-4" />
                Open Scorer Console
              </a>
            </Button>
            <Button variant="outline" className="gap-2" onClick={copyLink}>
              <Copy className="w-4 h-4" />
              Copy Link
            </Button>
          </div>
        </div>

        {/* Info note */}
        <p className="text-xs text-muted-foreground">
          To manage scorer accounts and assignments, go to{" "}
          <a href={matchCenterHref} className="underline underline-offset-2 hover:text-foreground">
            Match Center
          </a>
          .
        </p>
      </div>
    </CricketOrganizerPageShell>
  );
}
