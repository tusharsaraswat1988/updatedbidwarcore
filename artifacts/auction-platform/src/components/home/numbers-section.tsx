import { NUMBERS_STATS } from "@/data/homepage-content";

/**
 * Numbers Section — "the scoreboard". Verified totals across every league
 * run on BidWar so far. Content is data-driven via `NUMBERS_STATS`.
 */
export function NumbersSection() {
  return (
    <section id="numbers" aria-labelledby="numbers-heading" className="py-16 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <div className="text-primary text-xs font-bold uppercase tracking-widest mb-2">The Scoreboard</div>
            <h2 id="numbers-heading" className="text-3xl md:text-4xl font-display font-black">
              Numbers from the field.
            </h2>
          </div>
          <p className="max-w-md text-sm text-muted-foreground">
            Verified across cricket, football and corporate leagues — auctions we&rsquo;ve actually run, no vanity metrics.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          {NUMBERS_STATS.map((stat) => (
            <div
              key={stat.label}
              className="rounded-2xl border border-border bg-card/20 p-4 sm:p-5 text-center"
            >
              <p className="font-display font-black text-3xl sm:text-4xl text-primary leading-none">{stat.value}</p>
              <p className="mt-2 text-xs font-semibold uppercase tracking-wider text-foreground">{stat.label}</p>
              {stat.sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{stat.sub}</p>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
