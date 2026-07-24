import { Wifi, ShieldCheck, Clock, Globe, type LucideIcon } from "lucide-react";

export type WhyPoint = { icon: LucideIcon; title: string; desc: string };

export const BENEFITS_ITEMS: readonly WhyPoint[] = [
  { icon: Wifi, title: "Real-Time, Zero Lag", desc: "Bids, timers, and sold events sync across all screens within milliseconds. No refresh needed, no manual updates." },
  { icon: ShieldCheck, title: "Secure & Reliable", desc: "Role-based access controls, session-level organizer authentication, and audit logs for every bid and operator action." },
  { icon: Clock, title: "Setup in Minutes", desc: "From signup to live auction in under 15 minutes. No IT team, no installation, no configuration complexity." },
  { icon: Globe, title: "Works Everywhere", desc: "Cloud-based and browser-native. Run your auction from any venue — stadium, hotel, school, or open ground." },
] as const;

/**
 * Benefits Section — "Why BidWar" narrative column plus a live-auction status mock.
 */
export function BenefitsSection({
  items = BENEFITS_ITEMS,
}: {
  items?: readonly WhyPoint[];
}) {
  return (
    <section id="benefits" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-8">
            <div className="space-y-4">
              <div className="text-primary text-xs font-bold uppercase tracking-widest">Why BidWar</div>
              <h2 className="text-4xl md:text-5xl font-display font-black leading-tight">
                Auction infrastructure that performs under pressure
              </h2>
              <p className="text-muted-foreground text-lg leading-relaxed">
                Real auctions are high-energy, high-stakes events. BidWar is engineered to deliver flawless performance when the room is packed and every second counts.
              </p>
            </div>
            <div className="space-y-5">
              {items.map((w) => (
                <div key={w.title} className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <w.icon className="w-5 h-5 text-primary" aria-hidden />
                  </div>
                  <div>
                    <p className="font-display font-bold text-base text-foreground">{w.title}</p>
                    <p className="text-muted-foreground text-sm mt-1 leading-relaxed">{w.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-2xl overflow-hidden border border-border">
            <div className="bg-gradient-to-br from-card to-background p-6 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
                <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">Auction Live — 8 Teams</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { team: "Mumbai Hawks", purse: "₹62L", status: "leading", accent: "border-l-primary text-primary" },
                  { team: "Rajasthan Bulls", purse: "₹78L", status: "active", accent: "border-l-blue-400 text-blue-400" },
                  { team: "Chennai Kings", purse: "₹45L", status: "active", accent: "border-l-red-400 text-red-400" },
                  { team: "Delhi Stallions", purse: "₹91L", status: "full", accent: "border-l-green-400 text-green-400" },
                ].map((t) => (
                  <div key={t.team} className={`p-3 rounded-xl border border-border bg-card/40 border-l-[3px] ${t.accent}`}>
                    <p className="text-xs font-bold text-foreground truncate">{t.team}</p>
                    <p className="text-lg font-display font-black mt-0.5">{t.purse}</p>
                    <p className="text-[10px] text-muted-foreground capitalize">{t.status}</p>
                  </div>
                ))}
              </div>
              <div className="p-3 rounded-xl border border-primary/30 bg-primary/5">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Current Player</p>
                <p className="font-display font-black text-foreground text-base">Rahul Sharma — All-Rounder</p>
                <p className="text-primary font-bold text-lg mt-0.5">₹8,00,000 <span className="text-xs text-muted-foreground font-normal">base</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
