/**
 * BIDWAR — CRICKET BROADCAST OVERLAY V2
 * Authoritative Visual Foundation & Design Tokens
 *
 * Core Principles:
 * 1. Dark Obsidian Foundation (#050507, #08080C, #0C0C10, #11131A, #07080C)
 * 2. Gold is Brand Accent (#FFD700), not the entire UI
 * 3. Information Colour Hierarchy (semantic colors for states, metrics, alerts)
 * 4. Broadcast Geometry (controlled radius, chamfered accents, strong rails)
 * 5. Television Broadcast Typography (Bebas display, Inter body, JetBrains Mono numeric)
 * 6. Broadcast Spacing (4px grid, safe insets 96x54)
 * 7. Depth Hierarchy (surface, elevated, hero, inset with directional lighting)
 * 8. Broadcast Motion (precise timings, snappy broadcast curves, reading hold)
 * 9. Safe Area (1920x1080 16:9 canvas model)
 * 10. Strict Layering / Z-Index
 */

export const OBS_V2 = {
  /**
   * 1. 1920×1080 BROADCAST CANVAS & SAFE AREAS
   * Baseline television action-safe insets (~5% X/Y margins).
   */
  canvas: {
    width: 1920,
    height: 1080,
    aspect: "16:9" as const,
    safeX: 96,
    safeY: 54,
    safeWidth: 1728, // 1920 - (96 * 2)
    safeHeight: 972, // 1080 - (54 * 2)

    /** Standard layout vertical allocations */
    headerHeight: 64,
    scorebugHeight: 140,
    scorebugStripHeight: 104,
    scorebugRibbonHeight: 36,
    slateWidth: 1728,
    slateMaxHeight: 880,
  },

  /**
   * 2. COLOR SYSTEM
   * Obsidian foundation + BidWar Brand Gold + Semantic Hierarchy.
   */
  color: {
    // Dark Obsidian Foundation
    obsidian: "#050507", // Deepest base foundation / canvas void
    carbon: "#08080C", // Recessed chassis / structural backdrop
    panel: "#0C0C10", // Primary television broadcast panel
    panelElevated: "#11131A", // Lifted tier / active cards / popouts
    panelInset: "#07080C", // Sunken well / recessed metric container
    panelGlass: "rgba(12, 12, 16, 0.92)", // Controlled high-density backdrop

    // BidWar Brand Gold Accent (Restrained, Premium)
    brand: "#FFD700", // Authoritative BidWar Broadcast Yellow/Gold
    brandOn: "#0C0C10", // High-contrast text when placed ON gold
    brandSoft: "rgba(255, 215, 0, 0.12)", // Low-opacity brand tint
    brandBorder: "rgba(255, 215, 0, 0.42)", // Crisp brand edge line
    brandGlow: "rgba(255, 215, 0, 0.25)", // Ambient broadcast glow

    // Semantic Information & Sports Events
    info: "#12CFFF", // Cyan: Free Hit, Live Feed tracking, Secondary info
    infoSoft: "rgba(18, 207, 255, 0.14)",
    infoBorder: "rgba(18, 207, 255, 0.42)",
    infoGlow: "rgba(18, 207, 255, 0.28)",

    success: "#22C55E", // Green: Milestone (50/100), Target Achieved, Win
    successSoft: "rgba(34, 197, 94, 0.14)",
    successBorder: "rgba(34, 197, 94, 0.42)",
    successGlow: "rgba(34, 197, 94, 0.28)",

    danger: "#EF3340", // Crimson: Wicket dismissal, Review Lost, Out
    dangerSoft: "rgba(239, 51, 64, 0.16)",
    dangerBorder: "rgba(239, 51, 64, 0.48)",
    dangerGlow: "rgba(239, 51, 64, 0.32)",

    warning: "#F59E0B", // Amber: Caution, Super Over, RRR Spike, Countdown
    warningSoft: "rgba(245, 158, 11, 0.14)",
    warningBorder: "rgba(245, 158, 11, 0.42)",
    warningGlow: "rgba(245, 158, 11, 0.28)",

    neutral: "#94A3B8", // Slate: Dot ball, Wide, Standard divider
    neutralSoft: "rgba(148, 163, 184, 0.14)",
    neutralBorder: "rgba(148, 163, 184, 0.35)",

    // Typography Color Hierarchy
    text: "#F8FAFC", // High-contrast primary text
    textSecondary: "rgba(248, 250, 252, 0.72)", // Secondary context & figures
    textMuted: "rgba(248, 250, 252, 0.46)", // Units, labels, captions
    textDisabled: "rgba(248, 250, 252, 0.24)", // Inactive / placeholder

    // Structural Borders & Dividers
    hairline: "rgba(255, 255, 255, 0.08)", // Fine hairline edge
    standard: "rgba(255, 255, 255, 0.12)", // Structural panel border
    strong: "rgba(255, 255, 255, 0.18)", // Highlighted section border
    divider: "rgba(255, 255, 255, 0.10)", // Subtle separator
    dividerVertical: "rgba(255, 255, 255, 0.12)", // Column divider

    // Layered Surface Gradients (Extremely subtle, controlled lighting)
    gradient: {
      chassis: "linear-gradient(180deg, #08080C 0%, #050507 100%)",
      panel: "linear-gradient(180deg, #0E0F15 0%, #0A0A0E 100%)",
      elevated: "linear-gradient(180deg, #141722 0%, #0E1018 100%)",
      hero: "linear-gradient(180deg, #1A1D2B 0%, #11131E 100%)",
      inset: "linear-gradient(180deg, #050508 0%, #07080C 100%)",
      brandGleam: "linear-gradient(90deg, transparent 0%, rgba(255, 215, 0, 0.18) 50%, transparent 100%)",
    },
  },

  /**
   * 3. TYPOGRAPHY SYSTEM
   * Authoritative scale designed for 1920×1080 television readability.
   */
  typography: {
    family: {
      display: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
      body: "'Inter', 'Segoe UI', Arial, sans-serif",
      mono: "'JetBrains Mono', 'Consolas', monospace",
    },

    // Letter spacing tokens
    tracking: {
      tight: "-0.02em",
      normal: "0em",
      wide: "0.08em",
      wider: "0.16em",
      widest: "0.24em",
    },

    // Strict typography hierarchy scale
    scale: {
      mega: {
        fontSize: 112,
        lineHeight: 1,
        letterSpacing: "0.02em",
        fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
        fontWeight: 400,
        textTransform: "uppercase" as const,
      },
      score: {
        fontSize: 72,
        lineHeight: 1,
        letterSpacing: "0.02em",
        fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
        fontWeight: 400,
        textTransform: "uppercase" as const,
      },
      hero: {
        fontSize: 56,
        lineHeight: 1,
        letterSpacing: "0.03em",
        fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
        fontWeight: 400,
        textTransform: "uppercase" as const,
      },
      title: {
        fontSize: 36,
        lineHeight: 1.05,
        letterSpacing: "0.04em",
        fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
        fontWeight: 400,
        textTransform: "uppercase" as const,
      },
      headline: {
        fontSize: 24,
        lineHeight: 1.15,
        letterSpacing: "0.03em",
        fontFamily: "'Bebas Neue', 'Arial Narrow', Impact, sans-serif",
        fontWeight: 400,
        textTransform: "uppercase" as const,
      },
      scoreSub: {
        fontSize: 28,
        lineHeight: 1,
        letterSpacing: "0.02em",
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontWeight: 700,
        textTransform: "none" as const,
      },
      statNum: {
        fontSize: 22,
        lineHeight: 1,
        letterSpacing: "0.01em",
        fontFamily: "'JetBrains Mono', 'Consolas', monospace",
        fontWeight: 700,
        textTransform: "none" as const,
      },
      value: {
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: "0.01em",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontWeight: 600,
        textTransform: "none" as const,
      },
      body: {
        fontSize: 14,
        lineHeight: 1.4,
        letterSpacing: "0em",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontWeight: 500,
        textTransform: "none" as const,
      },
      bodySm: {
        fontSize: 12,
        lineHeight: 1.35,
        letterSpacing: "0.01em",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontWeight: 500,
        textTransform: "none" as const,
      },
      label: {
        fontSize: 11,
        lineHeight: 1.2,
        letterSpacing: "0.18em",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontWeight: 700,
        textTransform: "uppercase" as const,
      },
      micro: {
        fontSize: 9,
        lineHeight: 1.15,
        letterSpacing: "0.20em",
        fontFamily: "'Inter', 'Segoe UI', Arial, sans-serif",
        fontWeight: 800,
        textTransform: "uppercase" as const,
      },
    },
  },

  /**
   * 4. SPACING TOKENS (Strict 4px broadcast rhythm)
   */
  spacing: {
    micro: 2,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    section: 48,
    canvas: 64,
  },

  /**
   * 5. BROADCAST GEOMETRY & RADIUS
   * Controlled corners, chamfered accents, and strong horizontal rails.
   */
  geometry: {
    radius: {
      none: 0,
      xs: 2,
      sm: 4,
      md: 6,
      lg: 8,
      pill: 9999,
    },

    chamfer: {
      sm: 4,
      md: 6,
      lg: 10,
      // CSS clip-path helpers for chamfered cuts
      clipTopRight: (size: number = 6) =>
        `polygon(0 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% 100%, 0 100%)`,
      clipBothRight: (size: number = 6) =>
        `polygon(0 0, calc(100% - ${size}px) 0, 100% ${size}px, 100% calc(100% - ${size}px), calc(100% - ${size}px) 100%, 0 100%)`,
      clipSlanted: (offset: number = 14) =>
        `polygon(0 0, 100% 0, calc(100% - ${offset}px) 100%, 0 100%)`,
    },

    rail: {
      hairline: 1,
      standard: 2,
      hero: 3,
    },
  },

  /**
   * 6. DEPTH & LIGHTING
   * Consistent shadows and top directional hairlines.
   */
  depth: {
    shadow: {
      subtle: "0 2px 8px rgba(0, 0, 0, 0.45)",
      standard: "0 8px 24px rgba(0, 0, 0, 0.65)",
      elevated: "0 16px 40px rgba(0, 0, 0, 0.85)",
      hero: "0 20px 50px rgba(0, 0, 0, 0.92)",
      inset: "inset 0 2px 4px rgba(0, 0, 0, 0.60)",
    },

    edge: {
      topHairline: "1px solid rgba(255, 255, 255, 0.12)",
      topBrandRail: "2px solid #FFD700",
    },

    glow: {
      brand: "0 0 16px rgba(255, 215, 0, 0.28)",
      brandStrong: "0 0 24px rgba(255, 215, 0, 0.45)",
      info: "0 0 16px rgba(18, 207, 255, 0.28)",
      danger: "0 0 16px rgba(239, 51, 64, 0.32)",
      success: "0 0 16px rgba(34, 197, 94, 0.28)",
      warning: "0 0 16px rgba(245, 158, 11, 0.28)",
    },
  },

  /**
   * 7. MOTION LANGUAGE
   * Controlled, broadcast-first animations. No bouncy spring physics.
   */
  motion: {
    duration: {
      instant: 100, // Instant state toggles / tab switches
      fast: 180, // Minor metric updates, ball dot updates
      standard: 300, // Standard transitions, panel expands
      broadcast: 450, // Television lower-third reveals
      major: 700, // Full slate takeovers, major milestone reveals
      exit: 220, // Crisp wipe collapse
      hold: 2600, // Viewer comprehension hold for takeovers
    },

    easing: {
      // Snappy linear broadcast entry
      snappy: [0.16, 1, 0.3, 1] as const,
      // Smooth cinematic ease
      smooth: [0.22, 1, 0.36, 1] as const,
      // Crisp rapid exit collapse
      exit: [0.7, 0, 0.84, 0] as const,
      // Linear ticker / marquee
      linear: "linear" as const,
    },
  },

  /**
   * 8. BROADCAST Z-INDEX LAYERING
   */
  layer: {
    canvas: 0,
    cameraFeed: 10,
    scorebug: 20,
    header: 30,
    structuralRail: 35,
    slates: 40,
    eventFlash: 50,
    operatorControls: 90,
  },
} as const;

