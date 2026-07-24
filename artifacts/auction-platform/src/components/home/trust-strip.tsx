import { Tv, Smartphone, Cloud, Wifi, Shield } from "lucide-react";
import { TRUST_STRIP_ITEMS } from "@/data/homepage-content";

const ICONS = [Tv, Smartphone, Cloud, Wifi, Shield];

/**
 * Trust Strip — short row of platform capability badges shown just below
 * the hero. Purely presentational; content lives in `homepage-content.ts`.
 */
export function TrustStrip() {
  return (
    <section id="trust" aria-label="Trust badges" className="py-10 px-6 border-y border-border/40 bg-card/20">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 md:gap-0 divide-y md:divide-y-0 md:divide-x divide-border/40">
          {TRUST_STRIP_ITEMS.map((item, i) => {
            const Icon = ICONS[i % ICONS.length];
            return (
              <div key={item.label} className="flex flex-col items-center gap-2 py-4 px-4 text-center">
                <Icon className="w-5 h-5 text-primary opacity-80" aria-hidden />
                <p className="text-xs text-muted-foreground font-medium leading-tight">{item.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
