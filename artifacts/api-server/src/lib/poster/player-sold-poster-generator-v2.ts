import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { fetchImageBuffer } from "../pdf-branding.js";

/**
 * PlayerSoldPoster Generator V2 — LAYER 5: DYNAMIC TEAM IDENTITY IMPLEMENTATION
 *
 * Canvas: 1080 × 1350 (4:5 portrait)
 * Layer Order:
 * 1. Existing approved stadium background (1080 × 1350)
 * 2. Actual player photograph clipped to circular mask (cx: 540, cy: 365, r: 248)
 * 3. User-provided Golden Energy Ring PNG (on top of photo, perfectly concentric)
 * 4. Dynamic Player Name (First line metallic white, Second line metallic gold,
 *    athletic condensed display typography, exact centered -8° athletic slant, role badge below)
 * 5. User-provided Gold Leaf PNG layer & Sold Amount with refined condensed athletic typography
 * 6. Dynamic Team Identity Section (Translucent navy panel, team logo/initials, SOLD TO, team name)
 */

export const POSTER_V2_WIDTH = 1080;
export const POSTER_V2_HEIGHT = 1350;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BG_CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../assets/player-sold-bg-v2.png"),
  path.resolve(__dirname, "../../../../auction-platform/public/assets/branding/player-sold-bg-v2.png"),
  "C:/Users/ishit/.gemini/antigravity/brain/5575cce9-44b0-4c9f-82d6-b50717768848/step1-user-background-1080x1350.png",
];

const GOLD_LEAF_CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../assets/gold-leaf-banner-v2.png"),
  path.resolve(__dirname, "../../../../auction-platform/public/assets/branding/gold-leaf-banner-v2.png"),
  "C:/Users/ishit/.gemini/antigravity/brain/5575cce9-44b0-4c9f-82d6-b50717768848/gold-leaf-asset.png",
  "C:/Users/ishit/.gemini/antigravity/brain/5575cce9-44b0-4c9f-82d6-b50717768848/.user_uploaded/media_1793346854869_97024d9b.png",
];

const GOLDEN_RING_CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../assets/glowing-golden-energy-ring.png"),
  path.resolve(__dirname, "../../../../auction-platform/public/assets/branding/glowing-golden-energy-ring.png"),
  "C:/Users/ishit/.gemini/antigravity/brain/5575cce9-44b0-4c9f-82d6-b50717768848/glowing-golden-energy-ring.png",
];

const FONT_CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../assets/BarlowCondensed-ExtraBold.ttf"),
  path.resolve(__dirname, "../../../../auction-platform/public/fonts/BarlowCondensed-ExtraBold.ttf"),
  path.resolve(process.cwd(), "artifacts/api-server/src/assets/BarlowCondensed-ExtraBold.ttf"),
];

const BIDWAR_LOGO_CANDIDATE_PATHS = [
  path.resolve(__dirname, "../../assets/bidwar-clean-logo-v2.png"),
  path.resolve(__dirname, "../../../../auction-platform/public/assets/branding/bidwar-clean-logo-v2.png"),
  path.resolve(__dirname, "../../../../auction-platform/public/bidwar-clean-logo-v2.png"),
  path.resolve(process.cwd(), "artifacts/api-server/src/assets/bidwar-clean-logo-v2.png"),
  path.resolve(process.cwd(), "artifacts/auction-platform/public/assets/branding/bidwar-clean-logo-v2.png"),
  path.resolve(process.cwd(), "artifacts/auction-platform/public/bidwar-clean-logo-v2.png"),
  path.resolve(__dirname, "../../assets/bidwar-reverse-logo.png"),
  path.resolve(process.cwd(), "artifacts/auction-platform/public/bidwar-reverse-logo.png"),
];

function resolveFirstExisting(candidates: string[]): string {
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return candidates[0];
}

