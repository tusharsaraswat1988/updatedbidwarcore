import { memo } from "react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";

/**
 * Persistent venue branding — visible from the back row without
 * competing with tournament identity in the header.
 */
export const BidwarBrandWatermark = memo(function BidwarBrandWatermark({
  accent = "#a78bfa",
}: {
  accent?: string;
}) {
  const { logos, brandName, poweredByText } = useBranding();
  const label = poweredByText?.trim() || "Powered by BidWar";

  return (
    <div
      className="absolute z-[5] pointer-events-none select-none flex items-center gap-2 rounded-full px-3 py-1.5 md:px-4 md:py-2 backdrop-blur-sm"
      style={{
        left: "var(--led-safe-x, clamp(1.5rem, 5vw, 6rem))",
        bottom: "calc(var(--led-safe-bottom, 3rem) + 2.75rem)",
        backgroundColor: "rgba(0,0,0,0.45)",
        border: `1px solid ${accent}35`,
        boxShadow: `0 0 24px ${accent}18`,
      }}
      aria-hidden
    >
      <img
        src={cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.webp"}
        alt=""
        className="h-5 md:h-7 w-auto opacity-90"
        loading="eager"
        decoding="async"
      />
      <span
        className="font-display font-bold uppercase tracking-[0.2em] text-white/70 text-[10px] md:text-xs lg:text-sm whitespace-nowrap"
      >
        {label}
      </span>
      <span className="hidden lg:inline font-display font-black text-white/90 text-sm tracking-widest uppercase ml-1">
        {brandName}
      </span>
    </div>
  );
});
