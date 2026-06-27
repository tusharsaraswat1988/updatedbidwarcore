import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";
import { useBranding } from "@/hooks/use-branding";
import { getBrandLogoAlt, getObsBrandMarkSrc, getObsBroadcastLogoSrc } from "@/lib/brand-assets";
import { cldUrl } from "@/lib/cloudinary";
import { DevThemePicker } from "./DevThemePicker";const LED_TOP_BRAND_MAX_HEIGHT_PX = 48;
const LED_TOP_BRAND_MAX_WIDTH_PX = 220;

const LedTopBrandMark = memo(function LedTopBrandMark() {
  const { logos, brandName } = useBranding();
  const logoSrc = getObsBroadcastLogoSrc(logos) || getObsBrandMarkSrc(logos);

  if (logoSrc) {
    return (
      <img
        src={logoSrc}
        alt={getBrandLogoAlt(brandName)}
        className="block w-auto shrink-0 object-contain object-top"
        style={{
          maxHeight: LED_TOP_BRAND_MAX_HEIGHT_PX,
          maxWidth: LED_TOP_BRAND_MAX_WIDTH_PX,
          filter: "drop-shadow(0 2px 10px rgba(0,0,0,0.55))",
        }}
        loading="eager"
        decoding="async"
      />
    );
  }
  return (
    <div
      className="flex items-center gap-2 px-3 py-1.5"
      style={{ backgroundColor: "var(--accent)" }}
    >
      <span
        className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
        style={{ color: "var(--accent-on)" }}
      >
        BIDWAR
      </span>
      <span
        className="font-['Bebas_Neue'] text-xl tracking-[0.2em] italic"
        style={{ color: "var(--accent-on)" }}
      >
        LIVE
      </span>
    </div>
  );
});

/* ─── TopStrip ─── */

/**
 * TOP STRIP — BIDWAR LIVE brand, tournament line, LIVE pill, remaining counter.
 * Pure presentation. Sourced from TOURNAMENT + state.isBidding + queue.length.
 */
export const TopStrip = memo(function TopStrip({ view }: { view: LedView }) {
  const { tournament, state, remaining, totalPlayers } = view;
  const paused = view.derivedState === "paused";
  const live = state.isBidding && !paused;

  return (
    <div className="relative grid h-full min-h-[3.5rem] max-h-[3.5rem] grid-cols-[1fr_auto_1fr] items-center gap-6 overflow-visible px-[3%] border-b border-white/10 bg-black/40">
      {/* Center: OBS brand mark — pinned to canvas top edge */}      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2">
        <LedTopBrandMark />
      </div>

      {/* Left: tournament logo + name */}
      <div className="col-start-1 flex items-center gap-3 min-w-0 justify-self-start">
        <div className="hidden md:flex items-center gap-4 min-w-0 max-h-[3.25rem]">
          {tournament.logoUrl ? (
            <img
              src={cldUrl(tournament.logoUrl, "headerLogo")}
              alt=""
              className="h-12 w-auto max-w-[104px] shrink-0 object-contain"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="flex min-w-0 flex-col justify-center leading-none">
            <span className="text-[10px] font-mono uppercase tracking-[0.28em] text-white/45">
              Tournament
            </span>
            <span className="mt-0.5 truncate font-['Bebas_Neue'] text-xl tracking-[0.12em] uppercase text-white/95 md:text-2xl">
              {tournament.name}
            </span>
          </div>
        </div>
      </div>

      <div        aria-hidden
        className="col-start-2 w-[min(220px,18vw)] shrink-0"
      />

      {/* Right: LIVE pill + remaining + theme */}
      <div className="col-start-3 relative z-20 flex items-center justify-end gap-4 justify-self-end">        <div
          className={`flex items-center gap-2 px-4 py-1.5 border ${
            live
              ? "border-red-500/50 bg-red-500/10"
              : paused
                ? "border-amber-400/50 bg-amber-400/10"
                : "border-white/15 bg-white/5"
          }`}
        >
          {!live && !paused ? (
            <span className="text-[10px] font-mono uppercase tracking-[0.4em] text-white/40">
              Standby
            </span>
          ) : (
            <>
              <span
                className={`size-2 rounded-full ${
                  live
                    ? "bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"
                    : "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
                }`}
              />
              <span
                className={`text-[10px] font-mono uppercase tracking-[0.4em] ${
                  live ? "text-red-300" : "text-amber-300"
                }`}
              >
                {live ? "Live · Bidding Open" : "Paused"}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-end leading-none">
          <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-white/45">
            Players Remaining
          </span>
          <span className="font-['Bebas_Neue'] text-2xl tabular-nums mt-1 text-white/95">
            <span style={{ color: "var(--accent)" }}>{remaining}</span>
            <span className="text-white/40"> / {totalPlayers}</span>
          </span>
        </div>

        <DevThemePicker placement="inline" />
      </div>    </div>
  );
});