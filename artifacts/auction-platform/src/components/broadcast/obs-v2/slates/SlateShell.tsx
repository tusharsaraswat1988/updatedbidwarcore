/**
 * SlateShell — Shared V2 Full-Screen Broadcast Slate Chrome
 *
 * Visual Design: LOVABLE V2 DESIGN SYSTEM
 * - Sits below the persistent V2 Header (top: 96px, bottom: 0)
 * - Deep navy obsidian radial gradient with cinematic blur
 * - 3px glowing electric gold top rule
 * - Chamfered badges & gold/cyan accent lines
 * - Barlow Condensed display typography with bold italic headers
 */

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { OBS_V2 } from "../obs-v2-tokens";

export interface SlateShellProps {
  tournamentName: string;
  slateTitle: string;
  children: ReactNode;
}

export function SlateShell({ tournamentName, slateTitle, children }: SlateShellProps) {
  return (
    <motion.div
      key={`slate-${slateTitle}`}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="absolute inset-x-0 z-40 flex flex-col overflow-hidden pointer-events-none select-none"
      style={{
        top: "96px",
        bottom: 0,
        background: "radial-gradient(ellipse at 50% 20%, rgba(15, 23, 42, 0.96) 0%, rgba(8, 12, 22, 0.99) 100%)",
        backdropFilter: "blur(24px)",
        borderTop: "3px solid #FFD700",
        boxShadow: "0 0 24px rgba(255, 215, 0, 0.35)",
        fontFamily: "'Barlow Condensed', sans-serif",
      }}
    >
      {/* ─── V2 Sub-Masthead Bar (54px) ─────────────────────────────── */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          height: "54px",
          background: "linear-gradient(180deg, rgba(30, 41, 59, 0.85) 0%, rgba(15, 23, 42, 0.95) 100%)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.1)",
          paddingLeft: "72px",
          paddingRight: "72px",
        }}
      >
        {/* Left: Tournament context */}
        <div className="flex items-center gap-3">
          <span
            className="px-3 py-0.5 text-[12px] font-black uppercase tracking-wider text-slate-950"
            style={{
              background: "#FFD700",
              clipPath: "polygon(0 0, 100% 0, calc(100% - 10px) 100%, 0 100%)",
            }}
          >
            BIDWAR OBS
          </span>
          <span className="text-slate-300 text-sm font-semibold tracking-wide uppercase">
            {tournamentName || "TOURNAMENT"}
          </span>
        </div>

        {/* Right: Slate title badge */}
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#FFD700] animate-pulse" />
          <span className="text-[#FFD700] font-black text-sm uppercase tracking-[0.2em]">
            {slateTitle.toUpperCase()} SLATE
          </span>
        </div>
      </div>

      {/* ─── Main Viewport ──────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          padding: "24px 72px 32px 72px",
        }}
      >
        {children}
      </div>
    </motion.div>
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
    <div className="text-center mb-5 shrink-0 flex flex-col items-center">
      <div
        className="text-[13px] font-bold tracking-[0.22em] text-[#FFD700] uppercase mb-1"
        style={{ letterSpacing: "0.22em" }}
      >
        {kicker}
      </div>
      <div className="text-4xl sm:text-5xl font-black italic tracking-wide text-white uppercase drop-shadow-[0_2px_12px_rgba(0,0,0,0.8)]">
        {title}
      </div>
      <div
        className="mt-2.5 h-[2px] w-24"
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
        <p className="text-base text-slate-300 font-semibold tracking-wide uppercase">
          {message}
        </p>
      </div>
    </div>
  );
}
