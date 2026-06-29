import {
  cloudinaryImagesEqual,
  type StoredCloudinaryImage,
} from "@workspace/api-base/cloudinary-media";
import type { SponsorLogo } from "@workspace/api-base/sponsor-priority";

export function listRemovedSponsorLogos(
  previous: SponsorLogo[],
  next: SponsorLogo[],
): StoredCloudinaryImage[] {
  return previous
    .filter((prev) => {
      if (!prev.url?.trim()) return false;
      return !next.some((candidate) => cloudinaryImagesEqual(prev, candidate));
    })
    .map((entry) => ({ url: entry.url, publicId: entry.publicId }));
}

export function parseSponsorLogosJson(raw: string | null | undefined): SponsorLogo[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SponsorLogo[]) : [];
  } catch {
    return [];
  }
}
