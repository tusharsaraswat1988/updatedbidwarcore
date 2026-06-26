import type { OgCardBadge, RegistrationOgCardInput } from "./types.js";
import { OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
import { formatSportLabel } from "./sport-icon.js";
import {
  escapeSvgText,
  formatRegistrationDeadline,
  titleFontSize,
  wrapTitleLines,
} from "./text-layout.js";

const BADGE_TONE_COLORS: Record<NonNullable<OgCardBadge["tone"]>, string> = {
  default: "#27272a",
  urgent: "#7f1d1d",
  success: "#14532d",
  info: "#1e3a8a",
};

function buildBadgeRow(badges: OgCardBadge[] | undefined): string {
  if (!badges?.length) return "";

  let x = OG_IMAGE_WIDTH / 2;
  const gap = 12;
  const badgeWidths = badges.map((b) => Math.max(120, b.label.length * 11 + 36));
  const totalWidth = badgeWidths.reduce((sum, w) => sum + w, 0) + gap * (badges.length - 1);
  x -= totalWidth / 2;

  const parts: string[] = [];
  for (let i = 0; i < badges.length; i++) {
    const badge = badges[i];
    const width = badgeWidths[i];
    const fill = BADGE_TONE_COLORS[badge.tone ?? "default"];
    parts.push(`
      <rect x="${x}" y="520" width="${width}" height="34" rx="17" fill="${fill}" opacity="0.92"/>
      <text x="${x + width / 2}" y="542" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#fafafa">${escapeSvgText(badge.label)}</text>
    `);
    x += width + gap;
  }
  return parts.join("");
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

function buildBrandFallback(input: RegistrationOgCardInput, hasBrandLogo: boolean): string {
  if (hasBrandLogo) return "";
  return `
  <text x="64" y="82" font-family="Segoe UI, Arial, sans-serif" font-size="34" font-weight="800" fill="#ffffff">${escapeSvgText(input.brand.brandName)}</text>
  <rect x="64" y="94" width="72" height="4" rx="2" fill="${sanitizeHexColor(input.brand.primaryColor, "#F59E0B")}"/>`;
}

function buildInfoCard({
  x,
  y,
  label,
  value,
  primary,
}: {
  x: number;
  y: number;
  label: string;
  value: string;
  primary: string;
}): string {
  const displayValue = value.length > 24 ? `${value.slice(0, 23)}…` : value;
  const safeValue = escapeSvgText(displayValue);
  return `
    <rect x="${x}" y="${y}" width="236" height="86" rx="22" fill="#ffffff" fill-opacity="0.075" stroke="#ffffff" stroke-opacity="0.14"/>
    <text x="${x + 24}" y="${y + 34}" font-family="Segoe UI, Arial, sans-serif" font-size="15" font-weight="700" letter-spacing="1.8" fill="${primary}">${escapeSvgText(label.toUpperCase())}</text>
    <text x="${x + 24}" y="${y + 66}" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" fill="#ffffff">${safeValue}</text>`;
}

function buildInfoCards(input: RegistrationOgCardInput, primary: string, y: number): string {
  const cards: string[] = [];
  const deadline = formatRegistrationDeadline(input.registrationDeadline)?.replace(/^Register by\s+/i, "");
  if (deadline) {
    cards.push(buildInfoCard({ x: 64, y, label: "Register Before", value: deadline, primary }));
  }

  const venue = input.venue?.trim();
  if (venue) {
    cards.push(buildInfoCard({ x: cards.length ? 320 : 64, y, label: "Venue", value: venue, primary }));
  }

  const organizer = input.organizerName?.trim();
  if (organizer) {
    cards.push(buildInfoCard({ x: cards.length ? 576 : 320, y, label: "Organized By", value: organizer, primary }));
  }

  return cards.slice(0, 3).join("");
}

/** Foreground text + gradient overlay SVG (1200×630). */
export function buildRegistrationCardOverlaySvg(
  input: RegistrationOgCardInput,
  options?: { hasBrandLogo?: boolean },
): string {
  const primary = sanitizeHexColor(input.brand.primaryColor, "#F59E0B");
  const danger = sanitizeHexColor(input.brand.dangerColor, "#EF4444");
  const background = sanitizeHexColor(input.brand.backgroundColor, "#080A0F");
  const secondary = sanitizeHexColor(input.brand.secondaryColor, "#1E293B");
  const hasBrandLogo = options?.hasBrandLogo ?? false;
  const titleLines = wrapTitleLines(input.tournamentName, 3);
  const fontSize = titleFontSize(titleLines.length);
  const lineHeight = fontSize * 1.08;
  const titleY = 228;
  const statusY = Math.max(328, titleY + (titleLines.length - 1) * lineHeight + 42);
  const infoY = Math.min(454, statusY + 76);
  const sportLabel = formatSportLabel(input.sport);
  const statusLabel = input.registrationStatus === "closed" ? "Registration Closed" : "Registration Open";
  const statusColor = input.registrationStatus === "closed" ? danger : primary;
  const statusWidth = Math.max(258, statusLabel.length * 16 + 78);

  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="64" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join("");

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="safeTextFade" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${background}" stop-opacity="0.78"/>
      <stop offset="58%" stop-color="${background}" stop-opacity="0.34"/>
      <stop offset="100%" stop-color="${background}" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="brandRail" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${primary}" stop-opacity="0.96"/>
      <stop offset="100%" stop-color="${primary}" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#safeTextFade)"/>
  <rect x="40" y="30" width="1120" height="570" rx="34" fill="${secondary}" fill-opacity="0.1" stroke="#ffffff" stroke-opacity="0.1"/>
  <rect x="64" y="126" width="520" height="4" rx="2" fill="url(#brandRail)"/>
  ${buildBrandFallback(input, hasBrandLogo)}
  <text x="64" y="168" font-family="Segoe UI, Arial, sans-serif" font-size="23" font-weight="800" letter-spacing="2.8" fill="${primary}">${escapeSvgText(sportLabel.toUpperCase())}</text>
  <text x="64" y="${titleY}" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="#ffffff" letter-spacing="-1.6">${titleTspans}</text>
  <rect x="64" y="${statusY}" width="${statusWidth}" height="54" rx="27" fill="${statusColor}" fill-opacity="0.96"/>
  <text x="92" y="${statusY + 35}" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="900" fill="${input.registrationStatus === "closed" ? "#ffffff" : "#0b0b0f"}">${escapeSvgText(statusLabel)}</text>
  ${buildInfoCards(input, primary, infoY)}
  <text x="64" y="566" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="700" letter-spacing="2.2" fill="#ffffff" opacity="0.52">${escapeSvgText(input.brand.poweredByText.toUpperCase())}</text>
  <text x="1136" y="566" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="800" letter-spacing="2.2" fill="${primary}">BIDWAR REGISTRATION</text>
  ${buildBadgeRow(input.badges)}
</svg>`;
}
