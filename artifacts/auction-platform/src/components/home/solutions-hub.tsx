import { Gavel, Trophy, CircleDot, Building2, Users, BarChart3, ChevronRight, type LucideIcon } from "lucide-react";

export type Solution = {
  icon: LucideIcon;
  title: string;
  href: string;
  description: string;
  cta: string;
  accent: string;
  border: string;
  glow: string;
  iconBg: string;
};

export const SOLUTIONS: readonly Solution[] = [
  { icon: Gavel, title: "Sports Auction Software", href: "/sports-auction-software", description: "Run professional franchise auctions for cricket, football, kabaddi, badminton, basketball and more using one centralized platform.", cta: "Explore Sports Auction Software", accent: "text-yellow-400", border: "hover:border-yellow-400/30", glow: "hover:shadow-yellow-400/5", iconBg: "bg-yellow-400/10" },
  { icon: Trophy, title: "Cricket Auction Software", href: "/cricket-auction-software", description: "IPL-style cricket player auctions with purse tracking, player categories, owner bidding panels and live display screens.", cta: "Explore Cricket Auction Software", accent: "text-blue-400", border: "hover:border-blue-400/30", glow: "hover:shadow-blue-400/5", iconBg: "bg-blue-400/10" },
  { icon: CircleDot, title: "Badminton Scoring Software", href: "/badminton-scoring-software", description: "Live rally-by-rally badminton scoring, LED scoreboards, standings and tournament management in one platform.", cta: "Explore Badminton Scoring Software", accent: "text-green-400", border: "hover:border-green-400/30", glow: "hover:shadow-green-400/5", iconBg: "bg-green-400/10" },
  { icon: Building2, title: "Franchise Auction Software", href: "/franchise-auction-software", description: "Conduct professional franchise-based player auctions with automated bidding workflows and real-time updates.", cta: "Explore Franchise Auction Software", accent: "text-purple-400", border: "hover:border-purple-400/30", glow: "hover:shadow-purple-400/5", iconBg: "bg-purple-400/10" },
  { icon: Users, title: "Player Auction Software", href: "/player-auction-software", description: "Digitize player auctions for sports leagues with automated bidding, team budgets and live auction controls.", cta: "Explore Player Auction Software", accent: "text-orange-400", border: "hover:border-orange-400/30", glow: "hover:shadow-orange-400/5", iconBg: "bg-orange-400/10" },
  { icon: BarChart3, title: "Sports League Management Software", href: "/sports-league-management-software", description: "Manage registrations, auctions, scoring, standings and tournament operations from one platform.", cta: "Explore League Management Software", accent: "text-cyan-400", border: "hover:border-cyan-400/30", glow: "hover:shadow-cyan-400/5", iconBg: "bg-cyan-400/10" },
] as const;

/**
 * Solutions Hub — grid of sport/discipline landing-page links plus an SEO
 * prose block. Fully static/presentational.
 */
export function SolutionsHub({ solutions = SOLUTIONS }: { solutions?: readonly Solution[] }) {
  return (
    <section id="solutions" className="py-24 px-6 border-t border-border/30">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="text-primary text-xs font-bold uppercase tracking-widest mb-3">Solutions</div>
          <h2 className="text-3xl md:text-4xl font-display font-black mb-4">
            One Platform for Every Sports Event
          </h2>
          <p className="text-muted-foreground max-w-2xl mx-auto text-base">
            BidWar powers franchise player auctions, live bidding, digital scoring, and league management across all major sports. Choose your solution below.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {solutions.map((sol) => {
            const Icon = sol.icon;
            return (
              <a
                key={sol.href}
                href={sol.href}
                className={`group relative flex flex-col rounded-2xl border border-border/40 bg-card/30 p-7 transition-all duration-300 hover:-translate-y-1 hover:bg-card/60 hover:shadow-xl ${sol.border} ${sol.glow}`}
              >
                <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl mb-5 ${sol.iconBg}`}>
                  <Icon className={`w-6 h-6 ${sol.accent}`} aria-hidden />
                </div>
                <h3 className="font-display font-bold text-lg mb-3">
                  {sol.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed flex-1 mb-5">
                  {sol.description}
                </p>
                <span className={`flex items-center gap-1.5 text-xs font-semibold ${sol.accent}`}>
                  {sol.cta} <ChevronRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </a>
            );
          })}
        </div>

        <div className="mt-16 rounded-2xl border border-border/30 bg-card/20 p-8 md:p-12">
          <h2 className="text-2xl md:text-3xl font-display font-black mb-6">
            Explore BidWar Solutions
          </h2>
          <div className="prose prose-invert prose-sm md:prose-base max-w-none text-muted-foreground space-y-4 leading-relaxed">
            <p>
              BidWar is India&rsquo;s most complete platform for sports event management — combining{" "}
              <a href="/sports-auction-software" className="text-primary hover:underline font-medium">sports auction software</a>,{" "}
              <a href="/franchise-auction-software" className="text-primary hover:underline font-medium">franchise league management</a>,{" "}
              <a href="/badminton-scoring-software" className="text-primary hover:underline font-medium">badminton scoring</a>,
              live LED displays, team owner bidding panels, and tournament operations in a single cloud-based platform.
            </p>
            <p>
              Whether you are organizing a 6-team{" "}
              <a href="/cricket-auction-software" className="text-primary hover:underline font-medium">cricket auction</a>{" "}
              with IPL-style purse rules, a multi-discipline{" "}
              <a href="/badminton-scoring-software" className="text-primary hover:underline font-medium">badminton tournament</a>{" "}
              with live scoreboards, or a corporate football franchise event — BidWar handles every layer of the operation.
              Team owners bid from their phones via QR-code access. Players are displayed on any TV or projector using BidWar&rsquo;s
              full-screen broadcast display. Purse deductions happen automatically with every sold bid.
            </p>
            <p>
              For league administrators, BidWar&rsquo;s{" "}
              <a href="/sports-league-management-software" className="text-primary hover:underline font-medium">sports league management software</a>{" "}
              manages registrations, match scheduling, live scoring, standings, and end-of-season reports in one dashboard.
              The same platform that runs your{" "}
              <a href="/player-auction-software" className="text-primary hover:underline font-medium">player auction</a>{" "}
              builds the squad rosters that feed directly into your league operations — no duplicate data entry, no spreadsheets.
            </p>
            <p>
              BidWar currently supports cricket, football, kabaddi, badminton, basketball, volleyball, throwball, futsal, and multi-sport combined events.
              Every sport uses the same core platform with sport-specific category structures, scoring rules, and display modes configured by the organizer.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
