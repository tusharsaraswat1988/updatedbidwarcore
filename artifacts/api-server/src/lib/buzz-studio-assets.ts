/**
 * Buzz Studio Creative Assets — server-side helper.
 *
 * Reads the global poster background URL for a given aspect ratio directly
 * from the settings table. Called at render time so background URLs are never
 * stored inside creative job contracts.
 */

import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const BUZZ_BG_KEY_PREFIX = "buzz_studio_bg_";

/**
 * Returns the background image URL for the given aspect ratio, or null if
 * no background has been uploaded by the admin.
 *
 * @example
 * const url = await getBuzzStudioBackgroundUrl("1:1");
 * // → "https://cdn.example.com/bg-1x1.webp" | null
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
