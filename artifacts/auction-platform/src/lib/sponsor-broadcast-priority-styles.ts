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
        fontSize: baseFontSize + 3,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        textShadow:
          "0 0 14px rgba(247, 223, 138, 0.6), 0 0 28px rgba(201, 162, 39, 0.35), 0 2px 4px rgba(0,0,0,0.85)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER,
        fontWeight: 800,
        fontSize: baseFontSize + 1,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textShadow: "0 0 10px rgba(180, 200, 220, 0.4), 0 2px 4px rgba(0,0,0,0.7)",
      };
    default:
      return {
        color: "rgba(255,255,255,0.85)",
        fontWeight: 700,
        fontSize: baseFontSize,
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
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        textShadow: "0 0 8px rgba(247, 223, 138, 0.35)",
      };
    case "co_sponsor":
      return {
        color: CO_SILVER_MUTED,
        fontWeight: 700,
        fontSize: baseFontSize,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        textShadow: "0 0 6px rgba(180, 200, 220, 0.25)",
      };
    default:
      return {
        color: "rgba(255,255,255,0.55)",
        fontWeight: 600,
        fontSize: baseFontSize,
        letterSpacing: "0.04em",
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
