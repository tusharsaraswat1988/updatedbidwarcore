import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@workspace/api-base/auction-unit";
import { sharpToBuffer } from "../sharp-pipeline.js";

export interface PlayerSoldPosterInput {
  playerName: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamName: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount: number;
  auctionUnit?: AuctionUnit | null;
  tournamentName: string;
  tournamentSport?: string | null;
  bidwarLogoUrl?: string | null;
  titleSponsorLogoUrl?: string | null;
  coSponsorLogoUrls?: string[] | null;
}

// 4:5 Portrait Dimensions (Standard for Social Media Posts, Stories, and WhatsApp Image Headers)
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;

export const FONT_STACK = "'DejaVu Sans', 'Liberation Sans', 'FreeSans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

function escapeXml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

/**
 * Prepares a resized buffer converted to base64 data URI for the player photo.
 */
async function preparePlayerPhotoDataUri(
  photoUrl: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!photoUrl || !photoUrl.trim()) return null;
  const rawBuffer = await fetchImageBuffer(photoUrl.trim());
  if (!rawBuffer) return null;

  try {
    const resized = await sharpToBuffer(rawBuffer, (p) =>
      p.resize(width, height, { fit: "cover", position: "attention" }).png(),
    );
    return `data:image/png;base64,${resized.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Prepares a transparent-background resized buffer converted to base64 data URI for logos.
 */
async function prepareLogoDataUri(
  logoUrl: string | null | undefined,
  width: number,
  height: number,
): Promise<string | null> {
  if (!logoUrl || !logoUrl.trim()) return null;
  const rawBuffer = await fetchImageBuffer(logoUrl.trim());
  if (!rawBuffer) return null;

  try {
    const resized = await sharpToBuffer(rawBuffer, (p) =>
      p
        .resize(width, height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png(),
    );
    return `data:image/png;base64,${resized.toString("base64")}`;
  } catch {
    return null;
  }
}

/**
 * Builds the SVG overlay containing all vector graphics, background gradients,
 * stadium floodlights, typography, and branded fallbacks in 1080x1350 portrait format.
 */
export function buildPosterSvg(
  input: PlayerSoldPosterInput,
  playerPhotoDataUri: string | null,
  teamLogoDataUri: string | null,
  bidwarLogoDataUri?: string | null,
  titleSponsorLogoDataUri?: string | null,
  coSponsorLogosDataUris?: string[],
): string {
  const safePlayer = escapeXml(input.playerName?.trim() || "Player");
  const safeTeam = escapeXml(input.teamName?.trim() || "Team");
  const safeTournament = escapeXml(input.tournamentName?.trim() || "BidWar Premier Tournament");
  const initials = escapeXml(getInitials(input.playerName || "Player"));
  const shortCode = escapeXml((input.teamShortCode?.trim() || input.teamName?.slice(0, 3) || "TM").toUpperCase());

  const unit: AuctionUnit = normalizeAuctionUnit(input.auctionUnit);
  const formattedPrice = escapeXml(formatAuctionAmount(input.amount, unit));

  // Dynamic font sizing for player name based on character length - big and impactful
  const playerNameLen = input.playerName?.length || 10;
  const playerNameFontSize = playerNameLen > 24 ? 54 : playerNameLen > 15 ? 64 : 74;

  // Dynamic font sizing for tournament name banner
  const tourNameLen = safeTournament.length;
  const tourNameFontSize = tourNameLen > 36 ? 22 : tourNameLen > 24 ? 26 : 30;

  // Render top right sponsors
  const validCoSponsors = (coSponsorLogosDataUris || []).filter(Boolean);
  const hasSponsors = Boolean(titleSponsorLogoDataUri || validCoSponsors.length > 0);

  let sponsorSvgElements = "";
  if (hasSponsors) {
    let currentRightX = 1010;

    if (titleSponsorLogoDataUri) {
      const titleWidth = 170;
      const titleHeight = 60;
      currentRightX -= titleWidth;
      sponsorSvgElements += `
        <g transform="translate(${currentRightX}, 58)">
          <image href="${titleSponsorLogoDataUri}" x="0" y="0" width="${titleWidth}" height="${titleHeight}" preserveAspectRatio="xMidYMid meet"/>
        </g>
      `;
    }

    if (validCoSponsors.length > 0) {
      const coWidth = 90;
      const coHeight = 50;
      for (const coLogo of validCoSponsors.slice(0, 3)) {
        currentRightX -= (coWidth + 16);
        sponsorSvgElements += `
          <g transform="translate(${currentRightX}, 63)">
            <image href="${coLogo}" x="0" y="0" width="${coWidth}" height="${coHeight}" preserveAspectRatio="xMidYMid meet"/>
          </g>
        `;
      }
    }
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
    <!-- Photo and Logo Rounded Clip Paths -->
    <clipPath id="photoClip">
      <rect x="0" y="0" width="430" height="470" rx="30" ry="30"/>
    </clipPath>
    <clipPath id="teamLogoClip">
      <rect x="0" y="0" width="110" height="110" rx="18" ry="18"/>
    </clipPath>

    <!-- Background Gradient -->
    <radialGradient id="stadiumBg" cx="50%" cy="115%" r="90%">
      <stop offset="0%" stop-color="#1e3a8a" stop-opacity="0.85"/>
      <stop offset="45%" stop-color="#0b132b" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#050811" stop-opacity="1"/>
    </radialGradient>

    <!-- Floodlight Beams -->
    <radialGradient id="leftFloodlight" cx="0%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.5"/>
      <stop offset="25%" stop-color="#f59e0b" stop-opacity="0.2"/>
      <stop offset="70%" stop-color="#050811" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="rightFloodlight" cx="100%" cy="0%" r="70%">
      <stop offset="0%" stop-color="#60a5fa" stop-opacity="0.45"/>
      <stop offset="25%" stop-color="#3b82f6" stop-opacity="0.18"/>
      <stop offset="70%" stop-color="#050811" stop-opacity="0"/>
    </radialGradient>

    <!-- Gold Gradients -->
    <linearGradient id="goldGradient" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#fbbf24"/>
      <stop offset="50%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#d97706"/>
    </linearGradient>

    <linearGradient id="goldTextGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#fffbeb"/>
      <stop offset="50%" stop-color="#fde68a"/>
      <stop offset="100%" stop-color="#f59e0b"/>
    </linearGradient>

    <linearGradient id="cardGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a" stop-opacity="0.94"/>
      <stop offset="100%" stop-color="#020617" stop-opacity="0.98"/>
    </linearGradient>

    <linearGradient id="soldPriceGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#451a03" stop-opacity="0.80"/>
      <stop offset="50%" stop-color="#0f172a" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="#451a03" stop-opacity="0.75"/>
    </linearGradient>

    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- 1. Background -->
  <rect width="1080" height="1350" fill="#050811"/>
  <rect width="1080" height="1350" fill="url(#stadiumBg)"/>

  <!-- 2. Stadium Floodlights & Ambient Beams -->
  <rect width="1080" height="1350" fill="url(#leftFloodlight)"/>
  <rect width="1080" height="1350" fill="url(#rightFloodlight)"/>

  <!-- Stadium Pitch Arcs -->
  <ellipse cx="540" cy="1420" rx="680" ry="320" fill="none" stroke="#f59e0b" stroke-opacity="0.22" stroke-width="2.5" stroke-dasharray="8 8"/>
  <ellipse cx="540" cy="1420" rx="500" ry="240" fill="none" stroke="#fbbf24" stroke-opacity="0.25" stroke-width="2"/>
  <ellipse cx="540" cy="1420" rx="320" ry="150" fill="none" stroke="#ffffff" stroke-opacity="0.12" stroke-width="1"/>

  <!-- Floodlight Rays -->
  <line x1="0" y1="0" x2="420" y2="1350" stroke="#fde68a" stroke-width="1.5" stroke-opacity="0.18"/>
  <line x1="1080" y1="0" x2="660" y2="1350" stroke="#93c5fd" stroke-width="1.5" stroke-opacity="0.18"/>

  <!-- Outer Elegant Frame Border -->
  <rect x="30" y="30" width="1020" height="1290" rx="28" fill="none" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="2"/>

  <!-- 3. TOP HEADER ROW: BidWar Logo (Top Left) & Sponsors (Top Right) -->
  <!-- Top Left: BidWar Branding Logo -->
  ${
    bidwarLogoDataUri
      ? `<g transform="translate(65, 55)">
    <image href="${bidwarLogoDataUri}" x="0" y="0" width="220" height="65" preserveAspectRatio="xMinYMid meet"/>
  </g>`
      : `<g transform="translate(65, 58)">
    <rect x="0" y="2" width="48" height="48" rx="12" fill="url(#goldGradient)"/>
    <text x="24" y="34" font-family="${FONT_STACK}" font-size="26" font-weight="900" fill="#050811" text-anchor="middle">BW</text>
    <text x="62" y="26" font-family="${FONT_STACK}" font-size="24" font-weight="900" fill="#ffffff" letter-spacing="1">BIDWAR</text>
    <text x="62" y="46" font-family="${FONT_STACK}" font-size="11" font-weight="700" fill="#f59e0b" letter-spacing="2">AUCTION PLATFORM</text>
  </g>`
  }

  <!-- Top Right: Title Sponsor & Co-Sponsors Logos Only -->
  ${sponsorSvgElements}

  <!-- 4. TOURNAMENT NAME BANNER (Below Top Header) -->
  <g transform="translate(540, 156)">
    <line x1="-460" y1="0" x2="-260" y2="0" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="1.5"/>
    <text x="0" y="8" font-family="${FONT_STACK}" font-size="${tourNameFontSize}" font-weight="900" fill="#fbbf24" letter-spacing="3" text-anchor="middle">${safeTournament.toUpperCase()}</text>
    <line x1="260" y1="0" x2="460" y2="0" stroke="#f59e0b" stroke-opacity="0.35" stroke-width="1.5"/>
  </g>

  <!-- 5. HERO PLAYER PORTRAIT (Center X=540) -->
  <g transform="translate(325, 195)">
    <!-- Base card fill -->
    <rect x="0" y="0" width="430" height="470" rx="30" fill="#0f172a"/>

    ${
      playerPhotoDataUri
        ? `<g clip-path="url(#photoClip)">
      <image href="${playerPhotoDataUri}" x="0" y="0" width="430" height="470" preserveAspectRatio="xMidYMid slice"/>
    </g>`
        : `<!-- Branded Fallback Avatar (Initials Crest + Cricket Silhouette) -->
    <g transform="translate(215, 205)">
      <circle cx="0" cy="0" r="100" fill="url(#goldGradient)"/>
      <circle cx="0" cy="0" r="92" fill="#020617"/>
      <text x="0" y="24" font-family="${FONT_STACK}" font-size="72" font-weight="900" fill="#fbbf24" text-anchor="middle" letter-spacing="3">${initials}</text>
      <text x="0" y="160" font-family="${FONT_STACK}" font-size="15" font-weight="800" fill="#94a3b8" text-anchor="middle" letter-spacing="4">BIDWAR PLAYER</text>
    </g>`
    }

    <!-- Player Card Outer Frame with Gold Glow (layered on top of photo) -->
    <rect x="-6" y="-6" width="442" height="482" rx="36" fill="none" stroke="#f59e0b" stroke-width="3" stroke-opacity="0.8" filter="url(#glowEffect)"/>
    <rect x="0" y="0" width="430" height="470" rx="30" fill="none" stroke="#fbbf24" stroke-width="2"/>

    <!-- Bold Gold SOLD Ribbon floating on top of portrait -->
    <g transform="translate(16, 16)">
      <rect x="0" y="0" width="110" height="34" rx="8" fill="url(#goldGradient)"/>
      <text x="55" y="23" font-family="${FONT_STACK}" font-size="14" font-weight="900" fill="#020617" text-anchor="middle" letter-spacing="2">★ SOLD</text>
    </g>
  </g>

  <!-- 6. PLAYER NAME (BIG & BOLD, under portrait, no congratulations or batsman) -->
  <g transform="translate(540, 735)">
    <text x="0" y="0" font-family="${FONT_STACK}" font-size="${playerNameFontSize}" font-weight="900" fill="#ffffff" letter-spacing="-0.5" text-anchor="middle">${safePlayer}</text>
  </g>

  <!-- 7. SOLD POINTS (Winning Bid / Amount BIG & BOLD, centered, no verified sale badge) -->
  <g transform="translate(80, 775)">
    <rect x="0" y="0" width="920" height="170" rx="24" fill="url(#soldPriceGrad)" stroke="#f59e0b" stroke-width="2"/>
    
    <!-- Inner Accent Line -->
    <line x1="24" y1="166" x2="896" y2="166" stroke="#fbbf24" stroke-opacity="0.3" stroke-width="1"/>

    <g transform="translate(460, 48)">
      <text x="0" y="0" font-family="${FONT_STACK}" font-size="16" font-weight="900" fill="#f59e0b" letter-spacing="4" text-anchor="middle">SOLD FOR</text>
      <text x="0" y="74" font-family="${FONT_STACK}" font-size="84" font-weight="900" fill="url(#goldTextGrad)" letter-spacing="-1" text-anchor="middle">${formattedPrice}</text>
    </g>
  </g>

  <!-- 8. SOLD TO TEAM NAME & LOGO -->
  <g transform="translate(80, 970)">
    <rect x="0" y="0" width="920" height="170" rx="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Team Logo Frame (Left) -->
    <g transform="translate(30, 20)">
      <rect x="0" y="0" width="130" height="130" rx="20" fill="#0f172a" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="2"/>
      ${
        teamLogoDataUri
          ? `<g clip-path="url(#teamLogoClip)" transform="translate(10, 10)">
        <image href="${teamLogoDataUri}" x="0" y="0" width="110" height="110" preserveAspectRatio="xMidYMid meet"/>
      </g>`
          : `<text x="65" y="75" font-family="${FONT_STACK}" font-size="38" font-weight="900" fill="#fbbf24" text-anchor="middle">${shortCode}</text>`
      }
    </g>

    <!-- Team Details (Right of Logo) -->
    <g transform="translate(195, 60)">
      <text x="0" y="0" font-family="${FONT_STACK}" font-size="16" font-weight="800" fill="#94a3b8" letter-spacing="3">SOLD TO</text>
      <text x="0" y="52" font-family="${FONT_STACK}" font-size="46" font-weight="900" fill="#ffffff" letter-spacing="0.5">${safeTeam}</text>
    </g>

    <!-- Vector Championship Trophy (Far Right, pure SVG paths - no emoji glyph corruption) -->
    <g transform="translate(825, 52)">
      <circle cx="33" cy="33" r="33" fill="#f59e0b" fill-opacity="0.15" stroke="#f59e0b" stroke-opacity="0.3" stroke-width="1.5"/>
      <path d="M21 16h24v11a12 12 0 0 1-24 0V16zm-5 4h5v4a6 6 0 0 1-5-4zm34 0h-5v4a6 6 0 0 0 5-4zM29 35h8v8h-8v-8zm-6 8h20v4H23v-4z" fill="#f59e0b"/>
    </g>
  </g>

  <!-- 9. BOTTOM FOOTER -->
  <g transform="translate(80, 1225)">
    <line x1="0" y1="0" x2="920" y2="0" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1"/>
    
    <g transform="translate(0, 36)">
      <text x="0" y="0" font-family="${FONT_STACK}" font-size="14" font-weight="900" fill="#f59e0b">BIDWAR</text>
      <text x="80" y="0" font-family="${FONT_STACK}" font-size="14" font-weight="600" fill="#cbd5e1">•</text>
      <text x="100" y="0" font-family="${FONT_STACK}" font-size="14" font-weight="600" fill="#cbd5e1" letter-spacing="1">From Auction to Champions</text>
    </g>

    <g transform="translate(920, 36)">
      <text x="0" y="0" font-family="${FONT_STACK}" font-size="13" font-weight="600" fill="#64748b" text-anchor="end">Official Tournament Notification</text>
    </g>
  </g>
</svg>`;
}

