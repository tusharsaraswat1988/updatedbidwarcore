/**
 * Platform-level BidWar branding asset types.
 * Single source of truth for asset keys, metadata, and validation warnings.
 */

export const BRANDING_ASSET_TYPES = [
  "PRIMARY_LOGO",
  "REVERSE_LOGO",
  "SYMBOL_LOGO",
  "FAVICON",
  "PWA_ICON",
  "APPLE_TOUCH_ICON",
  "SPLASH_LOGO",
  "OPEN_GRAPH_IMAGE",
  "OBS_WATERMARK",
  "PDF_WATERMARK",
] as const;

export type BrandingAssetType = (typeof BRANDING_ASSET_TYPES)[number];

export type BrandingAssetCategory =
  | "logos"
  | "web_pwa"
  | "social"
  | "streaming"
  | "documents";

export interface BrandingAssetMeta {
  type: BrandingAssetType;
  name: string;
  category: BrandingAssetCategory;
  usage: string;
  recommendedDimensions: string;
  recommendedRatio?: string;
  preferTransparent?: boolean;
  accept: string;
}

export type FaviconPipelineStatus = "pending" | "processing" | "completed" | "failed";

export interface FaviconGeneratedVariant {
  url: string;
  publicId: string;
  width: number;
  height: number;
}

export interface FaviconPipelineMetadata {
  status: FaviconPipelineStatus;
  error?: string | null;
  sourceVersion: number;
  startedAt?: string | null;
  completedAt?: string | null;
  generated?: {
    "16"?: FaviconGeneratedVariant;
    "32"?: FaviconGeneratedVariant;
    "48"?: FaviconGeneratedVariant;
    ico?: FaviconGeneratedVariant;
  };
}

export const FAVICON_GENERATED_SIZE_KEYS = [16, 32, 48] as const;

export interface BrandingAssetRecord {
  id: number;
  assetType: BrandingAssetType;
  fileUrl: string;
  filePublicId?: string | null;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  version: number;
  isActive: boolean;
  metadataJson?: FaviconPipelineMetadata | null;
  createdAt: string;
  updatedAt: string;
}

export interface BrandingAssetValidationWarning {
  code: string;
  message: string;
}

export const BRANDING_ASSET_META: Record<BrandingAssetType, BrandingAssetMeta> = {
  PRIMARY_LOGO: {
    type: "PRIMARY_LOGO",
    name: "Primary Logo",
    category: "logos",
    usage: "Main website, admin panels, tournament sites, reports, invoices, certificates",
    recommendedDimensions: "SVG preferred, any ratio",
    preferTransparent: true,
    accept: "image/png,image/svg+xml,image/webp,image/jpeg",
  },
  REVERSE_LOGO: {
    type: "REVERSE_LOGO",
    name: "Reverse Logo",
    category: "logos",
    usage: "Dark backgrounds, footer, dark navigation, LED displays",
    recommendedDimensions: "SVG preferred, any ratio",
    preferTransparent: true,
    accept: "image/png,image/svg+xml,image/webp,image/jpeg",
  },
  SYMBOL_LOGO: {
    type: "SYMBOL_LOGO",
    name: "Symbol Logo",
    category: "logos",
    usage: "Sidebar, compact layouts, mobile navigation, small branding placements",
    recommendedDimensions: "Square, icon only",
    preferTransparent: true,
    accept: "image/png,image/svg+xml,image/webp",
  },
  FAVICON: {
    type: "FAVICON",
    name: "Favicon",
    category: "web_pwa",
    usage: "Browser tab icon",
    recommendedDimensions: "16×16, 32×32, or 48×48 px",
    accept: "image/png,image/webp,image/svg+xml,image/x-icon",
  },
  PWA_ICON: {
    type: "PWA_ICON",
    name: "PWA Icon",
    category: "web_pwa",
    usage: "Android install icon and PWA manifest",
    recommendedDimensions: "192×192 or 512×512 px",
    accept: "image/png,image/webp",
  },
  APPLE_TOUCH_ICON: {
    type: "APPLE_TOUCH_ICON",
    name: "Apple Touch Icon",
    category: "web_pwa",
    usage: "iPhone and iPad home screen",
    recommendedDimensions: "180×180 px",
    accept: "image/png,image/webp",
  },
  SPLASH_LOGO: {
    type: "SPLASH_LOGO",
    name: "Splash Logo",
    category: "web_pwa",
    usage: "PWA loading screen and mobile app loading screen",
    recommendedDimensions: "Transparent PNG or SVG",
    preferTransparent: true,
    accept: "image/png,image/svg+xml,image/webp,image/jpeg",
  },
  OPEN_GRAPH_IMAGE: {
    type: "OPEN_GRAPH_IMAGE",
    name: "Open Graph Image",
    category: "social",
    usage: "WhatsApp, Facebook, LinkedIn, and X/Twitter link previews",
    recommendedDimensions: "1200×630 px",
    recommendedRatio: "1200:630",
    accept: "image/png,image/jpeg,image/webp",
  },
  OBS_WATERMARK: {
    type: "OBS_WATERMARK",
    name: "OBS Broadcast Logo",
    category: "streaming",
    usage: "Top-center logo on tournament Broadcast Overlay (/obs). Upload your finished transparent PNG — shown exactly as uploaded.",
    recommendedDimensions: "Transparent PNG, ~800–2000px wide",
    preferTransparent: true,
    accept: "image/png,image/webp,image/svg+xml",
  },
  PDF_WATERMARK: {
    type: "PDF_WATERMARK",
    name: "PDF Watermark",
    category: "documents",
    usage: "PDF exports, reports, invoices, certificates",
    recommendedDimensions: "Transparent PNG or SVG",
    preferTransparent: true,
    accept: "image/png,image/svg+xml,image/webp",
  },
};

