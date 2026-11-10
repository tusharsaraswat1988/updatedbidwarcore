import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { WEDDING_TOKENS } from "./wedding-ui-tokens";
import type { ObsV2BroadcastEvent } from "../obs-v2/obs-v2-events";

export interface WeddingEventGraphicProps extends React.HTMLAttributes<HTMLDivElement> {
  event: ObsV2BroadcastEvent | null;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Gold Sparkle SVG Accent
 */
function Sparkle({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={18}
      height={18}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`pointer-events-none select-none ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path
        d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z"
        fill={WEDDING_TOKENS.color.gold.champagne}
      />
    </svg>
  );
}

/**
 * Trophy Cup SVG Motif for Match Victory
 */
function VictoryTrophy({ size = 52 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="select-none mx-auto"
      aria-hidden="true"
    >
      <path
        d="M20 12H44V28C44 34.6274 38.6274 40 32 40C25.3726 40 20 34.6274 20 28V12Z"
        fill="url(#trophyGold)"
        stroke={WEDDING_TOKENS.color.gold.rich}
        strokeWidth="1.5"
      />
      <path
        d="M20 18H14C11.7909 18 10 19.7909 10 22C10 26.4183 13.5817 30 18 30H20"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="2"
      />
      <path
        d="M44 18H50C52.2091 18 54 19.7909 54 22C54 26.4183 50.4183 30 46 30H44"
        stroke={WEDDING_TOKENS.color.gold.champagne}
        strokeWidth="2"
      />
      <path d="M32 40V48M24 48H40M22 52H42" stroke={WEDDING_TOKENS.color.gold.rich} strokeWidth="2" strokeLinecap="round" />
      <circle cx="32" cy="24" r="5" fill="#801830" />
      <defs>
        <linearGradient id="trophyGold" x1="20" y1="12" x2="44" y2="40">
          <stop offset="0%" stopColor="#FFF2D6" />
          <stop offset="50%" stopColor="#E5C378" />
          <stop offset="100%" stopColor="#9C7728" />
        </linearGradient>
      </defs>
    </svg>
  );
}

/**
 * 1. SIX CELEBRATION (Circular Gilded Medallion)
 */
function SixCelebration({ event }: { event: ObsV2BroadcastEvent }) {
  const batter = event.batter || "";
  const detail = event.detail || "6 RUNS";

  return (
    <motion.div
      key={`six-${event.id}`}
      initial={{ opacity: 0, scale: 0.72, y: 12 }}
      animate={{ opacity: 1, scale: [0.72, 1.05, 1], y: 0 }}
      exit={{ opacity: 0, scale: 1.08, filter: "blur(8px)", y: -10 }}
      transition={{ duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center justify-center text-center select-none"
      style={{
        width: "420px",
        height: "420px",
      }}
      data-celebration="six"
    >
      {/* Soft Ambient Radial Bloom Aura */}
      <div
        className="pointer-events-none absolute inset-0 rounded-full blur-2xl opacity-60"
        style={{
          background: "radial-gradient(circle, rgba(229, 195, 120, 0.45) 0%, rgba(212, 175, 55, 0.15) 55%, transparent 75%)",
          transform: "scale(1.3)",
        }}
      />

      {/* Outer Rotating Gilded Ring */}
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
        className="pointer-events-none absolute inset-4 rounded-full border border-dashed border-[#D4AF37]/50"
      />

      {/* Main Circular Medallion */}
      <div
        className="relative flex flex-col items-center justify-center rounded-full p-6"
        style={{
          width: "360px",
          height: "360px",
          background: "radial-gradient(circle at 35% 35%, #FFFDF9 0%, #FDFBF7 45%, #EBE1D0 100%)",
          border: `3px double ${WEDDING_TOKENS.color.gold.borderStrong}`,
          boxShadow: `
            0 12px 36px rgba(36, 28, 20, 0.35),
            inset 0 0 24px rgba(212, 175, 55, 0.25),
            0 0 0 2px rgba(253, 251, 247, 0.9)
          `,
        }}
      >
        {/* Floating Sparkles */}
        <Sparkle style={{ position: "absolute", top: "42px", left: "70px", transform: "scale(1.2)" }} />
        <Sparkle style={{ position: "absolute", top: "50px", right: "72px", transform: "scale(0.9)" }} />
        <Sparkle style={{ position: "absolute", bottom: "56px", left: "84px", transform: "scale(0.85)" }} />
        <Sparkle style={{ position: "absolute", bottom: "48px", right: "80px", transform: "scale(1.1)" }} />

        {/* Top Kicker Label */}
        <span
          className="text-[14px] font-bold tracking-[0.24em] uppercase"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.gold.antique,
          }}
        >
          {batter ? `${batter.toUpperCase()}` : "ROYAL MAXIMUM"}
        </span>

        {/* Dominant "SIX" Callout */}
        <h1
          className="text-[104px] font-black leading-none tracking-tight my-[-4px]"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            background: "linear-gradient(180deg, #F5EBC7 0%, #D4AF37 50%, #8A6D2D 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 3px 6px rgba(74, 14, 24, 0.35))",
          }}
        >
          SIX
        </h1>

        {/* Delicate Laurel Gold Border */}
        <div className="flex items-center gap-2 mt-1">
          <span className="w-8 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]" />
          <span
            className="text-[14px] font-bold tracking-widest uppercase"
            style={{
              fontFamily: WEDDING_TOKENS.typography.family.sans,
              color: WEDDING_TOKENS.color.charcoal.espresso,
            }}
          >
            {detail}
          </span>
          <span className="w-8 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 2. FOUR CELEBRATION (Horizontal Gilded Ribbon)
 */
function FourCelebration({ event }: { event: ObsV2BroadcastEvent }) {
  const batter = event.batter || "";
  const detail = event.detail || "4 RUNS";

  return (
    <motion.div
      key={`four-${event.id}`}
      initial={{ opacity: 0, scaleX: 0.65, y: 10 }}
      animate={{ opacity: 1, scaleX: [0.65, 1.04, 1], y: 0 }}
      exit={{ opacity: 0, scaleX: 1.08, filter: "blur(6px)", y: -8 }}
      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-center select-none"
      style={{ width: "560px", minHeight: "150px" }}
      data-celebration="four"
    >
      {/* Soft Ambient Lateral Glow */}
      <div
        className="pointer-events-none absolute inset-0 blur-2xl opacity-50"
        style={{
          background: "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.4) 0%, transparent 70%)",
        }}
      />

      {/* Main Horizontal Ribbon Plaque */}
      <div
        className="relative flex flex-col items-center justify-center w-full px-12 py-5 rounded-[22px]"
        style={{
          background: "linear-gradient(180deg, #FFFDF9 0%, #FDFBF7 50%, #F4ECE0 100%)",
          border: `2px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
          boxShadow: `
            0 12px 32px rgba(36, 28, 20, 0.3),
            0 0 0 3px rgba(229, 195, 120, 0.25),
            inset 0 1px 4px rgba(255, 255, 255, 0.8)
          `,
        }}
      >
        {/* Left & Right Ornamental Notch Flags */}
        <div
          className="absolute left-[-16px] top-1/2 -translate-y-1/2 w-4 h-12 rounded-l-md"
          style={{ background: WEDDING_TOKENS.color.gold.champagne, border: "1px solid #8A6D2D" }}
        />
        <div
          className="absolute right-[-16px] top-1/2 -translate-y-1/2 w-4 h-12 rounded-r-md"
          style={{ background: WEDDING_TOKENS.color.gold.champagne, border: "1px solid #8A6D2D" }}
        />

