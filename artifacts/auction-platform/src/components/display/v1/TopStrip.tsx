import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";
import { cldUrl } from "@/lib/cloudinary";
import { LedTopBrandMark } from "./led-top-brand-mark";
import { DevThemePicker } from "./DevThemePicker";
import { TrialLicenseBadge } from "@/components/trial-license-badge";

/**
 * TOP STRIP — OBS crest (center), tournament line, LIVE pill, remaining counter.
 */
export const TopStrip = memo(function TopStrip({ view }: { view: LedView }) {
  const { tournament, state, remaining, totalPlayers } = view;
  const paused = view.derivedState === "paused";
  const awaitingNext = view.derivedState === "awaitingNext";
  const live = state.isBidding && !paused;

  return (
    <div className="relative grid h-full min-h-[5.2cqh] max-h-[5.2cqh] grid-cols-[1fr_auto_1fr] items-center gap-[1.7cqw] overflow-visible px-[3%] border-b border-white/10 bg-black/40">
      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2">
        <LedTopBrandMark />
      </div>

      <div className="col-start-1 flex items-center gap-3 min-w-0 justify-self-start">
        <div className="hidden @md/stage:flex items-center gap-[1.1cqw] min-w-0 max-h-[4.8cqh]">
          {tournament.logoUrl ? (
            <img
              src={cldUrl(tournament.logoUrl, "headerLogo")}
              alt=""
              className="h-[5.6cqh] w-auto max-w-[9cqw] shrink-0 object-contain"
              loading="eager"
              decoding="async"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : null}
          <div className="flex min-w-0 flex-col justify-center leading-none">
            <span className="led-label text-[clamp(0.75rem,0.95cqw,1.05rem)] font-bold uppercase tracking-[0.06em] text-white/80">
              Tournament
            </span>
            <span className="mt-0.5 truncate led-tournament font-['Bebas_Neue'] text-[clamp(1.2rem,1.75cqw,2.2rem)] tracking-[0.06em] uppercase text-white font-bold leading-none">
              {tournament.name}
            </span>
          </div>
        </div>
      </div>

      <div
        aria-hidden
        className="col-start-2 w-[min(11.5cqw,18cqw)] shrink-0"
      />

      <div className="col-start-3 relative z-20 flex items-center justify-end gap-4 justify-self-end">
        {tournament.isTrial ? <TrialLicenseBadge size="led" /> : null}
        <div
          className={`flex items-center gap-2 px-4 py-1.5 border ${
            live
              ? "border-red-500/60 bg-red-500/20 shadow-[0_0_15px_rgba(239,68,68,0.3)]"
              : paused
                ? "border-amber-400/60 bg-amber-400/20 shadow-[0_0_15px_rgba(251,191,36,0.3)]"
                : "border-white/20 bg-white/10"
          }`}
        >
          {!live && !paused ? (
            <span className="led-status text-[clamp(0.85rem,1.1cqw,1.25rem)] font-bold uppercase tracking-[0.06em] text-white/85">
              {awaitingNext ? "Awaiting Next Player" : "Standby"}
            </span>
          ) : (
            <>
              <span
                className={`size-2.5 sm:size-3 rounded-full shrink-0 ${
                  live
                    ? "bg-red-500 animate-pulse shadow-[0_0_12px_#ef4444]"
                    : "bg-amber-400 shadow-[0_0_10px_#fbbf24]"
                }`}
              />
              <span
                className={`led-status text-[clamp(0.85rem,1.15cqw,1.3rem)] font-extrabold uppercase tracking-[0.06em] leading-tight ${
                  live ? "text-red-200" : "text-amber-200"
                }`}
              >
                {live ? "Live · Bidding Open" : "Paused"}
              </span>
            </>
          )}
        </div>

        <div className="flex flex-col items-end leading-none">
          <span className="led-label text-[clamp(0.75rem,0.95cqw,1.05rem)] font-bold uppercase tracking-[0.06em] text-white/80">
            Players Remaining
          </span>
          <span className="led-value font-['Bebas_Neue'] text-[clamp(1.4rem,2.1cqw,2.4rem)] tabular-nums mt-0.5 text-white font-black leading-none">
            <span style={{ color: "var(--accent)" }}>{remaining}</span>
            <span className="text-white/60 font-bold"> / {totalPlayers}</span>
          </span>
        </div>

        <DevThemePicker placement="inline" />
      </div>
    </div>
  );
});
