import type { CSSProperties } from "react";
import { SponsorPriorityType } from "@/lib/sponsor-logo";

export type SponsorBroadcastTier = "title" | "co_sponsor" | "normal";

const TITLE_GOLD = "#F7DF8A";
const TITLE_GOLD_MUTED = "rgba(247, 223, 138, 0.72)";
const CO_SILVER = "rgba(232, 238, 248, 0.96)";
const CO_SILVER_MUTED = "rgba(180, 200, 220, 0.7)";

export function sponsorBroadcastTier(priorityType: SponsorPriorityType): SponsorBroadcastTier {
  if (priorityType === SponsorPriorityType.TITLE) return "title";
  if (priorityType === SponsorPriorityType.CO_SPONSOR) return "co_sponsor";
  return "normal";
}

export function getSponsorLogoFilter(tier: SponsorBroadcastTier): string {
  switch (tier) {
    case "title":
      return "drop-shadow(0 0 16px rgba(247, 223, 138, 0.7)) drop-shadow(0 4px 14px rgba(0,0,0,0.55))";
    case "co_sponsor":
      return "drop-shadow(0 0 10px rgba(180, 200, 220, 0.45)) drop-shadow(0 2px 10px rgba(0,0,0,0.55))";
    default:
      return "drop-shadow(0 2px 10px rgba(0,0,0,0.55))";
  }
}

export function getSponsorTickerNameStyle(
  tier: SponsorBroadcastTier,
  overlay: boolean,
): CSSProperties {
  const baseFontSize = overlay ? 18 : 16;

  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD,
        fontWeight: 900,
        fontSize: baseFontSize + 4,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.85)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER,
        fontWeight: 800,
        fontSize: baseFontSize + 2,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        textShadow: "0 1px 3px rgba(0,0,0,0.75)",
      };
    default:
      return {
        color: "rgba(255,255,255,0.95)",
        fontWeight: 700,
        fontSize: baseFontSize,
        letterSpacing: "0.05em",
      };
  }
}

export function getSponsorTickerTypeStyle(
  tier: SponsorBroadcastTier,
  overlay: boolean,
): CSSProperties {
  const baseFontSize = overlay ? 13 : 12;

  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD_MUTED,
        fontWeight: 700,
        fontSize: baseFontSize + 1,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER_MUTED,
        fontWeight: 700,
        fontSize: baseFontSize,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      };
    default:
      return {
        color: "rgba(255,255,255,0.7)",
        fontWeight: 600,
        fontSize: baseFontSize,
        letterSpacing: "0.05em",
        textTransform: "none",
      };
  }
}

export function getSponsorCaptionNameStyle(
  tier: SponsorBroadcastTier,
  overlay: boolean,
): CSSProperties {
  const fontSize = overlay ? 11 : 13;

  switch (tier) {
    case "title":
      return {
        fontSize: fontSize + 2,
        fontWeight: 800,
        letterSpacing: "0.1em",
        textTransform: "uppercase",
        color: TITLE_GOLD,
        textShadow:
          "0 0 12px rgba(247, 223, 138, 0.55), 0 1px 6px rgba(0,0,0,0.65)",
      };
    case "co_sponsor":
      return {
        fontSize: fontSize + 1,
        fontWeight: 800,
        letterSpacing: "0.09em",
        textTransform: "uppercase",
        color: CO_SILVER,
        textShadow: "0 0 8px rgba(180, 200, 220, 0.35), 0 1px 6px rgba(0,0,0,0.65)",
      };
    default:
      return {
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.92)",
        textShadow: "0 1px 6px rgba(0,0,0,0.65)",
      };
  }
}

/** LED chyron strip — elevated pill treatment for title / co-sponsor tiers. */
export function getSponsorChyronItemStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        background: "rgba(245, 197, 24, 0.08)",
        border: "1.5px solid rgba(245, 197, 24, 0.5)",
        borderRadius: 8,
        padding: "5px 14px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      };
    case "co_sponsor":
      return {
        background: "rgba(255, 255, 255, 0.06)",
        border: "1.5px solid rgba(255, 255, 255, 0.3)",
        borderRadius: 8,
        padding: "5px 14px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.4)",
      };
    default:
      return {
        background: "rgba(255, 255, 255, 0.03)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 8,
        padding: "5px 14px",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
      };
  }
}