/**
 * Returns CSS custom properties mapped from OBS_V2 tokens.
 * Injected automatically by ObsV2Canvas to guarantee styling consistency.
 */
export function getObsV2CssVariables(): Record<string, string> {
  return {
    "--obs-v2-canvas-width": `${OBS_V2.canvas.width}px`,
    "--obs-v2-canvas-height": `${OBS_V2.canvas.height}px`,
    "--obs-v2-safe-x": `${OBS_V2.canvas.safeX}px`,
    "--obs-v2-safe-y": `${OBS_V2.canvas.safeY}px`,

    "--obs-v2-color-obsidian": OBS_V2.color.obsidian,
    "--obs-v2-color-carbon": OBS_V2.color.carbon,
    "--obs-v2-color-panel": OBS_V2.color.panel,
    "--obs-v2-color-panel-elevated": OBS_V2.color.panelElevated,
    "--obs-v2-color-panel-inset": OBS_V2.color.panelInset,
    "--obs-v2-color-panel-glass": OBS_V2.color.panelGlass,

    "--obs-v2-color-brand": OBS_V2.color.brand,
    "--obs-v2-color-brand-on": OBS_V2.color.brandOn,
    "--obs-v2-color-brand-soft": OBS_V2.color.brandSoft,
    "--obs-v2-color-brand-border": OBS_V2.color.brandBorder,

    "--obs-v2-color-info": OBS_V2.color.info,
    "--obs-v2-color-success": OBS_V2.color.success,
    "--obs-v2-color-danger": OBS_V2.color.danger,
    "--obs-v2-color-warning": OBS_V2.color.warning,
    "--obs-v2-color-neutral": OBS_V2.color.neutral,

    "--obs-v2-color-text": OBS_V2.color.text,
    "--obs-v2-color-text-secondary": OBS_V2.color.textSecondary,
    "--obs-v2-color-text-muted": OBS_V2.color.textMuted,
    "--obs-v2-color-divider": OBS_V2.color.divider,

    "--obs-v2-font-display": OBS_V2.typography.family.display,
    "--obs-v2-font-body": OBS_V2.typography.family.body,
    "--obs-v2-font-mono": OBS_V2.typography.family.mono,
  };
}

export type ObsV2 = typeof OBS_V2;
