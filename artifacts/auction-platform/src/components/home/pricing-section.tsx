import { Trophy, Shield, Zap, Clock } from "lucide-react";
import { AuctionLicenseInfo } from "@/components/auction-license-info";
import { AUCTION_LICENSE_PRICING_NOTE } from "@/data/auction-license";
import type { PaymentPlan } from "@/components/payment-modal";

export type PricingTier = {
  label: string;
  price: string;
  gst: boolean;
  teams: string;
  desc: string;
  highlight: boolean;
  color: string;
  badge: string | null;
  discountedPrice: number | null;
  cta?: string;
};

export const PRICING_TIERS: readonly PricingTier[] = [
  { label: "Trial", price: "Free", gst: false, teams: "Up to 2 Teams", desc: "Run your first auction at zero cost. No credit card required.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: null, cta: "Signup for Free Demo" },
  { label: "Starter", price: "₹5,000", gst: true, teams: "Up to 4 Teams", desc: "Ideal for small club leagues and community tournaments.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: 4500 },
  { label: "Pro", price: "₹6,000", gst: true, teams: "Up to 8 Teams", desc: "Built for district and city-level franchise auctions.", highlight: true, color: "border-primary bg-primary/5", badge: "Most Popular", discountedPrice: 5400 },
  { label: "Advanced", price: "₹8,000", gst: true, teams: "Up to 12 Teams", desc: "Growing franchise leagues with larger rosters.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: 7200 },
  { label: "Elite", price: "₹9,000", gst: true, teams: "Up to 16 Teams", desc: "State-level and professional franchise tournaments.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: 8100 },
  { label: "Premium", price: "₹11,000", gst: true, teams: "Up to 22 Teams", desc: "Large multi-city leagues and regional championships.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: 9900 },
  { label: "Champion", price: "₹12,000", gst: true, teams: "Up to 30 Teams", desc: "National-level and flagship franchise auctions.", highlight: false, color: "border-border bg-card/30", badge: null, discountedPrice: 10800 },
] as const;

/**
 * Pricing Section — plan grid, discount banner, license info and bank transfer.
 */
export function PricingSection({
  tiers = PRICING_TIERS,
  onSelectPlan,
}: {
  tiers?: readonly PricingTier[];
  onSelectPlan: (plan: PaymentPlan) => void;
}) {
  return (
    <section id="pricing" className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Pricing</div>
          <h2 className="text-4xl md:text-5xl font-display font-black">One-time per-tournament pricing</h2>
          <p className="text-muted-foreground text-lg">Pay once per event. No monthly fees. No recurring charges.</p>
          <p className="text-sm text-muted-foreground/90 max-w-2xl mx-auto">{AUCTION_LICENSE_PRICING_NOTE}</p>
        </div>

        <div className="relative mb-8 rounded-2xl overflow-hidden border border-primary/25 bg-primary/5">
          <div className="relative flex flex-col sm:flex-row items-center justify-center gap-3 py-4 px-6 text-center">
            <div className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-sm font-black uppercase tracking-wide flex-shrink-0">
              10% OFF
            </div>
            <span className="text-foreground font-semibold text-sm">
              Limited-Time Offer — Save on all paid plans today
            </span>
            <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
              <Clock className="w-3 h-3" aria-hidden />
              <span>Limited period only</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {tiers.map((p) => {
            const handlePlanSelect = () =>
              p.discountedPrice
                ? onSelectPlan({ label: p.label, price: p.price, discountedPrice: p.discountedPrice })
                : onSelectPlan({ label: p.label, price: p.price, discountedPrice: 0 });
            const analyticsId = `pricing_${p.label.toLowerCase()}`;

            return (
              <div
                key={p.label}
                role="button"
                tabIndex={0}
                data-analytics={analyticsId}
                onClick={handlePlanSelect}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlanSelect();
                  }
                }}
                className={`group relative p-5 rounded-2xl border ${p.color} flex flex-col gap-4 cursor-pointer transition-colors duration-200 hover:border-primary/50 hover:bg-primary/[0.04] active:border-primary/60 active:bg-primary/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black uppercase tracking-wider whitespace-nowrap">
                    {p.badge}
                  </div>
                )}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{p.label}</p>
                  {p.discountedPrice ? (
                    <>
                      <p className="text-2xl font-display font-black">
                        ₹{p.discountedPrice.toLocaleString("en-IN")}
                      </p>
                      <p className="text-xs text-muted-foreground line-through leading-none mt-0.5">{p.price}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">per auction · all taxes included</p>
                    </>
                  ) : (
                    <>
                      <p className="text-2xl font-display font-black">{p.price}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">free forever</p>
                    </>
                  )}
                </div>
                <div className="border-t border-border/50 pt-3 space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Trophy className="w-4 h-4 text-primary flex-shrink-0" aria-hidden />
                    <span className="font-semibold text-sm">{p.teams}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground/80 leading-snug">
                    {p.label === "Trial" ? "Trial Auction License" : "Auction License · Auction Module only"}
                  </p>
                  <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                </div>
                <div className="mt-auto w-full py-2 rounded-xl text-sm font-bold text-center transition-colors duration-200 border border-border text-foreground group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary">
                  {p.cta ?? "Get started"}
                </div>
              </div>
            );
          })}
        </div>

        <AuctionLicenseInfo className="mt-10" />

        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5" aria-hidden />
            License activated after payment.{" "}
            <a href="/legal/licensing" className="text-primary hover:underline">Auction License details</a>
            {" · "}Contact us on WhatsApp for instant activation.
          </span>
          <span className="hidden sm:block text-border">|</span>
          <span className="flex items-center gap-1.5 text-primary/80">
            <Zap className="w-3.5 h-3.5" aria-hidden />
            AI features carry additional usage charges.
          </span>
        </div>

        <div className="mt-10 p-6 rounded-2xl border border-border bg-card/20">
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary" aria-hidden />
              </div>
            </div>
            <div className="flex-1">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Bank Transfer Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Account Name</p>
                  <p className="text-sm font-bold text-foreground">CWPDETAILERS AND MOTORS</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Account Number</p>
                  <p className="text-sm font-bold text-foreground font-mono">42105505194</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">IFSC Code</p>
                  <p className="text-sm font-bold text-foreground font-mono">SBIN0001773</p>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Branch</p>
                  <p className="text-sm font-bold text-foreground">Bhelupura, Varanasi</p>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 pt-4 border-t border-border/40">
            After payment, share the transaction screenshot on WhatsApp at <a href="https://wa.me/918707488250" className="text-primary underline underline-offset-2" target="_blank" rel="noopener noreferrer">+91 8707488250</a> for instant license activation. GST invoice provided on request.
          </p>
        </div>
      </div>
    </section>
  );
}
