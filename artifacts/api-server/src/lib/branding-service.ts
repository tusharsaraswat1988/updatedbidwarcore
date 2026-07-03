import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { brandingAssetsTable, brandingSettingsTable } from "@workspace/db/schema";
import {
  type BrandingAssetRecord,
  type BrandingAssetType,
  type FaviconPipelineMetadata,
  ASSET_TYPE_TO_LEGACY_COLUMN,
  LEGACY_ASSET_COLUMN_MAP,
  isBrandingAssetType,
  validateBrandingAssetUpload,
} from "@workspace/api-base/branding-assets";
import { fetchImageBuffer } from "./pdf-branding.js";
import { commitCloudinaryImageWrite, destroyCloudinaryAssetSafe } from "./cloudinary-media-service";
import { resolveCloudinaryPublicId } from "@workspace/api-base/cloudinary-media";
import { getBrandingIconCacheVersion } from "./branding-asset-resolver.js";
import {
  coerceFaviconPipelineMetadata,
  initialFaviconPipelineMetadata,
  needsFaviconPipelineRun,
  runFaviconPipeline,
} from "./favicon-pipeline.js";

/** In-memory cache for SSR-critical branding (refreshed at startup + on asset changes). */
let cachedOpenGraphImageUrl: string | null = null;

export interface PdfWatermarkBranding {
  watermarkImageBuffer: Buffer | null;
  watermarkText: string;
  watermarkOpacity: number;
  footerLogoBuffer: Buffer | null;
  brandName: string;
  poweredByText: string;
  showBrandingPdf: boolean;
}

export interface UpsertAssetInput {
  assetType: BrandingAssetType;
  fileUrl: string;
  filePublicId?: string | null;
  fileName?: string | null;
  mimeType?: string | null;
  width?: number | null;
  height?: number | null;
  fileSize?: number | null;
}

function toRecord(row: typeof brandingAssetsTable.$inferSelect): BrandingAssetRecord {
  return {
    id: row.id,
    assetType: row.assetType as BrandingAssetType,
    fileUrl: row.fileUrl,
    filePublicId: row.filePublicId ?? null,
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    fileSize: row.fileSize,
    version: row.version,
    isActive: row.isActive,
    metadataJson: coerceFaviconPipelineMetadata(row.metadataJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

async function persistFaviconPipelineMetadata(
  assetId: number,
  metadata: FaviconPipelineMetadata,
): Promise<void> {
  await db
    .update(brandingAssetsTable)
    .set({
      metadataJson: metadata,
      updatedAt: new Date(),
    })
    .where(eq(brandingAssetsTable.id, assetId));
}

async function runFaviconPipelineForRow(
  row: typeof brandingAssetsTable.$inferSelect,
): Promise<FaviconPipelineMetadata> {
  const previous = coerceFaviconPipelineMetadata(row.metadataJson);
  const pending = initialFaviconPipelineMetadata(row.version);
  await persistFaviconPipelineMetadata(row.id, pending);

  const result = await runFaviconPipeline({
    sourceUrl: row.fileUrl,
    sourceVersion: row.version,
    previousMetadata: previous,
  });
  await persistFaviconPipelineMetadata(row.id, result);
  return result;
}

/** Sync a single asset URL back to legacy branding_settings columns. */
async function syncLegacyColumn(assetType: BrandingAssetType, fileUrl: string | null): Promise<void> {
  const column = ASSET_TYPE_TO_LEGACY_COLUMN[assetType];
  if (!column) return;

  const [existing] = await db.select({ id: brandingSettingsTable.id }).from(brandingSettingsTable).limit(1);
  if (!existing) return;

  await db
    .update(brandingSettingsTable)
    .set({ [column]: fileUrl, updatedAt: new Date() })
    .where(eq(brandingSettingsTable.id, existing.id));
}

/** Sync app icon legacy column from FAVICON or PWA_ICON (whichever is set). */
async function syncLegacyAppIcon(): Promise<void> {
  const favicon = await getAsset("FAVICON");
  const pwaIcon = await getAsset("PWA_ICON");
  const url = favicon?.fileUrl ?? pwaIcon?.fileUrl ?? null;

  const [existing] = await db.select({ id: brandingSettingsTable.id }).from(brandingSettingsTable).limit(1);
  if (!existing) return;

  await db
    .update(brandingSettingsTable)
    .set({ appIconUrl: url, updatedAt: new Date() })
    .where(eq(brandingSettingsTable.id, existing.id));
}

export async function getAsset(assetType: BrandingAssetType): Promise<BrandingAssetRecord | null> {
  const [row] = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.assetType, assetType))
    .limit(1);

  if (!row || !row.isActive) return null;
  return toRecord(row);
}

export async function getAllAssets(): Promise<BrandingAssetRecord[]> {
  const rows = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.isActive, true));

  return rows.map(toRecord);
}

