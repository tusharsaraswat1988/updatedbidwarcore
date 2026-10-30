import React, { useEffect } from "react";
import { formatAuctionAmount, normalizeAuctionUnit, type AuctionUnit } from "@/lib/format";
import { loadDisplayFonts } from "@/lib/load-display-fonts";

// ─── PlayerSoldPosterV2 — COMPLETE DESIGN WITH REFINED HEADER & FOOTER ──────────
// Layer Order:
// 1. Existing approved stadium background (1080 × 1350)
// 2. Dynamic Header (Zone 1): Official BidWar logo (left) + Dynamic Tournament Headline (right)
// 3. Actual player photograph clipped to circular mask (dead centered, zero gap)
// 4. User-provided Golden Energy Ring PNG (placed ON TOP of photograph)
// 5. Dynamic Player Name (First line metallic white, Second line metallic gold,
//    athletic condensed display typography, centered -8° athletic slant, role badge below)
// 6. User-provided Gold Leaf PNG layer & Sold Amount with refined condensed athletic typography
// 7. Dynamic Team Identity Section (Translucent navy panel, team logo/initials, SOLD TO, team name)
// 8. Brand Signature Footer (Zone 6): BIDWAR | FROM AUCTION TO CHAMPIONS

export interface PlayerSoldPosterV2Props {
  playerName?: string;
  playerPhotoUrl?: string | null;
  playerRole?: string | null;
  teamName?: string;
  teamLogoUrl?: string | null;
  teamShortCode?: string | null;
  teamColor?: string | null;
  amount?: number | string;
  tournamentName?: string;
  tournamentSport?: string | null;
  auctionUnit?: AuctionUnit;
  isIllustrative?: boolean;
  className?: string;
  showDownloadButton?: boolean;
  titleSponsorLogoUrl?: string | null;
  coSponsorLogoUrls?: string[] | null;
}

/**
 * Calculates responsive font size for the condensed athletic display font
 * used on the Gold Leaf sold amount.
 */
export function getResponsiveAmountFontSize(text: string): number {
  const len = text.length;
  if (len <= 5) return 118; // e.g. "₹500", "₹0"
  if (len <= 8) return 110; // e.g. "₹40,000", "500 Pt."
  if (len <= 10) return 100; // e.g. "₹1,20,00,000", "10,000 Pt."
  if (len <= 12) return 88; // e.g. "1,20,00,000 Pt.", "₹1,00,00,000"
  if (len <= 15) return 76; // e.g. "₹1,50,00,000"
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
  letterSpacing: number;
}

export function computeTournamentTypography(rawName?: string): TournamentTypographyLayout {
  const name = (rawName?.trim() || "PREMIER TOURNAMENT").toUpperCase();
  const len = name.length;
  const words = name.split(/\s+/).filter(Boolean);

  // If short name (<= 16 chars or single word), single line maximizes bold impact
  const shouldSplit = len > 16 && words.length > 1;

  if (!shouldSplit) {
    let fontSize = 58;
    if (len <= 12) fontSize = 62;
    else if (len <= 16) fontSize = 58;
    else if (len <= 20) fontSize = 52;
    else if (len <= 25) fontSize = 44;
    else fontSize = 38;

    return {
      isTwoLines: false,
      line1: name,
      line2: null,
      fontSize,
      line1Y: 88,
      letterSpacing: 2,
    };
  }

  // Split into 2 balanced lines across word boundaries to fill the dedicated header space
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

  let fontSize = 58;
  let line1Y = 66;
  let line2Y = 122;

  if (maxLineLen <= 16) {
    fontSize = 58;
    line1Y = 66;
    line2Y = 122;
  } else if (maxLineLen <= 21) {
    fontSize = 52;
    line1Y = 66;
    line2Y = 120;
  } else if (maxLineLen <= 26) {
    fontSize = 46;
    line1Y = 64;
    line2Y = 114;
  } else {
    fontSize = 38;
    line1Y = 60;
    line2Y = 106;
  }

  return {
    isTwoLines: true,
    line1,
    line2,
    fontSize,
    line1Y,
    line2Y,
    letterSpacing: maxLineLen <= 18 ? 2 : 1.2,
  };
}

/**
 * Formats amount from DB / dynamic source according to tournament auction unit.
 */
