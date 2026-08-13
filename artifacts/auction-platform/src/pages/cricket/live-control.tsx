/**
 * Cricket Live Control — organizer match-day board (scoreboard, OBS, queues).
 * Scoring stays on Scorer. Route: /tournament/:id/score/live-control
 */
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { scoringAppPublicUrl } from "@workspace/api-base/scoring-urls";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  BtnPrimary,
  BtnSecondary,
  EmptyState,
  HubSectionHeader,
  PageHeader,
  btnCompactClass,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useScoringMatches } from "@/hooks/use-scoring-match";
import { getCricketMasterTeams, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { cricketMasterTeamToScorerTeam } from "@/lib/scoring-squad";
import { useToast } from "@/hooks/use-toast";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import {
  cricketMatchCenterPath,
  cricketScoreHubPath,
  cricketScorerPath,
} from "@/lib/cricket-routes";
import {
  cricketObsLivePath,
  cricketObsMatchPath,
  openScoreDisplay,
} from "@/lib/tournament-navigation";
import {
  Copy,
  Monitor,
  Radio,
  RefreshCw,
  Tv,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

function statusBadgeVariant(status: string): "default" | "destructive" | "secondary" | "outline" {
  if (status === "live") return "destructive";
  if (status === "completed") return "secondary";
  if (status === "abandoned") return "outline";
  return "default";
}

export default function CricketLiveControlPage() {
  const [, params] = useRoute("/tournament/:id/score/live-control");
  const tournamentId = parseInt(params?.id || "0", 10);
  const { toast } = useToast();

  const { data: tournament, isLoading: tournamentLoading } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const { data: matches, isLoading, isFetching, refetch } = useScoringMatches(
    tournamentId,
    scoringActive,
  );

  const { data: masterTeams } = useQuery({
    queryKey: ["cricket-master-teams", tournamentId],
    queryFn: () => getCricketMasterTeams(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });
  const teams = useMemo(
    () => (masterTeams ?? []).map(cricketMasterTeamToScorerTeam),
    [masterTeams],
  );
  const teamMap = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  const live = useMemo(
    () => (matches ?? []).filter((m) => m.status === "live"),
    [matches],
  );
  const upcoming = useMemo(
    () =>
      (matches ?? []).filter(
        (m) => m.status !== "live" && !isTerminalCricketMatchStatus(m.status),
      ),
    [matches],
  );
  const recent = useMemo(
    () =>
      (matches ?? [])
        .filter((m) => isTerminalCricketMatchStatus(m.status))
        .slice(0, 6),
    [matches],
  );

  function teamLabel(id: number) {
    const t = teamMap.get(id);
    return t?.shortCode ?? t?.name ?? `Team ${id}`;
  }

  function copyScorerLink(matchId: number) {
    const path = cricketScorerPath(tournamentId, matchId);
    const url =
      typeof window !== "undefined"
        ? scoringAppPublicUrl(window.location.origin, path)
        : path;
    void navigator.clipboard.writeText(url).then(
      () => toast({ title: "Scorer link copied" }),
      () => toast({ title: "Could not copy link", variant: "destructive" }),
    );
  }

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  if (!scoringActive && !tournamentLoading) {
    return (
      <CricketOrganizerPageShell tournamentId={tournamentId}>
        <PageHeader
          tournamentId={tournamentId}
          eyebrow="Match day"
          title="Live Control"
          subtitle="Scoreboard, OBS, and match queues."
        />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10">
          <EmptyState
            icon={AlertTriangle}
            title="Cricket scoring is off"
            desc="Enable scoring for this tournament, then return here."
          />
        </div>
      </CricketOrganizerPageShell>
    );
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Match day"
        title="Live Control"
        subtitle="Control the scoreboard and OBS. Scoring is done on Scorer."
        badge={live.length > 0 ? `${live.length} LIVE` : undefined}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <BtnSecondary
              className={btnCompactClass}
              onClick={() => openScoreDisplay(tournamentId, tournament?.auctionCode)}
            >
              <Monitor className="w-4 h-4" />
              LED / Scoreboard
            </BtnSecondary>
            <BtnSecondary
              className={btnCompactClass}
              onClick={() =>
                window.open(
                  cricketObsLivePath(tournamentId, tournament?.auctionCode),
                  "_blank",
                  "noopener,noreferrer",
                )
              }
            >
              <Tv className="w-4 h-4" />
              Cricket OBS
            </BtnSecondary>
            <BtnSecondary
              className={btnCompactClass}
              disabled={isFetching}
              onClick={() => void refetch()}
            >
              <RefreshCw className={cn("w-4 h-4", isFetching && "animate-spin")} />
              Refresh
            </BtnSecondary>
            <BtnSecondary href={cricketScoreHubPath(tournamentId)} className={btnCompactClass}>
              Matches
            </BtnSecondary>
          </div>
        }
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-12 space-y-8">
        {tournamentLoading || isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
        ) : (
          <>
            <section className={cn(hubPanelClass, "p-4 sm:p-5 space-y-2")}>
              <h2 className="text-sm font-semibold">Displays</h2>
              <p className="text-xs text-muted-foreground">
                LED and OBS follow the live match. Open Scorer only for umpires or assigned scorers.
              </p>
            </section>

            <section>
              <HubSectionHeader
                title="Now live"
                subtitle="In-progress matches"
                badge={live.length > 0 ? String(live.length) : undefined}
              />
              {live.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">No live match yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {live.map((m) => (
                    <MatchOpsCard
                      key={m.id}
                      title={`${teamLabel(m.homeTeamId)} vs ${teamLabel(m.awayTeamId)}`}
                      status={m.status}
                      detail={m.roundName ?? m.venue ?? undefined}
                      scorerHref={cricketScorerPath(tournamentId, m.id)}
                      centerHref={cricketMatchCenterPath(tournamentId, m.id)}
                      obsHref={cricketObsMatchPath(
                        tournamentId,
                        m.id,
                        tournament?.auctionCode,
                      )}
                      onCopyScorer={() => copyScorerLink(m.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section>
              <HubSectionHeader
                title="Upcoming"
                subtitle="Ready to start from Scorer after Match Center setup"
              />
              {upcoming.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">No upcoming matches.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {upcoming.map((m) => (
                    <MatchOpsCard
                      key={m.id}
                      title={`${teamLabel(m.homeTeamId)} vs ${teamLabel(m.awayTeamId)}`}
                      status={m.status}
                      detail={m.roundName ?? m.venue ?? undefined}
                      scorerHref={cricketScorerPath(tournamentId, m.id)}
                      centerHref={cricketMatchCenterPath(tournamentId, m.id)}
                      onCopyScorer={() => copyScorerLink(m.id)}
                    />
                  ))}
                </div>
              )}
            </section>

            {recent.length > 0 ? (
              <section>
                <HubSectionHeader title="Recently completed" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                  {recent.map((m) => (
                    <Link
                      key={m.id}
                      href={cricketMatchCenterPath(tournamentId, m.id)}
                      className={cn(hubCardClass, "p-4 block hover:border-primary/30")}
                    >
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <Badge variant={statusBadgeVariant(m.status)} className="capitalize">
                          {m.status}
                        </Badge>
                      </div>
                      <p className="font-semibold">
                        {teamLabel(m.homeTeamId)} vs {teamLabel(m.awayTeamId)}
                      </p>
                      {m.resultSummary ? (
                        <p className="text-sm text-muted-foreground mt-1">{m.resultSummary}</p>
                      ) : null}
                    </Link>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}

function MatchOpsCard({
  title,
  status,
  detail,
  scorerHref,
  centerHref,
  obsHref,
  onCopyScorer,
}: {
  title: string;
  status: string;
  detail?: string;
  scorerHref: string;
  centerHref: string;
  obsHref?: string;
  onCopyScorer: () => void;
}) {
  return (
    <div className={cn(hubCardClass, "p-4 space-y-3")}>
      <div className="flex items-center justify-between gap-2">
        <Badge variant={statusBadgeVariant(status)} className="capitalize">
          {status}
        </Badge>
      </div>
      <p className="font-display font-bold text-lg">{title}</p>
      {detail ? <p className="text-xs text-muted-foreground">{detail}</p> : null}
      <div className="flex flex-wrap gap-2">
        <BtnPrimary href={scorerHref} className={btnCompactClass}>
          <Radio className="w-4 h-4" />
          Open Scorer
        </BtnPrimary>
        <BtnSecondary href={centerHref} className={btnCompactClass}>
          Match Center
        </BtnSecondary>
        {obsHref ? (
          <BtnSecondary
            className={btnCompactClass}
            onClick={() => window.open(obsHref, "_blank", "noopener,noreferrer")}
          >
            <Tv className="w-4 h-4" />
            OBS
          </BtnSecondary>
        ) : null}
        <BtnSecondary className={btnCompactClass} onClick={onCopyScorer}>
          <Copy className="w-4 h-4" />
          Copy scorer link
        </BtnSecondary>
      </div>
    </div>
  );
}