        {/* Top Kicker Label */}
        <span
          className="text-[13px] font-bold tracking-[0.22em] uppercase"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.gold.deep,
          }}
        >
          {batter ? `${batter.toUpperCase()} · BOUNDARY` : "MAGNIFICENT BOUNDARY"}
        </span>

        {/* Main "FOUR" Lettering */}
        <h1
          className="text-[88px] font-black leading-none tracking-wider my-[-2px]"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            background: "linear-gradient(180deg, #F3CA68 0%, #D9981E 60%, #9C680A 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            filter: "drop-shadow(0 2px 4px rgba(0, 0, 0, 0.25))",
          }}
        >
          FOUR
        </h1>

        {/* Bottom Rule with Diamonds */}
        <div className="flex items-center gap-2 mt-0.5">
          <span className="w-12 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]" />
          <span
            className="text-[13px] font-bold tracking-widest uppercase"
            style={{
              fontFamily: WEDDING_TOKENS.typography.family.sans,
              color: WEDDING_TOKENS.color.charcoal.ink,
            }}
          >
            {detail}
          </span>
          <span className="w-12 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 3. WICKET CELEBRATION (Royal Velvet Burgundy Plaque)
 */
function WicketCelebration({ event }: { event: ObsV2BroadcastEvent }) {
  const batter = event.batter || "";
  const detail = event.detail || "DISMISSAL";

  return (
    <motion.div
      key={`wicket-${event.id}`}
      initial={{ opacity: 0, scale: 0.8, y: -16 }}
      animate={{ opacity: 1, scale: [0.8, 1.03, 1], y: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(6px)", y: 12 }}
      transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-center select-none"
      style={{ width: "520px", minHeight: "170px" }}
      data-celebration="wicket"
    >
      {/* Deep Burgundy Ambient Bloom */}
      <div
        className="pointer-events-none absolute inset-0 blur-2xl opacity-60"
        style={{
          background: "radial-gradient(circle, rgba(128, 24, 48, 0.5) 0%, transparent 70%)",
        }}
      />

      {/* Main Velvet Burgundy Plaque */}
      <div
        className="relative flex flex-col items-center justify-center w-full px-10 py-6 rounded-[22px]"
        style={{
          background: WEDDING_TOKENS.color.gradient.brideVelvet,
          border: `2px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
          boxShadow: `
            0 14px 40px rgba(74, 14, 24, 0.5),
            0 0 0 3px rgba(212, 175, 55, 0.25),
            inset 0 2px 6px rgba(255, 235, 199, 0.25)
          `,
        }}
      >
        {/* Inner Delicate Gold Hairline */}
        <div
          className="pointer-events-none absolute inset-[4px] rounded-[18px]"
          style={{ border: `1px solid ${WEDDING_TOKENS.color.gold.hairline}` }}
        />

        {/* Top Label */}
        <span
          className="text-[13px] font-bold tracking-[0.24em] uppercase"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.gold.champagne,
          }}
        >
          KEY BREAKTHROUGH
        </span>

        {/* Dominant "WICKET" Title */}
        <h1
          className="text-[86px] font-black leading-none tracking-wider my-[-2px]"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.ivory.pure,
            textShadow: `
              0 2px 8px rgba(0, 0, 0, 0.6),
              0 0 20px rgba(212, 175, 55, 0.35)
            `,
          }}
        >
          WICKET
        </h1>

        {/* Dismissed Batter / Dismissal Method Subline */}
        <div className="flex items-center gap-2 mt-1">
          <span className="w-10 h-[1px] bg-gradient-to-r from-transparent to-[#D4AF37]" />
          <span
            className="text-[14px] font-bold tracking-widest uppercase text-white/95"
            style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
          >
            {batter ? `${batter} (${detail})` : detail}
          </span>
          <span className="w-10 h-[1px] bg-gradient-to-l from-transparent to-[#D4AF37]" />
        </div>
      </div>
    </motion.div>
  );
}

/**
 * 4. MATCH RESULT PRESENTATION (Victory Card)
 */
function MatchResultCelebration({ event }: { event: ObsV2BroadcastEvent }) {
  const winner = event.winnerName || event.title || "MATCH WON";
  const margin = event.marginText || event.subtitle || "MATCH COMPLETED";

  return (
    <motion.div
      key={`result-${event.id}`}
      initial={{ opacity: 0, scale: 0.8, y: 16 }}
      animate={{ opacity: 1, scale: [0.8, 1.03, 1], y: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(6px)" }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex items-center justify-center select-none"
      style={{ width: "620px", minHeight: "220px" }}
      data-celebration="match_won"
    >
      {/* Soft Ambient Victory Aura */}
      <div
        className="pointer-events-none absolute inset-0 blur-3xl opacity-60"
        style={{
          background: "radial-gradient(circle, rgba(229, 195, 120, 0.5) 0%, transparent 70%)",
        }}
      />

      {/* Main Victory Plaque */}
      <div
        className="relative flex flex-col items-center justify-center w-full px-12 py-8 rounded-[28px]"
        style={{
          background: WEDDING_TOKENS.color.gradient.parchment,
          border: `2px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
          boxShadow: `
            0 16px 44px rgba(36, 28, 20, 0.35),
            0 0 0 3px rgba(212, 175, 55, 0.3),
            inset 0 1px 4px rgba(255, 255, 255, 0.8)
          `,
        }}
      >
        {/* Trophy Icon */}
        <VictoryTrophy size={48} />

        {/* Top Kicker Label */}
        <span
          className="text-[13px] font-bold tracking-[0.24em] uppercase mt-2"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.gold.deep,
          }}
        >
          WEDDING CUP CHAMPIONS
        </span>

        {/* Winner Announcement */}
        <h1
          className="text-[52px] font-black leading-tight tracking-wide my-1 text-center"
          style={{
            fontFamily: WEDDING_TOKENS.typography.family.serif,
            color: WEDDING_TOKENS.color.charcoal.ink,
            textShadow: "0 2px 4px rgba(36, 28, 20, 0.15)",
          }}
        >
          {winner}
        </h1>

        {/* Margin Text */}
        <p
          className="text-[16px] font-semibold tracking-wider uppercase text-neutral-600 mt-0.5"
          style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
        >
          {margin}
        </p>
      </div>
    </motion.div>
  );
}

