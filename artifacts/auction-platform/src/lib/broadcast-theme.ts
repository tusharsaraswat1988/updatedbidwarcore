/**
 * Broadcast-Grade Design System for BidWar.in
 * Inspired by professional sports broadcasting and auction environments
 * Colors: Graphite-Navy base, IPL trophy gold, Ember-Orange, Emerald-Green, Cyan
 */

export const BROADCAST_THEME = {
  // Base palette
  colors: {
    // Dark foundations (broadcast control room aesthetic)
    darkBase: "#0F1117",
    darkCard: "#161B22",
    darkHover: "#1F2329",
    darkBorder: "#30363D",

    // Brand accent - IPL trophy gold
    gold: "#F5B301",
    goldLight: "#FFC107",
    goldDark: "#D4A106",

    // Live state - Ember orange
    orange: "#FF6B35",
    orangeLight: "#FF8A50",
    orangeDark: "#E55A1F",

    // Sold state - Emerald green
    green: "#10B981",
    greenLight: "#34D399",
    greenDark: "#059669",

    // Real-time indicator - Cyan
    cyan: "#06B6D4",
    cyanLight: "#22D3EE",
    cyanDark: "#0891B2",

    // Neutral palette
    white: "#FFFFFF",
    gray50: "#F9FAFB",
    gray100: "#F3F4F6",
    gray200: "#E5E7EB",
    gray300: "#D1D5DB",
    gray400: "#9CA3AF",
    gray500: "#6B7280",
    gray600: "#4B5563",
    gray700: "#374151",
    gray800: "#1F2937",
    gray900: "#111827",
  },

  // Typography scale for broadcast lower-third feel
  typography: {
    scales: {
      h1: {
        fontSize: "3.5rem",
        lineHeight: "1.1",
        fontWeight: "700",
        letterSpacing: "-0.02em",
      },
      h2: {
        fontSize: "2.5rem",
        lineHeight: "1.2",
        fontWeight: "700",
        letterSpacing: "-0.01em",
      },
      h3: {
        fontSize: "1.875rem",
        lineHeight: "1.3",
        fontWeight: "700",
      },
      h4: {
        fontSize: "1.5rem",
        lineHeight: "1.4",
        fontWeight: "600",
      },
      body: {
        fontSize: "1rem",
        lineHeight: "1.5",
        fontWeight: "400",
      },
      bodySmall: {
        fontSize: "0.875rem",
        lineHeight: "1.5",
        fontWeight: "400",
      },
      caption: {
        fontSize: "0.75rem",
        lineHeight: "1.4",
        fontWeight: "500",
        letterSpacing: "0.05em",
      },
    },
    fontFamily: {
      display: "'Space Grotesk', 'Space Grotesk Fallback', system-ui, sans-serif",
      body: "'Inter', 'Inter Fallback', system-ui, sans-serif",
      mono: "Menlo, monospace",
    },
  },

  // Auction states with broadcast styling
  auctionStates: {
    live: {
      bg: "bg-orange/10",
      border: "border-orange",
      text: "text-orange",
      badge: "Live",
      animation: "pulse",
    },
    sold: {
      bg: "bg-green/10",
      border: "border-green",
      text: "text-green",
      badge: "SOLD",
      animation: "none",
    },
    unsold: {
      bg: "bg-gray-700/10",
      border: "border-gray-700",
      text: "text-gray-400",
      badge: "Unsold",
      animation: "none",
    },
    upcoming: {
      bg: "bg-cyan/10",
      border: "border-cyan",
      text: "text-cyan",
      badge: "Up Next",
      animation: "none",
    },
  },

  // Component spacing system (follows Tailwind scale)
  spacing: {
    xs: "0.25rem",
    sm: "0.5rem",
    md: "1rem",
    lg: "1.5rem",
    xl: "2rem",
    "2xl": "3rem",
    "3xl": "4rem",
  },

  // Border radius
  radius: {
    sm: "0.25rem",
    md: "0.5rem",
    lg: "1rem",
    xl: "1.5rem",
    full: "9999px",
  },

  // Shadows for depth
  shadows: {
    sm: "0 1px 2px 0 rgb(0 0 0 / 0.5)",
    md: "0 4px 6px -1px rgb(0 0 0 / 0.5), 0 2px 4px -2px rgb(0 0 0 / 0.5)",
    lg: "0 10px 15px -3px rgb(0 0 0 / 0.5), 0 4px 6px -4px rgb(0 0 0 / 0.5)",
    xl: "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)",
    glow: "0 0 20px 0 hsla(43, 96%, 56%, 0.5)",
    glowSuccess: "0 0 20px 0 hsla(142, 71%, 45%, 0.5)",
    glowDanger: "0 0 20px 0 hsla(0, 84%, 60%, 0.5)",
  },

  // Animation presets
  animations: {
    // Bid ticker number update
    bidTicker: {
      name: "bid-ticker",
      duration: "300ms",
      timing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    // Sold stamp appearance
    soldStamp: {
      name: "sold-stamp",
      duration: "500ms",
      timing: "cubic-bezier(0.34, 1.56, 0.64, 1)",
    },
    // Soft pulse for live indicators
    softPulse: {
      name: "soft-pulse",
      duration: "2s",
      timing: "ease-in-out",
      iterationCount: "infinite",
    },
  },
};

// Export helper function for state styling
export function getAuctionStateStyling(state: "live" | "sold" | "unsold" | "upcoming") {
  return BROADCAST_THEME.auctionStates[state];
}

// Export color for direct access
export function getBroadcastColor(colorName: keyof typeof BROADCAST_THEME.colors) {
  return BROADCAST_THEME.colors[colorName];
}
