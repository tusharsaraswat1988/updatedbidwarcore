import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Award, Trophy } from "lucide-react";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getGlobalCricketPlayerProfile } from "@/lib/scoring-api";
import {
  CricketEmptyState,
  CricketLoadingShell,
  CricketPublicPageHeader,
  CricketPublicShell,
  cricketCardClass,
  cricketSectionTitleClass,
} from "@/components/scoring/cricket-page-chrome";
import { cn } from "@/lib/utils";

export default function CricketGlobalPlayerPage() {
  const [, params] = useRoute("/player/:globalPlayerId");
  const globalPlayerId = params?.globalPlayerId ?? "";

  const { data, isLoading, error } = useQuery({
    queryKey: ["global-cricket-player", globalPlayerId],
    queryFn: () => getGlobalCricketPlayerProfile(globalPlayerId),
    enabled: !!globalPlayerId,
  });

  const pageUrl =
    typeof window !== "undefined" ? `${window.location.origin}/player/${globalPlayerId}` : "";

  if (isLoading) return <CricketLoadingShell />;
  if (error || !data) return <CricketEmptyState message="Player profile not found." />;

  const { globalPlayer, careerStats, manOfTheMatchCount, tournaments } = data;

  return (
    <CricketPublicShell>
      <CricketPublicPageHeader
        eyebrow="Cricket career"
        title={globalPlayer.name}
        subtitle={globalPlayer.city ? <p>{globalPlayer.city}</p> : undefined}
        actions={
          pageUrl ? (
            <ShareButtons url={pageUrl} shareText={`${globalPlayer.name} — cricket career stats`} />
          ) : null
        }
      />

      <div className="space-y-6">
        {careerStats ? (
          <section className={cn(cricketCardClass, "p-4")}>
            <h2 className={cn(cricketSectionTitleClass, "mb-3 flex items-center gap-2")}>
              <Trophy className="h-4 w-4 text-primary" />
              Career totals
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ["Matches", careerStats.matches],
                ["Runs", careerStats.runs],
                ["Wickets", careerStats.wickets],
                ["MoM", manOfTheMatchCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-muted/30 px-3 py-2">
                  <div className="text-lg font-bold text-foreground tabular-nums">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {manOfTheMatchCount > 0 ? (
          <p className="text-sm text-primary flex items-center gap-2">
            <Award className="h-4 w-4" />
            {manOfTheMatchCount} Man of the Match award{manOfTheMatchCount === 1 ? "" : "s"}
          </p>
        ) : null}

        {tournaments.length > 0 ? (
          <section className={cn(cricketCardClass, "overflow-hidden")}>
            <h2 className={cn(cricketSectionTitleClass, "px-4 py-3 border-b border-border")}>
              Tournaments
            </h2>
            <ul>
              {tournaments.map((t) => (
                <li
                  key={t.id}
                  className="px-4 py-2.5 border-b border-border/50 last:border-0 text-sm text-foreground"
                >
                  {t.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </CricketPublicShell>
  );
}