/**
 * 5. GENERIC MILESTONE / CELEBRATION FALLBACK
 */
function GenericCelebration({ event }: { event: ObsV2BroadcastEvent }) {
  const title = event.title || event.type || "CELEBRATION";
  const subtitle = event.subtitle || "";

  return (
    <motion.div
      key={`generic-${event.id}`}
      initial={{ opacity: 0, scale: 0.8, y: 12 }}
      animate={{ opacity: 1, scale: [0.8, 1.03, 1], y: 0 }}
      exit={{ opacity: 0, scale: 1.05, filter: "blur(6px)" }}
      transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center justify-center select-none px-10 py-6 rounded-[22px]"
      style={{
        minWidth: "420px",
        background: WEDDING_TOKENS.color.gradient.parchment,
        border: `2px solid ${WEDDING_TOKENS.color.gold.borderStrong}`,
        boxShadow: WEDDING_TOKENS.depth.shadow.parchment,
      }}
      data-celebration="generic"
    >
      <h1
        className="text-[64px] font-black leading-none text-center"
        style={{
          fontFamily: WEDDING_TOKENS.typography.family.serif,
          color: WEDDING_TOKENS.color.charcoal.ink,
        }}
      >
        {title}
      </h1>
      {subtitle && (
        <span
          className="text-[14px] font-semibold tracking-widest uppercase text-neutral-600 mt-1"
          style={{ fontFamily: WEDDING_TOKENS.typography.family.sans }}
        >
          {subtitle}
        </span>
      )}
    </motion.div>
  );
}

