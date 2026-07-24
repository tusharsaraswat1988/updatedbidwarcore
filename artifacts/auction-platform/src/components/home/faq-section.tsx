import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { AUCTION_LICENSE_FAQ } from "@/data/auction-license";

export type FaqEntry = { q: string; a: string };

export const HOMEPAGE_FAQS: readonly FaqEntry[] = [
  { q: "What is sports auction software?", a: "Sports auction software is a digital platform that enables tournament organizers to conduct live player auctions for franchise-based leagues. It manages team rosters, bidding rounds, purse limits, player categories, and real-time bid tracking — replacing manual auction boards with a fully automated, broadcast-ready system." },
  { q: "How does cricket auction software work?", a: "The auction operator controls the session from a central dashboard — selecting players, starting bid timers, and accepting bids from team owners. Team owners bid from their phones via a dedicated panel. The LED display shows live action on a projector or TV for the audience. Everything syncs in real time." },
  { q: "Can BidWar run IPL-style auctions?", a: "Yes. BidWar is purpose-built for IPL-style franchise auctions. It supports player categories (Platinum, Gold, Silver, Emerging), team purse tracking, reserve prices, configurable bid increments, and a broadcast-quality LED display — the same format used in professional leagues." },
  { q: "Does BidWar support projector and LED screens?", a: "Yes. BidWar includes a dedicated full-screen LED Display Mode for large projectors and smart TVs. It features animated player cards, live bid counters, a SOLD stamp animation, team purse strips, and sponsor logo rotation — all in broadcast-quality resolution." },
  { q: "Is BidWar cloud-based?", a: "Yes. BidWar is fully cloud-based. The operator dashboard, team owner panels, and LED display all run in a browser — no downloads or installations required. All bid data syncs in real time across all connected devices from any location." },
  { q: "Is BidWar suitable for local tournaments?", a: "Absolutely. BidWar scales from 2-team club auctions to 16-team state-level franchise leagues. The free trial plan supports 2 teams at no cost, making it ideal for first-time organizers and small community tournaments." },
  { q: "Can multiple team owners bid simultaneously?", a: "Yes. Each team owner gets their own dedicated mobile bidding panel accessible from any smartphone. Multiple owners can see and place bids simultaneously during a live session — the system handles all bids in real time with instant updates for everyone." },
  { q: "Does BidWar support YouTube or Facebook Live streaming?", a: "Yes. BidWar includes a browser-source Broadcast Overlay (OBS, vMix, Wirecast, and more) that shows the player photo, live bid amount, team ticker, and bid bar directly in your YouTube or Facebook Live broadcast — giving your event a professional production quality." },
  AUCTION_LICENSE_FAQ,
] as const;

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/50 transition-colors"
      >
        <span className="font-display font-bold text-base text-foreground leading-snug">{q}</span>
        <span className="flex-shrink-0">
          {open ? (
            <ChevronDown className="w-5 h-5 text-primary rotate-180 transition-transform duration-200" aria-hidden />
          ) : (
            <Plus className="w-5 h-5 text-primary transition-transform duration-200" aria-hidden />
          )}
        </span>
      </button>
      {open ? (
        <p className="px-5 pb-5 text-muted-foreground text-sm leading-relaxed border-t border-border/50 pt-4">
          {a}
        </p>
      ) : null}
    </div>
  );
}

/**
 * FAQ Section — accordion of frequently asked questions.
 * Lightweight CSS toggle (no framer-motion) — only interactive hydration needed.
 */
export function FaqSection({
  faqs = HOMEPAGE_FAQS,
}: {
  faqs?: readonly FaqEntry[];
}) {
  return (
    <section id="faq" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">FAQ</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">Frequently asked questions</h2>
          <p className="text-muted-foreground text-lg">
            Everything you need to know about running a live sports auction with BidWar.
          </p>
        </div>
        <div className="space-y-3">
          {faqs.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  );
}
