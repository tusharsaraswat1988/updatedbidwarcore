import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";
import { getPlatformOpenGraphImageUrl } from "../branding-service.js";
import { BASE_URL, DEFAULT_OG_IMAGE_URL, type RegistrationMetaFields } from "../page-meta.js";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
import { buildRegistrationCardOverlaySvg } from "./svg-overlay.js";
import { buildSportBadgeSvg } from "./sport-icon.js";
import type { RegistrationOgCardInput } from "./types.js";

function absolutizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

/** Background URL priority: banner → logo → platform OG → default. */
export function resolveRegistrationBackgroundImageUrl(fields: RegistrationMetaFields): string {
  if (fields.bannerUrl?.trim()) {
    return absolutizeImageUrl(fields.bannerUrl);
  }
  if (fields.logoUrl?.trim()) {
    return absolutizeImageUrl(fields.logoUrl);
  }
  const platformOg = getPlatformOpenGraphImageUrl();
  if (platformOg) return platformOg;
  return DEFAULT_OG_IMAGE_URL;
}

async function buildBlurredBackground(source: Buffer): Promise<Buffer> {
  return sharp(source)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
    .blur(18)
    .modulate({ brightness: 0.72, saturation: 1.05 })
    .png()
    .toBuffer();
}

async function buildVignetteLayer(): Promise<Buffer> {
  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}">
  <defs>
    <radialGradient id="v" cx="50%" cy="42%" r="72%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#v)"/>
</svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/** Compose a 1200×630 registration social card PNG. */
export async function composeRegistrationOgCard(input: RegistrationOgCardInput): Promise<Buffer> {
  const remote = await fetchImageBuffer(input.backgroundImageUrl);
  const fallback = await fetchImageBuffer(DEFAULT_OG_IMAGE_URL);
  const source = remote ?? fallback;

  if (!source) {
    throw new Error("Unable to load background image for OG card");
  }

  const background = await buildBlurredBackground(source);
  const overlaySvg = buildRegistrationCardOverlaySvg(input);
  const sportBadgeSvg = buildSportBadgeSvg(input.sport);
  const vignette = await buildVignetteLayer();

  return sharp(background)
    .composite([
      { input: vignette, top: 0, left: 0 },
      { input: Buffer.from(overlaySvg), top: 0, left: 0 },
      { input: Buffer.from(sportBadgeSvg), top: 0, left: 0 },
    ])
    .png({ compressionLevel: 9, quality: 90 })
    .toBuffer();
}
