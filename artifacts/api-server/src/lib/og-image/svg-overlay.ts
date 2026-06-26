import type { OgCardBadge, RegistrationOgCardInput } from "./types.js";
import { REGISTRATION_OG_SUBTITLE, OG_IMAGE_HEIGHT, OG_IMAGE_WIDTH } from "./constants.js";
import { formatSportLabel, sportAccentColor } from "./sport-icon.js";
import {
  buildMetaLine,
  escapeSvgText,
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

function buildSportPill(sport: string): string {
  const label = formatSportLabel(sport);
  const accent = sportAccentColor(sport);
  const width = Math.max(132, label.length * 13 + 40);

  return `
  <rect x="56" y="52" width="${width}" height="36" rx="18" fill="${accent}" fill-opacity="0.22" stroke="${accent}" stroke-opacity="0.55" stroke-width="1.5"/>
  <text x="72" y="76" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="600" fill="#fafafa">${escapeSvgText(label)}</text>`;
}

/** Foreground text + gradient overlay SVG (1200×630). */
export function buildRegistrationCardOverlaySvg(
  input: RegistrationOgCardInput,
  options?: { hasLogo?: boolean },
): string {
  const hasLogo = options?.hasLogo ?? false;
  const titleLines = wrapTitleLines(input.tournamentName);
  const fontSize = titleFontSize(titleLines.length);
  const lineHeight = fontSize * 1.15;
  const titleBlockHeight = titleLines.length * lineHeight;

  const titleStartY = hasLogo ? 292 : 248;
  const subtitleSize = 24;
  const subtitleGap = 28;
  const metaGap = 26;

  const titleTspans = titleLines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="600" dy="${dy}">${escapeSvgText(line)}</tspan>`;
    })
    .join("");

  const subtitleY = titleStartY + titleBlockHeight + subtitleGap;
  const subtitleWidth = REGISTRATION_OG_SUBTITLE.length * 11 + 56;
  const subtitleX = 600 - subtitleWidth / 2;

  const metaLine = buildMetaLine(input.venue, input.registrationDeadline);
  const metaY = subtitleY + subtitleSize + metaGap + 18;
  const organizer = input.organizerName?.trim();

  const organizerBlock = organizer
    ? `<text x="56" y="584" font-family="Segoe UI, Arial, sans-serif" font-size="18" font-weight="500" fill="#a1a1aa">${escapeSvgText(organizer)}</text>`
    : "";

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="${OG_IMAGE_WIDTH}" height="${OG_IMAGE_HEIGHT}" viewBox="0 0 ${OG_IMAGE_WIDTH} ${OG_IMAGE_HEIGHT}">
  <defs>
    <linearGradient id="cardFade" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#09090b" stop-opacity="0.72"/>
      <stop offset="55%" stop-color="#09090b" stop-opacity="0.84"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0.96"/>
    </linearGradient>
    <linearGradient id="topGlow" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#18181b" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#09090b" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#cardFade)"/>
  <rect width="100%" height="220" fill="url(#topGlow)"/>
  ${buildSportPill(input.sport)}
  <text x="600" y="${titleStartY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${fontSize}" font-weight="700" fill="#fafafa">${titleTspans}</text>
  <rect x="${subtitleX}" y="${subtitleY}" width="${subtitleWidth}" height="38" rx="19" fill="#f59e0b" fill-opacity="0.16" stroke="#fbbf24" stroke-opacity="0.45" stroke-width="1.5"/>
  <text x="600" y="${subtitleY + 26}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="${subtitleSize}" font-weight="600" fill="#fcd34d">${escapeSvgText(REGISTRATION_OG_SUBTITLE)}</text>
  ${metaLine ? `<text x="600" y="${metaY}" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="500" fill="#d4d4d8">${escapeSvgText(metaLine)}</text>` : ""}
  ${organizerBlock}
  <text x="1144" y="572" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="14" font-weight="600" letter-spacing="1.6" fill="#71717a">POWERED BY</text>
  <text x="1144" y="596" text-anchor="end" font-family="Segoe UI, Arial, sans-serif" font-size="20" font-weight="700" fill="#fbbf24">BidWar</text>
  ${buildBadgeRow(input.badges)}
</svg>`;
}