export function getSponsorChyronNameStyle(tier: SponsorBroadcastTier): CSSProperties {
  const fullName: CSSProperties = {
    whiteSpace: "nowrap",
    overflow: "visible",
    textOverflow: "clip",
    maxWidth: "none",
    fontFamily: "'Barlow Condensed', sans-serif",
    wordSpacing: "0.22em",
  };
  switch (tier) {
    case "title":
      return {
        ...fullName,
        color: "#FFE27A",
        fontSize: "clamp(1.2rem, 1.6cqw, 1.7rem)",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
      };
    case "co_sponsor":
      return {
        ...fullName,
        color: "#FFFFFF",
        fontSize: "clamp(1.1rem, 1.45cqw, 1.55rem)",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textShadow: "0 1px 2px rgba(0,0,0,0.9)",
      };
    default:
      return {
        ...fullName,
        color: "#FFFFFF",
        fontSize: "clamp(1.05rem, 1.35cqw, 1.45rem)",
        fontWeight: 800,
        letterSpacing: "0.04em",
        textShadow: "0 1px 2px rgba(0,0,0,0.85)",
      };
  }
}

export function getSponsorChyronTypeStyle(tier: SponsorBroadcastTier): CSSProperties {
  const baseType: CSSProperties = {
    fontFamily: "'Space Grotesk', sans-serif",
    wordSpacing: "0.15em",
  };
  switch (tier) {
    case "title":
      return {
        ...baseType,
        color: "#E5C158",
        fontSize: "clamp(0.74rem, 0.94cqw, 1rem)",
        letterSpacing: "0.08em",
        fontWeight: 700,
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      };
    case "co_sponsor":
      return {
        ...baseType,
        color: "rgba(255, 255, 255, 0.85)",
        fontSize: "clamp(0.72rem, 0.88cqw, 0.94rem)",
        letterSpacing: "0.07em",
        fontWeight: 700,
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      };
    default:
      return {
        ...baseType,
        color: "rgba(255, 255, 255, 0.72)",
        fontSize: "clamp(0.7rem, 0.84cqw, 0.9rem)",
        letterSpacing: "0.07em",
        fontWeight: 600,
        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
      };
  }
}

export function getSponsorChyronLogoStyle(tier: SponsorBroadcastTier): CSSProperties {
  const base: CSSProperties = {
    height: "82%",
    maxHeight: tier === "title" ? 42 : 38,
    width: "auto",
    objectFit: "contain",
    borderRadius: 6,
    padding: "3px 8px",
    backgroundColor: "#FFFFFF",
    boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
  };

  switch (tier) {
    case "title":
      return {
        ...base,
        border: "1.5px solid rgba(245, 197, 24, 0.6)",
      };
    case "co_sponsor":
      return {
        ...base,
        border: "1.5px solid rgba(220, 230, 245, 0.4)",
      };
    default:
      return base;
  }
}

export function getSponsorCaptionTypeStyle(
  tier: SponsorBroadcastTier,
  overlay: boolean,
): CSSProperties {
  const fontSize = overlay ? 10 : 11;

  switch (tier) {
    case "title":
      return {
        fontSize: fontSize + 1,
        fontWeight: 700,
        letterSpacing: "0.14em",
        textTransform: "uppercase",
        color: TITLE_GOLD_MUTED,
        textShadow: "0 0 6px rgba(247, 223, 138, 0.3)",
      };
    case "co_sponsor":
      return {
        fontSize,
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        color: CO_SILVER_MUTED,
        textShadow: "0 0 4px rgba(180, 200, 220, 0.25)",
      };
    default:
      return {
        fontSize,
        fontWeight: 600,
        letterSpacing: overlay ? "0.12em" : "0.14em",
        textTransform: "uppercase",
        color: "rgba(255,255,255,0.65)",
        textShadow: "0 1px 6px rgba(0,0,0,0.65)",
      };
  }
}

/** Side LED canvas (1080×1920) — tier-specific broadcast treatment. */
export function getSideLedKickerText(tier: SponsorBroadcastTier): string {
  switch (tier) {
    case "title":
      return "Title Sponsor";
    case "co_sponsor":
      return "Co-Presented By";
    default:
      return "Proudly Supported By";
  }
}

export function getSideLedKickerStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD,
        letterSpacing: "0.22em",
        fontWeight: 800,
        textTransform: "uppercase",
        textShadow: "0 0 28px rgba(247, 223, 138, 0.6), 0 2px 8px rgba(0,0,0,0.85)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER,
        letterSpacing: "0.2em",
        fontWeight: 800,
        textTransform: "uppercase",
        textShadow: "0 0 24px rgba(180, 200, 220, 0.5), 0 2px 8px rgba(0,0,0,0.85)",
      };
    default:
      return {
        color: "#FBBF24",
        letterSpacing: "0.2em",
        fontWeight: 800,
        textTransform: "uppercase",
        textShadow: "0 0 24px rgba(251, 191, 36, 0.5), 0 2px 8px rgba(0,0,0,0.85)",
      };
  }
}

