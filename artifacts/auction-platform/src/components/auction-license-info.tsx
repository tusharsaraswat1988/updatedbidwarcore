import { Info } from "lucide-react";
import {
  AUCTION_LICENSE_CHECKOUT_NOTE,
  AUCTION_LICENSE_CLARIFICATION,
  AUCTION_LICENSE_CLARIFICATION_FOOTNOTE,
  AUCTION_LICENSE_CLARIFICATION_INTRO,
  AUCTION_LICENSE_CONSUMPTION,
  AUCTION_LICENSE_EXCLUSIONS,
  AUCTION_LICENSE_EXCLUSIONS_FOOTNOTE,
  AUCTION_LICENSE_INCLUDES,
  AUCTION_LICENSE_INTRO,
  AUCTION_LICENSE_PRICING_NOTE,
  AUCTION_LICENSE_USAGE_RESTRICTION,
} from "@/data/auction-license";

type AuctionLicenseInfoProps = {
  variant?: "full" | "compact" | "checkout";
  className?: string;
};

function BulletList({ items }: { items: readonly string[] }) {
  return (
    <ul className="space-y-1.5 text-sm text-white/70 leading-relaxed">
      {items.map((item) => (
        <li key={item} className="flex gap-2">
          <span className="text-primary mt-0.5 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function AuctionLicenseInfo({ variant = "full", className = "" }: AuctionLicenseInfoProps) {
  if (variant === "checkout") {
    return (
      <div className={`rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 ${className}`}>
        <p className="text-[11px] text-white/50 leading-relaxed">{AUCTION_LICENSE_CHECKOUT_NOTE}</p>
        <a
          href="/legal/licensing"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-block text-[11px] text-primary hover:underline"
        >
          View Auction License details
        </a>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`rounded-xl border border-border/60 bg-card/20 px-4 py-3 ${className}`}>
        <div className="flex items-start gap-2.5">
          <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-white">Auction License only</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{AUCTION_LICENSE_PRICING_NOTE}</p>
            <a href="/legal/licensing" className="text-xs text-primary hover:underline">
              Full licensing policy
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border border-border/60 bg-card/20 p-6 md:p-8 space-y-8 ${className}`}>
      <section className="space-y-3">
        <h3 className="font-display font-bold text-lg text-white">Auction License Definition</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_INTRO}</p>
        <p className="text-sm font-medium text-white/80">Each Auction License includes:</p>
        <BulletList items={AUCTION_LICENSE_INCLUDES} />
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_USAGE_RESTRICTION}</p>
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_CONSUMPTION}</p>
      </section>

      <section className="space-y-3 border-t border-border/40 pt-6">
        <h3 className="font-display font-bold text-lg text-white">Exclusions</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">The Auction License does NOT include:</p>
        <BulletList items={AUCTION_LICENSE_EXCLUSIONS} />
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_EXCLUSIONS_FOOTNOTE}</p>
      </section>

      <section className="space-y-3 border-t border-border/40 pt-6">
        <h3 className="font-display font-bold text-lg text-white">Licensing Clarification</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_CLARIFICATION_INTRO}</p>
        <ol className="space-y-3 text-sm text-white/70 leading-relaxed">
          {AUCTION_LICENSE_CLARIFICATION.map((item) => (
            <li key={item.title}>
              <span className="font-semibold text-white">{item.title}</span>
              <span className="text-muted-foreground"> — {item.description}</span>
            </li>
          ))}
        </ol>
        <p className="text-sm text-muted-foreground leading-relaxed">{AUCTION_LICENSE_CLARIFICATION_FOOTNOTE}</p>
      </section>
    </div>
  );
}
