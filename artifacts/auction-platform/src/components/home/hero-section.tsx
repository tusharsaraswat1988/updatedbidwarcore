import { Star, ArrowRight, Gavel } from "lucide-react";

/**
 * Hero — headline, CTAs, live-auction mock.
 * Static markup (no framer-motion) to keep LCP / hydration cheap.
 * Soft ambient glow uses a light blur (not a large paint-heavy filter).
 */
export function HeroSection({
  onStartFree,
  onOperatorLogin,
}: {
  onStartFree: () => void;
  onOperatorLogin: () => void;
}) {
  return (
    <section id="hero" className="relative pt-32 pb-24 px-6 overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[640px] h-[320px] bg-primary/10 rounded-full blur-3xl opacity-80" />
      </div>
      <div className="relative max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold uppercase tracking-widest">
            <Star className="w-3 h-3" aria-hidden />
            India&rsquo;s Live Sports Auction Platform
          </div>
          <h1 className="text-5xl md:text-7xl font-display font-black leading-none tracking-tight">
            Run Professional{" "}
            <span className="text-primary">Sports Auctions</span>{" "}
            Live
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            IPL-grade auction infrastructure for cricket, football, kabaddi and all franchise leagues.
            Real-time bidding, LED broadcast display, team owner mobile panels — one platform, every screen.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button
            type="button"
            onClick={onStartFree}
            data-analytics="hero_start_trial"
            className="w-full sm:w-auto px-8 py-4 rounded-xl bg-primary text-primary-foreground font-display font-black text-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
          >
            Start Free <ArrowRight className="w-5 h-5" aria-hidden />
          </button>
          <button
            type="button"
            onClick={onOperatorLogin}
            data-analytics="hero_operator_login"
            className="w-full sm:w-auto px-8 py-4 rounded-xl border border-border text-foreground font-semibold text-lg hover:bg-card/50 transition-colors flex items-center justify-center gap-2"
          >
            <Gavel className="w-5 h-5 text-muted-foreground" aria-hidden />
            Operator Login
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><CheckDot /> Free trial — 2 teams</span>
          <span className="flex items-center gap-1.5"><CheckDot /> No setup fee</span>
          <span className="flex items-center gap-1.5"><CheckDot /> Works on any device</span>
          <span className="flex items-center gap-1.5"><CheckDot /> No app install needed</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto mt-16 rounded-2xl overflow-hidden border border-border">
        <div className="bg-gradient-to-br from-card to-background p-8 md:p-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 bg-background rounded-xl border border-border p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full bg-green-500 animate-pulse" aria-hidden />
                <span className="text-xs text-muted-foreground font-mono uppercase tracking-widest">Live Auction — Round 3</span>
              </div>
              <div>
                <p className="text-4xl font-display font-black text-primary">₹14,00,000</p>
                <p className="text-sm text-muted-foreground mt-1">Current Bid — Mumbai Hawks</p>
              </div>
              <div className="flex gap-2 flex-wrap">
                {["MH ₹14L", "RB ₹12L", "CH ₹11L", "GT ₹10L"].map((t, i) => (
                  <div
                    key={t}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border ${
                      i === 0
                        ? "border-primary/50 bg-primary/10 text-primary"
                        : "border-border bg-card/50 text-muted-foreground"
                    }`}
                  >
                    {t}
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-3">
              {[
                { label: "SOLD", color: "text-green-400 border-green-500/30 bg-green-500/10", count: "42" },
                { label: "UNSOLD", color: "text-red-400 border-red-500/30 bg-red-500/10", count: "8" },
                { label: "REMAINING", color: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10", count: "28" },
              ].map((s) => (
                <div key={s.label} className={`p-4 rounded-xl border ${s.color} flex items-center justify-between`}>
                  <span className="text-xs font-bold uppercase tracking-wider">{s.label}</span>
                  <span className="text-2xl font-display font-black">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function CheckDot() {
  return <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" aria-hidden />;
}
