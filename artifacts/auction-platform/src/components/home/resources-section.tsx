import { BookOpen, ArrowRight, Clock, ChevronRight, Phone } from "lucide-react";
import { BLOG_POSTS_META, BLOG_CATEGORIES } from "@workspace/blog-data";

const RESOURCE_SLUGS = [
  "how-to-run-franchise-player-auction",
  "what-is-live-auction-software-sports",
  "ipl-style-auction-format-local-cricket-leagues",
  "badminton-scoring-software-live-rally-guide",
  "sports-league-management-software-buyers-guide",
  "cloud-vs-local-auction-software-sports-events",
] as const;

/**
 * Resources Section — blog highlights, SEO educational copy, and a
 * closing conversion banner.
 */
export function ResourcesSection({ onBookDemo }: { onBookDemo: () => void }) {
  return (
    <section id="resources" className="py-24 px-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-end justify-between mb-12">
          <div>
            <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2">
              <BookOpen className="w-3.5 h-3.5" aria-hidden /> Popular Resources
            </div>
            <h2 className="text-3xl md:text-4xl font-display font-black">
              Guides, Strategies &amp; Tutorials
            </h2>
            <p className="text-muted-foreground mt-2 max-w-xl">
              Educational guides, auction strategies, scoring tutorials and league management resources for tournament organizers.
            </p>
          </div>
          <a
            href="/blog"
            className="hidden sm:flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
          >
            View all articles <ArrowRight className="w-4 h-4" aria-hidden />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {RESOURCE_SLUGS.map((slug) => {
            const post = BLOG_POSTS_META.find((p) => p.slug === slug);
            if (!post) return null;
            const cat = BLOG_CATEGORIES.find((c) => c.slug === post.category);
            return (
              <a
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="group flex flex-col rounded-2xl border border-border/40 bg-card/30 hover:bg-card/60 hover:border-border/70 hover:-translate-y-0.5 transition-all duration-300 overflow-hidden"
              >
                <div className="p-6 flex flex-col gap-3 flex-1">
                  {cat && (
                    <span className={`inline-block text-xs font-bold uppercase tracking-widest px-2.5 py-1 rounded-full w-fit ${cat.color} ${cat.bgColor}`}>
                      {cat.name}
                    </span>
                  )}
                  <h3 className="font-display font-bold text-base leading-snug group-hover:text-primary transition-colors">
                    {post.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1 line-clamp-3">
                    {post.excerpt}
                  </p>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground pt-3 border-t border-border/30">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" aria-hidden /> {post.readingTimeMinutes} min read
                    </span>
                    <span className="flex items-center gap-1 ml-auto text-primary font-medium">
                      Read article <ChevronRight className="w-3 h-3" aria-hidden />
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>

        <div className="mt-6 flex sm:hidden justify-center">
          <a href="/blog" className="flex items-center gap-2 text-sm text-primary font-semibold hover:underline">
            View all articles <ArrowRight className="w-4 h-4" aria-hidden />
          </a>
        </div>

        <div className="mt-16 space-y-8">
          <div>
            <h2 className="text-2xl md:text-3xl font-display font-black mb-6">
              Learn Sports Auction Management
            </h2>
            <div className="grid md:grid-cols-2 gap-8 text-sm text-muted-foreground leading-relaxed">
              <div className="space-y-4">
                <p>
                  <strong className="text-foreground">Sports auction software</strong> transforms the way franchise leagues build teams.
                  Instead of random draws or manual spreadsheets, organizers use a{" "}
                  <a href="/sports-auction-software" className="text-primary hover:underline font-medium underline-offset-2">dedicated auction platform</a>{" "}
                  where team owners bid against each other in real time. Each bid is registered instantly,
                  team budgets (called purses) are deducted automatically, and the full session is displayed
                  on an LED screen for everyone to follow. The result is a live-event experience that raises
                  engagement, creates genuine strategic depth, and gives every franchise owner a reason
                  to show up on match day.
                </p>
                <p>
                  <a href="/cricket-auction-software" className="text-primary underline underline-offset-2 font-medium">Cricket auction software</a>{" "}
                  is the most-used category in India — replicating the IPL&rsquo;s purse structure, player tiers,
                  retention rounds, and marquee bidding in a format any local league can afford. BidWar&rsquo;s{" "}
                  <a href="/franchise-auction-software" className="text-primary underline underline-offset-2 font-medium">franchise auction software</a>{" "}
                  extends this to every sport: football position-based categories, kabaddi raider vs defender pools,
                  badminton discipline slots, and corporate multi-sport events. One platform; every format.
                </p>
                <p>
                  Organizers who have migrated from Excel sheets to BidWar report that auction-day disputes
                  drop significantly — because purse deductions, bid records, and player allocations are
                  tracked automatically with a permanent audit trail. No more post-auction arguments about
                  &ldquo;who bid how much for which player.&rdquo;
                </p>
              </div>
              <div className="space-y-4">
                <p>
                  <a href="/badminton-scoring-software" className="text-primary underline underline-offset-2 font-medium">Badminton scoring software</a>{" "}
                  is BidWar&rsquo;s second core capability. Rally-by-rally digital scoring replaces paper scorecards,
                  syncs live to any TV or projector via BidWar&rsquo;s scoreboard display mode, and automatically
                  handles service rotation, deuce detection, and game progression based on BWF rules.
                  Scorers score from any smartphone browser — no app installation required. Scores are
                  visible to spectators in real time, making club tournaments feel like broadcast events.
                </p>
                <p>
                  Beyond auctions and scoring,{" "}
                  <a href="/sports-league-management-software" className="text-primary underline underline-offset-2 font-medium">sports league management software</a>{" "}
                  keeps the season running smoothly. BidWar manages player registrations, match scheduling,
                  live scoring, standings, and tournament reports from a single dashboard. The{" "}
                  <a href="/player-auction-software" className="text-primary underline underline-offset-2 font-medium">player auction data</a>{" "}
                  flows directly into team rosters, which feed into scheduling — no manual data re-entry
                  at any stage.
                </p>
                <p>
                  For deeper reading, explore our guides on{" "}
                  <a href="/blog/category/auction-guides" className="text-primary underline underline-offset-2">auction how-to guides</a>,{" "}
                  <a href="/blog/category/sport-formats" className="text-primary underline underline-offset-2">cricket auction formats</a>,{" "}
                  <a href="/blog/category/platform-features" className="text-primary underline underline-offset-2">badminton scoring</a>, and{" "}
                  <a href="/blog/category/platform-features" className="text-primary underline underline-offset-2">platform features</a> — written by organizers
                  who have run hundreds of live auctions and tournaments across India.
                </p>
              </div>
            </div>
          </div>

          <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-10 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-transparent pointer-events-none" />
            <div className="relative text-center space-y-4">
              <h2 className="text-2xl md:text-3xl font-display font-black">
                Ready to Run Your Next Sports Auction?
              </h2>
              <p className="text-muted-foreground max-w-xl mx-auto">
                Start with a free demo and see how BidWar manages auctions, scoring, league operations and live displays from one platform.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                <button
                  onClick={onBookDemo}
                  className="px-7 py-3 rounded-xl bg-primary text-black font-display font-black text-sm hover:bg-primary/90 transition-all hover:shadow-[0_0_30px_rgba(234,179,8,0.35)] flex items-center justify-center gap-2"
                >
                  Book Free Demo <ChevronRight className="w-4 h-4" aria-hidden />
                </button>
                <a
                  href="https://wa.me/918707488250"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-7 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-card/50 transition-all flex items-center justify-center gap-2"
                >
                  <Phone className="w-4 h-4 text-green-400" aria-hidden /> Contact Sales
                </a>
                <a
                  href="#solutions"
                  className="px-7 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-card/50 transition-all flex items-center justify-center gap-2"
                >
                  Explore Solutions <ArrowRight className="w-4 h-4" aria-hidden />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
