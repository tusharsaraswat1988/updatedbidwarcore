import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";
import { formatAuctionAmount, type AuctionUnit } from "@workspace/api-base/auction-unit";
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
}

// 4:5 Portrait Dimensions (Standard for Social Media Posts, Stories, and WhatsApp Image Headers)
export const POSTER_WIDTH = 1080;
export const POSTER_HEIGHT = 1350;

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
 * Prepares a rounded rectangle cropped buffer for the player photo.
 */
async function preparePlayerPhotoBuffer(
  photoUrl: string | null | undefined,
  width: number,
  height: number,
  radius: number,
): Promise<Buffer | null> {
  if (!photoUrl || !photoUrl.trim()) return null;
  const rawBuffer = await fetchImageBuffer(photoUrl.trim());
  if (!rawBuffer) return null;

  try {
    const resized = await sharpToBuffer(rawBuffer, (p) =>
      p.resize(width, height, { fit: "cover", position: "attention" }).png(),
    );

    // Apply rounded corners mask via SVG
    const maskSvg = `<svg width="${width}" height="${height}">
      <rect x="0" y="0" width="${width}" height="${height}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`;

    return await sharp(resized)
      .composite([{ input: Buffer.from(maskSvg), blend: "dest-in" }])
      .png()
      .toBuffer();
  } catch {
    return null;
  }
}

/**
 * Prepares a transparent-background resized buffer for the team logo.
 */
async function prepareTeamLogoBuffer(
  logoUrl: string | null | undefined,
  width: number,
  height: number,
): Promise<Buffer | null> {
  if (!logoUrl || !logoUrl.trim()) return null;
  const rawBuffer = await fetchImageBuffer(logoUrl.trim());
  if (!rawBuffer) return null;

  try {
    return await sharpToBuffer(rawBuffer, (p) =>
      p
        .resize(width, height, {
          fit: "contain",
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        })
        .png(),
    );
  } catch {
    return null;
  }
}

/**
 * Builds the SVG overlay containing all vector graphics, background gradients,
 * stadium floodlights, typography, and branded fallbacks in 1080x1350 portrait format.
 */
