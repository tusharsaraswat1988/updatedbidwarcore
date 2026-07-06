import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";
import { getPlatformOpenGraphImageUrl } from "../branding-service.js";
import { BASE_URL, DEFAULT_OG_IMAGE_URL, type RegistrationMetaFields } from "../page-meta.js";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
import { buildRegistrationCardOverlaySvg } from "./svg-overlay.js";
import { escapeSvgText } from "./text-layout.js";
import { sharpToBuffer } from "../sharp-pipeline.js";
import type { RegistrationOgCardInput } from "./types.js";

function absolutizeImageUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith("//")) return `https:${trimmed}`;
  return `${BASE_URL.replace(/\/+$/, "")}/${trimmed.replace(/^\/+/, "")}`;
}

/** External background resolver for uploaded tournament banners. */
export function resolveRegistrationBackgroundImageUrl(fields: RegistrationMetaFields): string {
  if (fields.bannerUrl?.trim()) {
    return absolutizeImageUrl(fields.bannerUrl);
  }
  const platformOg = getPlatformOpenGraphImageUrl();
  if (platformOg) return platformOg;
  return DEFAULT_OG_IMAGE_URL;
}

function sanitizeHexColor(value: string | null | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) return trimmed;
  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`;
  }
  return fallback;
}

function buildGeneratedSportsBackground(input: RegistrationOgCardInput): Buffer {
  const primary = sanitizeHexColor(input.brand.primaryColor, "#F59E0B");
  const secondary = sanitizeHexColor(input.brand.secondaryColor, "#1E293B");
  const background = sanitizeHexColor(input.brand.backgroundColor, "#080A0F");
  const sport = escapeSvgText((input.sport.trim() || "Sports").toUpperCase());

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <radialGradient id="stadiumGlow" cx="72%" cy="28%" r="62%">
      <stop offset="0%" stop-color="${secondary}" stop-opacity="0.74"/>
      <stop offset="50%" stop-color="${background}" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="${background}" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="fieldSweep" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.34"/>
      <stop offset="42%" stop-color="${secondary}" stop-opacity="0.2"/>
      <stop offset="100%" stop-color="${background}" stop-opacity="0.92"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="${background}"/>
  <rect width="1200" height="630" fill="url(#stadiumGlow)"/>
  <path d="M0 474 C236 404 452 392 712 432 C908 462 1068 452 1200 404 L1200 630 L0 630 Z" fill="${secondary}" opacity="0.44"/>
  <path d="M600 342 L1170 610 M742 326 L1200 520 M470 362 L930 630 M250 430 L535 630" stroke="${primary}" stroke-opacity="0.16" stroke-width="2"/>
  <path d="M682 148 C820 108 982 108 1128 148" stroke="#ffffff" stroke-opacity="0.13" stroke-width="3" fill="none"/>
  <path d="M720 190 C846 158 982 158 1096 190" stroke="#ffffff" stroke-opacity="0.09" stroke-width="2" fill="none"/>
  <circle cx="930" cy="430" r="170" fill="none" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>
  <text x="1160" y="132" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="76" font-weight="800" fill="#ffffff" opacity="0.045" letter-spacing="4">${sport}</text>
  <rect x="0" y="0" width="1200" height="630" fill="url(#fieldSweep)" opacity="0.42"/>
</svg>`;

  return Buffer.from(svg);
}

async function buildBannerBackground(source: Buffer, input: RegistrationOgCardInput): Promise<Buffer> {
  const base = await sharpToBuffer(source, (pipeline) =>
    pipeline
      .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, {
        fit: "cover",
        position: "attention",
        withoutEnlargement: false,
      })
      .modulate({ brightness: 0.62, saturation: 0.86 })
      .png(),
  );

  const primary = sanitizeHexColor(input.brand.primaryColor, "#F59E0B");
  const background = sanitizeHexColor(input.brand.backgroundColor, "#080A0F");
  const overlay = `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="readability" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${background}" stop-opacity="0.94"/>
      <stop offset="52%" stop-color="${background}" stop-opacity="0.78"/>
      <stop offset="100%" stop-color="${background}" stop-opacity="0.5"/>
    </linearGradient>
    <radialGradient id="accentGlow" cx="82%" cy="14%" r="58%">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#readability)"/>
  <rect width="1200" height="630" fill="url(#accentGlow)"/>
</svg>`;

  return sharpToBuffer(base, (pipeline) =>
    pipeline.composite([{ input: Buffer.from(overlay), top: 0, left: 0 }]).png(),
  );
}

async function buildBackground(input: RegistrationOgCardInput): Promise<Buffer> {
  if (input.backgroundKind === "banner" && input.backgroundImageUrl) {
    const remote = await fetchImageBuffer(input.backgroundImageUrl);
    if (remote) return buildBannerBackground(remote, input);
  }

  return sharpToBuffer(buildGeneratedSportsBackground(input), (pipeline) => pipeline.png());
}

async function buildBrandLogoOverlay(
  logoUrl: string | null | undefined,
): Promise<{ buffer: Buffer; top: number; left: number } | null> {
  const trimmed = logoUrl?.trim();
  if (!trimmed) return null;
  const source = await fetchImageBuffer(trimmed);
  if (!source) return null;

  const buffer = await sharpToBuffer(source, (pipeline) =>
    pipeline
      .resize(196, 64, {
        fit: "contain",
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png(),
  );

  return {
    buffer,
    top: 46,
    left: 64,
  };
}

/** Compose a 1200×630 registration social card PNG. */
export async function composeRegistrationOgCard(input: RegistrationOgCardInput): Promise<Buffer> {
  const background = await buildBackground(input);
  const composites: sharp.OverlayOptions[] = [];

  const overlaySvg = buildRegistrationCardOverlaySvg(input, {
    hasBrandLogo: Boolean(input.brand.logoUrl),
  });
  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  const brandLogo = await buildBrandLogoOverlay(input.brand.logoUrl);
  if (brandLogo) {
    composites.push({ input: brandLogo.buffer, top: brandLogo.top, left: brandLogo.left });
  }

  return sharpToBuffer(background, (pipeline) =>
    pipeline
      .composite(composites)
      .png({ compressionLevel: 9, quality: 92 }),
  );
}
