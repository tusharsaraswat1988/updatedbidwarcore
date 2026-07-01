import { Sparkles } from "lucide-react";
import type { TournamentInsight } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const TYPE_STYLES: Record<TournamentInsight["type"], string> = {
  trending: "from-orange-500/15 via-amber-500/5 to-transparent border-orange-500/25",
  insight: "from-emerald-500/15 via-teal-500/5 to-transparent border-emerald-500/25",
  funFact: "from-violet-500/15 via-purple-500/5 to-transparent border-violet-500/25",
  strategy: "from-sky-500/15 via-blue-500/5 to-transparent border-sky-500/25",
};

const TYPE_ACCENT: Record<TournamentInsight["type"], string> = {
  trending: "text-orange-400",
  insight: "text-emerald-400",
  funFact: "text-violet-400",
  strategy: "text-sky-400",
};

function InsightCard({ insight }: { insight: TournamentInsight }) {
  return (
    <article
      className={`relative overflow-hidden rounded-xl border bg-gradient-to-br p-4 ${TYPE_STYLES[insight.type]}`}
    >
      <div className="flex items-start gap-3">
        <span className="text-2xl leading-none select-none" aria-hidden>
          {insight.emoji}
        </span>
        <div className="min-w-0 flex-1 space-y-1">
          <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${TYPE_ACCENT[insight.type]}`}>
            {insight.type === "funFact" ? "Fun Fact" : insight.type}
          </p>
          <h3 className="font-display font-bold text-sm leading-snug text-foreground">
            {insight.title}
          </h3>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {insight.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function InsightSkeleton() {
  return (
    <div className="rounded-xl border border-border/60 bg-card/40 p-4 space-y-2">
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-full" />
    </div>
  );
}

export function TournamentInsightsSection({
  insights,
  isLoading,
}: {
  insights: TournamentInsight[] | undefined;
  isLoading: boolean;
}) {
  const cards = (insights ?? []).slice(0, 4);

  if (!isLoading && cards.length === 0) {
    return null;
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-lg bg-primary/10">
          <Sparkles className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h2 className="text-xl font-display font-bold">Tournament Insights</h2>
          <p className="text-xs text-muted-foreground">Live intelligence from the auction floor</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isLoading
          ? Array.from({ length: 4 }).map((_, i) => <InsightSkeleton key={i} />)
          : cards.map((insight, i) => (
              <InsightCard key={`${insight.type}-${insight.title}-${i}`} insight={insight} />
            ))}
      </div>
    </section>
  );
}
