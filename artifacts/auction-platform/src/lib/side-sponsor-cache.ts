import type { LiveSponsorDTO } from "@/lib/led-view/types";

const KEY_PREFIX = "bidwar:side-sponsors:v1:";

export function readSideSponsorCache(tournamentId: number): LiveSponsorDTO[] | null {
  try {
    const raw = localStorage.getItem(`${KEY_PREFIX}${tournamentId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LiveSponsorDTO[];
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function writeSideSponsorCache(tournamentId: number, sponsors: LiveSponsorDTO[]): void {
  try {
    localStorage.setItem(`${KEY_PREFIX}${tournamentId}`, JSON.stringify(sponsors));
  } catch {
    /* quota / private mode */
  }
}

export function sponsorListSignature(sponsors: LiveSponsorDTO[]): string {
  return sponsors
    .map((s) => `${s.name}\0${s.logoUrl}\0${s.type}\0${s.tier ?? ""}`)
    .join("|");
}

export function preloadImageUrls(urls: string[]): void {
  for (const url of urls) {
    if (!url.trim()) continue;
    const img = new Image();
    img.decoding = "async";
    img.src = url;
  }
}
