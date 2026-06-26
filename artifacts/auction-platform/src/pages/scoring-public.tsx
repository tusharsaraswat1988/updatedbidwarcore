import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringLeaderboard, getScoringStandings, isTerminalCricketMatchStatus } from "@/lib/scoring-api";
import { StandingsTable } from "@/components/scoring/standings-table";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { CircleDot } from "lucide-react";
import { cricketMatchPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";
import { ShareButtons } from "@/components/scoring/share-buttons";
import {
  CricketEmptyState,
  CricketFilterPill,
  CricketLoadingShell,
  CricketPublicPageHeader,
  CricketPublicShell,
  cricketCardClass,
  cricketEyebrowClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import { cn } from "@/lib/utils";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const LEADERBOARD_TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

function statusBadge(status: string) {
  if (status === "live") return "text-emerald-400";
  if (isTerminalCricketMatchStatus(status)) return "text-muted-foreground";
  return "text-primary";
}

export default function ScoringPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket");
  const tournamentId = parseInt(params?.id || "0");
  const [lbTab, setLbTab] = useState<LeaderboardCategory>("runs");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: (query) => {
      const matches = query.state.data?.matches ?? [];
      const hasLive = matches.some((m: { status: string }) => m.status === "live");
      return hasLive ? 20000 : 60000;
    },
  });

  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, lbTab],
    queryFn: () => getScoringLeaderboard(tournamentId, lbTab, 15),
    enabled: !!tournamentId,
    refetchInterval: 30000,
  });

  type PublicTeam = { id: number; name: string; shortCode: string; color: string | null };

  const teamMap = useMemo(
    () => new Map(((data?.teams ?? []) as PublicTeam[]).map((t) => [t.id, t])),
    [data?.teams],
  );

  const liveMatches = (data?.matches ?? []).filter((m: { status: string }) => m.status === "live");
  const upcoming = (data?.matches ?? []).filter((m: { status: string }) => m.status === "scheduled");
  const completed = (data?.matches ?? []).filter((m: { status: string }) =>
    isTerminalCricketMatchStatus(m.status),
  );

  const activeLb = LEADERBOARD_TABS.find((t) => t.key === lbTab);
  const pageUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tournament/${tournamentId}/cricket` : "";
  const shareTitle = data?.tournament?.name ?? "Cricket tournament";

  if (isLoading) return <CricketLoadingShell lines={2} />;
  if (error || !data?.tournament) return <CricketEmptyState message="Tournament scoring not available." />;

  return (
    <CricketPublicShell>
      <CricketPublicPageHeader
        eyebrow="Cricket"
        title={data.tournament.name}
        actions={
          pageUrl ? (
            <ShareButtons url={pageUrl} shareText={`${shareTitle} — live scores & leaderboards`} compact />
          ) : null
        }
      />

      <main className="space-y-8">
        {liveMatches.length > 0 ? (
          <section>
            <h2 className={cn(cricketSectionTitleClass, "mb-3 flex items-center gap-2 text-emerald-400")}>
              <CircleDot className="h-4 w-4 animate-pulse" />
              Live
            </h2>
            <ul className="space-y-2">
              {liveMatches.map((m: { id: number; homeTeamId: number; awayTeamId: number }) => (
                <li key={m.id}>
                  <Link
                    href={`/tournament/${tournamentId}/score-display`}
                    className={cn(
                      cricketCardClass,
                      "block border-emerald-500/30 bg-emerald-500/5 px-4 py-3 hover:bg-emerald-500/10 transition-colors",
                    )}
                  >
                    <span className="font-medium text-foreground">
                      {teamMap.get(m.homeTeamId)?.name ?? "Home"} vs{" "}
                      {teamMap.get(m.awayTeamId)?.name ?? "Away"}
                    </span>
                    <span className="text-xs text-emerald-400 ml-2">LIVE</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Matches</h2>
          <ul className="space-y-2">
            {upcoming.slice(0, 8).map(
              (m: {
                id: number;
                homeTeamId: number;
                awayTeamId: number;
                status: string;
                roundName: string | null;
                scheduledAt: string | null;
              }) => (
                <li key={m.id} className={cn(cricketCardClass, "px-4 py-3 bg-card/50")}>
                  <div className="font-medium text-foreground">
                    {teamMap.get(m.homeTeamId)?.name ?? "Home"} vs{" "}
                    {teamMap.get(m.awayTeamId)?.name ?? "Away"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className={statusBadge(m.status)}>{m.status}</span>
                    {m.roundName ? ` · ${m.roundName}` : ""}
                    {m.scheduledAt ? ` · ${new Date(m.scheduledAt).toLocaleString()}` : ""}
                  </div>
                </li>
              ),
            )}
            {upcoming.length === 0 && liveMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matches scheduled yet.</p>
            ) : null}
          </ul>
        </section>

        {completed.length > 0 ? (
          <section>
            <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Results</h2>
            <ul className="space-y-2">
              {completed.slice(0, 10).map(
                (m: {
                  id: number;
                  homeTeamId: number;
                  awayTeamId: number;
                  resultSummary: string | null;
                }) => (
                  <li key={m.id}>
                    <Link
                      href={cricketMatchPublicPath(tournamentId, m.id)}
                      className={cn(cricketCardClass, "block px-4 py-3 hover:border-primary/25 transition-colors")}
                    >
                      <div className="font-medium text-foreground">
                        {teamMap.get(m.homeTeamId)?.name ?? "Home"} vs{" "}
                        {teamMap.get(m.awayTeamId)?.name ?? "Away"}
                      </div>
                      {m.resultSummary ? (
                        <p className="text-xs text-muted-foreground mt-1">{m.resultSummary}</p>
                      ) : (
                        <p className={cn("text-xs mt-1", cricketEyebrowClass)}>View scorecard →</p>
                      )}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Player stats</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {LEADERBOARD_TABS.map((tab) => (
              <CricketFilterPill key={tab.key} active={lbTab === tab.key} onClick={() => setLbTab(tab.key)}>
                {tab.label}
              </CricketFilterPill>
            ))}
          </div>
          <LeaderboardTable
            rows={leaderboard ?? []}
            valueLabel={activeLb?.valueLabel}
            tournamentId={tournamentId}
          />
        </section>

        {standings && standings.length > 0 ? (
          <section>
            <h2 className={cn(cricketSectionTitleClass, "mb-3")}>Points table</h2>
            <StandingsTable rows={standings} />
          </section>
        ) : null}
      </main>
    </CricketPublicShell>
  );
}
