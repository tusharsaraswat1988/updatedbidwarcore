import { Radio } from "lucide-react";
import { BROADCAST_ECOSYSTEM_SPOKES } from "@/data/homepage-content";

/**
 * Broadcast Ecosystem — one live feed, six connected surfaces. Renders a
 * center "hub" with animated connector lines to each surface. Content is
 * data-driven via `BROADCAST_ECOSYSTEM_SPOKES`.
 */
export function BroadcastEcosystem() {
  const left = BROADCAST_ECOSYSTEM_SPOKES.filter((s) => s.side === "left");
  const right = BROADCAST_ECOSYSTEM_SPOKES.filter((s) => s.side === "right");

  return (
    <section id="ecosystem" aria-labelledby="ecosystem-heading" className="py-24 px-6 border-t border-border/40">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14 space-y-4">
          <div className="text-primary text-xs font-bold uppercase tracking-widest">Broadcast Ecosystem</div>
          <h2 id="ecosystem-heading" className="text-3xl md:text-5xl font-display font-black">
            One live feed. Six connected surfaces.
          </h2>
        </div>

        <div className="relative rounded-2xl border border-border bg-card/20 p-6 md:p-10 overflow-hidden">
          <div className="relative grid items-center gap-6 lg:grid-cols-[1fr_1.2fr_1fr]">
            <div className="relative z-10 space-y-3">
              {left.map((spoke) => (
                <div key={spoke.title} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/30 p-4">
                  <div>
                    <div className="font-display font-bold text-base text-foreground">{spoke.title}</div>
                    <div className="text-xs text-muted-foreground">{spoke.description}</div>
                  </div>
                  <span className="text-[10px] font-mono text-primary flex-shrink-0">&rarr; HUB</span>
                </div>
              ))}
            </div>

            <div className="relative mx-auto aspect-square w-full max-w-sm">
              <svg
                viewBox="0 0 400 400"
                className="pointer-events-none absolute inset-0 hidden h-full w-full lg:block"
                aria-hidden="true"
              >
                <defs>
                  <linearGradient id="ecosystem-line-gradient" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="currentColor" stopOpacity="0" className="text-primary" />
                    <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" className="text-primary" />
                    <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-primary" />
                  </linearGradient>
                </defs>
                {[
                  { x2: -40, y2: 60 }, { x2: -40, y2: 200 }, { x2: -40, y2: 340 },
                  { x2: 440, y2: 60 }, { x2: 440, y2: 200 }, { x2: 440, y2: 340 },
                ].map((p, i) => (
                  <line
                    key={i}
                    x1="200" y1="200" x2={p.x2} y2={p.y2}
                    stroke="url(#ecosystem-line-gradient)"
                    strokeWidth="1.2"
                    strokeDasharray="4 6"
                    className="ecosystem-connector-line"
                    style={{ animationDelay: `${i * 0.25}s` }}
                  />
                ))}
              </svg>

              <div className="absolute inset-0 flex items-center justify-center">
                <div className="relative">
                  <span className="absolute inset-0 -m-2 animate-ping rounded-full bg-primary/25" aria-hidden />
                  <div className="relative flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 font-display text-sm font-black text-primary-foreground">
                    <Radio className="w-4 h-4" aria-hidden />
                    BidWar Live Hub
                  </div>
                </div>
              </div>
            </div>

            <div className="relative z-10 space-y-3">
              {right.map((spoke) => (
                <div key={spoke.title} className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card/30 p-4">
                  <span className="text-[10px] font-mono text-primary flex-shrink-0">HUB &larr;</span>
                  <div className="text-right">
                    <div className="font-display font-bold text-base text-foreground">{spoke.title}</div>
                    <div className="text-xs text-muted-foreground">{spoke.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes ecosystem-flow { 0% { stroke-dashoffset: 40; opacity: 0.35; } 50% { opacity: 0.9; } 100% { stroke-dashoffset: 0; opacity: 0.35; } }
        .ecosystem-connector-line { animation: ecosystem-flow 2.4s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ecosystem-connector-line { animation: none !important; } }
      `}</style>
    </section>
  );
}
