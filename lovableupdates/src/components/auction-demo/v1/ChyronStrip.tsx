import { memo } from "react";
import type { LedView } from "@/lib/auction-demo/use-auction-state";

/**
 * CHYRON STRIP — sponsor logos pulled live from the production tournament.
 * Falls back to brand mark if no sponsors are configured.
 */
export const ChyronStrip = memo(function ChyronStrip({ view }: { view: LedView }) {
  const sponsors = view.sponsors ?? [];
  const branding = view.branding;
  const loop =
    sponsors.length > 0 ? [...sponsors, ...sponsors, ...sponsors] : [];

  return (
    <div className="border-t border-white/10 bg-black/50 h-full grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]">
      <div
        className="h-full px-4 grid place-items-center"
        style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
      >
        <span className="font-['Bebas_Neue'] text-sm tracking-[0.3em] uppercase">
          Official Partners
        </span>
      </div>

      <div className="relative overflow-hidden h-full flex items-center">
        {loop.length > 0 ? (
          <div
            className="flex items-center gap-10 whitespace-nowrap"
            style={{ animation: "auction-ticker-scroll 36s linear infinite" }}
            aria-hidden
          >
            {loop.map((s, i) => (
              <div key={`${s.name}-${i}`} className="flex items-center gap-3 shrink-0 h-full py-1">
                {s.logoUrl ? (
                  <img
                    src={s.logoUrl}
                    alt={s.name}
                    className="h-[80%] max-h-10 w-auto object-contain bg-white/95 rounded-sm px-2 py-1"
                  />
                ) : null}
                <div className="flex flex-col leading-none">
                  <span className="font-['Bebas_Neue'] text-sm tracking-[0.25em] uppercase text-white/90">
                    {s.name}
                  </span>
                  <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-white/45">
                    {s.type}
                  </span>
                </div>
                <span className="text-white/15 ml-2">•</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">
            {view.tournament.name}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center gap-2 pl-4 border-l border-white/10">
        {branding?.miniLogoUrl ? (
          <img
            src={branding.miniLogoUrl}
            alt={branding.brandName}
            className="h-7 w-7 object-contain"
          />
        ) : (
          <div
            className="h-7 w-7 grid place-items-center"
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            <span className="font-['Bebas_Neue'] text-sm tracking-tighter italic">
              {branding?.miniBrandText ?? "BW"}
            </span>
          </div>
        )}
        <div className="flex flex-col leading-none">
          <span className="font-['Bebas_Neue'] text-base tracking-widest uppercase text-white/85">
            {branding?.brandName ?? "BidWar"}
          </span>
          <span className="text-[8px] font-mono uppercase tracking-[0.25em] text-white/40">
            {branding?.poweredByText ?? "Powered by BidWar"}
          </span>
        </div>
      </div>
    </div>
  );
});
