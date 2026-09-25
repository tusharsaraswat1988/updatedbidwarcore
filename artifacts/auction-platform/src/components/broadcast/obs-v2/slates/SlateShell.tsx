/**
 * SlateShell — Shared V2 Full-Screen Broadcast Slate Chrome
 *
 * Visual Design: NEW V2 Lovable Design System
 * Provides the consistent masthead, dark backdrop, and padding
 * for all mid-screen broadcast slates.
 *
 * Used by: SponsorSlateV2, StandingsSlateV2, FixturesSlateV2,
 *          ScorecardSlateV2, SummarySlateV2, VsIntroSlateV2
 *
 * Functional Behaviour: Preserved from CricketObsMidOverlays
 * - Covers full 1920×1080 canvas (fixed inset-0)
 * - Masthead: 64px top bar with tournament name + slate title
 * - Backdrop: dark obsidian (#050507) at 0.94 opacity
 * - Content area: safe-padded flex column
 * - Framer Motion: scale+fade entrance/exit (0.26s)
 * - Pointer-events: none (operator cannot accidentally click through)
 * - SELECT-NONE (broadcast-only display)
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
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.26, ease: OBS_V2.motion.easing.snappy }}
      className="fixed inset-0 z-40 flex flex-col overflow-hidden pointer-events-none select-none"
      style={{
        background: "rgba(5, 5, 7, 0.94)",
        fontFamily: OBS_V2.typography.family.body,
        width: "1920px",
        height: "1080px",
      }}
    >
      {/* ─── Masthead Header Band (64px) ─────────────────────────────── */}
      <div
        className="flex items-center justify-between shrink-0"
        style={{
          height: "64px",
          background: OBS_V2.color.panel,
          borderBottom: `2px solid ${OBS_V2.color.brand}`,
          paddingLeft: `${OBS_V2.canvas.safeX}px`,
          paddingRight: `${OBS_V2.canvas.safeX}px`,
          boxShadow: OBS_V2.depth.shadow.standard,
        }}
      >
        {/* Left: BIDWAR BROADCAST / Tournament Name */}
        <div className="flex items-center gap-4">
          <span
            style={{
              ...OBS_V2.typography.scale.headline,
              color: OBS_V2.color.brand,
              letterSpacing: "0.08em",
            }}
          >
            BIDWAR BROADCAST
          </span>
          <span
            style={{
              width: 1,
              height: 24,
              background: OBS_V2.color.divider,
              display: "block",
            }}
          />
          <span
            style={{
              ...OBS_V2.typography.scale.headline,
              color: OBS_V2.color.textSecondary,
              letterSpacing: "0.04em",
            }}
          >
            {tournamentName || "CRICKET TOURNAMENT"}
          </span>
        </div>

        {/* Right: Slate title badge */}
        <div className="flex items-center gap-2">
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: OBS_V2.color.brand,
              display: "inline-block",
            }}
          />
          <span
            style={{
              ...OBS_V2.typography.scale.label,
              color: OBS_V2.color.brand,
              letterSpacing: "0.2em",
            }}
          >
            {slateTitle.toUpperCase()} SLATE
          </span>
        </div>
      </div>

      {/* ─── Main Viewport ──────────────────────────────────────────── */}
      <div
        className="flex-1 flex flex-col overflow-hidden"
        style={{
          paddingTop: `${OBS_V2.canvas.safeY}px`,
          paddingBottom: `${OBS_V2.canvas.safeY}px`,
          paddingLeft: `${OBS_V2.canvas.safeX}px`,
          paddingRight: `${OBS_V2.canvas.safeX}px`,
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
    <div className="text-center mb-6 shrink-0">
      <div
        style={{
          ...OBS_V2.typography.scale.label,
          color: OBS_V2.color.brand,
          marginBottom: 4,
        }}
      >
        {kicker}
      </div>
      <div
        style={{
          ...OBS_V2.typography.scale.hero,
          color: OBS_V2.color.text,
          letterSpacing: "0.04em",
        }}
      >
        {title}
      </div>
    </div>
  );
}

/**
 * Shared empty state — shown when no data is available.
 */
export function SlateEmptyState({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p
        style={{
          ...OBS_V2.typography.scale.body,
          color: OBS_V2.color.textMuted,
        }}
      >
        {message}
      </p>
    </div>
  );
}
