import { eq } from "drizzle-orm";
import { db } from "@workspace/db";
import { brandingAssetsTable, brandingSettingsTable } from "@workspace/db/schema";
import {
  type BrandingAssetRecord,
  type BrandingAssetType,
  ASSET_TYPE_TO_LEGACY_COLUMN,
  LEGACY_ASSET_COLUMN_MAP,
  isBrandingAssetType,
  validateBrandingAssetUpload,
} from "@workspace/api-base/branding-assets";
import { fetchImageBuffer } from "./pdf-branding.js";

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
    fileName: row.fileName,
    mimeType: row.mimeType,
    width: row.width,
    height: row.height,
    fileSize: row.fileSize,
    version: row.version,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
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

export async function getAssetsMap(): Promise<Partial<Record<BrandingAssetType, BrandingAssetRecord>>> {
  const assets = await getAllAssets();
  const map: Partial<Record<BrandingAssetType, BrandingAssetRecord>> = {};
  for (const asset of assets) {
    map[asset.assetType] = asset;
  }
  return map;
}

export async function upsertAsset(input: UpsertAssetInput): Promise<{
  asset: BrandingAssetRecord;
  warnings: ReturnType<typeof validateBrandingAssetUpload>;
}> {
  const now = new Date();
  const warnings = validateBrandingAssetUpload(input.assetType, {
    width: input.width ?? null,
    height: input.height ?? null,
    mimeType: input.mimeType ?? null,
  });

  const [existing] = await db
    .select()
    .from(brandingAssetsTable)
    .where(eq(brandingAssetsTable.assetType, input.assetType))
    .limit(1);

  let row: typeof brandingAssetsTable.$inferSelect;

  if (existing) {
    [row] = await db
      .update(brandingAssetsTable)
      .set({
        fileUrl: input.fileUrl,
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        fileSize: input.fileSize ?? null,
        version: existing.version + 1,
        isActive: true,
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
        fileName: input.fileName ?? null,
        mimeType: input.mimeType ?? null,
        width: input.width ?? null,
        height: input.height ?? null,
        fileSize: input.fileSize ?? null,
        version: 1,
        isActive: true,
        updatedAt: now,
      })
      .returning();
  }

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

  await db
    .update(brandingAssetsTable)
    .set({ isActive: false, updatedAt: new Date() })
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
  const merged = { ...settings };

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

  return merged;
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
  upsertAsset,
  removeAsset,
  migrateLegacyBrandingAssets,
  mergeLegacyAssetFields,
  refreshPlatformBrandingCache,
  getPlatformOpenGraphImageUrl,
  resolveEmailLogoAssetUrl,
  resolvePdfWatermarkBranding,
  isBrandingAssetType,
};
