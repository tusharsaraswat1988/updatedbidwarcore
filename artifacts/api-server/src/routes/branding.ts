import { Router } from "express";
import { db } from "@workspace/db";
import { brandingSettingsTable } from "@workspace/db/schema";
import {
  BRANDING_ASSET_CATEGORIES,
  BRANDING_ASSET_META,
  type BrandingAssetType,
} from "@workspace/api-base/branding-assets";
import { brandingService } from "../lib/branding-service.js";
import { refreshBrandingIconCache, getBrandingIconCacheVersion } from "../lib/branding-asset-resolver.js";

const router = Router();

function publicAssetsPayload(
  assets: Partial<Record<BrandingAssetType, { fileUrl: string }>>,
) {
  const urls: Partial<Record<BrandingAssetType, string>> = {};
  for (const [type, asset] of Object.entries(assets)) {
    if (asset?.fileUrl) urls[type as BrandingAssetType] = asset.fileUrl;
  }
  return urls;
}

// ─── Public: read-only branding settings ──────────────────────────────────────

router.get("/branding/icon-version", async (_req, res) => {
  const version = await getBrandingIconCacheVersion();
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
  res.json({ version });
});

router.get("/branding", async (_req, res) => {
  res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");

  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  const assetsMap = await brandingService.getAssetsMap();

  if (!row) {
    res.json({
      ...brandingService.mergeLegacyAssetFields({}, assetsMap),
      assets: publicAssetsPayload(assetsMap),
      iconVersion: await getBrandingIconCacheVersion(),
    });
    return;
  }

  const merged = brandingService.mergeLegacyAssetFields(row, assetsMap);
  res.json({
    ...merged,
    assets: publicAssetsPayload(assetsMap),
    iconVersion: await getBrandingIconCacheVersion(),
  });
});

// ─── Admin: read settings ──────────────────────────────────────────────────────

router.get("/auth/admin/branding", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const [row] = await db.select().from(brandingSettingsTable).limit(1);
  const assetsMap = await brandingService.getAssetsMap();

  if (!row) {
    res.json({
      ...brandingService.mergeLegacyAssetFields({}, assetsMap),
      assets: assetsMap,
      assetCategories: BRANDING_ASSET_CATEGORIES,
      assetMeta: BRANDING_ASSET_META,
    });
    return;
  }

  res.json({
    ...brandingService.mergeLegacyAssetFields(row, assetsMap),
    assets: assetsMap,
    assetCategories: BRANDING_ASSET_CATEGORIES,
    assetMeta: BRANDING_ASSET_META,
  });
});

// ─── Admin: list all branding assets with metadata ────────────────────────────

router.get("/auth/admin/branding/assets", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const assetsMap = await brandingService.getAssetsMap();
  res.json({
    assets: assetsMap,
    categories: BRANDING_ASSET_CATEGORIES,
    meta: BRANDING_ASSET_META,
  });
});

// ─── Admin: upsert a single branding asset ────────────────────────────────────

router.put("/auth/admin/branding/assets/:assetType", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const assetType = req.params.assetType;
  if (!brandingService.isBrandingAssetType(assetType)) {
    res.status(400).json({ error: `Invalid asset type: ${assetType}` });
    return;
  }

  const { fileUrl, filePublicId, fileName, mimeType, width, height, fileSize } = req.body as {
    fileUrl?: string;
    filePublicId?: string | null;
    fileName?: string | null;
    mimeType?: string | null;
    width?: number | null;
    height?: number | null;
    fileSize?: number | null;
  };

  if (!fileUrl || typeof fileUrl !== "string") {
    res.status(400).json({ error: "fileUrl is required" });
    return;
  }

  try {
    const result = await brandingService.upsertAsset({
      assetType,
      fileUrl,
      filePublicId,
      fileName,
      mimeType,
      width,
      height,
      fileSize,
    });
    await brandingService.refreshPlatformBrandingCache();
    await refreshBrandingIconCache();
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "branding asset upsert failed");
    res.status(500).json({ error: "Failed to save branding asset" });
  }
});

// ─── Admin: remove a branding asset ───────────────────────────────────────────

router.delete("/auth/admin/branding/assets/:assetType", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  const assetType = req.params.assetType;
  if (!brandingService.isBrandingAssetType(assetType)) {
    res.status(400).json({ error: `Invalid asset type: ${assetType}` });
    return;
  }

  try {
    await brandingService.removeAsset(assetType);
    await brandingService.refreshPlatformBrandingCache();
    await refreshBrandingIconCache();
    res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "branding asset remove failed");
    res.status(500).json({ error: "Failed to remove branding asset" });
  }
});

// ─── Admin: upsert non-asset settings ─────────────────────────────────────────

router.put("/auth/admin/branding", async (req, res) => {
  if (!req.jwtUser.isAdmin) { res.status(403).json({ error: "Admin required" }); return; }

  try {
    const { id: _id, createdAt: _ca, updatedAt: _ua, assets: _assets, assetCategories: _ac, assetMeta: _am, ...safeBody } = req.body as Record<string, unknown>;
    const d = safeBody as Partial<typeof brandingSettingsTable.$inferInsert>;

    // Asset URLs are managed via /auth/admin/branding/assets — strip legacy fields
    // from settings save to avoid accidental overwrites via stale form state.
    delete d.mainLogoUrl;
    delete d.mainLogoReverseUrl;
    delete d.miniLogoUrl;
    delete d.appIconUrl;
    delete d.splashScreenUrl;

    const [existing] = await db.select({ id: brandingSettingsTable.id }).from(brandingSettingsTable).limit(1);
    const now = new Date();

    let row;
    if (existing) {
      [row] = await db
        .update(brandingSettingsTable)
        .set({ ...d, updatedAt: now })
        .returning();
    } else {
      [row] = await db
        .insert(brandingSettingsTable)
        .values({ ...d, updatedAt: now })
        .returning();
    }

    const assetsMap = await brandingService.getAssetsMap();
    res.json({
      ...brandingService.mergeLegacyAssetFields(row, assetsMap),
      assets: assetsMap,
    });
  } catch (err) {
    req.log.error({ err }, "branding save failed");
    res.status(500).json({ error: "Failed to save branding settings" });
  }
});

export default router;
