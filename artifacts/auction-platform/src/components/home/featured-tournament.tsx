import { useState } from "react";
import { FEATURED_TOURNAMENTS, type FeaturedTournament as FeaturedTournamentData } from "@/data/homepage-content";
import { HomepageMedia } from "@/components/home/homepage-media";

/**
 * Featured Tournament — data-driven case-study carousel.
 * Media supports thumbnail + videoUrl + fullImage via HomepageMediaAsset.
 */
export function FeaturedTournament({
  tournaments = FEATURED_TOURNAMENTS,
}: {
  tournaments?: readonly FeaturedTournamentData[];
}) {
  const [index, setIndex] = useState(0);
  const tournament = tournaments[index] ?? tournaments[0];
  if (!tournament) return null;

  return (
    <section id="case-study" aria-labelledby="featured-tournament-heading" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Case Study · Featured Tournament</div>
          <h2 id="featured-tournament-heading" className="text-3xl md:text-5xl font-display font-black max-w-3xl">
            Real tournaments. Real results.
          </h2>
        </div>

        <div className="rounded-2xl border border-border bg-card/20 p-6 md:p-8">
          <div role="tablist" aria-label="Featured tournaments" className="mb-6 flex flex-wrap items-center gap-2">
            {tournaments.map((t, i) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                data-analytics={`case_study_tab_${t.id}`}
                onClick={() => setIndex(i)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                  i === index
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:text-foreground hover:border-border"
                }`}
              >
                {t.title}
              </button>
            ))}
          </div>

          <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr] lg:items-center">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                  {tournament.subtitle}
                </span>
                <span className="rounded-full border border-border bg-card/40 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {tournament.sportTag}
                </span>
                <span className="rounded-full border border-border bg-card/40 px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                  {tournament.location}
                </span>
              </div>
              <h3 className="mt-4 text-2xl md:text-3xl font-display font-black">{tournament.title}</h3>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground leading-relaxed">{tournament.description}</p>
              <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
                {tournament.stats.map((stat) => (
                  <div key={stat.label} className="rounded-xl border border-border bg-card/40 px-3 py-2.5 text-center">
                    <div className="font-display font-black text-lg text-primary leading-none">{stat.value}</div>
                    <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</div>
                  </div>
                ))}
              </div>
              <a
                href={tournament.cta.href}
                data-analytics={tournament.cta.analyticsId}
                className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary hover:underline underline-offset-4"
              >
                {tournament.cta.label} &rarr;
              </a>
            </div>

            <div className="rounded-2xl border border-border bg-card/30 p-4">
              <HomepageMedia
                media={tournament.media}
                showPlayButton
                playLabel={tournament.media.videoUrl ? "Play highlight reel" : "Highlight reel coming soon"}
                analyticsId={`case_study_play_${tournament.id}`}
                duration={tournament.media.duration}
                className="rounded-xl border-0"
              />
              <div className="mt-3 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                <span>{tournament.media.caption}</span>
                {tournament.media.duration ? <span className="font-mono">{tournament.media.duration}</span> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
