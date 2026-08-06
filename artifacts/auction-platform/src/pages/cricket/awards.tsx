/**
 * Cricket Awards — MoM board + tournament awards from leaderboards.
 * Route: /tournament/:id/score/awards
 */
import { useMemo } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  useGetTournament,
  getGetTournamentQueryKey,
} from "@workspace/api-client-react";
import { CricketOrganizerPageShell } from "@/components/scoring/cricket-page-chrome";
import {
  EmptyState,
  HubSectionHeader,
  PageHeader,
  hubCardClass,
  hubPanelClass,
} from "@/components/badminton/page-chrome";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getScoringLeaderboard,
  listScoringAwards,
  type ScoringAwardRow,
  type ScoringLeaderboardRow,
} from "@/lib/scoring-api";
import { useCricketScoringActive } from "@/hooks/use-platform-features";
import { CricketScoringSportRedirect } from "@/components/scoring/cricket-scoring-sport-redirect";
import { cricketMatchPublicPath } from "@/lib/tournament-navigation";
import { Award, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

type DerivedAward = {
  id: string;
  title: string;
  playerName: string;
  teamName: string;
  detail: string;
};

function topAward(
  id: string,
  title: string,
  row: ScoringLeaderboardRow | undefined,
  unit: string,
): DerivedAward | null {
  if (!row) return null;
  return {
    id,
    title,
    playerName: row.playerName,
    teamName: row.shortCode || row.teamName,
    detail: `${row.value} ${unit}`,
  };
}

function potFromMoms(moms: ScoringAwardRow[]): DerivedAward | null {
  if (moms.length === 0) return null;
  const counts = new Map<number, { count: number; name: string; team: string }>();
  for (const a of moms) {
    const cur = counts.get(a.playerId) ?? {
      count: 0,
      name: a.playerName,
      team: a.shortCode || a.teamName,
    };
    cur.count += 1;
    counts.set(a.playerId, cur);
  }
  let best: { playerId: number; count: number; name: string; team: string } | null = null;
  for (const [playerId, v] of counts) {
    if (!best || v.count > best.count) {
      best = { playerId, ...v };
    }
  }
  if (!best) return null;
  return {
    id: "pot",
    title: "Player of the Tournament",
    playerName: best.name,
    teamName: best.team,
    detail: `${best.count} Player of the Match award${best.count === 1 ? "" : "s"}`,
  };
}

export default function CricketAwardsPage() {
  const [, params] = useRoute("/tournament/:id/score/awards");
  const tournamentId = parseInt(params?.id || "0");

  const { data: tournament } = useGetTournament(tournamentId, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId), enabled: !!tournamentId },
  });
  const scoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);

  const { data: moms, isLoading: momsLoading } = useQuery({
    queryKey: ["scoring-awards", tournamentId],
    queryFn: () => listScoringAwards(tournamentId),
    enabled: scoringActive && !!tournamentId,
  });

  const { data: runs } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "runs"],
    queryFn: () => getScoringLeaderboard(tournamentId, "runs", 5),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: wickets } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "wickets"],
    queryFn: () => getScoringLeaderboard(tournamentId, "wickets", 5),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: sixes } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "sixes"],
    queryFn: () => getScoringLeaderboard(tournamentId, "sixes", 3),
    enabled: scoringActive && !!tournamentId,
  });
  const { data: strikeRate } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, "strike_rate"],
    queryFn: () => getScoringLeaderboard(tournamentId, "strike_rate", 3),
    enabled: scoringActive && !!tournamentId,
  });

  const tournamentAwards = useMemo(() => {
    const list: DerivedAward[] = [];
    const pot = potFromMoms(moms ?? []);
    if (pot) list.push(pot);
    const batter = topAward("best-batter", "Best Batter", runs?.[0], "runs");
    if (batter) list.push(batter);
    const bowler = topAward("best-bowler", "Best Bowler", wickets?.[0], "wickets");
    if (bowler) list.push(bowler);
    const emerging = topAward("emerging", "Emerging Player", strikeRate?.[0], "SR");
    if (emerging) list.push(emerging);
    const bigHitter = topAward("sixes", "Most Sixes", sixes?.[0], "sixes");
    if (bigHitter) list.push(bigHitter);
    return list;
  }, [moms, runs, wickets, sixes, strikeRate]);

  if (tournament?.sport === "badminton") {
    return <CricketScoringSportRedirect tournamentId={tournamentId} sport={tournament.sport} />;
  }

  return (
    <CricketOrganizerPageShell tournamentId={tournamentId}>
      <PageHeader
        tournamentId={tournamentId}
        eyebrow="Cricket Operations"
        title="Awards"
        subtitle="Player of the Match and tournament leaders"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-10 space-y-8">
        {!scoringActive ? (
          <EmptyState icon={Trophy} title="Cricket scoring is off" desc="Enable scoring to view awards." />
        ) : momsLoading ? (
          <Skeleton className="h-48 w-full rounded-xl" />
        ) : (
          <>
            <section>
              <HubSectionHeader
                title="Tournament awards"
                subtitle="Derived from completed matches and leaderboards"
              />
              {tournamentAwards.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">
                  Awards appear after matches are completed.
                </p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-3">
                  {tournamentAwards.map((a) => (
                    <div key={a.id} className={cn(hubCardClass, "p-4")}>
                      <div className="flex items-center gap-2 text-primary mb-2">
                        <Award className="w-4 h-4" />
                        <p className="text-xs font-bold uppercase tracking-wider">{a.title}</p>
                      </div>
                      <p className="font-display font-bold text-lg text-foreground">{a.playerName}</p>
                      <p className="text-sm text-muted-foreground">{a.teamName}</p>
                      <p className="text-xs text-muted-foreground mt-1">{a.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section>
              <HubSectionHeader
                title="Players of the Match"
                subtitle={`${moms?.length ?? 0} award${(moms?.length ?? 0) === 1 ? "" : "s"}`}
              />
              {(moms?.length ?? 0) === 0 ? (
                <p className="text-sm text-muted-foreground mt-3">No Man of the Match awards yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {(moms ?? []).map((a) => (
                    <li key={a.id} className={cn(hubPanelClass, "flex items-center justify-between gap-3")}>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{a.playerName}</p>
                        <p className="text-xs text-muted-foreground">
                          {a.shortCode || a.teamName}
                          {a.reason ? ` · ${a.reason}` : ""}
                        </p>
                      </div>
                      <Link
                        href={cricketMatchPublicPath(tournamentId, a.matchId)}
                        className="text-xs font-semibold text-primary shrink-0"
                      >
                        Match
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </CricketOrganizerPageShell>
  );
}