export function resolveDisplayAmount(
  amount: number | string | undefined | null,
  unit?: AuctionUnit,
): string {
  const normalizedUnit = normalizeAuctionUnit(unit);

  if (amount == null || amount === "") {
    return formatAuctionAmount(0, normalizedUnit);
  }

  if (typeof amount === "number") {
    return formatAuctionAmount(amount, normalizedUnit);
  }

  const str = String(amount).trim();
  if (str.includes("₹") || /pt\.?/i.test(str)) {
    return str;
  }

  const numericOnly = str.replace(/[^0-9.]/g, "");
  const parsed = parseFloat(numericOnly);
  if (!Number.isNaN(parsed)) {
    return formatAuctionAmount(parsed, normalizedUnit);
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

export function PlayerSoldPosterV2({
  playerName,
  playerPhotoUrl,
  playerRole,
  teamName = "Team",
  teamLogoUrl,
  teamShortCode,
  amount,
  auctionUnit,
  tournamentName,
  className = "",
}: PlayerSoldPosterV2Props) {
  useEffect(() => {
    loadDisplayFonts();
  }, []);

  const tournLayout = computeTournamentTypography(tournamentName);
  const displayAmount = resolveDisplayAmount(amount, auctionUnit);
  const amountFontSize = getResponsiveAmountFontSize(displayAmount);
  const playerInitials = getInitials(playerName);

  // Optical centering parameters for Golden Energy Ring & Photo
  // Downsized by ~20% and shifted down to create ample dedicated space for the bold header headline
  const cx = 540;
  const cy = 405;
  const r = 198;
  const ringWidth = 570;
  const ringHeight = Math.round(ringWidth * (985 / 1024)); // 548px
  const ringX = Math.round(cx - ringWidth * (511 / 1024)); // 255px
  const ringY = Math.round(cy - ringHeight * (490.8 / 985)); // 132px

  // Name splitting & responsive sizing (Bigger, bolder athletic font)
  const { line1, line2 } = splitPlayerName(playerName);
  const { size1, size2 } = getNameFontSizes(line1, line2);
  const isTwoLines = Boolean(line2);

  // Vertical placement moved down below circle to eliminate any overlap:
  const nameLine1Y = isTwoLines ? 738 : 772;
  const nameLine2Y = 828;
  const nameCenterY = isTwoLines ? 750 : 725;
  const roleY = isTwoLines ? 866 : 818;
  const displayRole = (playerRole?.trim() || "PLAYER").toUpperCase();

  // Gold Leaf banner shifted down in harmony:
  const goldY = 836;
  const soldForY = goldY + 113; // 949px
  const amountY = goldY + 211;  // 1047px

  // Team Identity Section Geometry:
  const teamPanelX = 60;
  const teamPanelY = 1115;
  const teamPanelWidth = 960;
  const teamPanelHeight = 130;
  const teamPanelRx = 20;

  // Left Side: Logo Box
  const logoBoxX = teamPanelX + 22; // 82px
  const logoBoxY = teamPanelY + 15; // 1130px
  const logoBoxSize = 100;
  const logoBoxRx = 16;

  // Divider Line
  const dividerX = logoBoxX + logoBoxSize + 22; // 204px
  const dividerY1 = teamPanelY + 22; // 1137px
  const dividerY2 = teamPanelY + teamPanelHeight - 22; // 1223px

  // Right Side Text Area Geometry (Centered in available text zone):
  const textAreaLeft = dividerX + 20; // 224px
  const textAreaRight = teamPanelX + teamPanelWidth - 28; // 992px
  const textAreaCenterX = Math.round((textAreaLeft + textAreaRight) / 2); // 608px

  const displayTeamName = (teamName?.trim() || "TEAM").toUpperCase();
  const teamLayout = computeTeamTypography(displayTeamName);
  const teamInitials = getTeamInitials(teamName, teamShortCode);

  const hasPhoto = Boolean(playerPhotoUrl && playerPhotoUrl.trim().length > 0);
  const hasTeamLogo = Boolean(teamLogoUrl && teamLogoUrl.trim().length > 0);

  return (
    <div
      data-testid="player-sold-poster-v2-canvas"
      className={`relative w-full aspect-[4/5] overflow-hidden select-none bg-[#020612] ${className}`}
      style={{ aspectRatio: "1080 / 1350" }}
    >
      <svg
        viewBox="0 0 1080 1350"
        className="w-full h-full block"
        xmlns="http://www.w3.org/2000/svg"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          {/* Circular mask for Player Photograph */}
          <clipPath id="player-photo-circle-clip">
            <circle cx={cx} cy={cy} r={r} />
          </clipPath>

          {/* Rounded clip for Team Logo */}
          <clipPath id="team-logo-rounded-clip">
            <rect
              x={logoBoxX}
              y={logoBoxY}
              width={logoBoxSize}
              height={logoBoxSize}
              rx={logoBoxRx}
              ry={logoBoxRx}
            />
          </clipPath>

          {/* Metallic White/Silver Gradient for First Name */}
          <linearGradient id="name-white-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="60%" stopColor="#f1f5f9" />
            <stop offset="100%" stopColor="#94a3b8" />
          </linearGradient>

          {/* Metallic 3D Gold Gradient for Surname */}
          <linearGradient id="name-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff9db" />
            <stop offset="25%" stopColor="#ffd54f" />
            <stop offset="55%" stopColor="#f59e0b" />
            <stop offset="85%" stopColor="#b45309" />
            <stop offset="100%" stopColor="#78350f" />
          </linearGradient>

          {/* Team Panel Translucent Midnight Purple-Navy Gradient */}
          <linearGradient id="team-panel-bg" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#120822" stopOpacity="0.88" />
            <stop offset="50%" stopColor="#1e0c34" stopOpacity="0.82" />
            <stop offset="100%" stopColor="#120822" stopOpacity="0.88" />
          </linearGradient>

          {/* Team Panel Restrained Subtle Warm Gold/Bronze Border Gradient */}
          <linearGradient id="team-panel-border" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#85631e" stopOpacity="0.4" />
            <stop offset="35%" stopColor="#d4af37" stopOpacity="0.75" />
            <stop offset="65%" stopColor="#d4af37" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#85631e" stopOpacity="0.4" />
          </linearGradient>

          {/* Metallic Champagne Gold Gradient for Header Tournament Headline */}
          <linearGradient id="header-gold-grad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fff9db" />
            <stop offset="30%" stopColor="#ffd54f" />
            <stop offset="70%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#d97706" />
          </linearGradient>

          {/* Text drop shadow for high-contrast cinematic pop */}
          <filter id="name-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="6" stdDeviation="4" floodColor="#000000" floodOpacity="0.95" />
          </filter>

          <filter id="panel-shadow" x="-10%" y="-10%" width="120%" height="130%">
            <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#080210" floodOpacity="0.9" />
          </filter>
        </defs>

        {/* Layer 1: Existing Approved Stadium Background */}
        <image
          href="/assets/branding/player-sold-bg-v2.png"
          x="0"
          y="0"
          width="1080"
          height="1350"
          preserveAspectRatio="xMidYMid slice"
        />

        {/* Layer 1B: Header (Zone 1) — Official BidWar Logo + Dynamic Tournament Headline */}
        <g id="layer-header" filter="url(#name-shadow)">
          {/* Official BidWar Logo on the left in its dedicated space */}
          <image
            href="/bidwar-clean-logo-v2.png"
            x="55"
            y="46"
            width="155"
            height="38"
            preserveAspectRatio="xMinYMid meet"
          />

          {/* Vertical Gold Divider Line */}
          <line
            x1="228"
            y1="26"
            x2="228"
            y2="132"
            stroke="#d4af37"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />

          {/* Dynamic Tournament Headline (Dedicated right-side space, maximized for bold presence) */}
          {tournLayout.isTwoLines ? (
            <g id="header-tournament-title">
              <text
                x="248"
                y={tournLayout.line1Y}
                textAnchor="start"
                fill="url(#header-gold-grad)"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                fontSize={tournLayout.fontSize}
                fontWeight="900"
                letterSpacing={tournLayout.letterSpacing}
              >
                {tournLayout.line1}
              </text>
              <text
                x="248"
                y={tournLayout.line2Y}
                textAnchor="start"
                fill="url(#header-gold-grad)"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                fontSize={tournLayout.fontSize}
                fontWeight="900"
                letterSpacing={tournLayout.letterSpacing}
              >
                {tournLayout.line2}
              </text>
            </g>
          ) : (
            <text
              x="248"
              y={tournLayout.line1Y}
              textAnchor="start"
              fill="url(#header-gold-grad)"
              fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
              fontSize={tournLayout.fontSize}
              fontWeight="900"
              letterSpacing={tournLayout.letterSpacing}
            >
              {tournLayout.line1}
            </text>
          )}
        </g>

        {/* Layer 2A: Actual Player Photograph (Clipped to circular mask, dead center) */}
        <g id="layer-player-photo" clipPath="url(#player-photo-circle-clip)">
          <rect
            x={cx - r}
            y={cy - r}
            width={2 * r}
            height={2 * r}
            fill="#090e1c"
          />

          {hasPhoto ? (
            <image
              href={playerPhotoUrl!}
              x={cx - r}
              y={cy - r}
              width={2 * r}
              height={2 * r}
              preserveAspectRatio="xMidYMin slice"
            />
          ) : (
            <g id="player-avatar-fallback">
              <circle cx={cx} cy={cy} r={r} fill="#0d1527" />
              <circle cx={cx} cy={cy + 15} r={r - 45} fill="#18233c" opacity="0.7" />
              <text
                x={cx}
                y={cy + 38}
                textAnchor="middle"
                fill="#f59e0b"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', sans-serif"
                fontSize="120"
                fontWeight="900"
                letterSpacing="4"
              >
                {playerInitials}
              </text>
            </g>
          )}
        </g>

        {/* Layer 2B: Golden Energy Ring PNG (Positioned directly ON TOP of photograph) */}
        <image
          id="layer-golden-energy-ring"
          href="/assets/branding/glowing-golden-energy-ring.png"
          x={ringX}
          y={ringY}
          width={ringWidth}
          height={ringHeight}
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Layer 3: Dynamic Player Name (Dead Center Skew around 540, nameCenterY) */}
        <g id="layer-player-name" filter="url(#name-shadow)">
          <g transform={`translate(540, ${nameCenterY}) skewX(-8) translate(-540, -${nameCenterY})`}>
            {isTwoLines ? (
              <>
                {/* Line 1: First Name (Metallic White/Silver) */}
                <text
                  x="540"
                  y={nameLine1Y}
                  textAnchor="middle"
                  fill="url(#name-white-grad)"
                  fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                  fontSize={size1}
                  fontWeight="900"
                  letterSpacing="2"
                >
                  {line1}
                </text>

                {/* Line 2: Surname (Metallic Gold 3D) */}
                <text
                  x="540"
                  y={nameLine2Y}
                  textAnchor="middle"
                  fill="url(#name-gold-grad)"
                  fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                  fontSize={size2}
                  fontWeight="900"
                  letterSpacing="1"
                >
                  {line2}
                </text>
              </>
            ) : (
              /* Single Word Name (Metallic Gold 3D) */
              <text
                x="540"
                y={nameLine1Y}
                textAnchor="middle"
                fill="url(#name-gold-grad)"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                fontSize={size1}
                fontWeight="900"
                letterSpacing="2"
              >
                {line1}
              </text>
            )}
          </g>

          {/* Player Role with flanking golden lines (clean, upright horizontal badge, dead center) */}
          <g id="player-role-badge">
            <line
              x1="300"
              y1={roleY - 7}
              x2="420"
              y2={roleY - 7}
              stroke="#d4af37"
              strokeWidth="2"
              strokeOpacity="0.8"
            />
            <text
              x="540"
              y={roleY}
              textAnchor="middle"
              fill="#f1f5f9"
              fontFamily="'Barlow Condensed', 'Oswald', 'Inter', sans-serif"
              fontSize="19"
              fontWeight="800"
              letterSpacing="6"
            >
              {displayRole}
            </text>
            <line
              x1="660"
              y1={roleY - 7}
              x2="780"
              y2={roleY - 7}
              stroke="#d4af37"
              strokeWidth="2"
              strokeOpacity="0.8"
            />
          </g>
        </g>

        {/* Layer 4: User-Provided Gold Leaf PNG Layer */}
        <image
          href="/assets/branding/gold-leaf-banner-v2.png"
          x="60"
          y={goldY}
          width="960"
          height="320"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* Layer 4: Sold Amount Typography Refinement */}
        <g id="layer-sold-amount">
          <text
            x="540"
            y={soldForY}
            textAnchor="middle"
            fill="#0b101d"
            fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
            fontSize="25"
            fontWeight="800"
            letterSpacing="5"
          >
            SOLD FOR
          </text>

          <text
            x="540"
            y={amountY}
            textAnchor="middle"
            fill="#070b14"
            fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
            fontSize={amountFontSize}
            fontWeight="900"
            letterSpacing="0.5"
          >
            {displayAmount}
          </text>
        </g>

        {/* Layer 5: Dynamic Team Identity Section */}
        <g id="layer-team-identity" filter="url(#panel-shadow)">
          {/* Translucent Midnight Purple-Navy Container Panel */}
          <rect
            x={teamPanelX}
            y={teamPanelY}
            width={teamPanelWidth}
            height={teamPanelHeight}
            rx={teamPanelRx}
            ry={teamPanelRx}
            fill="url(#team-panel-bg)"
            stroke="url(#team-panel-border)"
            strokeWidth="2"
          />

          {/* Subtle Top Edge Warm Gold Sheen Line */}
          <line
            x1={teamPanelX + 40}
            y1={teamPanelY + 1.5}
            x2={teamPanelX + teamPanelWidth - 40}
            y2={teamPanelY + 1.5}
            stroke="#ffd54f"
            strokeWidth="1.5"
            strokeOpacity="0.28"
          />

          {/* Left Side: Square Logo Box with Subtle Gold Outline */}
          <g id="team-logo-container">
            <rect
              x={logoBoxX}
              y={logoBoxY}
              width={logoBoxSize}
              height={logoBoxSize}
              rx={logoBoxRx}
              ry={logoBoxRx}
              fill="#090414"
              stroke="#d4af37"
              strokeWidth="2"
              strokeOpacity="0.8"
            />

            {hasTeamLogo ? (
              <g clipPath="url(#team-logo-rounded-clip)">
                <image
                  href={teamLogoUrl!}
                  x={logoBoxX + 8}
                  y={logoBoxY + 8}
                  width={logoBoxSize - 16}
                  height={logoBoxSize - 16}
                  preserveAspectRatio="xMidYMid meet"
                />
              </g>
            ) : (
              /* Missing Logo Fallback: Bold Gold Team Initials */
              <text
                x={logoBoxX + logoBoxSize / 2}
                y={logoBoxY + logoBoxSize / 2 + 15}
                textAnchor="middle"
                fill="#ffd54f"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', sans-serif"
                fontSize="44"
                fontWeight="900"
                letterSpacing="1"
              >
                {teamInitials}
              </text>
            )}
          </g>

          {/* Vertical Gold Divider Line */}
          <line
            x1={dividerX}
            y1={dividerY1}
            x2={dividerX}
            y2={dividerY2}
            stroke="#d4af37"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />

          {/* Right Side: Team Information (Centered in available text zone) */}
          <g id="team-info">
            {/* First Line: SOLD TO */}
            <text
              x={textAreaCenterX}
              y={teamLayout.soldToY}
              textAnchor="middle"
              fill="#d4af37"
              fontFamily="'Barlow Condensed', 'Oswald', 'Impact', sans-serif"
              fontSize={teamLayout.soldToFontSize}
              fontWeight="800"
              letterSpacing="4"
            >
              SOLD TO
            </text>

            {/* Second Line: Actual Team Name */}
            {teamLayout.isTwoLines ? (
              <>
                <text
                  x={textAreaCenterX}
                  y={teamLayout.teamLine1Y}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                  fontSize={teamLayout.teamFontSize}
                  fontWeight="900"
                  letterSpacing="0.8"
                >
                  {teamLayout.line1}
                </text>
                <text
                  x={textAreaCenterX}
                  y={teamLayout.teamLine2Y}
                  textAnchor="middle"
                  fill="#ffffff"
                  fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                  fontSize={teamLayout.teamFontSize}
                  fontWeight="900"
                  letterSpacing="0.8"
                >
                  {teamLayout.line2}
                </text>
              </>
            ) : (
              <text
                x={textAreaCenterX}
                y={teamLayout.teamLine1Y}
                textAnchor="middle"
                fill="#ffffff"
                fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
                fontSize={teamLayout.teamFontSize}
                fontWeight="900"
                letterSpacing="1"
              >
                {teamLayout.line1}
              </text>
            )}
          </g>
        </g>

        {/* Layer 6: Brand Signature Footer (Zone 6) — BIDWAR | FROM AUCTION TO CHAMPIONS */}
        <g id="layer-footer" filter="url(#name-shadow)">
          {/* Subtle Flanking Thin Gold Accent Lines */}
          <line
            x1="110"
            y1="1296"
            x2="280"
            y2="1296"
            stroke="#d4af37"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
          <polygon
            points="285,1296 288,1293 291,1296 288,1299"
            fill="#d4af37"
            fillOpacity="0.75"
          />

          {/* Centered Brand Signature Text */}
          <text
            x="540"
            y="1302"
            textAnchor="middle"
            fontFamily="'Barlow Condensed', 'Oswald', 'Impact', 'Arial Narrow', sans-serif"
            fontSize="21"
            letterSpacing="2.5"
          >
            <tspan fill="#ffd54f" fontWeight="900">BIDWAR</tspan>
            <tspan fill="#d4af37" fillOpacity="0.65" fontWeight="600">  |  </tspan>
            <tspan fill="#f8fafc" fontWeight="700">FROM AUCTION TO CHAMPIONS</tspan>
          </text>

          <polygon
            points="789,1296 792,1293 795,1296 792,1299"
            fill="#d4af37"
            fillOpacity="0.75"
          />
          <line
            x1="800"
            y1="1296"
            x2="970"
            y2="1296"
            stroke="#d4af37"
            strokeWidth="1.5"
            strokeOpacity="0.45"
          />
        </g>
      </svg>
    </div>
  );
}
