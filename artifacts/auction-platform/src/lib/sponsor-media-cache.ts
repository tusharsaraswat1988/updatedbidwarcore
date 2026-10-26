import { sponsorCacheKey, verifyLocalAsset } from "@workspace/scoring-core";

const CACHE_NAME = "bidwar-sponsor-media-v1";
const memory = new Map<string, Blob>();

export async function sha256Blob(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function openCache(): Promise<Cache | null> {
  if (typeof caches === "undefined") return null;
  try {
    return await caches.open(CACHE_NAME);
  } catch {
    return null;
  }
}

export async function readCachedSponsorBlob(
  tournamentId: number,
  slotNumber: number,
  version: number,
): Promise<Blob | null> {
  const key = sponsorCacheKey(tournamentId, slotNumber, version);
  const remembered = memory.get(key);
  if (remembered) return remembered;
  const cache = await openCache();
  if (!cache) return null;
  const hit = await cache.match(key);
  if (!hit) return null;
  const blob = await hit.blob();
  memory.set(key, blob);
  return blob;
}

export async function writeCachedSponsorBlob(
  tournamentId: number,
  slotNumber: number,
  version: number,
  blob: Blob,
): Promise<void> {
  const key = sponsorCacheKey(tournamentId, slotNumber, version);
  memory.set(key, blob);
  const cache = await openCache();
  if (!cache) return;
  await cache.put(key, new Response(blob));
}

export async function dropOtherSponsorVersions(
  tournamentId: number,
  keep: Array<{ slotNumber: number; version: number }>,
  playingKey: string | null,
): Promise<void> {
  const keepKeys = new Set(keep.map((item) => sponsorCacheKey(tournamentId, item.slotNumber, item.version)));
  if (playingKey) keepKeys.add(playingKey);
  for (const key of [...memory.keys()]) {
    if (key.includes(`/sponsor-cache/${tournamentId}/`) && !keepKeys.has(key)) {
      memory.delete(key);
    }
  }
  const cache = await openCache();
  if (!cache) return;
  const keys = await cache.keys();
  await Promise.all(keys.map(async (request) => {
    const url = request.url;
    if (!url.includes(`/sponsor-cache/${tournamentId}/`)) return;
    if (keepKeys.has(url) || url === playingKey) return;
    await cache.delete(request);
  }));
}

export async function verifyCachedSponsorBlob(input: {
  blob: Blob;
  expectedVersion: number;
  actualVersion: number;
  expectedChecksum: string;
  expectedSize: number;
}): Promise<{ ok: true; checksum: string } | { ok: false; reason: string }> {
  const checksum = await sha256Blob(input.blob);
  const verified = verifyLocalAsset({
    expectedVersion: input.expectedVersion,
    expectedChecksum: input.expectedChecksum,
    expectedSize: input.expectedSize,
    actualVersion: input.actualVersion,
    actualChecksum: checksum,
    actualSize: input.blob.size,
  });
  if (!verified.ok) return verified;
  return { ok: true, checksum };
}
