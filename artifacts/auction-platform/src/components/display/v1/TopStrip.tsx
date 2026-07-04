import { memo } from "react";
import type { LedView } from "@/lib/led-view/types";
import { cldUrl } from "@/lib/cloudinary";
import { LedTopBrandMark } from "./led-top-brand-mark";
import { DevThemePicker } from "./DevThemePicker";

/**
 * TOP STRIP — OBS crest (center), tournament line, LIVE pill, remaining counter.
 */
export const TopStrip = memo(function TopStrip({ view }: { view: LedView }) {
  const { tournament, state, remaining, totalPlayers } = view;
  const paused = view.derivedState === "paused";
  const awaitingNext = view.derivedState === "awaitingNext";
  const live = state.isBidding && !paused;

  return (
    <div className="relative grid h-full min-h-[3.5rem] max-h-[3.5rem] grid-cols-[1fr_auto_1fr] items-center gap-6 overflow-visible px-[3%] border-b border-white/10 bg-black/40">
      <div className="pointer-events-none absolute top-0 left-1/2 z-10 -translate-x-1/2">
        <LedTopBrandMark />
      </div>

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

      <div
        aria-hidden
        className="col-start-2 w-[min(220px,18vw)] shrink-0"
      />

      <div className="col-start-3 relative z-20 flex items-center justify-end gap-4 justify-self-end">
        <div
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
              {awaitingNext ? "Awaiting Next Player" : "Standby"}
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
      </div>
    </div>
  );
});