function escapeXml(value: string | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface PlayerSoldPosterV2Input {
  playerName?: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamName?: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount?: number | string;
  auctionUnit?: "rupee" | "points";
  tournamentName?: string;
  tournamentSport?: string | null;
}

export function getResponsiveAmountFontSize(text: string): number {
  const len = text.length;
  if (len <= 5) return 118;
  if (len <= 8) return 110;
  if (len <= 10) return 100;
  if (len <= 12) return 88;
  if (len <= 15) return 76;
  return 66;
}

/**
 * Calculates responsive typography and line-wrapping for team name
 * to maximize visual impact while centering within the available text area.
 */
export interface TeamTypographyLayout {
  isTwoLines: boolean;
  line1: string;
  line2: string | null;
  soldToY: number;
  soldToFontSize: number;
  teamLine1Y: number;
  teamLine2Y?: number;
  teamFontSize: number;
}

export function computeTeamTypography(rawName?: string): TeamTypographyLayout {
  const name = (rawName?.trim() || "TEAM").toUpperCase();
  const len = name.length;
  const words = name.split(/\s+/).filter(Boolean);

  // Two lines only when necessary (e.g. len > 18 and at least 2 words)
  const shouldSplit = len > 18 && words.length > 1;

  if (!shouldSplit) {
    let fontSize = 54;
    if (len <= 7) fontSize = 66;       // e.g. "TEAM B" (6 chars) -> VERY LARGE
    else if (len <= 11) fontSize = 60;  // e.g. "TEAM INDIA"
    else if (len <= 16) fontSize = 54;  // e.g. "TUSHAR WARRIORS", "DELHI CHAMPIONS"
    else if (len <= 20) fontSize = 46;  // e.g. "MUMBAI SUPER KINGS"
    else fontSize = 38;

    return {
      isTwoLines: false,
      line1: name,
      line2: null,
      soldToY: 1152,
      soldToFontSize: 16,
      teamLine1Y: 1214,
      teamFontSize: fontSize,
    };
  }

  // Two lines split near middle for balanced line lengths
  let bestIndex = 1;
  let minDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ").length;
    const l2 = words.slice(i).join(" ").length;
    const diff = Math.abs(l1 - l2);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }

  const line1 = words.slice(0, bestIndex).join(" ");
  const line2 = words.slice(bestIndex).join(" ");
  const maxLineLen = Math.max(line1.length, line2.length);

  let fontSize = 35;
  if (maxLineLen <= 12) fontSize = 38;
  else if (maxLineLen <= 16) fontSize = 35;
  else if (maxLineLen <= 20) fontSize = 31;
  else fontSize = 28;

  return {
    isTwoLines: true,
    line1,
    line2,
    soldToY: 1144,
    soldToFontSize: 14,
    teamLine1Y: 1182,
    teamLine2Y: 1222,
    teamFontSize: fontSize,
  };
}

export function getResponsiveTeamFontSize(name?: string): number {
  return computeTeamTypography(name).teamFontSize;
}

/**
 * Calculates responsive typography and line-wrapping for tournament name in Header.
 * Tournament name is the visual headline, dynamically sized to fit available space (max 2 balanced lines).
 */
export interface TournamentTypographyLayout {
  isTwoLines: boolean;
  line1: string;
  line2: string | null;
  fontSize: number;
  line1Y: number;
  line2Y?: number;
}

export function computeTournamentTypography(rawName?: string): TournamentTypographyLayout {
  const name = (rawName?.trim() || "PREMIER TOURNAMENT").toUpperCase();
  const len = name.length;
  const words = name.split(/\s+/).filter(Boolean);

  // If <= 38 chars, single line maximizes the right-side horizontal space and makes it look big!
  const shouldSplit = len > 38 && words.length > 1;

  if (!shouldSplit) {
    let fontSize = 38;
    if (len <= 14) fontSize = 52;
    else if (len <= 18) fontSize = 48;
    else if (len <= 24) fontSize = 44;
    else if (len <= 30) fontSize = 40;
    else if (len <= 34) fontSize = 38;
    else fontSize = 34;

    return {
      isTwoLines: false,
      line1: name,
      line2: null,
      fontSize,
      line1Y: 66,
    };
  }

  // Split into 2 balanced lines across word boundaries if > 38 chars
  let bestIndex = 1;
  let minDiff = Infinity;
  for (let i = 1; i < words.length; i++) {
    const l1 = words.slice(0, i).join(" ").length;
    const l2 = words.slice(i).join(" ").length;
    const diff = Math.abs(l1 - l2);
    if (diff < minDiff) {
      minDiff = diff;
      bestIndex = i;
    }
  }

  const line1 = words.slice(0, bestIndex).join(" ");
  const line2 = words.slice(bestIndex).join(" ");
  const maxLineLen = Math.max(line1.length, line2.length);

  let fontSize = 30;
  if (maxLineLen <= 18) fontSize = 32;
  else if (maxLineLen <= 24) fontSize = 28;
  else fontSize = 24;

  return {
    isTwoLines: true,
    line1,
    line2,
    fontSize,
    line1Y: 50,
    line2Y: 80,
  };
}

