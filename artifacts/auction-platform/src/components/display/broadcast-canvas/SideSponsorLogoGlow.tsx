import type { SponsorBroadcastTier } from "@/lib/sponsor-broadcast-priority-styles";
import { getSideLedGlowClass } from "@/lib/sponsor-broadcast-priority-styles";

/** Soft halo behind sponsor logo — tier-tinted gold / silver / neutral. */
export function SideSponsorLogoGlow({
  width,
  height,
  tier = "normal",
}: {
  width: number;
  height: number;
  tier?: SponsorBroadcastTier;
}) {
  const maxDim = Math.max(width, height);
  const haloScale = tier === "title" ? 1.45 : tier === "co_sponsor" ? 1.4 : 1.38;
  const haloSize = Math.round(maxDim * haloScale);
  const goldSize = Math.round(maxDim * (tier === "title" ? 1.28 : 1.22));
  const whiteSize = Math.round(maxDim * 1.02);
  const glowClass = getSideLedGlowClass(tier);

  return (
    <div
      aria-hidden
      className={`side-sponsor-glow-root ${glowClass}`}
      style={{
        position: "absolute",
        left: "50%",
        top: "50%",
        transform: "translate(-50%, -50%)",
        width: haloSize,
        height: haloSize,
        pointerEvents: "none",
        zIndex: 0,
      }}
    >
      <div
        className="side-sponsor-glow-primary broadcast-logo-breath"
        style={{ width: goldSize, height: goldSize }}
      />
      <div
        className="side-sponsor-glow-secondary broadcast-logo-breath-delayed"
        style={{ width: whiteSize, height: whiteSize }}
      />
    </div>
  );
}
