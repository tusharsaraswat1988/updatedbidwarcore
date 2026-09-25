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
 * Visual Architecture (Layer 1 Refinement):
 * 1. Base Stage: Action-safe alignment (96px left, 156px bottom dock).
 * 2. Deep Broadcast Shadow: Multi-tier directional occlusion (45px blur).
 * 3. Outer Structural Rim: 1px metallic/gold chamfered perimeter clip.
 * 4. Obsidian Chassis: Deep multi-stop gradient (#13151E -> #0D0E15 -> #08080C).
 * 5. Structural Accent Rail: 3.5px BidWar Gold (#FFD700) left vertical beam with glow.
 * 6. Geometric Rail Terminals: Angled top cap (56px) and bottom return notch.
 * 7. Top Specular Hairline: Directional top-edge light reflection.
 * 8. Secondary Structural Guide: Subtle vertical divider separating rail from text.
 * 9. Television Typography:
 *    - Eyebrow: 10px uppercase gold metadata label with wide 0.18em tracking.
 *    - Headline: 28px condensed Bebas display type, commanding line-height (0.96).
 *    - Supporting Text: 12px Inter body text in high-legibility secondary white.
 * 10. Integrated Brand Anchor: Angular top-right BIDWAR platform mark.
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
              className="relative w-max min-w-[440px] max-w-[680px]"
            >
              {/* LAYER 1: Deep Broadcast Drop Shadow & Ambient Floor Reflection */}
              <div
                className="absolute -inset-1 pointer-events-none"
                style={{
                  filter: "blur(18px)",
                  background: "radial-gradient(ellipse at 20% 50%, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 75%)",
                  transform: "translateY(8px)",
                }}
              />

              {/* LAYER 2: Outer Structural Frame with Asymmetrical Chamfer Cuts */}
              {/* Top-right diagonal 20px cut + Bottom-right subtle 8px bevel */}
              <div
                className="relative p-[1px] transition-all"
                style={{
                  clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
                  background:
                    "linear-gradient(135deg, rgba(255, 215, 0, 0.60) 0%, rgba(255, 255, 255, 0.22) 18%, rgba(255, 255, 255, 0.08) 60%, rgba(255, 215, 0, 0.35) 100%)",
                  boxShadow:
                    "0 20px 40px -8px rgba(0, 0, 0, 0.85), 0 6px 16px -2px rgba(0, 0, 0, 0.70)",
                }}
              >
                {/* LAYER 3: Primary Obsidian Plate Interior */}
                <div
                  className="relative overflow-hidden"
                  style={{
                    clipPath: "polygon(0 0, calc(100% - 20px) 0, 100% 20px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%)",
                    background:
                      "linear-gradient(180deg, #13151E 0%, #0D0F16 38%, #08080C 100%)",
                  }}
                >
                  {/* LAYER 4: Inner Specular Top Hairline */}
                  <div
                    className="absolute inset-x-0 top-0 h-[1px] pointer-events-none z-20"
                    style={{
                      background:
                        "linear-gradient(90deg, rgba(255,215,0,0.8) 0%, rgba(255,255,255,0.4) 15%, rgba(255,255,255,0.12) 65%, transparent 100%)",
                    }}
                  />

                  {/* LAYER 5: Directional Top-Left Glaze Inset */}
                  <div
                    className="absolute inset-0 pointer-events-none z-10"
                    style={{
                      background:
                        "radial-gradient(ellipse at 0% 0%, rgba(255, 215, 0, 0.06) 0%, transparent 55%)",
                    }}
                  />

                  {/* LAYER 6: Structural Left Accent Rail (3.5px BidWar Gold with Glow) */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-[3.5px] z-30 pointer-events-none"
                    style={{
                      background: OBS_V2.color.brand,
                      boxShadow: `0 0 14px ${OBS_V2.color.brandGlow}, 0 0 4px ${OBS_V2.color.brand}`,
                    }}
                  />

                  {/* LAYER 7: Top-Left Designed Gold Terminal Return Cap */}
                  <div
                    className="absolute left-0 top-0 h-[3px] w-[56px] z-30 pointer-events-none"
                    style={{
                      background: OBS_V2.color.brand,
                      clipPath: "polygon(0 0, 100% 0, 82% 100%, 0 100%)",
                    }}
                  />

                  {/* LAYER 8: Bottom-Left Micro Return Notch */}
                  <div
                    className="absolute left-0 bottom-0 h-[2.5px] w-[24px] z-30 pointer-events-none"
                    style={{
                      background: OBS_V2.color.brand,
                      clipPath: "polygon(0 0, 80% 0, 100% 100%, 0 100%)",
                    }}
                  />

                  {/* LAYER 9: Subtle Secondary Vertical Guide Line */}
                  <div
                    className="absolute left-[12px] top-2 bottom-2 w-[1px] z-20 pointer-events-none"
                    style={{
                      background: "rgba(255, 255, 255, 0.04)",
                    }}
                  />

                  {/* LAYER 10: Content Presentation Layout */}
                  <div className="relative z-20 pl-6 pr-8 pt-3 pb-3.5 flex flex-col gap-1">
                    {/* Header Row: Eyebrow Tag + Brand Anchor Badge */}
                    <div className="flex items-center justify-between gap-6">
                      {/* Eyebrow / Metadata Capsule */}
                      <div className="flex items-center gap-2">
                        {/* Micro Accent Slanted Tick */}
                        <div
                          className="h-[8px] w-[3px] rounded-xs"
                          style={{
                            background: OBS_V2.color.brand,
                            transform: "skewX(-15deg)",
                          }}
                        />

                        {message.eyebrow ? (
                          <ObsV2Label
                            className="font-bold uppercase leading-none tracking-[0.18em]"
                            style={{
                              color: OBS_V2.color.brand,
                              fontSize: "10px",
                              fontFamily: OBS_V2.typography.family.body,
                              textShadow: "0 1px 2px rgba(0, 0, 0, 0.8)",
                            }}
                          >
                            {message.eyebrow}
                          </ObsV2Label>
                        ) : null}
                      </div>

                      {/* Integrated Structural Brand Anchor */}
                      <div
                        className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-xs"
                        style={{
                          background: "rgba(255, 255, 255, 0.04)",
                          border: "1px solid rgba(255, 255, 255, 0.08)",
                          clipPath: "polygon(0 0, calc(100% - 6px) 0, 100% 6px, 100% 100%, 6px 100%, 0 calc(100% - 6px))",
                        }}
                      >
                        <span
                          className="font-mono text-[9px] uppercase font-bold tracking-[0.24em]"
                          style={{ color: "rgba(255, 255, 255, 0.45)" }}
                        >
                          BIDWAR
                        </span>
                      </div>
                    </div>

                    {/* Dominant Headline (28px Condensed Display) */}
                    <div className="pt-0.5">
                      <ObsV2Text
                        variant="headline"
                        className="font-normal uppercase tracking-[0.025em]"
                        style={{
                          color: "#FFFFFF",
                          fontSize: "28px",
                          lineHeight: "0.95",
                          textShadow: "0 2px 8px rgba(0, 0, 0, 0.9)",
                        }}
                      >
                        {message.message}
                      </ObsV2Text>
                    </div>

                    {/* Supporting Narrative Detail (12px Inter Secondary) */}
                    {message.supportingText ? (
                      <div className="pt-0.5">
                        <ObsV2Text
                          variant="bodySm"
                          className="font-medium tracking-normal"
                          style={{
                            color: "rgba(248, 250, 252, 0.72)",
                            fontSize: "12px",
                            lineHeight: "1.25",
                          }}
                        >
                          {message.supportingText}
                        </ObsV2Text>
                      </div>
                    ) : null}
                  </div>

                  {/* Corner Accent Bevel Tick (Top-Right Angle Frame) */}
                  <div
                    className="absolute top-0 right-0 w-[24px] h-[24px] pointer-events-none z-30"
                    style={{
                      background:
                        "linear-gradient(225deg, rgba(255, 215, 0, 0.45) 0%, transparent 60%)",
                    }}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    );
  },
);
