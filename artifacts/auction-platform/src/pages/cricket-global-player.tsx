import { useRoute } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Award, Trophy } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ShareButtons } from "@/components/scoring/share-buttons";
import { getGlobalCricketPlayerProfile } from "@/lib/scoring-api";

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
        Player profile not found.
      </div>
    );
  }

  const { globalPlayer, careerStats, manOfTheMatchCount, tournaments } = data;

  return (
    <div className="min-h-screen bg-[#0a0f1a] text-foreground">
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <header className="space-y-3">
          <p className="text-xs uppercase tracking-[0.2em] text-amber-400/80">Cricket career</p>
          <h1 className="text-3xl font-bold text-white">{globalPlayer.name}</h1>
          {globalPlayer.city ? <p className="text-sm text-muted-foreground">{globalPlayer.city}</p> : null}
          {pageUrl ? (
            <ShareButtons url={pageUrl} shareText={`${globalPlayer.name} — cricket career stats`} />
          ) : null}
        </header>

        {careerStats ? (
          <section className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-400" />
              Career totals
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              {[
                ["Matches", careerStats.matches],
                ["Runs", careerStats.runs],
                ["Wickets", careerStats.wickets],
                ["MoM", manOfTheMatchCount],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-lg bg-black/20 px-3 py-2">
                  <div className="text-lg font-bold text-white tabular-nums">{value}</div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {manOfTheMatchCount > 0 ? (
          <p className="text-sm text-amber-300/90 flex items-center gap-2">
            <Award className="h-4 w-4" />
            {manOfTheMatchCount} Man of the Match award{manOfTheMatchCount === 1 ? "" : "s"}
          </p>
        ) : null}

        {tournaments.length > 0 ? (
          <section className="rounded-xl border border-white/10 overflow-hidden">
            <h2 className="px-4 py-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground border-b border-white/10">
              Tournaments
            </h2>
            <ul>
              {tournaments.map((t) => (
                <li key={t.id} className="px-4 py-2.5 border-b border-white/5 last:border-0 text-sm text-white">
                  {t.name}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
