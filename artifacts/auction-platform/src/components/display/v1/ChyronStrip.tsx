import { memo } from "react";
import type { LedView, LiveSponsorDTO } from "@/lib/led-view/types";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import {
  getSponsorChyronItemStyle,
  getSponsorChyronLogoStyle,
  getSponsorChyronNameStyle,
  getSponsorChyronTypeStyle,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";

const chyronPreset = getBrandSurfacePreset("led-chyron");

/**
 * CHYRON STRIP — sponsor logos pulled live from the production tournament.
 * Falls back to brand mark if no sponsors are configured.
 */
const CHYRON_TICKER_DURATION_S = 36 / 1.3; // 30% faster than 36s baseline

function chyronTier(sponsor: LiveSponsorDTO): SponsorBroadcastTier {
  return sponsor.tier ?? "normal";
}

const ChyronSponsorSegment = memo(function ChyronSponsorSegment({
  sponsor,
}: {
  sponsor: LiveSponsorDTO;
}) {
  const tier = chyronTier(sponsor);

  return (
    <div
      className="flex items-center gap-3 shrink-0 h-full py-1"
      style={getSponsorChyronItemStyle(tier)}
    >
      {sponsor.logoUrl ? (
        <img
          src={sponsor.logoUrl}
          alt={sponsor.name}
          style={getSponsorChyronLogoStyle(tier)}
        />
      ) : null}
      <div className="flex flex-col leading-none">
        <span
          className="font-['Bebas_Neue'] text-sm tracking-[0.25em] uppercase"
          style={getSponsorChyronNameStyle(tier)}
        >
          {sponsor.name}
        </span>
        <span
          className="font-mono uppercase tracking-[0.3em]"
          style={getSponsorChyronTypeStyle(tier)}
        >
          {sponsor.type}
        </span>
      </div>
      <span className="text-white/15 ml-2">•</span>
    </div>
  );
});

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
        <span className="font-['Bebas_Neue'] text-base md:text-lg font-bold tracking-[0.3em] uppercase">
          Official Partners
        </span>
      </div>

      <div className="relative overflow-hidden h-full flex items-center">
        {loop.length > 0 ? (
          <div
            className="flex items-center gap-10 whitespace-nowrap"
            style={{ animation: `auction-ticker-scroll ${CHYRON_TICKER_DURATION_S}s linear infinite` }}
            aria-hidden
          >
            {loop.map((s, i) => (
              <ChyronSponsorSegment key={`${s.name}-${s.tier ?? "normal"}-${i}`} sponsor={s} />
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

      <div className="flex items-center pl-4 border-l border-white/10">
        {branding?.miniLogoUrl ? (
          <img
            src={branding.miniLogoUrl}
            alt={branding.brandName ?? "BidWar"}
            className={chyronPreset.sizeClass}
          />
        ) : (
          <div
            className={`${chyronPreset.sizeClass} grid place-items-center`}
            style={{ backgroundColor: "var(--accent)", color: "var(--accent-on)" }}
          >
            <span className="font-['Bebas_Neue'] text-sm tracking-tighter italic">
              {branding?.miniBrandText ?? "BW"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