export function formatAuctionAmountLocal(
  amount: number | string | undefined | null,
  unit: "rupee" | "points" = "rupee",
): string {
  if (amount == null || amount === "") {
    return unit === "points" ? "0 Pt." : "₹0";
  }

  if (typeof amount === "number") {
    const formatted = Math.round(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return unit === "points" ? `${formatted} Pt.` : `₹${formatted}`;
  }

  const str = String(amount).trim();
  if (str.includes("₹") || /pt\.?/i.test(str)) {
    return str;
  }

  const numericOnly = str.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(numericOnly);
  if (!Number.isNaN(parsed)) {
    const formatted = Math.round(parsed).toLocaleString("en-IN", { maximumFractionDigits: 0 });
    return unit === "points" ? `${formatted} Pt.` : `₹${formatted}`;
  }

  return str;
}

export function splitPlayerName(fullName?: string): { line1: string; line2: string | null } {
  if (!fullName || !fullName.trim()) return { line1: "PLAYER", line2: null };
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { line1: parts[0].toUpperCase(), line2: null };
  const line1 = parts[0].toUpperCase();
  const line2 = parts.slice(1).join(" ").toUpperCase();
  return { line1, line2 };
}

export function getNameFontSizes(line1: string, line2: string | null): { size1: number; size2: number } {
  if (!line2) {
    const len = line1.length;
    if (len <= 5) return { size1: 140, size2: 0 };
    if (len <= 7) return { size1: 125, size2: 0 };
    if (len <= 10) return { size1: 110, size2: 0 };
    return { size1: 92, size2: 0 };
  }

  let size1 = 86;
  if (line1.length > 7) size1 = 78;
  if (line1.length > 10) size1 = 68;

  const len2 = line2.length;
  let size2 = 114;
  if (len2 <= 6) size2 = 122;
  else if (len2 <= 8) size2 = 114;
  else if (len2 <= 10) size2 = 100;
  else if (len2 <= 13) size2 = 88;
  else if (len2 <= 16) size2 = 74;
  else size2 = 64;

  return { size1, size2 };
}

function getInitials(name?: string): string {
  if (!name) return "PL";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "PL";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

function getTeamInitials(name?: string, shortCode?: string | null): string {
  if (shortCode && shortCode.trim()) return shortCode.trim().toUpperCase();
  if (!name || !name.trim()) return "TM";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "TM";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function buildPosterV2Svg(
  input?: PlayerSoldPosterV2Input,
  photoDataUri?: string | null,
  teamLogoDataUri?: string | null,
): string {
  const bgPath = resolveFirstExisting(BG_CANDIDATE_PATHS);
  const goldPath = resolveFirstExisting(GOLD_LEAF_CANDIDATE_PATHS);
  const ringPath = resolveFirstExisting(GOLDEN_RING_CANDIDATE_PATHS);
  const fontPath = resolveFirstExisting(FONT_CANDIDATE_PATHS);

  let bgDataUri = "/assets/branding/player-sold-bg-v2.png";
  let goldDataUri = "/assets/branding/gold-leaf-banner-v2.png";
  let ringDataUri = "/assets/branding/glowing-golden-energy-ring.png";
  let fontBase64 = "";

  if (fs.existsSync(bgPath)) {
    bgDataUri = `data:image/png;base64,${fs.readFileSync(bgPath).toString("base64")}`;
  }
  if (fs.existsSync(goldPath)) {
    goldDataUri = `data:image/png;base64,${fs.readFileSync(goldPath).toString("base64")}`;
  }
  if (fs.existsSync(ringPath)) {
    ringDataUri = `data:image/png;base64,${fs.readFileSync(ringPath).toString("base64")}`;
  }
  if (fs.existsSync(fontPath)) {
    fontBase64 = fs.readFileSync(fontPath).toString("base64");
  }

  const bidwarLogoPath = resolveFirstExisting(BIDWAR_LOGO_CANDIDATE_PATHS);
  let bidwarLogoDataUri = "/bidwar-reverse-logo.png";
  if (fs.existsSync(bidwarLogoPath)) {
    bidwarLogoDataUri = `data:image/png;base64,${fs.readFileSync(bidwarLogoPath).toString("base64")}`;
  }
  const tournLayout = computeTournamentTypography(input?.tournamentName);

  const displayAmount = escapeXml(formatAuctionAmountLocal(input?.amount, input?.auctionUnit || "rupee"));
  const amountFontSize = getResponsiveAmountFontSize(displayAmount);
  const initials = escapeXml(getInitials(input?.playerName));

  // Center coordinates for Golden Energy Ring & Photo
  const cx = 540;
  const cy = 365;
  const r = 248;
  const ringWidth = 710;
  const ringHeight = Math.round(ringWidth * (985 / 1024)); // 683px
  const ringX = Math.round(cx - ringWidth * (511 / 1024)); // 186px
  const ringY = Math.round(cy - ringHeight * (490.8 / 985)); // 25px

  // Dynamic Player Name splitting and sizing
  const { line1, line2 } = splitPlayerName(input?.playerName);
  const { size1, size2 } = getNameFontSizes(line1, line2);
  const isTwoLines = Boolean(line2);

  const nameLine1Y = isTwoLines ? 738 : 772;
  const nameLine2Y = 828;
  const nameCenterY = isTwoLines ? 750 : 725;
  const roleY = isTwoLines ? 866 : 818;
  const displayRole = escapeXml((input?.playerRole?.trim() || "PLAYER").toUpperCase());

  // Gold Leaf banner shifted down:
  const goldY = 836;
  const soldForY = goldY + 113; // 949px
  const amountY = goldY + 211;  // 1047px

  // Team Identity Section Geometry:
  const teamPanelX = 60;
  const teamPanelY = 1115;
  const teamPanelWidth = 960;
  const teamPanelHeight = 130;
  const teamPanelRx = 20;

  // Logo box coordinates:
  const logoBoxX = teamPanelX + 22; // 82px
  const logoBoxY = teamPanelY + 15; // 1130px
  const logoBoxSize = 100;
  const logoBoxRx = 16;

  // Divider Line:
  const dividerX = logoBoxX + logoBoxSize + 22; // 204px
  const dividerY1 = teamPanelY + 22; // 1137px
  const dividerY2 = teamPanelY + teamPanelHeight - 22; // 1223px

  // Right Side Text Area Geometry (Centered in available text zone):
  const textAreaLeft = dividerX + 20; // 224px
  const textAreaRight = teamPanelX + teamPanelWidth - 28; // 992px
  const textAreaCenterX = Math.round((textAreaLeft + textAreaRight) / 2); // 608px

  const displayTeamName = (input?.teamName?.trim() || "TEAM").toUpperCase();
  const teamLayout = computeTeamTypography(displayTeamName);
  const teamInitials = escapeXml(getTeamInitials(input?.teamName, input?.teamShortCode));

  const safeLine1 = escapeXml(line1);
  const safeLine2 = line2 ? escapeXml(line2) : null;

  const effectivePhotoUri = photoDataUri || (input?.playerPhotoUrl && input.playerPhotoUrl.startsWith("data:") ? input.playerPhotoUrl : null);
  const effectiveTeamLogoUri = teamLogoDataUri || (input?.teamLogoUrl && input.teamLogoUrl.startsWith("data:") ? input.teamLogoUrl : null);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${POSTER_V2_WIDTH}" height="${POSTER_V2_HEIGHT}" viewBox="0 0 ${POSTER_V2_WIDTH} ${POSTER_V2_HEIGHT}">
  <defs>
    ${
      fontBase64
        ? `<style>
      @font-face {
        font-family: 'Barlow Condensed';
        src: url('data:font/ttf;base64,${fontBase64}') format('truetype');
        font-weight: 800;
        font-style: normal;
      }
    </style>`
        : ""
    }
    <!-- Circular mask for Player Photograph -->
    <clipPath id="player-photo-circle-clip">
      <circle cx="${cx}" cy="${cy}" r="${r}" />
    </clipPath>

    <!-- Rounded clip for Team Logo -->
    <clipPath id="team-logo-rounded-clip">
      <rect x="${logoBoxX}" y="${logoBoxY}" width="${logoBoxSize}" height="${logoBoxSize}" rx="${logoBoxRx}" ry="${logoBoxRx}" />
    </clipPath>

    <!-- Metallic White/Silver Gradient for First Name -->
    <linearGradient id="name-white-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="60%" stop-color="#f1f5f9" />
      <stop offset="100%" stop-color="#94a3b8" />
    </linearGradient>

    <!-- Metallic 3D Gold Gradient for Surname -->
    <linearGradient id="name-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff9db" />
      <stop offset="25%" stop-color="#ffd54f" />
      <stop offset="55%" stop-color="#f59e0b" />
      <stop offset="85%" stop-color="#b45309" />
      <stop offset="100%" stop-color="#78350f" />
    </linearGradient>

    <!-- Team Panel Translucent Midnight Purple-Navy Gradient -->
    <linearGradient id="team-panel-bg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#120822" stop-opacity="0.88" />
      <stop offset="50%" stop-color="#1e0c34" stop-opacity="0.82" />
      <stop offset="100%" stop-color="#120822" stop-opacity="0.88" />
    </linearGradient>

    <!-- Team Panel Restrained Subtle Warm Gold/Bronze Border Gradient -->
    <linearGradient id="team-panel-border" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#85631e" stop-opacity="0.4" />
      <stop offset="35%" stop-color="#d4af37" stop-opacity="0.75" />
      <stop offset="65%" stop-color="#d4af37" stop-opacity="0.75" />
      <stop offset="100%" stop-color="#85631e" stop-opacity="0.4" />
    </linearGradient>

    <!-- Metallic Champagne Gold Gradient for Header Tournament Headline -->
    <linearGradient id="header-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#fff9db" />
      <stop offset="30%" stop-color="#ffd54f" />
      <stop offset="70%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>

    <!-- High-contrast drop shadow for text separation -->
    <filter id="name-shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="4" flood-color="#000000" flood-opacity="0.95" />
    </filter>

    <filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="130%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#080210" flood-opacity="0.9" />
    </filter>
  </defs>

  <!-- Layer 1: Background -->
  <image href="${bgDataUri}" x="0" y="0" width="${POSTER_V2_WIDTH}" height="${POSTER_V2_HEIGHT}" preserveAspectRatio="xMidYMid slice" />

  <!-- Layer 1B: Header (Zone 1) — Official BidWar Logo + Dynamic Tournament Headline -->
  <g id="layer-header" filter="url(#name-shadow)">
    <!-- Official BidWar Logo on the left in its dedicated space (compact & crisp) -->
    <image
      href="${bidwarLogoDataUri}"
      x="55"
      y="38"
      width="138"
      height="34"
      preserveAspectRatio="xMinYMid meet"
    />

    <!-- Vertical Gold Divider Line -->
    <line
      x1="210"
      y1="28"
      x2="210"
      y2="82"
      stroke="#d4af37"
      stroke-width="1.5"
      stroke-opacity="0.45"
    />

    <!-- Dynamic Tournament Headline (Dedicated right-side space, maximized for bold presence) -->
    ${
      tournLayout.isTwoLines
        ? `<g id="header-tournament-title">
      <text
        x="228"
        y="${tournLayout.line1Y}"
        text-anchor="start"
        fill="url(#header-gold-grad)"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
        font-size="${tournLayout.fontSize}"
        font-weight="900"
        letter-spacing="1.2"
      >${escapeXml(tournLayout.line1)}</text>
      <text
        x="228"
        y="${tournLayout.line2Y}"
        text-anchor="start"
        fill="url(#header-gold-grad)"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
        font-size="${tournLayout.fontSize}"
        font-weight="900"
        letter-spacing="1.2"
      >${escapeXml(tournLayout.line2)}</text>
    </g>`
        : `<text
      x="228"
      y="${tournLayout.line1Y}"
      text-anchor="start"
      fill="url(#header-gold-grad)"
      font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
      font-size="${tournLayout.fontSize}"
      font-weight="900"
      letter-spacing="1.5"
    >${escapeXml(tournLayout.line1)}</text>`
    }
  </g>

  <!-- Layer 2A: Actual Player Photograph (Clipped to circular mask, dead center) -->
  <g id="layer-player-photo" clip-path="url(#player-photo-circle-clip)">
    <rect x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" fill="#090e1c" />
    ${
      effectivePhotoUri
        ? `<image href="${effectivePhotoUri}" x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" preserveAspectRatio="xMidYMin slice" />`
        : `<g id="player-avatar-fallback">
             <circle cx="${cx}" cy="${cy}" r="${r}" fill="#0d1527" />
             <circle cx="${cx}" cy="${cy + 15}" r="${r - 45}" fill="#18233c" opacity="0.7" />
             <text x="${cx}" y="${cy + 38}" text-anchor="middle" fill="#f59e0b" font-family="'Barlow Condensed', 'Oswald', 'Impact', sans-serif" font-size="120" font-weight="900" letter-spacing="4">${initials}</text>
           </g>`
    }
  </g>

  <!-- Layer 2B: Golden Energy Ring PNG (Positioned ON TOP of photograph) -->
  <image id="layer-golden-energy-ring" href="${ringDataUri}" x="${ringX}" y="${ringY}" width="${ringWidth}" height="${ringHeight}" preserveAspectRatio="xMidYMid meet" />

  <!-- Layer 3: Dynamic Player Name (Athletic Condensed Display, Two-tone, -8° Slant) -->
  <g id="layer-player-name" filter="url(#name-shadow)">
    <g transform="translate(540, ${nameCenterY}) skewX(-8) translate(-540, -${nameCenterY})">
      ${
        isTwoLines
          ? `<!-- Line 1: First Name (Metallic White/Silver) -->
      <text
        x="540"
        y="${nameLine1Y}"
        text-anchor="middle"
        fill="url(#name-white-grad)"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
        font-size="${size1}"
        font-weight="900"
        letter-spacing="2"
      >${safeLine1}</text>

      <!-- Line 2: Surname (Metallic Gold 3D) -->
      <text
        x="540"
        y="${nameLine2Y}"
        text-anchor="middle"
        fill="url(#name-gold-grad)"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
        font-size="${size2}"
        font-weight="900"
        letter-spacing="1"
      >${safeLine2}</text>`
          : `<!-- Single Word Name (Metallic Gold 3D) -->
      <text
        x="540"
        y="${nameLine1Y}"
        text-anchor="middle"
        fill="url(#name-gold-grad)"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
        font-size="${size1}"
        font-weight="900"
        letter-spacing="2"
      >${safeLine1}</text>`
      }
    </g>

    <!-- Player Role with flanking golden lines (clean, upright horizontal badge) -->
    <g id="player-role-badge">
      <line x1="300" y1="${roleY - 7}" x2="420" y2="${roleY - 7}" stroke="#d4af37" stroke-width="2" stroke-opacity="0.8" />
      <text
        x="540"
        y="${roleY}"
        text-anchor="middle"
        fill="#f1f5f9"
        font-family="'Barlow Condensed', 'Oswald', 'Inter', sans-serif"
        font-size="19"
        font-weight="800"
        letter-spacing="6"
      >${displayRole}</text>
      <line x1="660" y1="${roleY - 7}" x2="780" y2="${roleY - 7}" stroke="#d4af37" stroke-width="2" stroke-opacity="0.8" />
    </g>
  </g>

  <!-- Layer 4: User-Provided Gold Leaf PNG Layer -->
  <image href="${goldDataUri}" x="60" y="${goldY}" width="960" height="320" preserveAspectRatio="xMidYMid meet" />

  <!-- Layer 4: Sold Amount Typography Refinement -->
  <g id="layer-sold-amount">
    <text
      x="540"
      y="${soldForY}"
      text-anchor="middle"
      fill="#0b101d"
      font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
      font-size="25"
      font-weight="800"
      letter-spacing="5"
    >SOLD FOR</text>

    <text
      x="540"
      y="${amountY}"
      text-anchor="middle"
      fill="#070b14"
      font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
      font-size="${amountFontSize}"
      font-weight="900"
      letter-spacing="0.5"
    >${displayAmount}</text>
  </g>

  <!-- Layer 5: Dynamic Team Identity Section -->
  <g id="layer-team-identity" filter="url(#panel-shadow)">
    <!-- Translucent Midnight Purple-Navy Container Panel -->
    <rect
      x="${teamPanelX}"
      y="${teamPanelY}"
      width="${teamPanelWidth}"
      height="${teamPanelHeight}"
      rx="${teamPanelRx}"
      ry="${teamPanelRx}"
      fill="url(#team-panel-bg)"
      stroke="url(#team-panel-border)"
      stroke-width="2"
    />

    <!-- Subtle Top Edge Warm Gold Sheen Line -->
    <line
      x1="${teamPanelX + 40}"
      y1="${teamPanelY + 1.5}"
      x2="${teamPanelX + teamPanelWidth - 40}"
      y2="${teamPanelY + 1.5}"
      stroke="#ffd54f"
      stroke-width="1.5"
      stroke-opacity="0.28"
    />

    <!-- Left Side: Square Logo Box with Subtle Gold Outline -->
    <g id="team-logo-container">
      <rect
        x="${logoBoxX}"
        y="${logoBoxY}"
        width="${logoBoxSize}"
        height="${logoBoxSize}"
        rx="${logoBoxRx}"
        ry="${logoBoxRx}"
        fill="#090414"
        stroke="#d4af37"
        stroke-width="2"
        stroke-opacity="0.8"
      />

      ${
        effectiveTeamLogoUri
          ? `<g clip-path="url(#team-logo-rounded-clip)">
               <image
                 href="${effectiveTeamLogoUri}"
                 x="${logoBoxX + 8}"
                 y="${logoBoxY + 8}"
                 width="${logoBoxSize - 16}"
                 height="${logoBoxSize - 16}"
                 preserveAspectRatio="xMidYMid meet"
               />
             </g>`
          : `<!-- Missing Logo Fallback: Bold Gold Team Initials -->
             <text
               x="${logoBoxX + logoBoxSize / 2}"
               y="${logoBoxY + logoBoxSize / 2 + 15}"
               text-anchor="middle"
               fill="#ffd54f"
               font-family="'Barlow Condensed', 'Oswald', 'Impact', sans-serif"
               font-size="44"
               font-weight="900"
               letter-spacing="1"
             >${teamInitials}</text>`
      }
    </g>

    <!-- Vertical Gold Divider Line -->
    <line
      x1="${dividerX}"
      y1="${dividerY1}"
      x2="${dividerX}"
      y2="${dividerY2}"
      stroke="#d4af37"
      stroke-width="1.5"
      stroke-opacity="0.45"
    />

    <!-- Right Side: Team Information (Centered in available text zone) -->
    <g id="team-info">
      <!-- First Line: SOLD TO -->
      <text
        x="${textAreaCenterX}"
        y="${teamLayout.soldToY}"
        text-anchor="middle"
        fill="#d4af37"
        font-family="'Barlow Condensed', 'Oswald', 'Impact', sans-serif"
        font-size="${teamLayout.soldToFontSize}"
        font-weight="800"
        letter-spacing="4"
      >SOLD TO</text>

      <!-- Second Line: Actual Team Name -->
      ${
        teamLayout.isTwoLines
          ? `<text
               x="${textAreaCenterX}"
               y="${teamLayout.teamLine1Y}"
               text-anchor="middle"
               fill="#ffffff"
               font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
               font-size="${teamLayout.teamFontSize}"
               font-weight="900"
               letter-spacing="0.8"
             >${escapeXml(teamLayout.line1)}</text>
             <text
               x="${textAreaCenterX}"
               y="${teamLayout.teamLine2Y}"
               text-anchor="middle"
               fill="#ffffff"
               font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
               font-size="${teamLayout.teamFontSize}"
               font-weight="900"
               letter-spacing="0.8"
             >${escapeXml(teamLayout.line2)}</text>`
          : `<text
               x="${textAreaCenterX}"
               y="${teamLayout.teamLine1Y}"
               text-anchor="middle"
               fill="#ffffff"
               font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
               font-size="${teamLayout.teamFontSize}"
               font-weight="900"
               letter-spacing="1"
             >${escapeXml(teamLayout.line1)}</text>`
      }
    </g>
  </g>

  <!-- Layer 6: Brand Signature Footer (Zone 6) — BIDWAR | FROM AUCTION TO CHAMPIONS -->
  <g id="layer-footer" filter="url(#name-shadow)">
    <!-- Subtle Flanking Thin Gold Accent Lines -->
    <line
      x1="110"
      y1="1296"
      x2="280"
      y2="1296"
      stroke="#d4af37"
      stroke-width="1.5"
      stroke-opacity="0.45"
    />
    <polygon
      points="285,1296 288,1293 291,1296 288,1299"
      fill="#d4af37"
      fill-opacity="0.75"
    />

    <!-- Centered Brand Signature Text -->
    <text
      x="540"
      y="1302"
      text-anchor="middle"
      font-family="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
      font-size="21"
      letter-spacing="2.5"
    >
      <tspan fill="#ffd54f" font-weight="900">BIDWAR</tspan>
      <tspan fill="#d4af37" fill-opacity="0.65" font-weight="600">  |  </tspan>
      <tspan fill="#f8fafc" font-weight="700">FROM AUCTION TO CHAMPIONS</tspan>
    </text>

    <polygon
      points="789,1296 792,1293 795,1296 792,1299"
      fill="#d4af37"
      fill-opacity="0.75"
    />
    <line
      x1="800"
      y1="1296"
      x2="970"
      y2="1296"
      stroke="#d4af37"
      stroke-width="1.5"
      stroke-opacity="0.45"
    />
  </g>
</svg>`;
}

export const buildPosterSvg = buildPosterV2Svg;

function bufferToDataUri(buffer: Buffer): string {
  if (buffer.length >= 4) {
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return `data:image/png;base64,${buffer.toString("base64")}`;
    }
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return `data:image/jpeg;base64,${buffer.toString("base64")}`;
    }
    if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
      return `data:image/webp;base64,${buffer.toString("base64")}`;
    }
  }
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

export async function generatePlayerSoldPosterV2Buffer(
  input?: PlayerSoldPosterV2Input,
): Promise<Buffer> {
  let photoDataUri: string | null = null;
  if (input?.playerPhotoUrl && input.playerPhotoUrl.startsWith("http")) {
    const rawBuffer = await fetchImageBuffer(input.playerPhotoUrl.trim());
    if (rawBuffer) {
      photoDataUri = bufferToDataUri(rawBuffer);
    }
  }

  let teamLogoDataUri: string | null = null;
  if (input?.teamLogoUrl && input.teamLogoUrl.startsWith("http")) {
    const rawLogoBuffer = await fetchImageBuffer(input.teamLogoUrl.trim());
    if (rawLogoBuffer) {
      teamLogoDataUri = bufferToDataUri(rawLogoBuffer);
    }
  }

  const svg = buildPosterV2Svg(input, photoDataUri, teamLogoDataUri);
  return await sharp(Buffer.from(svg))
    .png({ quality: 95, compressionLevel: 8 })
    .toBuffer();
}

export const generatePlayerSoldPosterBuffer = generatePlayerSoldPosterV2Buffer;