/**
 * Generates a high-resolution, production-ready 1080x1350 Player Sold portrait poster PNG buffer.
 */
import { generatePlayerSoldPosterV2Buffer } from "./player-sold-poster-generator-v2.js";

export async function generatePlayerSoldPosterBuffer(
  input: PlayerSoldPosterInput,
): Promise<Buffer> {
  return generatePlayerSoldPosterV2Buffer({
    playerName: input.playerName,
    playerPhotoUrl: input.playerPhotoUrl,
    playerRole: input.playerRole,
    teamName: input.teamName,
    teamLogoUrl: input.teamLogoUrl,
    teamShortCode: input.teamShortCode,
    teamColor: input.teamColor,
    amount: input.amount,
    auctionUnit: (input.auctionUnit ?? "rupee") as "rupee" | "points",
    tournamentName: input.tournamentName,
    tournamentSport: input.tournamentSport,
    bidwarLogoUrl: input.bidwarLogoUrl,
    titleSponsorLogoUrl: input.titleSponsorLogoUrl,
    coSponsorLogoUrls: input.coSponsorLogoUrls,
  });
}

async function _legacyGeneratePlayerSoldPosterBuffer(
  input: PlayerSoldPosterInput,
): Promise<Buffer> {
  const [
    playerPhotoDataUri,
    teamLogoDataUri,
    bidwarLogoDataUri,
    titleSponsorLogoDataUri,
    coSponsorLogosDataUris,
  ] = await Promise.all([
    preparePlayerPhotoDataUri(input.playerPhotoUrl, 430, 470),
    prepareLogoDataUri(input.teamLogoUrl, 130, 130),
    prepareLogoDataUri(input.bidwarLogoUrl, 220, 65),
    prepareLogoDataUri(input.titleSponsorLogoUrl, 170, 60),
    Promise.all(
      (input.coSponsorLogoUrls ?? [])
        .slice(0, 3)
        .map((url) => prepareLogoDataUri(url, 90, 50)),
    ).then((res) => res.filter((u): u is string => Boolean(u))),
  ]);

  const svgArtwork = buildPosterSvg(
    input,
    playerPhotoDataUri,
    teamLogoDataUri,
    bidwarLogoDataUri,
    titleSponsorLogoDataUri,
    coSponsorLogosDataUris,
  );

  return await sharp(Buffer.from(svgArtwork))
    .png({
      compressionLevel: 8,
      quality: 92,
    })
    .toBuffer();
}
