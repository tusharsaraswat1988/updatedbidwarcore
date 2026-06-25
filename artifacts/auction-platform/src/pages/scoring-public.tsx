import { useMemo, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { getPublicSchedule } from "@/lib/scoring-foundation-api";
import { getScoringLeaderboard, getScoringStandings } from "@/lib/scoring-api";
import { StandingsTable } from "@/components/scoring/standings-table";
import { LeaderboardTable } from "@/components/scoring/leaderboard-table";
import { Skeleton } from "@/components/ui/skeleton";
import { CircleDot } from "lucide-react";
import { cricketMatchPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";
import { ShareButtons } from "@/components/scoring/share-buttons";
import type { LeaderboardCategory } from "@workspace/scoring-core";

const LEADERBOARD_TABS: { key: LeaderboardCategory; label: string; valueLabel: string }[] = [
  { key: "runs", label: "Runs", valueLabel: "Runs" },
  { key: "wickets", label: "Wickets", valueLabel: "Wkts" },
  { key: "sixes", label: "Sixes", valueLabel: "6s" },
  { key: "fours", label: "Fours", valueLabel: "4s" },
];

function statusBadge(status: string) {
  if (status === "live") return "text-emerald-400";
  if (status === "completed") return "text-muted-foreground";
  return "text-amber-400/90";
}

export default function ScoringPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket");
  const tournamentId = parseInt(params?.id || "0");
  const [lbTab, setLbTab] = useState<LeaderboardCategory>("runs");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-public", tournamentId],
    queryFn: () => getPublicSchedule(tournamentId),
    enabled: !!tournamentId,
  });

  const { data: standings } = useQuery({
    queryKey: ["scoring-standings", tournamentId],
    queryFn: () => getScoringStandings(tournamentId),
    enabled: !!tournamentId,
  });

  const { data: leaderboard } = useQuery({
    queryKey: ["scoring-leaderboard", tournamentId, lbTab],
    queryFn: () => getScoringLeaderboard(tournamentId, lbTab, 15),
    enabled: !!tournamentId,
  });

  type PublicTeam = { id: number; name: string; shortCode: string; color: string | null };

  const teamMap = useMemo(
    () => new Map(((data?.teams ?? []) as PublicTeam[]).map((t) => [t.id, t])),
    [data?.teams],
  );

  const liveMatches = (data?.matches ?? []).filter((m: { status: string }) => m.status === "live");
  const upcoming = (data?.matches ?? []).filter((m: { status: string }) => m.status === "scheduled");
  const completed = (data?.matches ?? []).filter((m: { status: string }) => m.status === "completed");

  const activeLb = LEADERBOARD_TABS.find((t) => t.key === lbTab);
  const pageUrl =
    typeof window !== "undefined" ? `${window.location.origin}/tournament/${tournamentId}/cricket` : "";
  const shareTitle = data?.tournament?.name ?? "Cricket tournament";

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] text-foreground">
        <div className="max-w-3xl mx-auto p-6 space-y-4">
          <Skeleton className="h-10 w-64 bg-white/10" />
          <Skeleton className="h-32 w-full bg-white/10" />
        </div>
      </div>
    );
  }

  if (error || !data?.tournament) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center text-muted-foreground">
        Tournament scoring not available.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <header className="border-b border-white/10 bg-gradient-to-b from-[#121a2e] to-transparent">
        <div className="max-w-3xl mx-auto px-4 py-8">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80 mb-2">Cricket</p>
          <h1 className="text-3xl font-bold tracking-tight text-white">{data.tournament.name}</h1>
          {pageUrl ? (
            <div className="pt-3">
              <ShareButtons url={pageUrl} shareText={`${shareTitle} — live scores & leaderboards`} compact />
            </div>
          ) : null}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-8">
        {liveMatches.length > 0 ? (
          <section>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-emerald-400 mb-3 flex items-center gap-2">
              <CircleDot className="h-4 w-4 animate-pulse" />
              Live
            </h2>
            <ul className="space-y-2">
              {liveMatches.map((m: { id: number; homeTeamId: number; awayTeamId: number }) => (
                <li key={m.id}>
                  <Link
                    href={`/tournament/${tournamentId}/score-display`}
                    className="block rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 hover:bg-emerald-500/10 transition-colors"
                  >
                    <span className="font-medium text-white">
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
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Matches
          </h2>
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
                <li
                  key={m.id}
                  className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                >
                  <div className="font-medium text-white/95">
                    {teamMap.get(m.homeTeamId)?.name ?? "Home"} vs{" "}
                    {teamMap.get(m.awayTeamId)?.name ?? "Away"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    <span className={statusBadge(m.status)}>{m.status}</span>
                    {m.roundName ? ` · ${m.roundName}` : ""}
                    {m.scheduledAt
                      ? ` · ${new Date(m.scheduledAt).toLocaleString()}`
                      : ""}
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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Results
            </h2>
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
                      className="block rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 hover:bg-white/[0.06] transition-colors"
                    >
                      <div className="font-medium text-white/95">
                        {teamMap.get(m.homeTeamId)?.name ?? "Home"} vs{" "}
                        {teamMap.get(m.awayTeamId)?.name ?? "Away"}
                      </div>
                      {m.resultSummary ? (
                        <p className="text-xs text-muted-foreground mt-1">{m.resultSummary}</p>
                      ) : (
                        <p className="text-xs text-amber-400/80 mt-1">View scorecard →</p>
                      )}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </section>
        ) : null}

        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Player stats
          </h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {LEADERBOARD_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setLbTab(tab.key)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  lbTab === tab.key
                    ? "bg-amber-500/20 text-amber-300"
                    : "bg-white/5 text-muted-foreground hover:text-white"
                }`}
              >
                {tab.label}
              </button>
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
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
              Points table
            </h2>
            <StandingsTable rows={standings} />
          </section>
        ) : null}
      </main>
    </div>
  );
}
