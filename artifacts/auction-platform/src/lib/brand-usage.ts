import type { BrandLogos } from "@/lib/brand-assets";

/**
 * Single source of truth for BidWar logo usage across the platform UI.
 * Do not duplicate size or asset-selection rules in components — import from here.
 */

export const LOGO_USAGE_RULES = {
  PRIMARY_LOGO: {
    assetKey: "PRIMARY_LOGO" as const,
    mapsTo: "main" as const,
    useOnlyFor: [
      "Landing Page Header",
      "Login Pages (light backgrounds)",
      "Marketing Hero Sections",
      "Footer (light backgrounds)",
      "Certificates",
      "Reports",
    ],
  },
  REVERSE_LOGO: {
    assetKey: "REVERSE_LOGO" as const,
    mapsTo: "mainReverse" as const,
    useOnlyFor: [
      "Dark Background Pages",
      "Dark Hero Sections",
      "Dark Navigation",
      "Authentication Screens",
      "Footer on dark pages",
    ],
  },
  SYMBOL_LOGO: {
    assetKey: "SYMBOL_LOGO" as const,
    mapsTo: "mini" as const,
    useOnlyFor: [
      "Admin Sidebar",
      "Organizer Sidebar",
      "Owner App compact chrome",
      "Auction Screens",
      "OBS Overlays",
      "LED Watermarks",
      "Compact UI",
    ],
  },
} as const;

export type LogoAssetKey = keyof typeof LOGO_USAGE_RULES;

export type BrandSurfaceId =
  | "landing-header"
  | "landing-footer"
  | "auth-login"
  | "sidebar-compact"
  | "organizer-dashboard-header"
  | "operator-header"
  | "auction-viewer-header"
  | "led-watermark"
  | "obs-overlay"
  | "led-chyron"
  | "led-team-overlay"
  | "registration-header"
  | "pdf-footer";

type LogoKey = keyof BrandLogos;

export interface BrandSurfacePreset {
  /** Which LOGO_USAGE_RULES entry applies */
  logoAsset: LogoAssetKey;
  /** Resolution order passed to getBrandLogoSrc / getBrandWordmarkSrc */
  logoOrder: LogoKey[];
  /** Tailwind classes for rendered logo height/width */
  sizeClass: string;
  /** Whether adjacent brand name text is allowed (false when logo is a wordmark) */
  showBrandName: boolean;
  /** Whether "Powered by BidWar" is allowed on this surface */
  showPoweredBy: boolean;
  /** Surface sits on a dark background — prefer REVERSE_LOGO when using wordmarks */
  darkBackground: boolean;
}

/** Per-surface branding presets — sizes tuned for visual hierarchy */
export const BRAND_SURFACE_PRESETS: Record<BrandSurfaceId, BrandSurfacePreset> = {
  "landing-header": {
    logoAsset: "PRIMARY_LOGO",
    logoOrder: ["main", "mainReverse", "mini", "appIcon"],
    sizeClass: "h-7 sm:h-8 md:h-10 w-auto max-w-[120px] sm:max-w-[148px] md:max-w-[168px] object-contain object-left",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: false,
  },
  "landing-footer": {
    logoAsset: "REVERSE_LOGO",
    logoOrder: ["mainReverse", "main", "mini", "appIcon"],
    sizeClass: "h-16 w-auto max-w-[392px] object-contain object-left",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "auth-login": {
    logoAsset: "REVERSE_LOGO",
    logoOrder: ["mainReverse", "main", "mini", "appIcon"],
    sizeClass: "h-16 md:h-20 w-auto max-w-[280px] mx-auto object-contain",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "sidebar-compact": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon"],
    sizeClass: "h-9 w-9 object-contain flex-shrink-0",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "organizer-dashboard-header": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon", "mainReverse"],
    sizeClass: "h-9 w-9 object-contain flex-shrink-0",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "operator-header": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon", "obsWatermark"],
    sizeClass: "h-9 sm:h-10 w-auto max-w-[120px] object-contain",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "auction-viewer-header": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon"],
    sizeClass: "h-7 sm:h-8 w-auto object-contain",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "led-watermark": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["obsWatermark", "mini", "appIcon"],
    sizeClass: "h-6 md:h-8 w-auto opacity-90",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "obs-overlay": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["obsWatermark"],
    sizeClass: "max-h-14 w-auto object-contain",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "led-chyron": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon"],
    sizeClass: "h-11 w-11 sm:h-12 sm:w-12 object-contain shrink-0",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "led-team-overlay": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["obsWatermark", "mini", "appIcon"],
    sizeClass: "h-10 md:h-12 w-auto flex-shrink-0",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "registration-header": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "appIcon", "mainReverse", "main"],
    sizeClass: "h-10 sm:h-12 w-auto",
    showBrandName: false,
    showPoweredBy: false,
    darkBackground: true,
  },
  "pdf-footer": {
    logoAsset: "SYMBOL_LOGO",
    logoOrder: ["mini", "main"],
    sizeClass: "h-5 w-5 object-contain",
    showBrandName: false,
    showPoweredBy: true,
    darkBackground: true,
  },
};

/** Surfaces where "Powered by BidWar" text is permitted */
export const POWERED_BY_ALLOWED_SURFACES = new Set<BrandSurfaceId>([
  "pdf-footer",
  "led-chyron",
  "led-watermark",
]);

export function getBrandSurfacePreset(surface: BrandSurfaceId): BrandSurfacePreset {
  return BRAND_SURFACE_PRESETS[surface];
}

export function isPoweredByAllowed(surface: BrandSurfaceId): boolean {
  return POWERED_BY_ALLOWED_SURFACES.has(surface);
}

/** Wordmark logos already embed brand text — never show adjacent brand name */
export function isWordmarkLogoKey(key: LogoKey): boolean {
  return key === "main" || key === "mainReverse";
}

export function shouldShowBrandNameAlongsideLogo(
  surface: BrandSurfaceId,
  resolvedLogoKey?: LogoKey | null,
): boolean {
  const preset = BRAND_SURFACE_PRESETS[surface];
  if (!preset.showBrandName) return false;
  if (resolvedLogoKey && isWordmarkLogoKey(resolvedLogoKey)) return false;
  return true;
}
