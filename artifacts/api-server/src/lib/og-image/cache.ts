import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import type { RegistrationOgCardInput } from "./types.js";

function cacheRootDir(): string {
  return process.env.OG_IMAGE_CACHE_DIR?.trim() || path.join(process.cwd(), ".og-image-cache");
}

export function buildRegistrationOgCacheKey(input: RegistrationOgCardInput): string {
  const payload = JSON.stringify({
    v: input.generatorVersion,
    code: input.registrationCode,
    contentVersion: input.contentVersion,
    tournamentName: input.tournamentName,
    sport: input.sport,
    venue: input.venue ?? null,
    organizerName: input.organizerName ?? null,
    registrationDeadline: input.registrationDeadline ?? null,
    backgroundImageUrl: input.backgroundImageUrl,
    logoImageUrl: input.logoImageUrl ?? null,
    badges: input.badges ?? [],
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 24);
}

function cacheFilePath(code: string, hash: string): string {
  return path.join(cacheRootDir(), "register", `${code}-${hash}.png`);
}

async function ensureCacheDir(): Promise<void> {
  await mkdir(path.join(cacheRootDir(), "register"), { recursive: true });
}

export async function readCachedRegistrationOgImage(
  code: string,
  hash: string,
): Promise<Buffer | null> {
  try {
    return await readFile(cacheFilePath(code, hash));
  } catch {
    return null;
  }
}

export async function writeCachedRegistrationOgImage(
  code: string,
  hash: string,
  buffer: Buffer,
): Promise<void> {
  await ensureCacheDir();
  await writeFile(cacheFilePath(code, hash), buffer);

  const dir = path.join(cacheRootDir(), "register");
  const prefix = `${code}-`;
  const keep = `${code}-${hash}.png`;
  const entries = await readdir(dir).catch(() => [] as string[]);
  await Promise.all(
    entries
      .filter((name) => name.startsWith(prefix) && name.endsWith(".png") && name !== keep)
      .map((name) => rm(path.join(dir, name), { force: true })),
  );
}

export { buildRegistrationOgCacheKey as buildCacheEtag };
