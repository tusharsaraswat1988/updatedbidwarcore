import { Router } from "express";
import { eq } from "drizzle-orm";
import type { LocalDb } from "@workspace/db-local";
import { venueSnapshotsTable } from "@workspace/db-local";

const BRANDING_KEY = "branding";

const BRANDING_FALLBACK = {
  brandName: "BidWar",
  tagline: "Powered by Intelligent Bidding",
  poweredByText: "Powered by BidWar",
  miniBrandText: "BW",
  mainLogoUrl: null,
  mainLogoReverseUrl: null,
  miniLogoUrl: null,
  appIconUrl: null,
  splashScreenUrl: null,
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
  assets: {},
};

export async function saveBrandingSnapshot(db: LocalDb, payload: Record<string, unknown>): Promise<void> {
  const now = new Date().toISOString();
  const existing = await db.select().from(venueSnapshotsTable).where(eq(venueSnapshotsTable.key, BRANDING_KEY));
  if (existing.length > 0) {
    await db.update(venueSnapshotsTable).set({ payload: JSON.stringify(payload), updatedAt: now })
      .where(eq(venueSnapshotsTable.key, BRANDING_KEY));
  } else {
    await db.insert(venueSnapshotsTable).values({
      key: BRANDING_KEY,
      payload: JSON.stringify(payload),
      updatedAt: now,
    });
  }
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
      res.json({ ...BRANDING_FALLBACK, ...parsed });
    } catch {
      res.json(BRANDING_FALLBACK);
    }
  });

  return router;
}
