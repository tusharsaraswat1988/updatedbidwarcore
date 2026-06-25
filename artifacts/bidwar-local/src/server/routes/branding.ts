import { Router } from "express";
import { eq } from "drizzle-orm";
import type { LocalDb } from "@workspace/db-local";
import { venueSnapshotsTable } from "@workspace/db-local";
import {
  ASSET_TYPE_TO_LEGACY_COLUMN,
  type BrandingAssetType,
} from "@workspace/api-base/branding-assets";
import { resolveOfflineUrl } from "../lib/offline-media.js";

const BRANDING_KEY = "branding";

/** Bundled BidWar mark — works offline before cloud import. */
const LOCAL_DEFAULT_SYMBOL = "/static/branding/symbol.svg";

const LOCAL_DEFAULT_ASSETS: Partial<Record<BrandingAssetType, string>> = {
  PRIMARY_LOGO: LOCAL_DEFAULT_SYMBOL,
  REVERSE_LOGO: LOCAL_DEFAULT_SYMBOL,
  SYMBOL_LOGO: LOCAL_DEFAULT_SYMBOL,
  FAVICON: LOCAL_DEFAULT_SYMBOL,
  PWA_ICON: LOCAL_DEFAULT_SYMBOL,
  APPLE_TOUCH_ICON: LOCAL_DEFAULT_SYMBOL,
  SPLASH_LOGO: LOCAL_DEFAULT_SYMBOL,
};

const BRANDING_FALLBACK = {
  brandName: "BidWar",
  tagline: "Powered by Intelligent Bidding",
  poweredByText: "Powered by BidWar",
  miniBrandText: "BW",
  mainLogoUrl: LOCAL_DEFAULT_SYMBOL,
  mainLogoReverseUrl: LOCAL_DEFAULT_SYMBOL,
  miniLogoUrl: LOCAL_DEFAULT_SYMBOL,
  appIconUrl: LOCAL_DEFAULT_SYMBOL,
  splashScreenUrl: LOCAL_DEFAULT_SYMBOL,
  primaryColor: "#F59E0B",
  secondaryColor: "#1E293B",
  accentColor: "#3B82F6",
  backgroundColor: "#080A0F",
  successColor: "#22C55E",
  dangerColor: "#EF4444",
  headingFont: "Space Grotesk",
  bodyFont: "Inter",
  showPoweredByViewer: true,
  showPoweredByOwnerApp: true,
  showBrandingPdf: true,
  showBrandingPublicLinks: true,
  showBrandingAuction: true,
  enableWatermark: false,
  watermarkText: "Powered by BidWar",
  watermarkOpacity: 0.04,
  watermarkPosition: "center",
  logoAnimationUrl: null,
  assets: LOCAL_DEFAULT_ASSETS,
};

/** Sync legacy logo columns from the assets map (matches cloud branding API). */
export function mergeBrandingLegacyFields(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const merged = { ...payload };
  const assets = payload.assets as Partial<Record<BrandingAssetType, string>> | undefined;
  if (!assets) return merged;

  for (const [type, column] of Object.entries(ASSET_TYPE_TO_LEGACY_COLUMN)) {
    if (!column) continue;
    const url = assets[type as BrandingAssetType];
    if (url) merged[column] = url;
  }
  if (assets.FAVICON || assets.PWA_ICON) {
    merged.appIconUrl = assets.FAVICON ?? assets.PWA_ICON;
  }
  return merged;
}

export async function saveBrandingSnapshot(db: LocalDb, payload: Record<string, unknown>): Promise<void> {
  const normalized = mergeBrandingLegacyFields(payload);
  const now = new Date().toISOString();
  const existing = await db.select().from(venueSnapshotsTable).where(eq(venueSnapshotsTable.key, BRANDING_KEY));
  if (existing.length > 0) {
    await db.update(venueSnapshotsTable).set({ payload: JSON.stringify(normalized), updatedAt: now })
      .where(eq(venueSnapshotsTable.key, BRANDING_KEY));
  } else {
    await db.insert(venueSnapshotsTable).values({
      key: BRANDING_KEY,
      payload: JSON.stringify(normalized),
      updatedAt: now,
    });
  }
}

function resolveBrandingResponse(parsed: Record<string, unknown>): Record<string, unknown> {
  const merged = mergeBrandingLegacyFields({ ...BRANDING_FALLBACK, ...parsed });
  const assets = {
    ...LOCAL_DEFAULT_ASSETS,
    ...(merged.assets as Record<string, string> | undefined),
  };
  const resolvedAssets: Record<string, string> = {};
  for (const [key, value] of Object.entries(assets)) {
    if (typeof value === "string") {
      resolvedAssets[key] = resolveOfflineUrl(value) ?? value;
    }
  }
  const out: Record<string, unknown> = { ...merged, assets: resolvedAssets };
  for (const [key, value] of Object.entries(out)) {
    if (key === "assets") continue;
    if (typeof value === "string" && (value.startsWith("http") || value.startsWith("/"))) {
      out[key] = resolveOfflineUrl(value) ?? value;
    }
  }
  return out;
}

export function createBrandingRouter(db: LocalDb) {
  const router = Router();

  router.get("/branding", async (_req, res) => {
    const [row] = await db.select().from(venueSnapshotsTable).where(eq(venueSnapshotsTable.key, BRANDING_KEY));
    if (!row) {
      res.json(BRANDING_FALLBACK);
      return;
    }
    try {
      const parsed = JSON.parse(row.payload) as Record<string, unknown>;
      res.json(resolveBrandingResponse(parsed));
    } catch {
      res.json(BRANDING_FALLBACK);
    }
  });

  return router;
}
