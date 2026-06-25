import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentTeamProfile } from "@/lib/scoring-api";
import { cricketPlayerPublicPath, cricketPublicPath } from "@/lib/tournament-navigation";
import {
  CricketEmptyState,
  CricketLoadingShell,
  CricketPublicPageHeader,
  CricketPublicShell,
  cricketCardClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import { cn } from "@/lib/utils";

export default function ScoringTeamPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/team/:teamId");
  const tournamentId = parseInt(params?.id || "0");
  const teamId = parseInt(params?.teamId || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-team-public", tournamentId, teamId],
    queryFn: () => getTournamentTeamProfile(tournamentId, teamId),
    enabled: !!tournamentId && !!teamId,
  });

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournamentId}/cricket/team/${teamId}`
      : "";

  if (isLoading) return <CricketLoadingShell />;
  if (error || !data) return <CricketEmptyState message="Team profile not available." />;

  const { team, standing, squad, recentResults, topBatsmen } = data;

  return (
    <CricketPublicShell>
      <Link
        href={cricketPublicPath(tournamentId)}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        Tournament
      </Link>

      <CricketPublicPageHeader
        eyebrow="Team profile"
        title={team.name}
        subtitle={
          <>
            <p>{team.shortCode}</p>
            {standing ? (
              <p className="text-primary">
                {standing.points} pts · NRR {standing.netRunRate.toFixed(3)} · {standing.won}W-{standing.lost}L
              </p>
            ) : null}
          </>
        }
        actions={pageUrl ? <ShareButtons url={pageUrl} shareText={`${team.name} — team profile`} /> : null}
      />

      <div className="space-y-6">
        {topBatsmen.length > 0 ? (
          <section className={cn(cricketCardClass, "overflow-hidden")}>
            <h2 className={cn(cricketSectionTitleClass, "px-4 py-3 border-b border-border")}>
              Top run scorers
            </h2>
            <ul>
              {topBatsmen.map((b) => (
                <li
                  key={b.playerId}
                  className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0"
                >
                  <Link
                    href={cricketPlayerPublicPath(tournamentId, b.playerId)}
                    className="text-foreground hover:text-primary"
                  >
                    {b.playerName}
                  </Link>
                  <span className="text-sm tabular-nums text-primary">{b.runs} runs</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className={cn(cricketCardClass, "overflow-hidden")}>
          <h2 className={cn(cricketSectionTitleClass, "px-4 py-3 border-b border-border")}>Squad</h2>
          <ul>
            {squad.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 last:border-0 text-sm"
              >
                <Link
                  href={cricketPlayerPublicPath(tournamentId, p.id)}
                  className="text-foreground hover:text-primary"
                >
                  {p.name}
                </Link>
                <span className="text-muted-foreground">{p.role ?? p.status}</span>
              </li>
            ))}
          </ul>
        </section>

        {recentResults.length > 0 ? (
          <section className="space-y-2">
            <h2 className={cricketSectionTitleClass}>Recent results</h2>
            <ul className="space-y-2">
              {recentResults.map((m) => (
                <li key={m.id} className={cn(cricketCardClass, "px-4 py-2 text-sm")}>
                  <span className={m.won ? "text-emerald-400" : "text-muted-foreground"}>
                    {m.won ? "W" : "L"}
                  </span>
                  <span className="ml-2 text-foreground">{m.resultSummary ?? `Match #${m.id}`}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </CricketPublicShell>
  );
}
