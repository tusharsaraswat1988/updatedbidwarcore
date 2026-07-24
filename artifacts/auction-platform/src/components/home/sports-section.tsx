import { Target, CircleDot, Swords, GraduationCap, Building2, Heart, type LucideIcon } from "lucide-react";

export type UseCase = { icon: LucideIcon; title: string; desc: string };

export const SPORTS_SECTION_ITEMS: readonly UseCase[] = [
  { icon: Target, title: "Cricket Leagues", desc: "T20, T10, and box cricket franchise auctions with IPL-style player categories, purse limits, and live bid counters." },
  { icon: CircleDot, title: "Football Auctions", desc: "Franchise football league drafts with team budgets, player roles, and real-time bidding panels for each team owner." },
  { icon: Swords, title: "Kabaddi Tournaments", desc: "PKL-inspired kabaddi league auctions with full team management, category-based bidding, and LED display support." },
  { icon: GraduationCap, title: "School Championships", desc: "Inter-school and inter-college sports leagues with multi-team auctions, budget controls, and operator-led bidding." },
  { icon: Building2, title: "Business Sports Leagues", desc: "Corporate cricket and football leagues with franchise bidding, sponsor branding, and streaming overlay for events." },
  { icon: Heart, title: "Community Tournaments", desc: "Local club and residential society leagues with simple setup, mobile bidding, and projector display for live audiences." },
] as const;

/**
 * Sports Section — "Built for every sport" use-case grid.
 */
export function SportsSection({
  items = SPORTS_SECTION_ITEMS,
}: {
  items?: readonly UseCase[];
}) {
  return (
    <section id="sports" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Use Cases</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">Built for every sport</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Whether it&rsquo;s a local cricket league or a multi-city franchise tournament — BidWar is designed to run it.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((u) => (
            <div
              key={u.title}
              className="p-6 rounded-2xl border border-border bg-card/30 hover:border-primary/30 hover:bg-card/50 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <u.icon className="w-5 h-5 text-primary" aria-hidden />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{u.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{u.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
