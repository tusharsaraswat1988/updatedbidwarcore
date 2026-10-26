import { memo, useState } from "react";
import { ChevronDown, HelpCircle } from "lucide-react";

export const ACADEMY_FAQS = [
  {
    q: "Can team owners bid from their own mobile phones while seated in the venue?",
    a: "Yes! Each team receives a secure private access code or team owner link. Owners can place live bids from their mobile browsers with a single tap, while the auctioneer console updates instantly with zero latency.",
  },
  {
    q: "What happens if the venue Wi-Fi disconnects in the middle of a live bid?",
    a: "BidWar uses distributed real-time state synchronization with offline tolerance. If a connection dips, bids placed are safely recorded on the cloud server, and the auctioneer can immediately pause the round or continue from a phone hotspot backup without losing data.",
  },
  {
    q: "Can we run a practice or rehearsal auction with test players before the main event?",
    a: "Absolutely. You can import dummy players, test the timer, sound effects, and stage LED projector. Once your committee is satisfied, simply click 'Reset Auction' to restore team purse balances and player lots to draft state.",
  },
  {
    q: "Can we customize team purse budgets, player categories, and bid increments?",
    a: "Yes. You have full control over franchise purse limits (e.g. 50 Lakhs or 1 Crore), player roles (Batsman, Fast Bowler, Spin Bowler, All-Rounder, Wicket Keeper), tiers (Icon, Platinum, Gold, Silver), and progressive bid increment jumps.",
  },
  {
    q: "How do we display the auction on a big projector screen or LED video wall?",
    a: "Open your tournament's Live Viewer stage URL in a browser on the laptop connected to the projector or TV via HDMI. Press F11 to enter full-screen mode for TV broadcast-grade graphics, live timer countdowns, and real-time team purse meters.",
  },
  {
    q: "How does BidWar handle unsold players?",
    a: "When a player receives no bids, they are automatically placed into the 'Unsold Pool'. You can run accelerated bidding rounds at the end of the auction with reduced base prices or custom nominations.",
  },
];

export const AcademyFaq = memo(function AcademyFaq() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  function toggle(idx: number) {
    setOpenIndex((cur) => (cur === idx ? null : idx));
  }

  // Generate FAQPage schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: ACADEMY_FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.a,
      },
    })),
  };

  return (
    <section className="space-y-6">
      {/* FAQ Schema for Google Rich Snippets */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div>
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary mb-1">
          <HelpCircle className="h-4 w-4" />
          Common Questions
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
          Frequently Asked Questions for Organisers
        </h2>
        <p className="text-sm text-muted-foreground mt-1 max-w-xl">
          Everything you need to know about setting up and executing a flawless live sports auction with BidWar.
        </p>
      </div>

      <div className="space-y-3">
        {ACADEMY_FAQS.map((faq, idx) => {
          const isOpen = openIndex === idx;
          return (
            <div
              key={`faq-${idx}`}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                isOpen
                  ? "border-primary/40 bg-card/40 shadow-sm"
                  : "border-border/60 bg-card/20 hover:border-border"
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="flex w-full items-center justify-between gap-4 p-4 sm:p-5 text-left font-bold text-foreground text-sm sm:text-base leading-snug"
                aria-expanded={isOpen}
              >
                <span>{faq.q}</span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-primary transition-transform duration-200 ${
                    isOpen ? "rotate-180 text-amber-400" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 text-xs sm:text-sm text-muted-foreground leading-relaxed border-t border-border/20 pt-3">
                  {faq.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
});