export const BRANDING_ASSET_CATEGORIES: Array<{
  id: BrandingAssetCategory;
  title: string;
  description: string;
  types: BrandingAssetType[];
}> = [
  {
    id: "logos",
    title: "Logos",
    description: "Platform wordmarks and symbol marks used across BidWar surfaces.",
    types: ["PRIMARY_LOGO", "REVERSE_LOGO", "SYMBOL_LOGO"],
  },
  {
    id: "web_pwa",
    title: "Web & PWA",
    description: "Browser, install, and loading screen assets.",
    types: ["FAVICON", "PWA_ICON", "APPLE_TOUCH_ICON", "SPLASH_LOGO"],
  },
  {
    id: "social",
    title: "Social Sharing",
    description: "Link preview image for social platforms.",
    types: ["OPEN_GRAPH_IMAGE"],
  },
  {
    id: "streaming",
    title: "Streaming",
    description: "OBS Broadcast Logo for tournament /obs overlay (upload finished PNG).",
    types: ["OBS_WATERMARK"],
  },
  {
    id: "documents",
    title: "Documents",
    description: "Watermark for exported PDFs and reports.",
    types: ["PDF_WATERMARK"],
  },
];

/** Legacy branding_settings column → new asset type mapping. */
export const LEGACY_ASSET_COLUMN_MAP: Record<string, BrandingAssetType> = {
  mainLogoUrl: "PRIMARY_LOGO",
  mainLogoReverseUrl: "REVERSE_LOGO",
  miniLogoUrl: "SYMBOL_LOGO",
  splashScreenUrl: "SPLASH_LOGO",
};

/** Reverse map: asset type → legacy column for backward-compatible sync. */
export const ASSET_TYPE_TO_LEGACY_COLUMN: Partial<Record<BrandingAssetType, string>> = {
  PRIMARY_LOGO: "mainLogoUrl",
  REVERSE_LOGO: "mainLogoReverseUrl",
  SYMBOL_LOGO: "miniLogoUrl",
  SPLASH_LOGO: "splashScreenUrl",
};

export function isBrandingAssetType(value: string): value is BrandingAssetType {
  return (BRANDING_ASSET_TYPES as readonly string[]).includes(value);
}

