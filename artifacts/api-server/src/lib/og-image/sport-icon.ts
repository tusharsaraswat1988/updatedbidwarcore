import { escapeSvgText } from "./text-layout.js";

const SPORT_LABELS: Record<string, string> = {
  cricket: "Cricket",
  badminton: "Badminton",
  football: "Football",
  kabaddi: "Kabaddi",
  basketball: "Basketball",
  volleyball: "Volleyball",
  esports: "Esports",
  tennis: "Tennis",
  hockey: "Hockey",
};

const SPORT_ACCENTS: Record<string, string> = {
  cricket: "#22c55e",
  badminton: "#f59e0b",
  football: "#3b82f6",
  kabaddi: "#ef4444",
  basketball: "#f97316",
  volleyball: "#a855f7",
  esports: "#06b6d4",
  tennis: "#84cc16",
  hockey: "#14b8a6",
};

export function formatSportLabel(sport: string): string {
  const key = sport.trim().toLowerCase();
  if (SPORT_LABELS[key]) return SPORT_LABELS[key];
  const trimmed = sport.trim();
  if (!trimmed) return "Sports";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export function sportAccentColor(sport: string): string {
  return SPORT_ACCENTS[sport.trim().toLowerCase()] ?? "#f59e0b";
}

/** Compact sport badge SVG for top-left corner. */
export function buildSportBadgeSvg(sport: string): string {
  const label = formatSportLabel(sport);
  const accent = sportAccentColor(sport);
  const short = escapeSvgText(label.slice(0, 3).toUpperCase());
  const safeLabel = escapeSvgText(label);

  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <g transform="translate(48, 48)">
    <rect x="0" y="0" width="72" height="72" rx="18" fill="${accent}" opacity="0.92"/>
    <text x="36" y="44" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif" font-size="22" font-weight="700" fill="#ffffff">${short}</text>
    <text x="92" y="44" font-family="Segoe UI, Arial, sans-serif" font-size="24" font-weight="600" fill="#f4f4f5">${safeLabel}</text>
  </g>
</svg>`;
}
