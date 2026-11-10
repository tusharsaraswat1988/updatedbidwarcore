/**
 * BIDWAR CRICKET — ROYAL WEDDING DESIGN SYSTEM (PHASE 1)
 * Authoritative Visual Foundation & Design Tokens
 *
 * Designed for luxury Indian Wedding Cricket broadcasts (e.g. Bride's XI vs Groom's XI).
 *
 * Core Aesthetic Principles:
 * 1. Regal & Ceremonial: Inspired by Indian wedding heritage, silk lehengas, and royal durbars.
 * 2. High Contrast & Readability: Ivory parchment and dark charcoal ink ensure crisp broadcast legibility.
 * 3. Restrained Gold: Metallic champagne and antique gold used strictly for structural rims,
 *    filigree accents, and subtle gleams — never gaudy or cartoonish.
 * 4. Architectural Geometry: Scalloped corners, double-rule borders, and arched portrait alcoves.
 * 5. Classical Typography: Romantic copperplate scripts for titles, classical Roman serifs for subtitles,
 *    and precision tabular serifs for score numbers.
 * 6. Broadcast Integrity: Strictly adheres to 1920×1080 16:9 safe zone standards.
 */

export const WEDDING_TOKENS = {
  /**
   * 1. 1920×1080 BROADCAST CANVAS & SAFE AREAS
   */
  canvas: {
    width: 1920,
    height: 1080,
    aspect: "16:9" as const,
    safeX: 96,
    safeY: 54,
    safeWidth: 1728, // 1920 - (96 * 2)
    safeHeight: 972, // 1080 - (54 * 2)

    /** Vertical Broadcast Zones */
    zones: {
      header: { top: 24, height: 160, zIndex: 30 },
      liveBug: { top: 32, right: 48, height: 38, zIndex: 35 },
      cameraSafe: { top: 190, height: 500, zIndex: 10 },
      lowerThird: { top: 710, height: 260, zIndex: 20 },
      footer: { top: 1020, height: 48, zIndex: 25 },
    },

    /** Lower-Third Scoreboard Physical Geometry */
    scoreboard: {
      width: 1240, // Centered plaque width
      mainStripHeight: 92, // Top tier: Team Badges + Center Score Pod
      statsRibbonHeight: 68, // Bottom tier: Batsmen + Rates + Bowler
      totalHeight: 160,
      cornerRadius: 16,
      teamBadgeWidth: 400,
      scorePodWidth: 360,
      vsMedallionSize: 44,
      ballPillSize: 32,
      avatarAlcoveWidth: 78,
    },

    /** Header Tournament Plaque Geometry */
    headerPlaque: {
      width: 680,
      height: 148,
      crestSize: 48,
    },
  },

  /**
   * 2. COLOR PALETTE
   * Ceremonial Indian Wedding Palette: Royal Burgundy, Midnight Navy, Champagne Gold,
   * Warm Ivory, Deep Emerald, and Dark Charcoal.
   */
  color: {
    // Primary Ceremonial Identity
    burgundy: {
      deep: "#4A0E18", // Deep velvet shadow
      base: "#6B1D2F", // Authoritative Bride's XI burgundy
      rich: "#801830", // Highlight burgundy
      light: "#9A2740", // Edge accent
      soft: "rgba(107, 29, 47, 0.12)",
      glow: "rgba(128, 24, 48, 0.35)",
    },

    navy: {
      deep: "#0F162B", // Deep midnight shadow
      base: "#182042", // Authoritative Groom's XI navy
      rich: "#243063", // Highlight navy
      light: "#354585", // Edge accent
      soft: "rgba(24, 32, 66, 0.12)",
      glow: "rgba(36, 48, 99, 0.35)",
    },

    gold: {
      deep: "#8A6D2D", // Antique shadow gold
      antique: "#B38C3B", // Burnished gold filigree
      rich: "#D4AF37", // Authoritative royal gold
      champagne: "#E5C378", // Luminous champagne metallic
      pale: "#F5EBC7", // Lightest highlight / ivory gold
      soft: "rgba(212, 175, 55, 0.14)",
      border: "rgba(212, 175, 55, 0.52)",
      borderStrong: "rgba(212, 175, 55, 0.85)",
      hairline: "rgba(212, 175, 55, 0.36)",
      glow: "rgba(229, 195, 120, 0.40)",
    },

    ivory: {
      pure: "#FFFDF9", // Highest surface highlight
      parchment: "#FDFBF7", // Primary scoreboard backdrop
      silk: "#F7F2EA", // Secondary surface well
      dim: "#ECE4D6", // Recessed well / border boundary
      aged: "#E0D5C3", // Outer shadow parchment
    },

    emerald: {
      deep: "#0B2B1F", // Deep jewel emerald
      base: "#124E38", // Ceremonial emerald
      light: "#1B7353", // Highlight emerald
      soft: "rgba(18, 78, 56, 0.14)",
      glow: "rgba(27, 115, 83, 0.30)",
    },

    charcoal: {
      ink: "#1C1917", // Primary high-contrast typography
      espresso: "#292420", // Secondary dark contrast
      muted: "#574E45", // Labels and captions
      subtle: "#85796E", // De-emphasized metadata
      faint: "#B5A99D", // Placeholders / disabled
    },

    // Semantic Match Event Colors
    semantic: {
      dotBall: "#786E64",
      single: "#1C1917",
      boundaryFour: "#D9981E", // Radiant warm gold
      boundarySix: "#124E38", // Regal emerald green
      wicket: "#8B1528", // Rich crimson burgundy
      extra: "#574E45",
      strikerMark: "#801830",
    },

    // Gradients
    gradient: {
      parchment: "linear-gradient(180deg, #FFFDF9 0%, #FDFBF7 60%, #F5ECE0 100%)",
      parchmentInset: "linear-gradient(180deg, #F3EAE0 0%, #FAF6EE 100%)",
      brideVelvet: "linear-gradient(135deg, #4A0E18 0%, #6B1D2F 55%, #801830 100%)",
      groomVelvet: "linear-gradient(135deg, #0F162B 0%, #182042 55%, #243063 100%)",
      goldMetallic: "linear-gradient(90deg, #8A6D2D 0%, #D4AF37 25%, #F5EBC7 50%, #D4AF37 75%, #8A6D2D 100%)",
      goldLinearVertical: "linear-gradient(180deg, #F5EBC7 0%, #D4AF37 60%, #8A6D2D 100%)",
      goldSoftRadial: "radial-gradient(circle, rgba(229, 195, 120, 0.22) 0%, transparent 70%)",
      liveBug: "linear-gradient(135deg, rgba(168, 24, 52, 0.94) 0%, rgba(128, 16, 40, 0.94) 100%)",
      vsMedallion: "linear-gradient(135deg, #2D241C 0%, #4A3A2C 50%, #2D241C 100%)",
    },
  },

  /**
   * 3. TYPOGRAPHY SYSTEM
   * Bespoke hierarchy balancing celebratory royal elegance with television legibility.
   */
  typography: {
    family: {
      // Script: Calligraphic headline for tournament name
      script: "'Alex Brush', 'Great Vibes', 'Playfair Display', cursive, serif",
      // Classical Roman serif for couple names, team titles, and labels
      serif: "'Cinzel', 'Playfair Display', 'Cormorant Garamond', 'Georgia', serif",
      // High-readability serif for numbers and scores
      numeric: "'Cinzel', 'Playfair Display', 'Georgia', serif",
      // Clean modern sans for small micro-metrics
      sans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    },

    tracking: {
      tight: "-0.02em",
      normal: "0em",
      wide: "0.08em",
      wider: "0.18em",
      widest: "0.26em",
    },

    scale: {
      // Cup Header Title ("The Wedding Cricket Cup")
      cupTitle: {
        fontSize: 44,
        lineHeight: 1.1,
        letterSpacing: "0.03em",
        fontFamily: "'Alex Brush', 'Great Vibes', 'Playfair Display', cursive, serif",
        fontWeight: 400,
      },
      // Couple Subtitle ("— AARAV & KIARA —")
      coupleSubtitle: {
        fontSize: 16,
        lineHeight: 1.2,
        letterSpacing: "0.24em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 600,
        textTransform: "uppercase" as const,
      },
      // Team Badges ("Bride's XI", "Groom's XI")
      teamName: {
        fontSize: 26,
        lineHeight: 1.15,
        letterSpacing: "0.02em",
        fontFamily: "'Playfair Display', 'Cinzel', serif",
        fontWeight: 600,
        fontStyle: "italic" as const,
      },
      // Primary Score Numerals ("72/3")
      primaryScore: {
        fontSize: 66,
        lineHeight: 0.95,
        letterSpacing: "-0.01em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 700,
      },
      // Overs Numerals ("8.4")
      oversScore: {
        fontSize: 26,
        lineHeight: 1.0,
        letterSpacing: "0.02em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 700,
      },
      // "OVERS" label
      oversLabel: {
        fontSize: 11,
        lineHeight: 1.1,
        letterSpacing: "0.20em",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        textTransform: "uppercase" as const,
      },
      // Batters / Bowlers Name Line ("Riya S.", "Arjun M.")
      playerLine: {
        fontSize: 17,
        lineHeight: 1.2,
        letterSpacing: "0.01em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 600,
      },
      // Player Figures ("28 (22)", "1-14 (1.4)")
      playerStats: {
        fontSize: 17,
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 600,
      },
      // Analytics Label ("CRR", "PROJECTED")
      analyticsLabel: {
        fontSize: 11,
        lineHeight: 1.2,
        letterSpacing: "0.18em",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
        textTransform: "uppercase" as const,
      },
      // Analytics Value ("8.31", "83")
      analyticsValue: {
        fontSize: 18,
        lineHeight: 1.2,
        letterSpacing: "0.02em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 700,
      },
      // Ball pill text ("1", "4", "W")
      ballPill: {
        fontSize: 13,
        lineHeight: 1.0,
        letterSpacing: "0em",
        fontFamily: "'Inter', sans-serif",
        fontWeight: 700,
      },
      // VS Medallion text
      vsText: {
        fontSize: 15,
        lineHeight: 1.0,
        letterSpacing: "0.08em",
        fontFamily: "'Cinzel', 'Playfair Display', serif",
        fontWeight: 700,
        fontStyle: "italic" as const,
      },
    },
  },

  /**
   * 4. SPACING RHYTHM
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
  },

  /**
   * 5. ARCHITECTURAL BORDERS & GEOMETRY
   */
  geometry: {
    radius: {
      none: 0,
      xs: 3,
      sm: 6,
      md: 10,
      lg: 16,
      xl: 24,
      pill: 9999,
    },

    borderWidth: {
      hairline: 1,
      standard: 1.5,
      bold: 2.5,
      double: 4,
    },

    // Scalloped corner helper for luxury plaques
    scallopedCorner: (radius: number = 14) => ({
      borderRadius: `${radius}px`,
      boxShadow: `0 0 0 1px rgba(212, 175, 55, 0.45), 0 0 0 3px rgba(253, 251, 247, 0.9)`,
    }),
  },

  /**
   * 6. SHADOWS, DEPTH & LIGHTING
   */
  depth: {
    shadow: {
      subtle: "0 2px 8px rgba(36, 28, 20, 0.12)",
      parchment: "0 8px 24px rgba(36, 28, 20, 0.22)",
      elevated: "0 14px 36px rgba(28, 20, 16, 0.32)",
      dramatic: "0 20px 48px rgba(20, 14, 10, 0.48)",
      insetParchment: "inset 0 2px 4px rgba(60, 48, 36, 0.08)",
      goldRing: "0 0 0 1.5px #D4AF37, 0 4px 12px rgba(138, 109, 45, 0.3)",
    },

    edge: {
      goldHairline: "1px solid rgba(212, 175, 55, 0.42)",
      goldRail: "2px solid #D4AF37",
      doubleGold: "3px double rgba(212, 175, 55, 0.75)",
      innerParchmentLine: "1px solid rgba(138, 109, 45, 0.22)",
    },
  },

  /**
   * 7. BROADCAST MOTION & ANIMATION LANGUAGE
   * Smooth, majestic, regal timings avoiding aggressive bouncy arcade motions.
   */
  motion: {
    duration: {
      instant: 120,
      fast: 220,
      standard: 340,
      regal: 550, // Smooth royal transitions
      ceremonial: 850, // Grand reveals, trophy presentations
      pulse: 2200, // Gentle glowing pulse
    },

    easing: {
      regal: [0.22, 1, 0.36, 1] as const, // Smooth cubic deceleration
      sharp: [0.16, 1, 0.3, 1] as const,
      gentle: [0.4, 0, 0.2, 1] as const,
    },
  },

  /**
   * 8. BROADCAST Z-INDEX LAYERING
   */
  layer: {
    canvas: 0,
    ambientLights: 5,
    cameraFeed: 10,
    scorebugPlaque: 20,
    teamBadges: 24,
    centerScorePod: 26,
    vsMedallion: 28,
    headerPlaque: 30,
    liveBug: 35,
    celebrationOverlay: 50,
  },
} as const;