/**
 * Backfill favicon generation for uploads saved before the pipeline existed.
 * Safe to call repeatedly — skips assets that already completed for their version.
 */
export async function repairFaviconPipelineIfNeeded(
  asset: BrandingAssetRecord,
): Promise<BrandingAssetRecord> {
  if (asset.assetType !== "FAVICON" || !asset.fileUrl || !asset.isActive) {
    return asset;
  }

  const metadata = coerceFaviconPipelineMetadata(asset.metadataJson);
  if (!needsFaviconPipelineRun(asset.version, metadata)) {
    return asset;
  }

  const [row] = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.id, asset.id))
    .limit(1);

  if (!row?.fileUrl) return asset;

  const result = await runFaviconPipelineForRow(row);
  return {
    ...asset,
    metadataJson: result,
    updatedAt: new Date().toISOString(),
  };
}

export async function getAssetsMap(): Promise<Partial<Record<BrandingAssetType, BrandingAssetRecord>>> {
  const assets = await getAllAssets();
  const map: Partial<Record<BrandingAssetType, BrandingAssetRecord>> = {};
  for (const asset of assets) {
    map[asset.assetType] = asset;
  }
  return map;
}

export async function getAdminAssetsMap(): Promise<Partial<Record<BrandingAssetType, BrandingAssetRecord>>> {
  const map = await getAssetsMap();
  const favicon = map.FAVICON;
  if (favicon) {
    map.FAVICON = await repairFaviconPipelineIfNeeded(favicon);
  }
  return map;
}

export async function upsertAsset(input: UpsertAssetInput): Promise<{
  asset: BrandingAssetRecord;
  warnings: ReturnType<typeof validateBrandingAssetUpload>;
}> {
  const now = new Date();

  const [existing] = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.assetType, input.assetType))
    .limit(1);

  let row!: typeof brandingAssetsTable.$inferSelect;

  await commitCloudinaryImageWrite({
    previous: {
      url: existing?.fileUrl ?? null,
      publicId: existing?.filePublicId ?? null,
    },
    next: {
      url: input.fileUrl,
      publicId: input.filePublicId ?? null,
    },
    persist: async () => {
      const pipelineSeed =
        input.assetType === "FAVICON"
          ? initialFaviconPipelineMetadata((existing?.version ?? 0) + 1)
          : null;

      if (existing) {
        [row] = await db
          .update(brandingAssetsTable)
          .set({
            fileUrl: input.fileUrl,
            filePublicId: input.filePublicId ?? null,
            fileName: input.fileName ?? null,
            mimeType: input.mimeType ?? null,
            width: input.width ?? null,
            height: input.height ?? null,
            fileSize: input.fileSize ?? null,
            version: existing.version + 1,
            isActive: true,
            metadataJson: input.assetType === "FAVICON" ? pipelineSeed : existing.metadataJson,
            updatedAt: now,
          })
          .where(eq(brandingAssetsTable.id, existing.id))
          .returning();
      } else {
        [row] = await db
          .insert(brandingAssetsTable)
          .values({
            assetType: input.assetType,
            fileUrl: input.fileUrl,
            filePublicId: input.filePublicId ?? null,
            fileName: input.fileName ?? null,
            mimeType: input.mimeType ?? null,
            width: input.width ?? null,
            height: input.height ?? null,
            fileSize: input.fileSize ?? null,
            version: 1,
            isActive: true,
            metadataJson: pipelineSeed,
            updatedAt: now,
          })
          .returning();
      }
    },
    context: { route: "branding.upsertAsset", assetType: input.assetType },
  });

  let pipelineMetadata: FaviconPipelineMetadata | null =
    input.assetType === "FAVICON" ? coerceFaviconPipelineMetadata(row.metadataJson) : null;

  if (input.assetType === "FAVICON") {
    pipelineMetadata = await runFaviconPipelineForRow(row);
    const [fresh] = await db
      .select()
      .from(brandingAssetsTable)
      .where(eq(brandingAssetsTable.id, row.id))
      .limit(1);
    if (fresh) row = fresh;
  }

  const warnings = validateBrandingAssetUpload(input.assetType, {
    width: input.width ?? null,
    height: input.height ?? null,
    mimeType: input.mimeType ?? null,
  }, pipelineMetadata);

  if (ASSET_TYPE_TO_LEGACY_COLUMN[input.assetType]) {
    await syncLegacyColumn(input.assetType, input.fileUrl);
  }
  if (input.assetType === "FAVICON" || input.assetType === "PWA_ICON") {
    await syncLegacyAppIcon();
  }

  return { asset: toRecord(row), warnings };
}

