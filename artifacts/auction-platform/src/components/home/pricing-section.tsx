import { useState } from "react";
import { Trophy, Shield, Check, Clock, ChevronDown } from "lucide-react";
import type { PaymentPlan } from "@/components/payment-modal";
import { waMeUrl } from "@/lib/public-site-links";

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
  category: "club" | "franchise";
  cta?: string;
};

export const PRICING_TIERS: readonly PricingTier[] = [
  {
    label: "Trial",
    price: "Free",
    gst: false,
    teams: "Up to 2 Teams",
    desc: "Test the operator console & mobile bidding at zero cost.",
    highlight: false,
    color: "border-white/10 bg-card/40",
    badge: null,
    discountedPrice: null,
    category: "club",
    cta: "Start Free Trial",
  },
  {
    label: "Starter",
    price: "₹5,000",
    gst: true,
    teams: "Up to 4 Teams",
    desc: "Small club leagues and community tournaments.",
    highlight: false,
    color: "border-white/10 bg-card/40",
    badge: null,
    discountedPrice: 3750,
    category: "club",
    cta: "Get Starter",
  },
  {
    label: "Pro",
    price: "₹6,000",
    gst: true,
    teams: "Up to 8 Teams",
    desc: "District and city-level franchise player auctions.",
    highlight: true,
    color: "border-primary/80 bg-primary/10 shadow-[var(--shadow-broadcast)]",
    badge: "Most Popular",
    discountedPrice: 4500,
    category: "club",
    cta: "Get Pro License",
  },
  {
    label: "Advanced",
    price: "₹8,000",
    gst: true,
    teams: "Up to 12 Teams",
    desc: "Growing franchise leagues with larger rosters.",
    highlight: false,
    color: "border-white/10 bg-card/40",
    badge: null,
    discountedPrice: 6000,
    category: "franchise",
    cta: "Get Advanced",
  },
  {
    label: "Elite",
    price: "₹9,000",
    gst: true,
    teams: "Up to 16 Teams",
    desc: "State-level and premier franchise tournaments.",
    highlight: true,
    color: "border-primary/80 bg-primary/10 shadow-[var(--shadow-broadcast)]",
    badge: "Recommended",
    discountedPrice: 6750,
    category: "franchise",
    cta: "Get Elite",
  },
  {
    label: "Premium",
    price: "₹11,000",
    gst: true,
    teams: "Up to 22 Teams",
    desc: "Multi-city leagues and regional championships.",
    highlight: false,
    color: "border-white/10 bg-card/40",
    badge: null,
    discountedPrice: 8250,
    category: "franchise",
    cta: "Get Premium",
  },
  {
    label: "Champion",
    price: "₹12,000",
    gst: true,
    teams: "Up to 30 Teams",
    desc: "Flagship mega-franchise auctions with maximum capacity.",
    highlight: false,
    color: "border-white/10 bg-card/40",
    badge: null,
    discountedPrice: 9000,
    category: "franchise",
    cta: "Get Champion",
  },
] as const;

/**
 * Compact, Screen-Fitting Pricing Section — 1-screen viewport design.
 */
