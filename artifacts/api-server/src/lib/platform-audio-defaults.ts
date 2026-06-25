import { db } from "@workspace/db";
import { settingsTable } from "@workspace/db";
import { inArray, eq } from "drizzle-orm";
import {
  EMPTY_PLATFORM_AUDIO_DEFAULTS,
  PLATFORM_AUDIO_SETTING_KEYS,
  type PlatformAudioDefaults,
} from "@workspace/api-base/platform-audio";

const ALL_KEYS = Object.values(PLATFORM_AUDIO_SETTING_KEYS);

let cached: PlatformAudioDefaults | null = null;
let cachedAt = 0;
const CACHE_MS = 30_000;

export function invalidatePlatformAudioCache(): void {
  cached = null;
  cachedAt = 0;
}

export async function readPlatformDefaultAudio(): Promise<PlatformAudioDefaults> {
  const rows = await db
    .select()
    .from(settingsTable)
    .where(inArray(settingsTable.key, ALL_KEYS));

  const map = Object.fromEntries(rows.map((r) => [r.key, r.value ?? null]));
  return {
    countdownSoundUrl: map[PLATFORM_AUDIO_SETTING_KEYS.countdownSoundUrl] ?? null,
    soldSoundUrl: map[PLATFORM_AUDIO_SETTING_KEYS.soldSoundUrl] ?? null,
    breakEndMusicUrl: map[PLATFORM_AUDIO_SETTING_KEYS.breakEndMusicUrl] ?? null,
  };
}

export async function getPlatformDefaultAudioCached(): Promise<PlatformAudioDefaults> {
  if (cached && Date.now() - cachedAt < CACHE_MS) return cached;
  cached = await readPlatformDefaultAudio();
  cachedAt = Date.now();
  return cached;
}

export async function writePlatformDefaultAudio(
  updates: Partial<PlatformAudioDefaults>,
): Promise<PlatformAudioDefaults> {
  for (const [field, key] of Object.entries(PLATFORM_AUDIO_SETTING_KEYS) as Array<
    [keyof PlatformAudioDefaults, string]
  >) {
    if (!(field in updates)) continue;
    const value = updates[field];
    if (value === undefined) continue;
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
      await db.delete(settingsTable).where(eq(settingsTable.key, key));
    } else {
      await db
        .insert(settingsTable)
        .values({ key, value: trimmed })
        .onConflictDoUpdate({ target: settingsTable.key, set: { value: trimmed } });
    }
  }
  invalidatePlatformAudioCache();
  return readPlatformDefaultAudio();
}

export { EMPTY_PLATFORM_AUDIO_DEFAULTS };
