import { useLocation } from "wouter";
import { CheckCircle2, Lightbulb } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { PublicNavbar } from "@/components/public-navbar";

const AUCTION_TIPS = [
  {
    title: "Freeze roster and player data before auction start",
    detail:
      "Use BidWar player registration and category setup to lock player name, role, and base price before the first nomination. Last-minute edits during live bidding create confusion for owners and can lead to disputes.",
  },
  {
    title: "Use clear category-wise base pricing",
    detail:
      "Set base prices by category (for example marquee, core, emerging) instead of random values. This keeps bidding fair and prevents premium players from being sold too cheaply in early rounds.",
  },
  {
    title: "Define bid increment rules in advance",
    detail:
      "Before going live, finalize minimum increments for low, mid, and high bid ranges. Consistent increments keep auction speed stable and make purse calculations predictable for every team.",
  },
  {
    title: "Keep owner panels synced and tested on mobile",
    detail:
      "Run a 5-minute dry run on team owner phones before the main auction. Confirm each owner can open the panel, place bids, and see purse updates in real time.",
  },
  {
    title: "Use the LED display as the single source of truth",
    detail:
      "Project BidWar live display on a large screen for the room. Ask everyone to follow sold amount, current bidder, and countdown from that screen to reduce manual announcements.",
  },
  {
    title: "Nominate players strategically to avoid long dead zones",
    detail:
      "Mix premium and mid-tier nominations to maintain momentum. If too many low-demand players are nominated together, bidding energy drops and auction duration increases.",
  },
  {
    title: "Track purse pressure continuously",
    detail:
      "Monitor remaining purse per team after each sale. When purse pressure rises, shift to role-specific nominations so teams can complete squads without panic bidding.",
  },
  {
    title: "Use controlled pauses instead of ad-hoc stoppages",
    detail:
      "If organizers need a break, use planned pause windows and communicate restart time. Frequent unscheduled stops break rhythm and reduce owner confidence in the process.",
  },
  {
    title: "Capture every sold/unsold decision immediately",
    detail:
      "Mark SOLD or UNSOLD right after countdown ends and avoid delayed updates. Immediate recording prevents replay confusion and keeps reports accurate for post-auction sharing.",
  },
  {
    title: "End with reports and shareables",
    detail:
      "After final hammer, export team-wise spend and player allocations from BidWar reports. Sharing a clean summary quickly builds trust and gives your league a professional finish.",
  },
];

export default function AuctionTipsPage() {
  const [, navigate] = useLocation();
  const { brandName } = useBranding();

  return (
    <div className="min-h-screen bg-[#09090b] text-white pt-16">
      <title>Auction Tips for Organizers | {brandName}</title>
      <meta
        name="description"
        content="Practical sports auction tips for organizers using BidWar. Learn how to set base prices, manage owner bidding, run clean live sessions, and close with professional reports."
      />

      <PublicNavbar />

      <section className="py-14 px-6 border-b border-white/5">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
            <Lightbulb className="w-3.5 h-3.5" />
            Organizer Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-display font-black tracking-tight">
            Auction Tips for Better
            <span className="text-primary"> Live Sessions</span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto text-sm md:text-base leading-relaxed">
            These practical tips are based on how BidWar auctions run in real events. Use them as a pre-auction checklist so teams, owners, and viewers get a professional experience.
          </p>
        </div>
      </section>

      <section className="py-12 px-6">
        <div className="max-w-4xl mx-auto space-y-3">
          {AUCTION_TIPS.map((tip, index) => (
            <details
              key={tip.title}
              className="group rounded-2xl border border-white/10 bg-white/[0.03] open:border-primary/40 open:bg-primary/[0.07] transition-colors"
            >
              <summary className="list-none cursor-pointer p-5 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-primary text-xs font-bold mt-1 min-w-8">Tip {String(index + 1).padStart(2, "0")}</span>
                  <span className="font-semibold text-sm sm:text-base text-white">{tip.title}</span>
                </div>
                <span className="text-primary/80 text-xs group-open:rotate-45 transition-transform">+</span>
              </summary>
              <div className="px-5 pb-5 border-t border-white/10">
                <p className="text-sm text-white/65 leading-relaxed pt-4">{tip.detail}</p>
              </div>
            </details>
          ))}
        </div>
      </section>

      <section className="px-6 pb-14">
        <div className="max-w-4xl mx-auto rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <h2 className="text-xl font-display font-bold text-white">Quick Action Plan</h2>
              <p className="text-sm text-white/60 mt-2 leading-relaxed">
                If you are running an auction this week: finalize player categories and base prices first, test owner panels on mobile, and run one full mock round on your LED display.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