export function isFaviconPipelineComplete(
  pipeline: FaviconPipelineMetadata | null | undefined,
  assetVersion?: number | null,
): boolean {
  if (!pipeline || pipeline.status !== "completed") return false;
  if (assetVersion != null && pipeline.sourceVersion !== assetVersion) return false;
  const g = pipeline.generated;
  return Boolean(g?.["16"] && g?.["32"] && g?.["48"] && g?.ico);
}

export function validateBrandingAssetUpload(
  assetType: BrandingAssetType,
  meta: Pick<BrandingAssetRecord, "width" | "height" | "mimeType">,
  pipeline?: FaviconPipelineMetadata | null,
): BrandingAssetValidationWarning[] {
  const spec = BRANDING_ASSET_META[assetType];
  const warnings: BrandingAssetValidationWarning[] = [];
  const { width, height, mimeType } = meta;

  if (assetType === "FAVICON") {
    if (pipeline?.status === "processing" || pipeline?.status === "pending") {
      warnings.push({
        code: "favicon_pipeline_pending",
        message: "Favicon sizes are being generated from your upload.",
      });
    } else if (pipeline?.status === "failed") {
      warnings.push({
        code: "favicon_pipeline_failed",
        message: pipeline.error ?? "Favicon generation failed. Try re-uploading the source image.",
      });
    } else if (!isFaviconPipelineComplete(pipeline) && width && height) {
      const maxDim = Math.max(width, height);
      if (maxDim > 64) {
        warnings.push({
          code: "favicon_oversized",
          message: `Recommended favicon size is 32×32 px. Uploaded: ${width}×${height} px.`,
        });
      }
    }
  }

  if (assetType === "PWA_ICON" && width && height) {
    const maxDim = Math.max(width, height);
    if (maxDim < 128 || maxDim > 1024) {
      warnings.push({
        code: "pwa_icon_size",
        message: `Recommended PWA icon size is 192×192 or 512×512 px. Uploaded: ${width}×${height} px.`,
      });
    }
  }

  if (assetType === "APPLE_TOUCH_ICON" && width && height) {
    if (width !== 180 || height !== 180) {
      warnings.push({
        code: "apple_touch_size",
        message: `Recommended Apple touch icon size is 180×180 px. Uploaded: ${width}×${height} px.`,
      });
    }
  }

  if (assetType === "OPEN_GRAPH_IMAGE" && width && height) {
    const ratio = width / height;
    const target = 1200 / 630;
    if (Math.abs(ratio - 1) < 0.1) {
      warnings.push({
        code: "og_square_format",
        message: "Recommended Open Graph ratio is 1200×630 (landscape). Square format detected.",
      });
    } else if (Math.abs(ratio - target) > 0.15) {
      warnings.push({
        code: "og_ratio",
        message: `Recommended Open Graph dimensions are 1200×630 px. Uploaded: ${width}×${height} px.`,
      });
    }
  }

  if (spec.preferTransparent && mimeType) {
    const opaque = ["image/jpeg", "image/jpg"].includes(mimeType.toLowerCase());
    if (opaque) {
      warnings.push({
        code: "transparency_recommended",
        message: "Transparent background is recommended for this asset type.",
      });
    }
  }

  if (assetType === "SYMBOL_LOGO" && width && height) {
    const ratio = width / height;
    if (ratio < 0.8 || ratio > 1.25) {
      warnings.push({
        code: "symbol_not_square",
        message: "Symbol logo should be square (icon only). Uploaded image is not square.",
      });
    }
  }

  return warnings;
}

/** Canonical root paths — always served by the branding asset resolver (never static files). */
export const BRANDING_ICON_PATHS = {
  faviconIco: "/favicon.ico",
  faviconSvg: "/favicon.svg",
  favicon32: "/favicon-32.png",
  favicon32x32: "/favicon-32x32.png",
  appleTouchIcon: "/apple-touch-icon.png",
  pwaIcon192: "/pwa-icon-192.png",
  pwaIcon512: "/pwa-icon-512.png",
} as const;