export function getSideLedLogoFrameStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        border: "3.5px solid rgba(247, 223, 138, 0.95)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(255, 248, 230, 0.98) 100%)",
        boxShadow:
          "0 0 65px rgba(247, 223, 138, 0.55), 0 0 110px rgba(201, 162, 39, 0.3), 0 24px 60px rgba(0, 0, 0, 0.65)",
      };
    case "co_sponsor":
      return {
        border: "3px solid rgba(180, 200, 220, 0.85)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(240, 246, 255, 0.98) 100%)",
        boxShadow:
          "0 0 55px rgba(180, 200, 220, 0.45), 0 0 95px rgba(140, 165, 200, 0.25), 0 24px 60px rgba(0, 0, 0, 0.65)",
      };
    default:
      return {
        border: "2.5px solid rgba(245, 158, 11, 0.75)",
        background:
          "linear-gradient(145deg, rgba(255,255,255,0.99) 0%, rgba(255, 252, 240, 0.98) 100%)",
        boxShadow:
          "0 0 50px rgba(245, 158, 11, 0.45), 0 0 90px rgba(212, 175, 55, 0.22), 0 24px 60px rgba(0, 0, 0, 0.65)",
      };
  }
}

export function getSideLedNameStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD,
        fontWeight: 900,
        textShadow:
          "0 0 32px rgba(247, 223, 138, 0.65), 0 0 64px rgba(201, 162, 39, 0.35), 0 4px 16px rgba(0,0,0,0.95)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER,
        fontWeight: 900,
        textShadow:
          "0 0 28px rgba(180, 200, 220, 0.55), 0 0 54px rgba(140, 165, 200, 0.25), 0 4px 16px rgba(0,0,0,0.95)",
      };
    default:
      return {
        color: "#FFFFFF",
        fontWeight: 900,
        textShadow:
          "0 0 28px rgba(255, 255, 255, 0.35), 0 4px 16px rgba(0,0,0,0.95)",
      };
  }
}

export function getSideLedNameSize(baseSize: number, tier: SponsorBroadcastTier): number {
  switch (tier) {
    case "title":
      return Math.round(baseSize * 1.08);
    case "co_sponsor":
      return Math.round(baseSize * 1.04);
    default:
      return baseSize;
  }
}

export function getSideLedCategoryStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD_MUTED,
        textShadow: "0 0 16px rgba(247, 223, 138, 0.35)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER_MUTED,
        textShadow: "0 0 12px rgba(180, 200, 220, 0.28)",
      };
    default:
      return { color: "rgba(212, 175, 55, 0.92)" };
  }
}

export function getSideLedCategoryBadgeStyle(tier: SponsorBroadcastTier): CSSProperties {
  switch (tier) {
    case "title":
      return {
        color: TITLE_GOLD,
        background:
          "linear-gradient(135deg, rgba(201, 162, 39, 0.28) 0%, rgba(247, 223, 138, 0.1) 100%)",
        border: "2px solid rgba(247, 223, 138, 0.75)",
        boxShadow:
          "0 0 32px rgba(247, 223, 138, 0.4), inset 0 1px 0 rgba(255,255,255,0.2)",
        textShadow: "0 0 16px rgba(247, 223, 138, 0.55), 0 2px 6px rgba(0,0,0,0.85)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER,
        background:
          "linear-gradient(135deg, rgba(160, 180, 210, 0.25) 0%, rgba(232, 238, 248, 0.08) 100%)",
        border: "2px solid rgba(180, 200, 220, 0.65)",
        boxShadow:
          "0 0 28px rgba(180, 200, 220, 0.35), inset 0 1px 0 rgba(255,255,255,0.2)",
        textShadow: "0 0 14px rgba(180, 200, 220, 0.45), 0 2px 6px rgba(0,0,0,0.85)",
      };
    default:
      return {
        color: "#FCD34D",
        background:
          "linear-gradient(135deg, rgba(212, 175, 55, 0.22) 0%, rgba(255, 255, 255, 0.05) 100%)",
        border: "2px solid rgba(245, 158, 11, 0.65)",
        boxShadow:
          "0 0 28px rgba(212, 175, 55, 0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
        textShadow: "0 0 16px rgba(245, 158, 11, 0.5), 0 2px 6px rgba(0,0,0,0.85)",
      };
  }
}

export function getSideLedGlowClass(tier: SponsorBroadcastTier): string {
  switch (tier) {
    case "title":
      return "side-sponsor-glow--title";
    case "co_sponsor":
      return "side-sponsor-glow--co";
    default:
      return "side-sponsor-glow--normal";
  }
}