export async function removeAsset(assetType: BrandingAssetType): Promise<void> {
  const [existing] = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.assetType, assetType))
    .limit(1);

  if (!existing) return;

  const publicId = resolveCloudinaryPublicId({
    url: existing.fileUrl,
    publicId: existing.filePublicId,
  });
  if (publicId) {
    await destroyCloudinaryAssetSafe(publicId, undefined, {
      route: "branding.removeAsset",
      assetType,
    });
  }

  await db
    .update(brandingAssetsTable)
    .set({
      isActive: false,
      fileUrl: "",
      filePublicId: null,
      metadataJson: null,
      updatedAt: new Date(),
    })
    .where(eq(brandingAssetsTable.id, existing.id));

  if (ASSET_TYPE_TO_LEGACY_COLUMN[assetType]) {
    await syncLegacyColumn(assetType, null);
  }
  if (assetType === "FAVICON" || assetType === "PWA_ICON") {
    await syncLegacyAppIcon();
  }
}

/**
 * Migrate existing branding_settings URL columns into branding_assets.
 * Idempotent — skips types that already have an active asset row.
 */
export async function migrateLegacyBrandingAssets(): Promise<void> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);
  if (!settings) return;

  for (const [column, assetType] of Object.entries(LEGACY_ASSET_COLUMN_MAP)) {
    const url = settings[column as keyof typeof settings] as string | null | undefined;
    if (!url) continue;

    const existing = await getAsset(assetType);
    if (existing) continue;

    await upsertAsset({ assetType, fileUrl: url });
  }

  // Split merged app icon into FAVICON + PWA_ICON if neither exists yet
  if (settings.appIconUrl) {
    const favicon = await getAsset("FAVICON");
    const pwaIcon = await getAsset("PWA_ICON");

    if (!favicon) {
      await upsertAsset({ assetType: "FAVICON", fileUrl: settings.appIconUrl });
    }
    if (!pwaIcon) {
      await upsertAsset({ assetType: "PWA_ICON", fileUrl: settings.appIconUrl });
    }
  }
}

/** Merge branding_settings row with asset map for backward-compatible API responses. */
export function mergeLegacyAssetFields<T extends Record<string, unknown>>(
  settings: T,
  assets: Partial<Record<BrandingAssetType, BrandingAssetRecord>>,
): T {
  const merged: Record<string, unknown> = { ...settings };

  const primary = assets.PRIMARY_LOGO?.fileUrl;
  const reverse = assets.REVERSE_LOGO?.fileUrl;
  const symbol = assets.SYMBOL_LOGO?.fileUrl;
  const favicon = assets.FAVICON?.fileUrl;
  const pwa = assets.PWA_ICON?.fileUrl;
  const splash = assets.SPLASH_LOGO?.fileUrl;

  if (primary) merged.mainLogoUrl = primary;
  if (reverse) merged.mainLogoReverseUrl = reverse;
  if (symbol) merged.miniLogoUrl = symbol;
  if (splash) merged.splashScreenUrl = splash;
  if (favicon || pwa) merged.appIconUrl = favicon ?? pwa;

  return merged as T;
}

