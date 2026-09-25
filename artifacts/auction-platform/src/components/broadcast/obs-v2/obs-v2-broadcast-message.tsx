import { forwardRef, type CSSProperties, type HTMLAttributes } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { OBS_V2 } from "./obs-v2-tokens";
import { ObsV2Text, ObsV2Label } from "./obs-v2-typography";
import type { ObsV2BroadcastMessageData } from "./types";

export interface ObsV2BroadcastMessageProps extends HTMLAttributes<HTMLDivElement> {
  /** The broadcast message payload to display (or null to hide) */
  message: ObsV2BroadcastMessageData | null;
  className?: string;
  style?: CSSProperties;
}

/**
 * ObsV2BroadcastMessage — Television Broadcast Lower-Third Chyron Plate
 *
 * Graphic Pass 2 Architecture:
 * - Substantial visual mass: 560–720px width, 92–102px height.
 * - Solid 4.5px Gold Structural Spine with 72px top cap and 36px bottom return bracket.
 * - Engineered angular broadcast chassis with 24px top-right diagonal terminal and 12px bottom cuts.
 * - Multi-plate tonal depth: Obsidian base (#07080D) -> Navy-tinted inset (#0D0F17) -> Content surface (#111420).
 * - Secondary cyan/ice-blue structural edge on the opposite flank (#12CFFF).
 * - Top directional metallic specular sheen.
 * - Commanding 32px condensed display headline (Bebas Neue) with 0.92 line-height.
 * - Integrated structural BIDWAR brand anchor badge plate.
 */
