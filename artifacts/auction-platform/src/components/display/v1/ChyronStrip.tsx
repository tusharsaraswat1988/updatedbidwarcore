import { memo } from "react";
import type { LedView, LiveSponsorDTO } from "@/lib/led-view/types";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import {
  getSponsorChyronItemStyle,
  getSponsorChyronLogoStyle,
  getSponsorChyronNameStyle,
  getSponsorChyronTypeStyle,
  type SponsorBroadcastTier,
} from "@/lib/sponsor-broadcast-priority-styles";
import { LED_META_LABEL_CLASS } from "@/lib/led-display-typography";
import { ChyronTickerScroller } from "./ChyronTickerScroller";

const chyronPreset = getBrandSurfacePreset("led-chyron");

/**
 * CHYRON STRIP — sponsor logos pulled live from the production tournament.
 * Falls back to brand mark if no sponsors are configured.
 */

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
  const { logos, brandName, iconVersion } = useBranding();
  const chyronLogoSrc =
    cldUrl(logos.mini, "headerLogo") ||
    getBrandLogoSrc(logos, chyronPreset.logoOrder, iconVersion);

  return (
    <div className="border-t border-white/10 bg-black/50 h-full grid grid-cols-[auto_1fr_auto] items-center gap-4 pr-[3%]">
      <div
        className="relative h-full shrink-0 flex items-center px-4 md:px-5"
        style={{
          backgroundColor: "var(--accent)",
          color: "var(--accent-on)",
          clipPath: "polygon(0 0, calc(100% - 10px) 0, 100% 100%, 0 100%)",
        }}
      >
        <div className="flex flex-col leading-none gap-1" aria-label="Our Sponsors">
          <span className={`${LED_META_LABEL_CLASS} opacity-70`}>Our</span>
          <span className={`${LED_META_LABEL_CLASS} tracking-[0.22em]`}>Sponsors</span>
        </div>
      </div>

      <div className="relative overflow-hidden h-full flex items-center">
        {sponsors.length > 0 ? (
          <ChyronTickerScroller
            items={sponsors}
            renderItem={(sponsor, index) => (
              <ChyronSponsorSegment
                key={`${sponsor.name}-${sponsor.tier ?? "normal"}-${index}`}
                sponsor={sponsor}
              />
            )}
          />
        ) : (
          <div className="px-4 text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">
            {view.tournament.name}
          </div>
        )}
        <div className="absolute inset-y-0 left-0 w-10 bg-gradient-to-r from-black to-transparent pointer-events-none" />
        <div className="absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-black to-transparent pointer-events-none" />
      </div>

      <div className="flex items-center pl-4 border-l border-white/10">
        {chyronLogoSrc ? (
          <img
            src={chyronLogoSrc}
            alt={getBrandLogoAlt(brandName ?? branding?.brandName)}
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