function buildPosterSvg(
  input: PlayerSoldPosterInput,
  hasPlayerPhoto: boolean,
  hasTeamLogo: boolean,
): string {
  const safePlayer = escapeXml(input.playerName?.trim() || "Player");
  const safeTeam = escapeXml(input.teamName?.trim() || "Team");
  const safeTournament = escapeXml(input.tournamentName?.trim() || "BidWar Premier Tournament");
  const safeSport = escapeXml((input.tournamentSport?.trim() || "Cricket").toUpperCase());
  const safeRole = escapeXml((input.playerRole?.trim() || "Player").replace(/_/g, " ").toUpperCase());
  const initials = escapeXml(getInitials(input.playerName || "Player"));
  const shortCode = escapeXml((input.teamShortCode?.trim() || input.teamName?.slice(0, 3) || "TM").toUpperCase());

  const unit: AuctionUnit = input.auctionUnit === "points" ? "points" : "rupee";
  const formattedPrice = escapeXml(formatAuctionAmount(input.amount, unit));

  // Dynamic font sizing for player name based on character length
  const playerNameLen = input.playerName?.length || 10;
  const playerNameFontSize = playerNameLen > 20 ? 42 : playerNameLen > 14 ? 48 : 54;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_WIDTH}" height="${POSTER_HEIGHT}" viewBox="0 0 ${POSTER_WIDTH} ${POSTER_HEIGHT}">
  <defs>
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
      <stop offset="0%" stop-color="#451a03" stop-opacity="0.75"/>
      <stop offset="50%" stop-color="#0f172a" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#451a03" stop-opacity="0.65"/>
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

  <!-- 3. Top Header Bar -->
  <g transform="translate(60, 56)">
    <!-- BIDWAR Logo Mark -->
    <rect x="0" y="4" width="48" height="48" rx="12" fill="url(#goldGradient)"/>
    <text x="24" y="36" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="26" font-weight="900" fill="#050811" text-anchor="middle">BW</text>
    
    <text x="64" y="28" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="24" font-weight="900" fill="#ffffff" letter-spacing="1">BIDWAR</text>
    <text x="64" y="48" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="700" fill="#f59e0b" letter-spacing="2">AUCTION PLATFORM</text>

    <!-- Divider -->
    <line x1="215" y1="8" x2="215" y2="48" stroke="#ffffff" stroke-opacity="0.25" stroke-width="1.5"/>

    <!-- Tournament Name & Sport Pill -->
    <g transform="translate(235, 12)">
      <rect x="0" y="0" width="160" height="22" rx="11" fill="#f59e0b" fill-opacity="0.18" stroke="#f59e0b" stroke-opacity="0.4"/>
      <text x="80" y="15" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="10" font-weight="900" fill="#fbbf24" letter-spacing="1.5" text-anchor="middle">🏏 ${safeSport} AUCTION</text>
      <text x="2" y="38" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="16" font-weight="800" fill="#e2e8f0">${safeTournament}</text>
    </g>

    <!-- Official Sold Badge (Right) -->
    <g transform="translate(740, 10)">
      <rect x="0" y="0" width="220" height="38" rx="19" fill="#f59e0b" fill-opacity="0.2" stroke="#f59e0b" stroke-opacity="0.5"/>
      <text x="110" y="24" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="900" fill="#fbbf24" letter-spacing="1.5" text-anchor="middle">👑 OFFICIAL AUCTION • SOLD</text>
    </g>
  </g>

  <!-- 4. Hero Player Portrait Section (Center X=540) -->
  <g transform="translate(330, 180)">
    <!-- Player Card Outer Frame with Gold Glow -->
    <rect x="-6" y="-6" width="432" height="472" rx="36" fill="none" stroke="#f59e0b" stroke-width="3" stroke-opacity="0.8" filter="url(#glowEffect)"/>
    <rect x="0" y="0" width="420" height="460" rx="30" fill="#0f172a" stroke="#fbbf24" stroke-width="2"/>

    ${
      !hasPlayerPhoto
        ? `<!-- Branded Fallback Avatar (Initials Crest + Cricket Silhouette) -->
      <g transform="translate(210, 200)">
        <circle cx="0" cy="0" r="100" fill="url(#goldGradient)"/>
        <circle cx="0" cy="0" r="92" fill="#020617"/>
        <text x="0" y="24" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="72" font-weight="900" fill="#fbbf24" text-anchor="middle" letter-spacing="3">${initials}</text>
        <text x="0" y="160" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="800" fill="#94a3b8" text-anchor="middle" letter-spacing="4">BIDWAR PLAYER</text>
      </g>`
        : ""
    }

    <!-- Bold Gold SOLD Ribbon floating on top of portrait -->
    <g transform="translate(16, 16)">
      <rect x="0" y="0" width="110" height="34" rx="8" fill="url(#goldGradient)"/>
      <text x="55" y="23" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="900" fill="#020617" text-anchor="middle" letter-spacing="2">★ SOLD</text>
    </g>
  </g>

  <!-- Player Name & Role (Centered under portrait) -->
  <g transform="translate(540, 690)">
    <text x="0" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="900" fill="#f59e0b" letter-spacing="3" text-anchor="middle">🏏 CONGRATULATIONS!</text>
    <text x="0" y="48" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="${playerNameFontSize}" font-weight="900" fill="#ffffff" letter-spacing="-0.5" text-anchor="middle">${safePlayer}</text>
    
    <!-- Role Pill -->
    <g transform="translate(0, 80)">
      <rect x="-110" y="-14" width="220" height="28" rx="14" fill="#0f172a" fill-opacity="0.9" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="1.5"/>
      <text x="0" y="4" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="11" font-weight="800" fill="#38bdf8" letter-spacing="1.5" text-anchor="middle">${safeRole}</text>
    </g>
  </g>

  <!-- 5. Winning Bid Section (Sold Price Banner) -->
  <g transform="translate(90, 810)">
    <rect x="0" y="0" width="900" height="150" rx="24" fill="url(#soldPriceGrad)" stroke="#f59e0b" stroke-width="2"/>
    
    <!-- Inner Accent Line -->
    <line x1="24" y1="146" x2="876" y2="146" stroke="#fbbf24" stroke-opacity="0.3" stroke-width="1"/>

    <g transform="translate(45, 42)">
      <text x="0" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="15" font-weight="900" fill="#f59e0b" letter-spacing="3">WINNING BID / SOLD FOR</text>
      <text x="0" y="64" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="68" font-weight="900" fill="url(#goldTextGrad)" letter-spacing="-1">${formattedPrice}</text>
    </g>

    <!-- Verified Sale Badge (Right) -->
    <g transform="translate(700, 52)">
      <rect x="0" y="0" width="155" height="44" rx="10" fill="url(#goldGradient)"/>
      <text x="77" y="27" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="12" font-weight="900" fill="#020617" text-anchor="middle" letter-spacing="1.5">VERIFIED SALE</text>
    </g>
  </g>

  <!-- 6. Winning Team Section -->
  <g transform="translate(90, 990)">
    <rect x="0" y="0" width="900" height="160" rx="24" fill="url(#cardGrad)" stroke="#334155" stroke-width="1.5"/>

    <!-- Team Logo Frame (Left) -->
    <g transform="translate(30, 20)">
      <rect x="0" y="0" width="120" height="120" rx="20" fill="#0f172a" stroke="#f59e0b" stroke-opacity="0.4" stroke-width="2"/>
      ${
        !hasTeamLogo
          ? `<text x="60" y="70" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="34" font-weight="900" fill="#fbbf24" text-anchor="middle">${shortCode}</text>`
          : ""
      }
    </g>

    <!-- Team Details (Right of Logo) -->
    <g transform="translate(180, 55)">
      <text x="0" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="800" fill="#94a3b8" letter-spacing="2">ACQUIRED BY</text>
      <text x="0" y="44" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="40" font-weight="900" fill="#ffffff" letter-spacing="0.5">${safeTeam}</text>
    </g>

    <!-- Trophy Emblem (Far Right) -->
    <g transform="translate(805, 50)">
      <circle cx="30" cy="30" r="30" fill="#f59e0b" fill-opacity="0.15"/>
      <text x="30" y="38" font-size="28" text-anchor="middle">🏆</text>
    </g>
  </g>

  <!-- 7. Bottom Footer -->
  <g transform="translate(90, 1225)">
    <line x1="0" y1="0" x2="900" y2="0" stroke="#ffffff" stroke-opacity="0.15" stroke-width="1"/>
    
    <g transform="translate(0, 36)">
      <text x="0" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="900" fill="#f59e0b">BIDWAR</text>
      <text x="80" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#cbd5e1">•</text>
      <text x="100" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="#cbd5e1" letter-spacing="1">From Auction to Champions</text>
    </g>

    <g transform="translate(900, 36)">
      <text x="0" y="0" font-family="'Segoe UI', Roboto, Helvetica, Arial, sans-serif" font-size="13" font-weight="600" fill="#64748b" text-anchor="end">Official Tournament Notification</text>
    </g>
  </g>