/**
 * Returns CSS custom properties mapped from WEDDING_TOKENS.
 * Allows pure CSS styling and Tailwind integration.
 */
export function getWeddingCssVariables(): Record<string, string> {
  return {
    "--wedding-color-burgundy": WEDDING_TOKENS.color.burgundy.base,
    "--wedding-color-burgundy-deep": WEDDING_TOKENS.color.burgundy.deep,
    "--wedding-color-burgundy-rich": WEDDING_TOKENS.color.burgundy.rich,
    "--wedding-color-navy": WEDDING_TOKENS.color.navy.base,
    "--wedding-color-navy-deep": WEDDING_TOKENS.color.navy.deep,
    "--wedding-color-navy-rich": WEDDING_TOKENS.color.navy.rich,
    "--wedding-color-gold": WEDDING_TOKENS.color.gold.rich,
    "--wedding-color-gold-champagne": WEDDING_TOKENS.color.gold.champagne,
    "--wedding-color-gold-antique": WEDDING_TOKENS.color.gold.antique,
    "--wedding-color-gold-pale": WEDDING_TOKENS.color.gold.pale,
    "--wedding-color-gold-border": WEDDING_TOKENS.color.gold.border,
    "--wedding-color-ivory": WEDDING_TOKENS.color.ivory.parchment,
    "--wedding-color-ivory-pure": WEDDING_TOKENS.color.ivory.pure,
    "--wedding-color-ivory-silk": WEDDING_TOKENS.color.ivory.silk,
    "--wedding-color-emerald": WEDDING_TOKENS.color.emerald.base,
    "--wedding-color-ink": WEDDING_TOKENS.color.charcoal.ink,
    "--wedding-color-ink-espresso": WEDDING_TOKENS.color.charcoal.espresso,
    "--wedding-color-ink-muted": WEDDING_TOKENS.color.charcoal.muted,

    "--wedding-font-script": WEDDING_TOKENS.typography.family.script,
    "--wedding-font-serif": WEDDING_TOKENS.typography.family.serif,
    "--wedding-font-numeric": WEDDING_TOKENS.typography.family.numeric,
    "--wedding-font-sans": WEDDING_TOKENS.typography.family.sans,

    "--wedding-shadow-parchment": WEDDING_TOKENS.depth.shadow.parchment,
    "--wedding-shadow-elevated": WEDDING_TOKENS.depth.shadow.elevated,
  };
}

export type WeddingTokens = typeof WEDDING_TOKENS;
