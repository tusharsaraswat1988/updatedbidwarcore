/**
 * NeutralFooterV2 — V2 Neutral / Interval Footer Slate
 *
 * Visual Design: NEW V2 Lovable Design System
 * - Obsidian (#0C0C10) chassis with gold (#FFD700) top rail
 * - Tournament identity on left with crest/logo
 * - Sponsor spotlight on right with auto-rotation
 * - Chamfer geometry, V2 typography, broadcast motion
 *
 * Functional Behaviour: Preserved from cricket-obs-neutral-footer.tsx
 * - Auto-rotates sponsors every 4.5 seconds (authoritative timing)
 * - AnimatePresence cross-fade on sponsor change
 * - Graceful no-sponsor fallback state
 * - Framer Motion: slide up on enter (350ms), slide down on exit
 *
 * SOURCE EVENT: vm.isNeutralActive + vm.midOverlay === "neutral"
 * ADAPTER: cricket-v2-adapter preserves neutral mode flag
 * STATE: parent page tracks overlay state from useCricketObsLive
 * COMPONENT: NeutralFooterV2 (replaces scorebug in neutral mode)
 * ENTER: y: 140 → 0, opacity: 0 → 1, 350ms snappy
 * HOLD: indefinite until neutral mode deactivated
 * EXIT: y: 0 → 140, opacity: 1 → 0, 350ms snappy
 */

import { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "../obs-v2-tokens";
import type { SponsorLogo } from "../contracts";

export interface NeutralFooterV2Props {
  tournamentName: string;
  tournamentLogoUrl?: string | null;
  sponsors: SponsorLogo[];
  /** Whether neutral mode is currently active */
  isActive: boolean;
}

const SPONSOR_ROTATION_MS = 4500; // 4.5s — matches original authoritative timing

export function NeutralFooterV2({ tournamentName, tournamentLogoUrl, sponsors, isActive }: NeutralFooterV2Props) {
  const [activeSponsorIdx, setActiveSponsorIdx] = useState(0);

  // Filter valid sponsors
  const sponsorsList = useMemo(
    () => sponsors.filter((s) => Boolean(s.name || s.logoUrl)),
    [sponsors],
  );

  // Auto-rotate every 4.5 seconds — authoritative timing
  useEffect(() => {
    if (sponsorsList.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSponsorIdx((prev) => (prev + 1) % sponsorsList.length);
    }, SPONSOR_ROTATION_MS);
    return () => clearInterval(interval);
  }, [sponsorsList.length]);

  // Reset index when sponsor list changes
  useEffect(() => {
    setActiveSponsorIdx(0);
  }, [sponsorsList.length]);

  const activeSponsor = sponsorsList[activeSponsorIdx] ?? null;

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key="bw-neutral-footer"
          initial={{ y: 140, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 140, opacity: 0 }}
          transition={{ duration: 0.35, ease: OBS_V2.motion.easing.snappy }}
          className="w-full flex items-stretch relative select-none"
          style={{
            background: OBS_V2.color.panel,
            borderTop: `2px solid ${OBS_V2.color.brand}`,
            height: "140px",
            boxShadow: OBS_V2.depth.shadow.hero,
          }}
        >
          {/* LEFT SECTION: Tournament Identity */}
          <div
            className="flex items-center gap-4 shrink-0"
            style={{
              padding: `0 ${OBS_V2.spacing.xl}px`,
              minWidth: "360px",
              maxWidth: "480px",
              borderRight: `1px solid ${OBS_V2.color.divider}`,
            }}
          >
            {/* Tournament Crest / Logo */}
            {tournamentLogoUrl ? (
              <div
                className="shrink-0 overflow-hidden flex items-center justify-center"
                style={{
                  width: 72,
                  height: 72,
                  background: OBS_V2.color.panelInset,
                  border: `1px solid ${OBS_V2.color.standard}`,
                  padding: 4,
                }}
              >
                <img
                  src={tournamentLogoUrl}
                  alt={tournamentName}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 72,
                  height: 72,
                  background: OBS_V2.color.panelInset,
                  border: `1px solid ${OBS_V2.color.brandBorder}`,
                }}
              >
                <span
                  style={{
                    ...OBS_V2.typography.scale.title,
                    color: OBS_V2.color.brand,
                    fontSize: 28,
                  }}
                >
                  {(tournamentName || "BW").slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}

            {/* Tournament info */}
            <div className="flex flex-col justify-center min-w-0">
              <div
                style={{
                  ...OBS_V2.typography.scale.label,
                  color: OBS_V2.color.brand,
                  marginBottom: 4,
                }}
              >
                MATCH INTERVAL
              </div>
              <div
                className="truncate"
                style={{
                  ...OBS_V2.typography.scale.headline,
                  color: OBS_V2.color.text,
                  letterSpacing: "0.04em",
                  lineHeight: 1,
                }}
              >
                {tournamentName || "BIDWAR CRICKET"}
              </div>
              <div
                style={{
                  ...OBS_V2.typography.scale.label,
                  color: OBS_V2.color.textMuted,
                  marginTop: 4,
                }}
              >
                OFFICIAL STREAM
              </div>
            </div>
          </div>

          {/* RIGHT SECTION: Sponsor Spotlight */}
          <div
            className="flex-1 flex items-center"
            style={{ padding: `0 ${OBS_V2.spacing.xl}px`, overflow: "hidden" }}
          >
            {activeSponsor ? (
              <div className="flex items-center justify-between w-full gap-6">
                {/* Label + Logo + Name */}
                <div className="flex items-center gap-4 min-w-0">
                  {/* "SPONSORED BY" label */}
                  <div
                    className="shrink-0 text-right hidden sm:block"
                    style={{ minWidth: 80 }}
                  >
                    <div
                      style={{
                        ...OBS_V2.typography.scale.micro,
                        color: OBS_V2.color.brand,
                      }}
                    >
                      SPONSORED
                    </div>
                    <div
                      style={{
                        ...OBS_V2.typography.scale.micro,
                        color: OBS_V2.color.brand,
                      }}
                    >
                      BY
                    </div>
                  </div>

                  {/* Sponsor Logo */}
                  {activeSponsor.logoUrl ? (
                    <div
                      className="shrink-0 flex items-center justify-center overflow-hidden"
                      style={{
                        width: 64,
                        height: 64,
                        background: OBS_V2.color.panelInset,
                        border: `1px solid ${OBS_V2.color.standard}`,
                        padding: 4,
                      }}
                    >
                      <img
                        src={activeSponsor.logoUrl}
                        alt={activeSponsor.name || "Sponsor"}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                  ) : (
                    <div
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: 64,
                        height: 64,
                        background: OBS_V2.color.panelInset,
                        border: `1px solid ${OBS_V2.color.brandBorder}`,
                      }}
                    >
                      <span
                        style={{
                          ...OBS_V2.typography.scale.title,
                          color: OBS_V2.color.brand,
                          fontSize: 22,
                        }}
                      >
                        {(activeSponsor.name || "SP").slice(0, 2).toUpperCase()}
                      </span>
                    </div>
                  )}

                  {/* Animated sponsor name & tier */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`sponsor-${activeSponsor.id}-${activeSponsorIdx}`}
                      initial={{ opacity: 0, x: 14 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -14 }}
                      transition={{ duration: 0.28, ease: "easeInOut" }}
                      className="flex flex-col justify-center min-w-0"
                    >
                      <div
                        className="truncate"
                        style={{
                          ...OBS_V2.typography.scale.title,
                          color: OBS_V2.color.text,
                          letterSpacing: "0.04em",
                          lineHeight: 1,
                          maxWidth: 420,
                        }}
                      >
                        {activeSponsor.name || "TOURNAMENT SPONSOR"}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          style={{
                            ...OBS_V2.typography.scale.micro,
                            color: OBS_V2.color.brand,
                            background: OBS_V2.color.brandSoft,
                            border: `1px solid ${OBS_V2.color.brandBorder}`,
                            padding: "2px 8px",
                          }}
                        >
                          {activeSponsor.label ?? (activeSponsor.tier === "title" ? "TITLE PARTNER" : "OFFICIAL PARTNER")}
                        </span>
                        {sponsorsList.length > 1 && (
                          <span
                            style={{
                              ...OBS_V2.typography.scale.micro,
                              color: OBS_V2.color.textDisabled,
                            }}
                          >
                            {activeSponsorIdx + 1}/{sponsorsList.length}
                          </span>
                        )}
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Mini sponsor dots (right) */}
                {sponsorsList.length > 1 && (
                  <div className="hidden lg:flex items-center gap-2 shrink-0">
                    {sponsorsList.slice(0, 4).map((sp, idx) => (
                      <div
                        key={`dot-${idx}`}
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: idx === activeSponsorIdx ? OBS_V2.color.brand : OBS_V2.color.standard,
                          transition: "background 0.3s ease",
                        }}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              /* No sponsor fallback */
              <div className="flex items-center justify-between w-full">
                <div
                  style={{
                    ...OBS_V2.typography.scale.headline,
                    color: OBS_V2.color.textSecondary,
                    letterSpacing: "0.06em",
                  }}
                >
                  OFFICIAL TOURNAMENT BROADCAST
                </div>
                <div
                  style={{
                    ...OBS_V2.typography.scale.label,
                    color: OBS_V2.color.textDisabled,
                  }}
                >
                  POWERED BY BIDWAR
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