/**
 * WeddingEventGraphic
 * Authoritative Central Broadcast Celebration Graphic for the Royal Wedding stage.
 *
 * Renders distinct, bespoke luxury animations for:
 * - SIX: Circular champagne-gold medallion with sparkles and rotating outer ring.
 * - FOUR: Horizontal gold ribbon banner with tapered flag accents.
 * - WICKET: Dramatic velvet burgundy plaque with gold filigree.
 * - MATCH_WON: Grand victory plaque with golden trophy.
 *
 * Mounts strictly inside Camera Safe Area (Zone 2).
 */
export const WeddingEventGraphic = React.forwardRef<HTMLDivElement, WeddingEventGraphicProps>(
  function WeddingEventGraphic({ event, className = "", style, ...rest }, ref) {
    return (
      <div
        ref={ref}
        className={`wedding-event-graphic pointer-events-none absolute inset-0 flex items-center justify-center select-none ${className}`}
        style={{
          width: "100%",
          height: "100%",
          zIndex: WEDDING_TOKENS.layer.celebrationOverlay,
          ...style,
        }}
        data-wedding-event-active={event ? "true" : "false"}
        data-wedding-event-type={event?.type}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {event && (
            <React.Fragment key={event.id}>
              {event.type === "SIX" && <SixCelebration event={event} />}
              {event.type === "FOUR" && <FourCelebration event={event} />}
              {event.type === "WICKET" && <WicketCelebration event={event} />}
              {event.type === "MATCH_WON" && <MatchResultCelebration event={event} />}
              {event.type !== "SIX" &&
                event.type !== "FOUR" &&
                event.type !== "WICKET" &&
                event.type !== "MATCH_WON" && <GenericCelebration event={event} />}
            </React.Fragment>
          )}
        </AnimatePresence>
      </div>
    );
  }
);
