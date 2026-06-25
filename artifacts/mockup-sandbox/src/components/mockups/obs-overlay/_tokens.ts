/** Shared tokens for OBS overlay visual mockups (audit P0–P4 direction). */

export const BW = 1920;
export const BH = 1080;

export const YELLOW = "#FFC400";
export const YELLOW_MUTED = "rgba(255, 196, 0, 0.75)";
export const YELLOW_SOFT = "rgba(255, 196, 0, 0.12)";
export const YELLOW_BORDER = "rgba(255, 196, 0, 0.4)";

export const FONTS = {
  body: "'Barlow Condensed', 'Inter', system-ui, sans-serif",
  display: "'Bebas Neue', 'Barlow Condensed', sans-serif",
  mono: "'JetBrains Mono', ui-monospace, monospace",
  current: "'Inter', 'Segoe UI', Arial, sans-serif",
} as const;

export const SAMPLE = {
  player: "VIRAT KOHLI",
  role: "Batsman",
  city: "Delhi",
  base: "₹2,00,00,000",
  bid: "₹8,75,00,000",
  team: "Mumbai Warriors",
  teamColor: "#3b82f6",
  tag: "PLATINUM",
  tournament: "Premier League Mega Auction 2026",
  timer: 12,
} as const;

export const TEAMS = [
  { name: "Mumbai Warriors", taken: 8, due: 4, color: "#3b82f6" },
  { name: "Delhi Strikers", taken: 6, due: 6, color: "#ef4444" },
  { name: "Chennai Kings", taken: 9, due: 3, color: "#fbbf24" },
  { name: "Royal Challengers", taken: 5, due: 7, color: "#8b5cf6" },
] as const;

export const SPONSORS = ["Dream11", "Jio", "CEAT", "Tata"] as const;
