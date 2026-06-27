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

export interface BrandingAssetRecord {
  id: number;
  assetType: BrandingAssetType;
  fileUrl: string;
  fileName: string | null;
  mimeType: string | null;
  width: number | null;
  height: number | null;
  fileSize: number | null;
  version: number;
  isActive: boolean;
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

export function validateBrandingAssetUpload(
  assetType: BrandingAssetType,
  meta: Pick<BrandingAssetRecord, "width" | "height" | "mimeType">,
): BrandingAssetValidationWarning[] {
  const spec = BRANDING_ASSET_META[assetType];
  const warnings: BrandingAssetValidationWarning[] = [];
  const { width, height, mimeType } = meta;

  if (assetType === "FAVICON" && width && height) {
    const maxDim = Math.max(width, height);
    if (maxDim > 64) {
      warnings.push({
        code: "favicon_oversized",
        message: `Recommended favicon size is 32×32 px. Uploaded: ${width}×${height} px.`,
      });
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