export type BrandingIconPath = (typeof BRANDING_ICON_PATHS)[keyof typeof BRANDING_ICON_PATHS];

export const ALL_BRANDING_ICON_PATHS: readonly BrandingIconPath[] = Object.values(BRANDING_ICON_PATHS);

/** Production platform wordmark paths — stable URLs for SSR, CSR, schema, and crawlers. */
export const BRANDING_LOGO_PATHS = {
  primary: "/bidwar-primary-logo.png",
  reverse: "/bidwar-reverse-logo.png",
} as const;

export type BrandingLogoPath = (typeof BRANDING_LOGO_PATHS)[keyof typeof BRANDING_LOGO_PATHS];

export const ALL_BRANDING_LOGO_PATHS: readonly BrandingLogoPath[] = Object.values(BRANDING_LOGO_PATHS);

/** Static fallbacks bundled with auction-platform when DB branding is unset. */
export const BRANDING_LOGO_STATIC_FALLBACKS: Record<BrandingLogoPath, string> = {
  [BRANDING_LOGO_PATHS.primary]: "/assets/branding/bidwar-reverse-logo-official.png",
  [BRANDING_LOGO_PATHS.reverse]: "/assets/branding/bidwar-reverse-logo-official.png",
};

/** Static icon fallbacks (official BidWar app icon) when DB branding is unset. */
export const BRANDING_ICON_STATIC_FALLBACKS: Record<BrandingIconPath, string> = {
  [BRANDING_ICON_PATHS.faviconIco]: "/assets/branding/favicon.ico",
  [BRANDING_ICON_PATHS.faviconSvg]: "/assets/branding/favicon.svg",
  [BRANDING_ICON_PATHS.favicon32]: "/assets/branding/favicon-32.png",
  [BRANDING_ICON_PATHS.favicon32x32]: "/assets/branding/favicon-32x32.png",
  [BRANDING_ICON_PATHS.appleTouchIcon]: "/assets/branding/apple-touch-icon.png",
  [BRANDING_ICON_PATHS.pwaIcon192]: "/assets/branding/pwa-icon-192.png",
  [BRANDING_ICON_PATHS.pwaIcon512]: "/assets/branding/pwa-icon-512.png",
};

/** Boot splash preload target — matches canonical favicon.svg resolver path. */
export const BRANDING_BOOT_SPLASH_ICON_PATH = BRANDING_ICON_PATHS.faviconSvg;

export const PLATFORM_BASE_URL = "https://bidwar.in";

export function withBrandingAssetVersion(path: string, version?: number | null): string {
  if (!version || version <= 0) return path;
  const joiner = path.includes("?") ? "&" : "?";
  return `${path}${joiner}v=${version}`;
}

export function resolvePlatformPrimaryLogoPath(version?: number | null): string {
  return withBrandingAssetVersion(BRANDING_LOGO_PATHS.primary, version);
}

export function resolvePlatformReverseLogoPath(version?: number | null): string {
  return withBrandingAssetVersion(BRANDING_LOGO_PATHS.reverse, version);
}

export function resolvePlatformPrimaryLogoUrl(
  baseUrl = PLATFORM_BASE_URL,
  version?: number | null,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${resolvePlatformPrimaryLogoPath(version)}`;
}

export function resolvePlatformReverseLogoUrl(
  baseUrl = PLATFORM_BASE_URL,
  version?: number | null,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${resolvePlatformReverseLogoPath(version)}`;
}

/** Pick the canonical platform logo path from a logo resolution order. */
export function resolvePlatformLogoPathForOrder(
  order: readonly string[],
  version?: number | null,
): string {
  const preferReverse = order[0] === "mainReverse";
  return preferReverse
    ? resolvePlatformReverseLogoPath(version)
    : resolvePlatformPrimaryLogoPath(version);
}

export function resolvePlatformLogoUrlForOrder(
  order: readonly string[],
  baseUrl = PLATFORM_BASE_URL,
  version?: number | null,
): string {
  return `${baseUrl.replace(/\/+$/, "")}${resolvePlatformLogoPathForOrder(order, version)}`;
}