export const ObsV2BroadcastMessage = forwardRef<HTMLDivElement, ObsV2BroadcastMessageProps>(
  function ObsV2BroadcastMessage({ message, className = "", style, ...rest }, ref) {
    const isVisible = Boolean(message && message.message && message.message.trim().length > 0);

    return (
      <div
        ref={ref}
        className={`obs-v2-broadcast-message pointer-events-none absolute select-none ${className}`}
        style={{
          bottom: `${OBS_V2.canvas.scorebugHeight + OBS_V2.spacing.lg}px`,
          left: `${OBS_V2.canvas.safeX}px`,
          zIndex: OBS_V2.layer.slates,
          ...style,
        }}
        data-broadcast-message-active={isVisible ? "true" : "false"}
        {...rest}
      >
        <AnimatePresence mode="wait">
          {isVisible && message ? (
            <motion.div
              key="broadcast-message-plate"
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.992 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1],
              }}
              className="relative w-max min-w-[560px] max-w-[720px]"
            >
              {/* LAYER 1: Deep Broadcast Drop Shadow & Directional Grounding */}
              <div
                className="absolute -inset-2 pointer-events-none"
                style={{
                  filter: "blur(22px)",
                  background:
                    "radial-gradient(ellipse at 25% 60%, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0) 75%)",
                  transform: "translateY(10px)",
                }}
              />

              {/* LAYER 2: Outer Structural Chassis (Asymmetrical Sports Broadcast Silhouette) */}
              {/* 24px top-right diagonal terminal + 12px bottom-right bevel + 12px bottom-left notch */}
              <div
                className="relative p-[1.5px] transition-all"
                style={{
                  clipPath:
                    "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 12px), calc(100% - 16px) 100%, 14px 100%, 0 calc(100% - 12px))",
                  background:
                    "linear-gradient(135deg, rgba(255, 215, 0, 0.75) 0%, rgba(255, 255, 255, 0.28) 20%, rgba(18, 207, 255, 0.25) 55%, rgba(255, 215, 0, 0.45) 100%)",
                  boxShadow:
                    "0 24px 48px -10px rgba(0, 0, 0, 0.88), 0 8px 20px -4px rgba(0, 0, 0, 0.75)",
                }}
              >
                {/* LAYER 3: Primary Dark Obsidian Chassis (#07080D Base) */}
                <div
                  className="relative p-[1px] overflow-hidden"
                  style={{
                    clipPath:
                      "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 12px), calc(100% - 16px) 100%, 14px 100%, 0 calc(100% - 12px))",
                    background: "#07080D",
                  }}
                >
                  {/* LAYER 4: Secondary Navy/Carbon Inset Well (#0D0F17 with Cool Undertone) */}
                  <div
                    className="relative overflow-hidden"
                    style={{
                      clipPath:
                        "polygon(0 0, calc(100% - 24px) 0, 100% 24px, 100% calc(100% - 12px), calc(100% - 16px) 100%, 14px 100%, 0 calc(100% - 12px))",
                      background:
                        "linear-gradient(180deg, #131724 0%, #0D101A 42%, #080A10 100%)",
                      minHeight: "94px",
                    }}
                  >
                    {/* LAYER 5: Directional Top Specular Sheen */}
                    <div
                      className="absolute inset-x-0 top-0 h-[1.5px] pointer-events-none z-20"
                      style={{
                        background:
                          "linear-gradient(90deg, rgba(255,215,0,0.95) 0%, rgba(255,255,255,0.55) 18%, rgba(255,255,255,0.15) 60%, transparent 100%)",
                      }}
                    />

                    {/* LAYER 6: Directional Ambient Light Spill (Top-Left Corner) */}
                    <div
                      className="absolute inset-0 pointer-events-none z-10"
                      style={{
                        background:
                          "radial-gradient(ellipse at 0% 0%, rgba(255, 215, 0, 0.08) 0%, rgba(18, 207, 255, 0.03) 40%, transparent 65%)",
                      }}
                    />

                    {/* LAYER 7: Structural Left Gold Spine (4.5px BidWar Gold Beam) */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[4.5px] z-30 pointer-events-none"
                      style={{
                        background: OBS_V2.color.brand,
                        boxShadow: `0 0 16px ${OBS_V2.color.brandGlow}, 0 0 5px ${OBS_V2.color.brand}`,
                      }}
                    />

                    {/* LAYER 8: Top Gold Spine Terminal (72px Angled Header Cap) */}
                    <div
                      className="absolute left-0 top-0 h-[3.5px] w-[72px] z-30 pointer-events-none"
                      style={{
                        background: OBS_V2.color.brand,
                        clipPath: "polygon(0 0, 100% 0, 84% 100%, 0 100%)",
                      }}
                    />

                    {/* LAYER 9: Bottom Gold Return Notch (36px Structural Bracket) */}
                    <div
                      className="absolute left-0 bottom-0 h-[3px] w-[36px] z-30 pointer-events-none"
                      style={{
                        background: OBS_V2.color.brand,
                        clipPath: "polygon(0 0, 78% 0, 100% 100%, 0 100%)",
                      }}
                    />

                    {/* LAYER 10: Secondary Cyan Structural Edge (Opposite Right Flank) */}
                    <div
                      className="absolute right-0 top-6 bottom-4 w-[2px] z-30 pointer-events-none"
                      style={{
                        background: OBS_V2.color.info,
                        boxShadow: `0 0 10px ${OBS_V2.color.infoGlow}`,
                      }}
                    />

                    {/* LAYER 11: Subtle Vertical Interior Guide Rule */}
                    <div
                      className="absolute left-[14px] top-2.5 bottom-2.5 w-[1px] z-20 pointer-events-none"
                      style={{
                        background: "rgba(255, 255, 255, 0.05)",
                      }}
                    />

                    {/* LAYER 12: Content Presentation Layout */}
                    <div className="relative z-20 pl-7 pr-9 pt-3.5 pb-4 flex flex-col justify-center gap-1.5">
                      {/* Header Row: Eyebrow Capsule + Integrated Brand Anchor */}
                      <div className="flex items-center justify-between gap-6">
                        {/* Eyebrow Lockup */}
                        <div className="flex items-center gap-2">
                          {/* Micro Gold Accent Parallelogram */}
                          <div
                            className="h-[9px] w-[3.5px] rounded-xs"
                            style={{
                              background: OBS_V2.color.brand,
                              transform: "skewX(-18deg)",
                              boxShadow: `0 0 6px ${OBS_V2.color.brandGlow}`,
                            }}
                          />

                          {message.eyebrow ? (
                            <ObsV2Label
                              className="font-extrabold uppercase leading-none tracking-[0.20em]"
                              style={{
                                color: OBS_V2.color.brand,
                                fontSize: "10px",
                                fontFamily: OBS_V2.typography.family.body,
                                textShadow: "0 1px 3px rgba(0, 0, 0, 0.9)",
                              }}
                            >
                              {message.eyebrow}
                            </ObsV2Label>
                          ) : null}
                        </div>

                        {/* Integrated Structural Brand Anchor Badge */}
                        <div
                          className="flex items-center gap-2 px-3 py-0.5 rounded-xs"
                          style={{
                            background: "rgba(255, 255, 255, 0.05)",
                            border: "1px solid rgba(255, 255, 255, 0.10)",
                            clipPath:
                              "polygon(0 0, calc(100% - 7px) 0, 100% 7px, 100% 100%, 7px 100%, 0 calc(100% - 7px))",
                          }}
                        >
                          {/* Micro Cyan Broadcast Indicator */}
                          <span
                            className="h-[4px] w-[4px] rounded-full"
                            style={{
                              background: OBS_V2.color.info,
                              boxShadow: `0 0 6px ${OBS_V2.color.infoGlow}`,
                            }}
                          />
                          <span
                            className="font-mono text-[9.5px] uppercase font-bold tracking-[0.26em]"
                            style={{ color: "rgba(255, 255, 255, 0.50)" }}
                          >
                            BIDWAR
                          </span>
                        </div>
                      </div>

                      {/* Dominant Headline (32px Bebas Neue Display Type) */}
                      <div>
                        <ObsV2Text
                          variant="headline"
                          className="font-normal uppercase tracking-[0.025em]"
                          style={{
                            color: "#FFFFFF",
                            fontSize: "32px",
                            lineHeight: "0.92",
                            textShadow: "0 2px 10px rgba(0, 0, 0, 0.95)",
                          }}
                        >
                          {message.message}
                        </ObsV2Text>
                      </div>

                      {/* Supporting Narrative Detail (13.5px Inter Secondary) */}
                      {message.supportingText ? (
                        <div className="pt-0.5">
                          <ObsV2Text
                            variant="body"
                            className="font-medium tracking-normal"
                            style={{
                              color: "rgba(248, 250, 252, 0.78)",
                              fontSize: "13.5px",
                              lineHeight: "1.3",
                              textShadow: "0 1px 4px rgba(0, 0, 0, 0.8)",
                            }}
                          >
                            {message.supportingText}
                          </ObsV2Text>
                        </div>
                      ) : null}
                    </div>

                    {/* Top-Right Chamfered Bevel Frame Accent */}
                    <div
                      className="absolute top-0 right-0 w-[28px] h-[28px] pointer-events-none z-30"
                      style={{
                        background:
                          "linear-gradient(225deg, rgba(255, 215, 0, 0.55) 0%, rgba(18, 207, 255, 0.25) 40%, transparent 70%)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);
