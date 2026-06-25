import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentPlayerProfile } from "@/lib/scoring-api";
import { cricketMatchPublicPath, cricketPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";

export default function ScoringPlayerPublicPage() {
  const [, params] = useRoute("/tournament/:id/cricket/player/:playerId");
  const tournamentId = parseInt(params?.id || "0");
  const playerId = parseInt(params?.playerId || "0");

  const { data, isLoading, error } = useQuery({
    queryKey: ["scoring-player-public", tournamentId, playerId],
    queryFn: () => getTournamentPlayerProfile(tournamentId, playerId),
    enabled: !!tournamentId && !!playerId,
  });

  const pageUrl =
    typeof window !== "undefined"
      ? `${window.location.origin}/tournament/${tournamentId}/cricket/player/${playerId}`
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
        Player profile not available.
      </div>
    );
  }

  const { player, team, stats, manOfTheMatchAwards } = data;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
        <Link href={cricketPublicPath(tournamentId)} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Tournament
        </Link>

        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Player profile</p>
          <h1 className="text-3xl font-bold text-white">{player.name}</h1>
          {player.role ? <p className="text-sm text-muted-foreground">{player.role}</p> : null}
          {team ? (
            <Link href={cricketTeamPublicPath(tournamentId, team.id)} className="text-sm text-amber-300 hover:underline">
              {team.name} ({team.shortCode})
            </Link>
          ) : null}
          {pageUrl ? (
            <ShareButtons url={pageUrl} shareText={`${player.name} — cricket stats`} />
          ) : null}
        </header>

        {stats ? (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Tournament stats
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ["Matches", stats.matches],
                ["Runs", stats.runs],
                ["Wickets", stats.wickets],
                ["Strike rate", stats.strikeRate],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-lg font-bold text-white tabular-nums">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {manOfTheMatchAwards.length > 0 ? (
          <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 space-y-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-amber-300 flex items-center gap-2">
              <Award className="h-4 w-4" />
              Man of the Match ({manOfTheMatchAwards.length})
            </h2>
            <ul className="space-y-2 text-sm">
              {manOfTheMatchAwards.map((a) => (
                <li key={a.matchId}>
                  <Link href={cricketMatchPublicPath(tournamentId, a.matchId)} className="text-white hover:text-amber-300">
                    Match #{a.matchId}
                  </Link>
                  {a.reason ? <span className="text-muted-foreground"> — {a.reason}</span> : null}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