function publicAssetsPayload(
  assets: Partial<Record<BrandingAssetType, BrandingAssetRecord>>,
): Partial<Record<BrandingAssetType, string>> {
  const urls: Partial<Record<BrandingAssetType, string>> = {};
  for (const [type, asset] of Object.entries(assets)) {
    if (asset?.fileUrl) urls[type as BrandingAssetType] = asset.fileUrl;
  }
  return urls;
}

/** Public read payload — same shape as GET /api/branding. */
export async function getPublicBrandingPayload(): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  const assetsMap = await getAssetsMap();
  const iconVersion = await getBrandingIconCacheVersion();

  if (!row) {
    return {
      ...mergeLegacyAssetFields({}, assetsMap),
      assets: publicAssetsPayload(assetsMap),
      iconVersion,
    };
  }

  return {
    ...mergeLegacyAssetFields(row, assetsMap),
    assets: publicAssetsPayload(assetsMap),
    iconVersion,
  };
}

/** Refresh in-memory platform branding cache (SSR OG image). */
export async function refreshPlatformBrandingCache(): Promise<void> {
  const og = await getAsset("OPEN_GRAPH_IMAGE");
  cachedOpenGraphImageUrl = og?.fileUrl ?? null;
}

/** SSR source of truth for Open Graph image URL. */
export function getPlatformOpenGraphImageUrl(): string | null {
  return cachedOpenGraphImageUrl;
}

/** Email logo: SYMBOL_LOGO → PRIMARY_LOGO from branding_assets. */
export async function resolveEmailLogoAssetUrl(): Promise<string | null> {
  const symbol = await getAsset("SYMBOL_LOGO");
  if (symbol?.fileUrl) return symbol.fileUrl;

  const primary = await getAsset("PRIMARY_LOGO");
  return primary?.fileUrl ?? null;
}

/**
 * PDF watermark branding: PDF_WATERMARK → SYMBOL_LOGO image fallback, then text watermark.
 * Text/opacity settings still come from branding_settings (non-asset fields).
 */
export async function resolvePdfWatermarkBranding(): Promise<PdfWatermarkBranding> {
  const [settings] = await db.select().from(brandingSettingsTable).limit(1);

  const pdfWatermark = await getAsset("PDF_WATERMARK");
  const symbolLogo = await getAsset("SYMBOL_LOGO");
  const primaryLogo = await getAsset("PRIMARY_LOGO");

  const watermarkImageUrl = pdfWatermark?.fileUrl ?? symbolLogo?.fileUrl ?? null;
  const watermarkImageBuffer = watermarkImageUrl ? await fetchImageBuffer(watermarkImageUrl) : null;

  const footerLogoUrl = symbolLogo?.fileUrl ?? primaryLogo?.fileUrl ?? null;
  const footerLogoBuffer = footerLogoUrl ? await fetchImageBuffer(footerLogoUrl) : null;

  return {
    watermarkImageBuffer,
    watermarkText: settings?.watermarkText || (settings?.brandName ?? "BidWar"),
    watermarkOpacity: settings?.watermarkOpacity ?? 0.04,
    footerLogoBuffer,
    brandName: settings?.brandName ?? "BidWar",
    poweredByText: settings?.poweredByText ?? "Powered by BidWar",
    showBrandingPdf: settings?.showBrandingPdf ?? true,
  };
}

export const brandingService = {
  getAsset,
  getAllAssets,
  getAssetsMap,
  getAdminAssetsMap,
  upsertAsset,
  removeAsset,
  migrateLegacyBrandingAssets,
  repairFaviconPipelineIfNeeded,
  mergeLegacyAssetFields,
  getPublicBrandingPayload,
  refreshPlatformBrandingCache,
  getPlatformOpenGraphImageUrl,
  resolveEmailLogoAssetUrl,
  resolvePdfWatermarkBranding,
  isBrandingAssetType,
};
