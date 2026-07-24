import {
  Monitor, Wallet, Gavel, Cast, BarChart3, Dices, QrCode, Tv, Cloud, type LucideIcon,
} from "lucide-react";

export type Feature = { icon: LucideIcon; title: string; desc: string };

export const FEATURE_DECK_ITEMS: readonly Feature[] = [
  { icon: Monitor, title: "Live Broadcast Display", desc: "Full-screen LED display mode with animated player cards, live bid counter, team purse strip, and SOLD stamp. Plug into any projector or TV — broadcast-ready out of the box." },
  { icon: Wallet, title: "Team Owner Bidding Panel", desc: "Every team owner gets a mobile-optimized bidding panel. One-tap bid button, real-time purse tracker, squad overview — bid from any smartphone, no app needed." },
  { icon: Gavel, title: "Operator Control Dashboard", desc: "Run the entire auction from a tablet. Nominate players, start bid timers, accept quick bids, mark SOLD or UNSOLD, and undo the last action — full control, zero cables." },
  { icon: Cast, title: "Broadcast Overlay", desc: "Transparent browser-source overlay for YouTube, Facebook Live, and any broadcast software. Shows hexagon player photo, live bid bar, and team ticker at 1920×1080." },
  { icon: BarChart3, title: "Auction Analytics & Reports", desc: "Post-auction reports with bar charts, purse utilization, top sold players, and team-wise spend breakdown. Export data and share results instantly." },
  { icon: Dices, title: "Fortune Wheel & Tiebreakers", desc: "Animated full-screen spin wheel for lucky draws and tiebreakers. Crowd-pleasing, tournament-ready, and configurable with your team names." },
  { icon: QrCode, title: "Player Self-Registration", desc: "Players register via a public QR code link — name, photo, role, and stats. Auto-fills your auction roster. No manual data entry for the organizer." },
  { icon: Tv, title: "Multi-Screen Support", desc: "Run the operator panel, LED display, and owner panels simultaneously on separate devices. Designed for projectors, smart TVs, laptops, and mobile — all synced in real time." },
  { icon: Cloud, title: "Cloud-Based, Any Device", desc: "No software installation. No local server. Everything runs in a browser and syncs live across all connected devices — from any city, any venue." },
] as const;

/**
 * Feature Deck — grid of platform capability cards.
 */
export function FeatureDeck({
  items = FEATURE_DECK_ITEMS,
}: {
  items?: readonly Feature[];
}) {
  return (
    <section id="features" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Platform Features</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">Everything your auction needs</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From player registration to live broadcast overlays — BidWar handles every part of your auction day, start to finish.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map((f) => (
            <div
              key={f.title}
              className="p-6 rounded-2xl border border-border bg-card/30 hover:border-primary/30 hover:bg-card/50 transition-colors group"
            >
              <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                <f.icon className="w-5 h-5 text-primary" aria-hidden />
              </div>
              <h3 className="font-display font-bold text-lg mb-2">{f.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
