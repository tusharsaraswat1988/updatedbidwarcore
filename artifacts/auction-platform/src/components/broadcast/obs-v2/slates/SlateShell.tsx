/**
 * SlateShell — Shared V2 Mid-Screen Broadcast Slate Chrome
 *
 * Visual Design: V2 DESIGN SYSTEM
 * - Sits strictly inside the Camera Safe Zone (top: 96px, bottom: 200px / height: 784px)
 * - Header (0–96px) and Footer/Scorebug (880–1080px) remain 100% visible and protected
 * - Enters from LEFT (x: -100% → 0%) and exits back to LEFT (0% → -100%)
 * - Deep navy obsidian chassis with 3px glowing electric gold rails
 * - Genuine BidWar crest badge lockup
 * - Barlow Condensed display typography with bold italic headers
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { OBS_V2 } from "../obs-v2-tokens";

export interface SlateShellProps {
  tournamentName: string;
  slateTitle: string;
  children: ReactNode;
  /** Width of the slate panel (default: 100% of safe area, ~68% for takeovers) */
  panelWidth?: string;
  /** If true, aligns the panel to the left margin */
  alignLeft?: boolean;
}

export function SlateShell({
  tournamentName,
  slateTitle,
  children,
  panelWidth = "100%",
  alignLeft = false,
}: SlateShellProps) {
  return (
    <div
      className="absolute inset-x-0 pointer-events-none select-none flex items-center"
      style={{
        top: `${OBS_V2.canvas.headerHeight}px`,
        height: `${OBS_V2.canvas.cameraHeight}px`,
        zIndex: OBS_V2.layer.slates,
        paddingLeft: alignLeft ? `${OBS_V2.canvas.safeX}px` : `${OBS_V2.canvas.safeX}px`,
        paddingRight: `${OBS_V2.canvas.safeX}px`,
        overflow: "hidden",
      }}
    >
      <motion.div
        key={`slate-${slateTitle}`}
        initial={{ opacity: 0, x: "-100%" }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: "-100%" }}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col overflow-hidden shadow-2xl pointer-events-none"
        style={{
          width: panelWidth,
          maxHeight: `${OBS_V2.canvas.cameraHeight - 32}px`,
          height: "92%",
          background: "linear-gradient(180deg, rgba(14, 20, 36, 0.98) 0%, rgba(8, 12, 22, 0.99) 100%)",
          backdropFilter: "blur(24px)",
          border: "1px solid rgba(255, 215, 0, 0.35)",
          borderTop: "3px solid #FFD700",
          borderBottom: "2px solid rgba(255, 215, 0, 0.3)",
          borderRadius: "16px",
          boxShadow: "0 0 35px rgba(255, 215, 0, 0.25), 0 20px 60px rgba(0, 0, 0, 0.8)",
          fontFamily: "'Barlow Condensed', 'Inter', sans-serif",
        }}
      >
        {/* ─── V2 Sub-Masthead Bar (48px) ─────────────────────────────── */}
        <div
          className="flex items-center justify-between shrink-0 px-6 py-2.5"
          style={{
            height: "48px",
            background: "linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)",
            borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          }}
        >
          {/* Left: Real BidWar badge & Tournament context */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-[#FFD700] text-black px-2.5 py-0.5 rounded font-black text-xs uppercase tracking-wider">
              <img
                src="/assets/broadcast/bidwar-obs-crest-badge.png"
                alt="BidWar"
                className="w-4 h-4 object-contain"
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes("bidwar-reverse-logo-official")) {
                    target.src = "/assets/broadcast/bidwar-reverse-logo-official.png";
                  }
                }}
              />
              <span>BIDWAR OBS</span>
            </div>
            <span className="text-slate-300 text-xs font-bold tracking-wide uppercase truncate max-w-xs">
              {tournamentName || "CRICKET TOURNAMENT"}
            </span>
          </div>

          {/* Right: Slate title badge */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse" />
            <span className="text-[#FFD700] font-black text-xs uppercase tracking-[0.2em]">
              {slateTitle.toUpperCase()} SLATE
            </span>
          </div>
        </div>

        {/* ─── Main Content Viewport ──────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden p-6">
          {children}
        </div>
      </motion.div>
    </div>
  );
}

/**
 * Shared slot header — category label + main title.
 * Used by individual slate components.
 */
export function SlateHeading({
  kicker,
  title,
}: {
  kicker: string;
  title: string;
}) {
  return (
    <div className="text-center mb-4 shrink-0 flex flex-col items-center">
      <div
        className="text-xs font-bold tracking-[0.22em] text-[#FFD700] uppercase mb-0.5"
        style={{ letterSpacing: "0.22em" }}
      >
        {kicker}
      </div>
      <div className="text-3xl sm:text-4xl font-black italic tracking-wide text-white uppercase drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
        {title}
      </div>
      <div
        className="mt-1.5 h-[2px] w-20"
        style={{
          background: "linear-gradient(90deg, transparent, #FFD700 20%, #12CFFF 80%, transparent)",
        }}
      />
    </div>
  );
}

/**
 * Shared empty state — shown when no data is available.
 */
export function SlateEmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="rounded-xl border border-white/10 bg-slate-900/60 backdrop-blur-md px-8 py-6 text-center shadow-lg">
        <p className="text-sm text-slate-300 font-semibold tracking-wide uppercase">
          {message}
        </p>
      </div>
    </div>
  );
}