export function PricingSection({
  tiers = PRICING_TIERS,
  onSelectPlan,
}: {
  tiers?: readonly PricingTier[];
  onSelectPlan: (plan: PaymentPlan) => void;
}) {
  const [activeCategory, setActiveCategory] = useState<"club" | "franchise">("club");
  const [showBankDetails, setShowBankDetails] = useState(false);

  const filteredTiers = tiers.filter((t) => t.category === activeCategory);

  return (
    <section id="pricing" className="py-12 md:py-16 px-5">
      <div className="max-w-6xl mx-auto">
        {/* Compact Header */}
        <div className="text-center mb-6 space-y-2">
          <div className="text-[10px] uppercase tracking-[0.24em] text-primary font-semibold font-mono">
            One-Time Tournament License
          </div>
          <h2 className="text-2xl md:text-4xl font-display font-bold text-foreground">
            Simple, Transparent Pricing. No Monthly Fees.
          </h2>
          <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 px-2.5 py-0.5 font-mono text-[10px] font-bold text-primary border border-primary/30">
              <Clock className="w-3 h-3" /> 25% LIMITED DISCOUNT INCLUDED
            </span>
            <span>·</span>
            <span>Pay once per tournament · All screens & features included</span>
          </div>
        </div>

        {/* Category Switcher Tabs */}
        <div className="flex justify-center mb-6">
          <div className="inline-flex rounded-full border border-white/10 bg-black/40 p-1 backdrop-blur-md">
            <button
              type="button"
              onClick={() => setActiveCategory("club")}
              className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                activeCategory === "club"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Club Leagues (2 – 8 Teams)
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory("franchise")}
              className={`rounded-full px-5 py-2 text-xs font-bold transition ${
                activeCategory === "franchise"
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Franchise & State Leagues (12 – 30 Teams)
            </button>
          </div>
        </div>

        {/* Compact 1-Row Pricing Cards Grid */}
        <div
          className={`grid gap-4 ${
            activeCategory === "club"
              ? "grid-cols-1 sm:grid-cols-3"
              : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4"
          }`}
        >
          {filteredTiers.map((p) => {
            const handlePlanSelect = () =>
              p.discountedPrice
                ? onSelectPlan({ label: p.label, price: p.price, discountedPrice: p.discountedPrice })
                : onSelectPlan({ label: p.label, price: p.price, discountedPrice: 0 });

            return (
              <div
                key={p.label}
                role="button"
                tabIndex={0}
                onClick={handlePlanSelect}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handlePlanSelect();
                  }
                }}
                className={`group relative flex flex-col justify-between p-5 rounded-2xl border ${p.color} transition-all duration-200 hover:-translate-y-1 hover:border-primary/60 cursor-pointer backdrop-blur-sm`}
              >
                {p.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[image:var(--gradient-gold)] text-primary-foreground text-[9px] font-mono font-bold uppercase tracking-wider shadow-md whitespace-nowrap">
                    ★ {p.badge}
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">
                      {p.label}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded bg-white/10 px-2 py-0.5 font-mono text-[10px] text-foreground font-semibold">
                      <Trophy className="w-3 h-3 text-primary" /> {p.teams}
                    </span>
                  </div>

                  <div className="mt-3">
                    {p.discountedPrice ? (
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-display font-bold text-foreground">
                          ₹{p.discountedPrice.toLocaleString("en-IN")}
                        </span>
                        <span className="text-xs text-muted-foreground line-through font-mono">
                          {p.price}
                        </span>
                      </div>
                    ) : (
                      <div className="text-3xl font-display font-bold text-foreground">Free</div>
                    )}
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {p.discountedPrice ? "per tournament · all taxes included" : "free forever · no card needed"}
                    </div>
                  </div>

                  <p className="mt-2.5 text-xs text-muted-foreground leading-relaxed">
                    {p.desc}
                  </p>

                  <div className="mt-4 space-y-1.5 border-t border-white/10 pt-3 text-[11px] text-foreground/90 font-mono">
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Operator Console + Undo</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>Mobile Bidding PWA (Any Phone)</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>1080p LED Stage Display</span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    className={`w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition ${
                      p.highlight
                        ? "gold-button gold-button-hover shadow-md"
                        : "ghost-button ghost-button-hover text-foreground hover:bg-primary/20 hover:text-primary"
                    }`}
                  >
                    {p.cta ?? "Get Started →"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compact Footer Note & Bank Details Accordion */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground border-t border-white/10 pt-4">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <span>Instant license activation on WhatsApp:</span>
            <a
              href={waMeUrl("Hi, I want to activate a BidWar tournament license.")}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary font-mono font-bold hover:underline"
            >
              +91 8707488250
            </a>
          </div>

          <button
            type="button"
            onClick={() => setShowBankDetails((v) => !v)}
            className="flex items-center gap-1 text-[11px] font-mono text-muted-foreground hover:text-foreground transition"
          >
            <span>Direct Bank Transfer / NEFT / RTGS Details</span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showBankDetails ? "rotate-180" : ""}`} />
          </button>
        </div>

        {/* Collapsible Bank Transfer Details Drawer */}
        {showBankDetails && (
          <div className="mt-3 p-4 rounded-xl border border-white/10 bg-black/50 text-xs animate-in fade-in duration-200">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-mono">Account Name</span>
                <span className="font-bold text-foreground">CWPDETAILERS AND MOTORS</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-mono">Account Number</span>
                <span className="font-mono font-bold text-foreground">42105505194</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-mono">IFSC Code</span>
                <span className="font-mono font-bold text-foreground">SBIN0001773</span>
              </div>
              <div>
                <span className="text-[9px] uppercase tracking-wider text-muted-foreground block font-mono">Bank Branch</span>
                <span className="font-bold text-foreground">SBI, Bhelupura, Varanasi</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
