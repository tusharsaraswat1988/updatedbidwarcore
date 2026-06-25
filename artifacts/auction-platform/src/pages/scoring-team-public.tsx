import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentTeamProfile } from "@/lib/scoring-api";
import { cricketPlayerPublicPath, cricketPublicPath } from "@/lib/tournament-navigation";

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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] p-6">
        <Skeleton className="h-10 w-48 bg-white/10" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center text-muted-foreground">
        Team profile not available.
      </div>
    );
  }

  const { team, standing, squad, recentResults, topBatsmen } = data;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Link href={cricketPublicPath(tournamentId)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Tournament
        </Link>

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Team profile</p>
          <h1 className="text-3xl font-bold text-white">{team.name}</h1>
          <p className="text-sm text-muted-foreground">{team.shortCode}</p>
          {standing ? (
            <p className="text-sm text-amber-300/90">
              {standing.points} pts · NRR {standing.netRunRate.toFixed(3)} · {standing.won}W-{standing.lost}L
            </p>
          ) : null}
          {pageUrl ? (
            <ShareButtons url={pageUrl} shareText={`${team.name} — team profile`} />
          ) : null}
        </header>

        {topBatsmen.length > 0 ? (
          <section className="rounded-xl border border-white/10 overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-white/10">
              Top run scorers
            </h2>
            <ul>
              {topBatsmen.map((b) => (
                <li key={b.playerId} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0">
                  <Link href={cricketPlayerPublicPath(tournamentId, b.playerId)} className="text-white hover:text-amber-300">
                    {b.playerName}
                  </Link>
                  <span className="text-sm tabular-nums text-amber-300">{b.runs} runs</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <section className="rounded-xl border border-white/10 overflow-hidden">
          <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-white/10">
            Squad
          </h2>
          <ul>
            {squad.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5 border-b border-white/5 last:border-0 text-sm">
                <Link href={cricketPlayerPublicPath(tournamentId, p.id)} className="text-white hover:text-amber-300">
                  {p.name}
                </Link>
                <span className="text-muted-foreground">{p.role ?? p.status}</span>
              </li>
            ))}
          </ul>
        </section>

        {recentResults.length > 0 ? (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recent results</h2>
            <ul className="space-y-2">
              {recentResults.map((m) => (
                <li key={m.id} className="rounded-lg border border-white/10 px-4 py-2 text-sm">
                  <span className={m.won ? "text-emerald-400" : "text-muted-foreground"}>
                    {m.won ? "W" : "L"}
                  </span>
                  <span className="ml-2 text-white">{m.resultSummary ?? `Match #${m.id}`}</span>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
