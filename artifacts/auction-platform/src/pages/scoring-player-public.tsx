import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Award, Trophy } from "lucide-react";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getTournamentPlayerProfile } from "@/lib/scoring-api";
import { cricketMatchPublicPath, cricketPublicPath, cricketTeamPublicPath } from "@/lib/tournament-navigation";
import {
  CricketEmptyState,
  CricketLoadingShell,
  CricketPublicPageHeader,
  CricketPublicShell,
  cricketCardClass,
  cricketPanelClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import { cn } from "@/lib/utils";

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

  if (isLoading) return <CricketLoadingShell />;
  if (error || !data) return <CricketEmptyState message="Player profile not available." />;

  const { player, team, stats, manOfTheMatchAwards } = data;

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
        eyebrow="Player profile"
        title={player.name}
        subtitle={
          <>
            {player.role ? <p>{player.role}</p> : null}
            {team ? (
              <Link
                href={cricketTeamPublicPath(tournamentId, team.id)}
                className="text-primary hover:underline inline-block"
              >
                {team.name} ({team.shortCode})
              </Link>
            ) : null}
          </>
        }
        actions={
          pageUrl ? <ShareButtons url={pageUrl} shareText={`${player.name} — cricket stats`} /> : null
        }
      />

      {stats ? (
        <section className={cricketPanelClass}>
          <h2 className={cn(cricketSectionTitleClass, "mb-3 flex items-center gap-2")}>
            <Trophy className="h-4 w-4 text-primary" />
            Tournament stats
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
            {[
              ["Matches", stats.matches],
              ["Runs", stats.runs],
              ["Wickets", stats.wickets],
              ["Strike rate", stats.strikeRate],
            ].map(([label, value]) => (
              <div key={String(label)} className="rounded-lg bg-muted/30 px-3 py-2">
                <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {manOfTheMatchAwards.length > 0 ? (
        <section className={cn(cricketPanelClass, "mt-6 border-primary/25 bg-primary/5 space-y-2")}>
          <h2 className={cn(cricketSectionTitleClass, "text-primary flex items-center gap-2")}>
            <Award className="h-4 w-4" />
            Man of the Match ({manOfTheMatchAwards.length})
          </h2>
          <ul className="space-y-2 text-sm">
            {manOfTheMatchAwards.map((a) => (
              <li key={a.matchId}>
                <Link
                  href={cricketMatchPublicPath(tournamentId, a.matchId)}
                  className="text-foreground hover:text-primary"
                >
                  Match #{a.matchId}
                </Link>
                {a.reason ? <span className="text-muted-foreground"> — {a.reason}</span> : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </CricketPublicShell>
  );
}
