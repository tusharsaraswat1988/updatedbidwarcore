import { memo, useMemo, type HTMLAttributes } from "react";
import type { SponsorLogo } from "@/lib/sponsor-logo";
import { formatSponsorTickerSegment } from "@/lib/sponsor-logo";

/** Ribbon content height (px) — used by Broadcast Overlay stacking. */
export const SPONSOR_RIBBON_HEIGHT_PX = 34;
/** Bottom inset above TV safe area (px). */
export const SPONSOR_RIBBON_SAFE_INSET_PX = 8;
export const SPONSOR_RIBBON_TOTAL_HEIGHT_PX = SPONSOR_RIBBON_HEIGHT_PX + SPONSOR_RIBBON_SAFE_INSET_PX;

const GOLD_BORDER = "rgba(201, 162, 39, 0.45)";

function TickerCopy({ names, ...rest }: { names: string[] } & HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className="inline-flex shrink-0 items-center text-sm md:text-base font-semibold tracking-wide text-white/75"
      {...rest}
    >
      {names.map((part, i) => (
        <span key={i}>
          {part}
          <span className="text-white/45"> • </span>
        </span>
      ))}
    </span>
  );
}

/**
 * Bottom sponsor ribbon — readable at distance, secondary to player/bid focus.
 * Names only; top-right logo carousel remains the primary sponsor showcase.
 */
export const SponsorTicker = memo(function SponsorTicker({
  logos,
}: {
  logos: SponsorLogo[];
  /** Kept for API compatibility. */
  themeAccent?: string;
}) {
  const names = useMemo(
    () => logos.map(formatSponsorTickerSegment).filter((n): n is string => !!n),
    [logos],
  );

  if (!names.length) return null;

  const baseDuration = Math.min(30, Math.max(25, 25 + names.length));
  const duration = baseDuration * 0.9;

  return (
    <div
      className="relative z-20 flex-shrink-0 w-full"
      style={{ paddingBottom: `max(${SPONSOR_RIBBON_SAFE_INSET_PX}px, env(safe-area-inset-bottom, 0px))` }}
    >
      <div
        className="w-full overflow-hidden bg-black/55"
        style={{ borderTop: `1px solid ${GOLD_BORDER}` }}
      >
        <div
          className="flex items-center overflow-hidden"
          style={{ height: SPONSOR_RIBBON_HEIGHT_PX }}
        >
          {/* contentA + contentB side-by-side; -50% shift = exactly one copy width */}
          <div
            className="flex w-max will-change-transform"
            style={{ animation: `sponsorTicker ${duration}s linear infinite` }}
          >
            <TickerCopy names={names} />
            <TickerCopy names={names} aria-hidden />
          </div>
        </div>
      </div>
      <style>{`
        @keyframes sponsorTicker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
});
