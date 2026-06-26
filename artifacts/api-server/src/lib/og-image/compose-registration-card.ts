import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";
import { getPlatformOpenGraphImageUrl } from "../branding-service.js";
import { BASE_URL, DEFAULT_OG_IMAGE_URL, type RegistrationMetaFields } from "../page-meta.js";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
import { buildRegistrationCardOverlaySvg } from "./svg-overlay.js";
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

async function withOpacity(buffer: Buffer, opacity: number): Promise<Buffer> {
  return sharp(buffer)
    .ensureAlpha()
    .linear([1, 1, 1, opacity], [0, 0, 0, 0])
    .png()
    .toBuffer();
}

async function isSquareLogo(source: Buffer): Promise<boolean> {
  const meta = await sharp(source).metadata();
  const w = meta.width ?? 1;
  const h = meta.height ?? 1;
  return Math.abs(w - h) / Math.max(w, h) < 0.22;
}

async function buildDarkBase(): Promise<Buffer> {
  return sharp({
    create: {
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      channels: 4,
      background: { r: 10, g: 10, b: 12, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

/** Subtle atmospheric wash — never a readable giant watermark. */
async function buildAtmosphericBackground(source: Buffer): Promise<Buffer> {
  const squareLogo = await isSquareLogo(source);
  const darkBase = await buildDarkBase();

  const atmospheric = await sharp(source)
    .resize(OG_IMAGE_WIDTH, OG_IMAGE_HEIGHT, { fit: "cover", position: "centre" })
    .blur(squareLogo ? 36 : 22)
    .modulate({
      brightness: squareLogo ? 0.32 : 0.4,
      saturation: squareLogo ? 0.28 : 0.5,
    })
    .png()
    .toBuffer();

  const faded = await withOpacity(atmospheric, squareLogo ? 0.18 : 0.32);

  return sharp(darkBase)
    .composite([{ input: faded, top: 0, left: 0 }])
    .png()
    .toBuffer();
}

async function buildLogoOverlay(source: Buffer): Promise<{ buffer: Buffer; top: number; left: number }> {
  const size = 112;
  const buffer = await sharp(source)
    .resize(size, size, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  return {
    buffer,
    top: 108,
    left: Math.round((OG_IMAGE_WIDTH - size) / 2),
  };
}

/** Compose a 1200×630 registration social card PNG. */
export async function composeRegistrationOgCard(input: RegistrationOgCardInput): Promise<Buffer> {
  const remote = await fetchImageBuffer(input.backgroundImageUrl);
  const fallback = await fetchImageBuffer(DEFAULT_OG_IMAGE_URL);
  const source = remote ?? fallback;

  if (!source) {
    throw new Error("Unable to load background image for OG card");
  }

  const background = await buildAtmosphericBackground(source);
  const composites: sharp.OverlayOptions[] = [];

  const logoSourceUrl = input.logoImageUrl?.trim();
  let hasLogo = false;

  if (logoSourceUrl) {
    const logoBuffer = await fetchImageBuffer(logoSourceUrl);
    if (logoBuffer) {
      const logo = await buildLogoOverlay(logoBuffer);
      composites.push({ input: logo.buffer, top: logo.top, left: logo.left });
      hasLogo = true;
    }
  } else if (await isSquareLogo(source)) {
    const logo = await buildLogoOverlay(source);
    composites.push({ input: logo.buffer, top: logo.top, left: logo.left });
    hasLogo = true;
  }

  const overlaySvg = buildRegistrationCardOverlaySvg(input, { hasLogo });

  composites.push({ input: Buffer.from(overlaySvg), top: 0, left: 0 });

  return sharp(background)
    .composite(composites)
    .png({ compressionLevel: 9, quality: 92 })
    .toBuffer();
}
