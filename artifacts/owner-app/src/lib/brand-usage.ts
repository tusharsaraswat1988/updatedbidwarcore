/** Owner-app branding presets — mirrors auction-platform `brand-usage.ts` surfaces. */

export const OWNER_AUTH_LOGIN = {
  logoOrder: ["mainReverse", "main", "mini", "appIcon"] as const,
  sizeClass: "h-16 md:h-20 w-auto max-w-[280px] mx-auto object-contain",
  showBrandName: false,
};

export const OWNER_COMPACT_MARK = {
  logoOrder: ["mainReverse", "main", "mini", "splash", "obsWatermark"] as const,
  sizeClass: "h-12 w-auto max-w-[min(320px,78vw)] object-contain object-center",
  showBrandName: false,
};

export const OWNER_SPLASH = {
  logoOrder: ["splash", "mainReverse", "main", "mini"] as const,
  sizeClass: "h-20 w-auto max-w-[280px] object-contain",
  showBrandName: false,
};
