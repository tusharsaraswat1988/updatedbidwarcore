import {
  BRANDING_ASSET_CATEGORIES,
  BRANDING_ASSET_TYPES,
  validateBrandingAssetUpload,
  type BrandingAssetRecord,
  type BrandingAssetType,
  type BrandingAssetValidationWarning,
  type FaviconPipelineMetadata,
  isFaviconPipelineComplete,
} from "@workspace/api-base/branding-assets";

export type AssetStatus = "configured" | "legacy" | "missing";

export const SECTION_STORAGE_KEY = "bidwar-branding-sections-v1";

/** Surfaces where each asset type is consumed (frontend reference map). */
export const ASSET_USAGE_LOCATIONS: Record<BrandingAssetType, string[]> = {
  PRIMARY_LOGO: ["Website Header", "Admin Panels", "Reports", "Certificates", "Invoices", "Tournament Sites"],
  REVERSE_LOGO: ["Dark Navigation", "Footer", "LED Displays", "Dark Background Sections"],
  SYMBOL_LOGO: ["Sidebar", "Mobile Navigation", "Compact Layouts", "Login Header"],
  FAVICON: ["Browser Tabs"],
  PWA_ICON: ["Android Install Icon", "PWA Manifest", "Add to Home Screen"],
  APPLE_TOUCH_ICON: ["iPhone Home Screen", "iPad Home Screen"],
  SPLASH_LOGO: ["PWA Loading Screen", "Mobile App Splash", "Owner App Launch"],
  OPEN_GRAPH_IMAGE: ["WhatsApp Shares", "Facebook Shares", "LinkedIn Shares", "X/Twitter Shares"],
  OBS_WATERMARK: ["Tournament Broadcast Overlay (/obs)", "Top-center BidWar badge"],
  PDF_WATERMARK: ["Reports", "Invoices", "Certificates", "PDF Exports"],
};

/** Assets wired into production code paths today. */
export const ASSET_ENGINE_CONNECTED: Partial<Record<BrandingAssetType, boolean>> = {
  PDF_WATERMARK: false,
  OBS_WATERMARK: true,
};

export const FAVICON_GENERATED_SIZES = ["16×16", "32×32", "48×48"] as const;

export function inferAssetStatus(asset: BrandingAssetRecord | null | undefined): AssetStatus {
  if (!asset?.fileUrl || !asset.isActive) return "missing";
  const migratedOnly =
    asset.version === 1 &&
    !asset.fileName &&
    asset.fileSize == null &&
    asset.width == null &&
    asset.height == null;
  return migratedOnly ? "legacy" : "configured";
}

export function getAssetWarnings(
  assetType: BrandingAssetType,
  asset: BrandingAssetRecord | null | undefined,
): BrandingAssetValidationWarning[] {
  if (!asset?.fileUrl) return [];
  return validateBrandingAssetUpload(assetType, {
    width: asset.width,
    height: asset.height,
    mimeType: asset.mimeType,
  }, asset.metadataJson ?? null);
}

export function getFaviconPipeline(asset: BrandingAssetRecord | null | undefined): FaviconPipelineMetadata | null {
  return asset?.metadataJson ?? null;
}

export function formatFaviconPipelineStatus(pipeline: FaviconPipelineMetadata | null): string {
  if (!pipeline) return "Pending Generation";
  switch (pipeline.status) {
    case "pending":
      return "Pending Generation";
    case "processing":
      return "Processing";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    default:
      return "Pending Generation";
  }
}

export function faviconGeneratedSizeLabels(
  pipeline: FaviconPipelineMetadata | null,
  assetVersion?: number | null,
): string {
  if (!isFaviconPipelineComplete(pipeline, assetVersion)) {
    return FAVICON_GENERATED_SIZES.join(" · ");
  }
  const g = pipeline!.generated!;
  return [
    g["16"] ? "16×16" : null,
    g["32"] ? "32×32" : null,
    g["48"] ? "48×48" : null,
    g.ico ? "favicon.ico" : null,
  ].filter(Boolean).join(" · ");
}

export function formatWarningMessage(
  warning: BrandingAssetValidationWarning,
  asset: BrandingAssetRecord,
  assetType: BrandingAssetType,
): string {
  const dims =
    asset.width && asset.height ? `Current image: ${asset.width}×${asset.height}.` : "";

  switch (warning.code) {
    case "favicon_oversized":
      return `Recommended favicon size is 32×32. ${dims}`;
    case "favicon_pipeline_pending":
      return "Generating optimized favicon sizes (16×16, 32×32, 48×48, favicon.ico) from your upload.";
    case "favicon_pipeline_failed":
      return warning.message;
    case "og_square_format":
      return `Open Graph image should be 1200×630. Current image ratio may be cropped on social platforms. ${dims}`;
    case "og_ratio":
      return `Open Graph image should be 1200×630. Current image ratio may be cropped on social platforms. ${dims}`;
    case "transparency_recommended":
      if (assetType === "OBS_WATERMARK") {
        return "Transparent PNG recommended for OBS watermark.";
      }
      return "Transparent background is recommended for this asset type.";
    default:
      return warning.message;
  }
}

export function formatAssetDate(iso: string | undefined): string {
  if (!iso) return "Unknown";
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "Unknown";
  }
}

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function mimeToFormat(mime: string | null | undefined): string {
  if (!mime) return "—";
  const map: Record<string, string> = {
    "image/png": "PNG",
    "image/jpeg": "JPEG",
    "image/jpg": "JPEG",
    "image/webp": "WebP",
    "image/svg+xml": "SVG",
    "image/x-icon": "ICO",
  };
  return map[mime.toLowerCase()] ?? mime.split("/").pop()?.toUpperCase() ?? mime;
}

export interface BrandingHealthSummary {
  configured: number;
  legacy: number;
  missing: number;
  warnings: number;
  completionPct: number;
}

export function computeHealthSummary(
  assets: Partial<Record<BrandingAssetType, BrandingAssetRecord>>,
): BrandingHealthSummary {
  let configured = 0;
  let legacy = 0;
  let missing = 0;
  let warnings = 0;

  for (const type of BRANDING_ASSET_TYPES) {
    const asset = assets[type];
    const status = inferAssetStatus(asset);
    if (status === "configured") configured++;
    else if (status === "legacy") legacy++;
    else missing++;
    warnings += getAssetWarnings(type, asset).length;
  }

  const total = BRANDING_ASSET_TYPES.length;
  const completionPct = Math.round(((configured + legacy) / total) * 100);

  return { configured, legacy, missing, warnings, completionPct };
}

export function loadSectionExpandedState(): Record<string, boolean> {
  const defaults = Object.fromEntries(
    BRANDING_ASSET_CATEGORIES.map(c => [c.id, true]),
  );
  try {
    const raw = localStorage.getItem(SECTION_STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Record<string, boolean>;
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
}

export function saveSectionExpandedState(state: Record<string, boolean>): void {
  try {
    localStorage.setItem(SECTION_STORAGE_KEY, JSON.stringify(state));
  } catch { /* quota / private mode */ }
}

export function sourceFileLabel(asset: BrandingAssetRecord | null | undefined): string {
  if (asset?.fileName) return asset.fileName;
  if (asset?.fileUrl) {
    try {
      const path = new URL(asset.fileUrl).pathname;
      const name = path.split("/").pop();
      if (name) return name;
    } catch { /* ignore */ }
  }
  return "favicon.png";
}