</svg>`;
}

/**
 * Generates a high-resolution, production-ready 1080x1350 Player Sold portrait poster PNG buffer.
 */
export async function generatePlayerSoldPosterBuffer(
  input: PlayerSoldPosterInput,
): Promise<Buffer> {
  // 1. Concurrently resolve player photo and team logo buffers (with error tolerance)
  const [playerPhotoBuffer, teamLogoBuffer] = await Promise.all([
    preparePlayerPhotoBuffer(input.playerPhotoUrl, 420, 460, 30),
    prepareTeamLogoBuffer(input.teamLogoUrl, 100, 100),
  ]);

  const hasPlayerPhoto = Boolean(playerPhotoBuffer);
  const hasTeamLogo = Boolean(teamLogoBuffer);

  // 2. Generate Base SVG containing background, typography, and fallbacks
  const svgOverlay = buildPosterSvg(input, hasPlayerPhoto, hasTeamLogo);

  // 3. Prepare sharp composite layers
  const composites: sharp.OverlayOptions[] = [];

  // If player photo was loaded, composite at (330, 180) inside the player portrait card
  if (playerPhotoBuffer) {
    composites.push({
      input: playerPhotoBuffer,
      left: 330,
      top: 180,
    });
  }

  // If team logo was loaded, composite at (130, 1000) inside the team card
  if (teamLogoBuffer) {
    composites.push({
      input: teamLogoBuffer,
      left: 130,
      top: 1000,
    });
  }

  // Always composite the SVG artwork
  composites.push({
    input: Buffer.from(svgOverlay),
    left: 0,
    top: 0,
  });

  // 4. Create blank 1080x1350 canvas and composite all layers to PNG
  const baseCanvas = sharp({
    create: {
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      channels: 4,
      background: { r: 5, g: 8, b: 17, alpha: 1 },
    },
  });

  return await baseCanvas
    .composite(composites)
    .png({
      compressionLevel: 8,
      quality: 92,
    })
    .toBuffer();
}
