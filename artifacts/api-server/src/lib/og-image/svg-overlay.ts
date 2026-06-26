import type { OgCardBadge, RegistrationOgCardInput } from "./types.js";
import { REGISTRATION_OG_SUBTITLE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
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
      <rect x="${x}" y="468" width="${width}" height="34" rx="17" fill="${fill}" opacity="0.92"/>
      <text x="${x + width / 2}" y="490" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="16" font-weight="600" fill="#fafafa">${escapeSvgText(badge.label)}</text>
    `);
    x += width + gap;
  }
  return parts.join("");
}

/** Foreground text + gradient overlay SVG (1200×630). */
export function buildRegistrationCardOverlaySvg(input: RegistrationOgCardInput): string {
  const titleLines = wrapTitleLines(input.tournamentName);
  const fontSize = titleFontSize(titleLines.length);
  const lineHeight = fontSize * 1.12;
  const titleBlockHeight = titleLines.length * lineHeight;
  const titleStartY = 250 - titleBlockHeight / 2 + fontSize * 0.35;

  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="600" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join("");

  const venue = input.venue?.trim();
  const deadline = formatRegistrationDeadline(input.registrationDeadline);
  const organizer = input.organizerName?.trim();

  const metaLines: string[] = [];
  if (venue) metaLines.push(venue);
  if (deadline) metaLines.push(deadline);

  const metaY = titleStartY + titleBlockHeight + 36;
  const metaTspans = metaLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : 30;
      return `<tspan x="600" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join("");

  const organizerBlock = organizer
    ? `<text x="48" y="582" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="500" fill="#d4d4d8">${escapeSvgText(organizer)}</text>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="cardFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#09090b" stop-opacity="0.35"/>
      <stop offset="42%" stop-color="#09090b" stop-opacity="0.62"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0.94"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#cardFade)"/>
  <text x="600" y="${titleStartY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fafafa">${titleTspans}</text>
  <text x="600" y="${titleStartY + titleBlockHeight + 28}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="28" font-weight="600" fill="#fbbf24">${escapeSvgText(REGISTRATION_OG_SUBTITLE)}</text>
  ${metaLines.length ? `<text x="600" y="${metaY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="500" fill="#e4e4e7">${metaTspans}</text>` : ""}
  ${organizerBlock}
  <text x="1152" y="582" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" letter-spacing="2" fill="#a1a1aa">POWERED BY</text>
  <text x="1152" y="608" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="700" fill="#fbbf24">BidWar</text>
  ${buildBadgeRow(input.badges)}
</svg>`;
}
