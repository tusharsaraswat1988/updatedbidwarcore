/**
 * Buzz Studio Creative Assets — server-side helper.
 *
 * Global backgrounds: buzz_studio_bg_{aspectRatio}
 * Template backgrounds: buzz_studio_bg_{templateId}_{aspectRatio}
 *
 * Template backgrounds are optional and never replace global keys.
 */

import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq, inArray } from "drizzle-orm";

const BUZZ_BG_KEY_PREFIX = "buzz_studio_bg_";

export type BuzzBackgroundSource = "template" | "global" | null;

export interface ResolvedBuzzBackground {
  url: string | null;
  source: BuzzBackgroundSource;
  /** Top Buys 4:5 — absolute frame layout when template background is present. */
  featuredFrameLayout: boolean;
}

/**
 * Returns the global background image URL for the given aspect ratio.
 */
export async function getBuzzStudioBackgroundUrl(
  aspectRatio: string,
): Promise<string | null> {
  const key = `${BUZZ_BG_KEY_PREFIX}${aspectRatio}`;
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/**
 * Returns a template-specific background URL, or null if not uploaded.
 */
export async function getBuzzStudioTemplateBackgroundUrl(
  templateId: string,
  aspectRatio: string,
): Promise<string | null> {
  const key = `${BUZZ_BG_KEY_PREFIX}${templateId}_${aspectRatio}`;
  const rows = await db
    .select()
    .from(settingsTable)
    .where(eq(settingsTable.key, key))
    .limit(1);
  return rows[0]?.value ?? null;
}

/**
 * Resolve background for render/preview.
 * Prefers template-specific art when available; falls back to global.
 */
export async function resolveBuzzStudioBackground(
  templateId: string,
  aspectRatio: string,
): Promise<ResolvedBuzzBackground> {
  const templateUrl = await getBuzzStudioTemplateBackgroundUrl(templateId, aspectRatio);
  if (templateUrl) {
    return {
      url: templateUrl,
      source: "template",
      featuredFrameLayout: templateId === "top_buys" && aspectRatio === "4:5",
    };
  }

  const globalUrl = await getBuzzStudioBackgroundUrl(aspectRatio);
  return {
    url: globalUrl,
    source: globalUrl ? "global" : null,
    featuredFrameLayout: false,
  };
}

/** Settings keys for template-specific Top Buys backgrounds. */
export const TOP_BUYS_TEMPLATE_BG_KEYS = {
  "1:1":  "buzz_studio_bg_top_buys_1:1",
  "4:5":  "buzz_studio_bg_top_buys_4:5",
  "9:16": "buzz_studio_bg_top_buys_9:16",
  "16:9": "buzz_studio_bg_top_buys_16:9",
} as const;

export const TOP_BUYS_TEMPLATE_BG_PUBLIC_ID_KEYS = {
  "1:1":  "buzz_studio_bg_top_buys_1:1_public_id",
  "4:5":  "buzz_studio_bg_top_buys_4:5_public_id",
  "9:16": "buzz_studio_bg_top_buys_9:16_public_id",
  "16:9": "buzz_studio_bg_top_buys_16:9_public_id",
} as const;

export type BuzzAspectRatioKey = keyof typeof TOP_BUYS_TEMPLATE_BG_KEYS;

export async function readTopBuysTemplateAssets(): Promise<Record<BuzzAspectRatioKey, string | null>> {
  const keys = Object.values(TOP_BUYS_TEMPLATE_BG_KEYS);
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, keys));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    "1:1":  map[TOP_BUYS_TEMPLATE_BG_KEYS["1:1"]]  ?? null,
    "4:5":  map[TOP_BUYS_TEMPLATE_BG_KEYS["4:5"]]  ?? null,
    "9:16": map[TOP_BUYS_TEMPLATE_BG_KEYS["9:16"]] ?? null,
    "16:9": map[TOP_BUYS_TEMPLATE_BG_KEYS["16:9"]] ?? null,
  };
}
