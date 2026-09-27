import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "./obs-v2-tokens";
import type { ObsV2BroadcastEvent } from "./obs-v2-events";

export interface ObsV2EventGraphicProps extends HTMLAttributes<HTMLDivElement> {
  /** The currently active broadcast event (or null if none) */
  event: ObsV2BroadcastEvent | null;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2EventGraphic — Central Event Impact System
 *
 * Television Broadcast Impact Moment:
 * - Positioned strictly inside the Camera Safe Area (y = 96px to 880px)
 * - Centered vertically and horizontally with generous safety margins
 * - Protected Zones: Never overlaps header (0–96), scorebug (880–1040), or footer (1040–1080)
 * - Single unified visual language with semantic accent switching
 * - Genuine BidWar logo crest lockup (no plain hardcoded text)
 * - Broadcast Timing: Snappy entrance (0–220ms) → Hold (220–1500ms) → Collapse exit (1500–2000ms)
 */
export const ObsV2EventGraphic = forwardRef<HTMLDivElement, ObsV2EventGraphicProps>(
  function ObsV2EventGraphic({ event, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`obs-v2-central-event-impact pointer-events-none absolute inset-0 flex items-center justify-center select-none ${className}`}
        style={{
          width: "100%",
          height: "100%",
          zIndex: OBS_V2.layer.eventFlash,
          ...style,
        }}
        data-event-active={event ? "true" : "false"}
        data-event-type={event?.type}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {event ? (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, scale: 0.86, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -10 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative flex flex-col items-center justify-center overflow-hidden"
              style={{
                width: "min(720px, 90%)",
                maxWidth: "720px",
                background: "linear-gradient(180deg, rgba(14, 18, 32, 0.96) 0%, rgba(7, 10, 18, 0.98) 100%)",
                backdropFilter: "blur(24px)",
                border: `1px solid ${event.borderColor || "rgba(255, 215, 0, 0.4)"}`,
                borderTop: `3px solid ${event.accentColor || OBS_V2.color.brand}`,
                borderBottom: `3px solid ${event.accentColor || OBS_V2.color.brand}`,
                borderRadius: "16px",
                boxShadow: `0 0 40px ${event.accentColor ? `${event.accentColor}33` : "rgba(255, 215, 0, 0.25)"}, 0 20px 60px rgba(0, 0, 0, 0.85)`,
                padding: "24px 36px",
              }}
            >
              {/* Background radiant sweep effect */}
              <div
                className="pointer-events-none absolute inset-0 opacity-25"
                style={{
                  background: `radial-gradient(ellipse at 50% 50%, ${event.accentColor || "#FFD700"}44 0%, transparent 70%)`,
                }}
              />

              {/* Decorative top corner slashes */}
              <div
                className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-40"
                style={{
                  background: `linear-gradient(135deg, transparent 50%, ${event.accentColor || "#FFD700"} 50%)`,
                  clipPath: "polygon(100% 0, 0 0, 100% 100%)",
                }}
              />

              {/* ── 1. BRAND LOCKUP BAR ── */}
              <div className="relative z-10 flex items-center justify-between w-full pb-3 border-b border-white/10 mb-3">
                <div className="flex items-center gap-2.5">
                  <img
                    src="/assets/branding/bidwar-reverse-logo-official.png"
                    alt="BidWar"
                    className="h-5 w-auto object-contain filter drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
                    onError={(e) => {
                      const target = e.currentTarget;
                      if (!target.src.includes("broadcast/bidwar-reverse-logo-official")) {
                        target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                      }
                    }}
                  />
                  <span
                    className="text-[11px] font-black uppercase tracking-[0.2em]"
                    style={{ color: event.accentColor || OBS_V2.color.brand }}
                  >
                    LIVE IMPACT
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full animate-pulse"
                    style={{ backgroundColor: event.accentColor || OBS_V2.color.brand }}
                  />
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    LIVE EVENT
                  </span>
                </div>
              </div>

              {/* ── 2. HERO CONTENT COMPOSITION ── */}
              <div className="relative z-10 flex flex-col items-center text-center my-1 w-full">
                {/* Specific Event Type Renderers */}
                {event.type === "SIX" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-[#FFD700] mb-1">
                      MAXIMUM 6 RUNS
                    </span>
                    <div className="flex items-baseline justify-center gap-3">
                      <span
                        className="text-8xl sm:text-9xl font-black italic leading-none text-[#FFD700] drop-shadow-[0_0_24px_rgba(255,215,0,0.6)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        6
                      </span>
                      <div className="text-left font-mono">
                        <span className="text-2xl font-black text-white block leading-none">SIX</span>
                        <span className="text-xs text-cyan-400 uppercase tracking-widest font-bold">OVER THE ROPES</span>
                      </div>
                    </div>
                  </div>
                ) : event.type === "FOUR" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-[#FFD700] mb-1">
                      BOUNDARY 4 RUNS
                    </span>
                    <div className="flex items-baseline justify-center gap-3">
                      <span
                        className="text-8xl sm:text-9xl font-black italic leading-none text-[#FFD700] drop-shadow-[0_0_24px_rgba(255,215,0,0.6)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        4
                      </span>
                      <div className="text-left font-mono">
                        <span className="text-2xl font-black text-white block leading-none">FOUR</span>
                        <span className="text-xs text-amber-300 uppercase tracking-widest font-bold">ALONG THE TURF</span>
                      </div>
                    </div>
                  </div>
                ) : event.type === "WICKET" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-rose-400 mb-1">
                      DISMISSAL · BREAKTHROUGH
                    </span>
                    <div className="flex items-center justify-center gap-4">
                      <span
                        className="text-7xl sm:text-8xl font-black italic leading-none text-rose-500 drop-shadow-[0_0_30px_rgba(239,51,64,0.7)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        WICKET
                      </span>
                    </div>
                  </div>
                ) : event.type === "MILESTONE" || (event.milestoneValue && (event.milestoneValue === 50 || event.milestoneValue === 100)) ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-emerald-400 mb-1">
                      {event.milestoneValue === 100 ? "CENTURY 100 RUNS" : "HALF CENTURY 50 RUNS"}
                    </span>
                    <div className="flex items-baseline justify-center gap-3">
                      <span
                        className="text-8xl sm:text-9xl font-black italic leading-none text-emerald-400 drop-shadow-[0_0_24px_rgba(34,197,94,0.6)] font-mono"
                      >
                        {event.milestoneValue ?? (event.title.includes("100") ? "100" : "50")}
                      </span>
                      <div className="text-left">
                        <span className="text-2xl font-black text-white block leading-none">
                          {event.milestoneValue === 100 ? "CENTURY" : "HALF CENTURY"}
                        </span>
                        <span className="text-xs text-emerald-300 uppercase tracking-widest font-bold">
                          MILESTONE REACHED
                        </span>
                      </div>
                    </div>
                  </div>
                ) : event.type === "NEW_BATSMAN" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] font-black uppercase tracking-[0.25em] text-cyan-400 mb-1 flex items-center gap-2">
                      <span>🏏</span> NEW BATTER ARRIVAL
                    </span>
                    <span
                      className="text-4xl sm:text-5xl font-black italic text-white uppercase tracking-wide my-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                      style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                    >
                      {event.batter || event.subtitle.split("·")[0] || "NEW BATTER"}
                    </span>
                    <span className="text-xs font-bold text-cyan-300 uppercase tracking-widest">
                      WALKING IN TO BAT
                    </span>
                  </div>
                ) : event.type === "NEW_BOWLER" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[12px] font-black uppercase tracking-[0.25em] text-emerald-400 mb-1 flex items-center gap-2">
                      <span>⚾</span> BOWLING CHANGE
                    </span>
                    <span
                      className="text-4xl sm:text-5xl font-black italic text-white uppercase tracking-wide my-1 drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]"
                      style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                    >
                      {event.bowler || event.subtitle.split("·")[0] || "NEW BOWLER"}
                    </span>
                    <span className="text-xs font-bold text-emerald-300 uppercase tracking-widest">
                      INTO THE ATTACK
                    </span>
                  </div>
                ) : event.type === "SUPERBALL" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">
                      SPECIAL DELIVERY ACTIVE
                    </span>
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className="text-6xl sm:text-7xl font-black italic text-[#FFD700] drop-shadow-[0_0_24px_rgba(255,215,0,0.6)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        SUPERBALL
                      </span>
                      <span className="px-3 py-1 rounded-lg bg-amber-400 text-black font-black text-xl font-mono shadow-md">
                        2X
                      </span>
                    </div>
                  </div>
                ) : event.type === "FREE_HIT" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-cyan-400 mb-1">
                      NO DISMISSAL DELIVERY
                    </span>
                    <span
                      className="text-6xl sm:text-7xl font-black italic text-cyan-400 drop-shadow-[0_0_24px_rgba(18,207,255,0.6)]"
                      style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                    >
                      FREE HIT
                    </span>
                  </div>
                ) : event.type === "NO_BALL" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-amber-400 mb-1">
                      ILLEGAL DELIVERY
                    </span>
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className="text-6xl sm:text-7xl font-black italic text-amber-300 drop-shadow-[0_0_20px_rgba(245,158,11,0.5)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        NO BALL
                      </span>
                      <span className="px-2.5 py-1 rounded bg-amber-500/20 border border-amber-400/40 text-amber-300 font-mono font-bold text-sm">
                        +1 RUN
                      </span>
                    </div>
                  </div>
                ) : event.type === "WIDE" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-slate-300 mb-1">
                      EXTRA DELIVERY
                    </span>
                    <div className="flex items-center justify-center gap-3">
                      <span
                        className="text-6xl sm:text-7xl font-black italic text-slate-100 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                        style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                      >
                        WIDE
                      </span>
                      <span className="px-2.5 py-1 rounded bg-slate-700/40 border border-white/20 text-slate-200 font-mono font-bold text-sm">
                        +1 RUN
                      </span>
                    </div>
                  </div>
                ) : event.type === "MATCH_WON" ? (
                  <div className="flex flex-col items-center">
                    <span className="text-[13px] font-black uppercase tracking-[0.25em] text-[#FFD700] mb-1 flex items-center gap-2">
                      <span>🏆</span> MATCH COMPLETED · VICTORY <span>🏆</span>
                    </span>
                    <span
                      className="text-5xl sm:text-7xl font-black italic text-[#FFD700] uppercase tracking-wide my-1 drop-shadow-[0_0_24px_rgba(255,215,0,0.6)]"
                      style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                    >
                      {event.title}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <span
                      className="text-5xl sm:text-6xl font-black italic uppercase tracking-wide text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]"
                      style={{ fontFamily: "'Bebas Neue', 'Barlow Condensed', Impact, sans-serif" }}
                    >
                      {event.title}
                    </span>
                  </div>
                )}

                {/* Subtitle / Context line */}
                {event.subtitle && (
                  <p className="text-sm font-semibold uppercase tracking-wider text-slate-200 mt-2">
                    {event.subtitle}
                  </p>
                )}
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);
