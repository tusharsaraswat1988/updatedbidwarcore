import { playerTagLabel } from "@workspace/api-base/player-tag-label";

export type PlayerTagTheme = {
  color: string;
  glow: string;
  label: string;
};

const TAG_THEMES: Record<string, PlayerTagTheme> = {
  icon: { color: "#fbbf24", glow: "rgba(251,191,36,0.45)", label: "Icon" },
  star_player: { color: "#a855f7", glow: "rgba(168,85,247,0.45)", label: "Star Player" },
  captain: { color: "#22c55e", glow: "rgba(34,197,94,0.35)", label: "Captain" },
  vice_captain: { color: "#06b6d4", glow: "rgba(6,182,212,0.35)", label: "Vice Captain" },
  booster: { color: "#ef4444", glow: "rgba(239,68,68,0.35)", label: "Booster" },
  owner: { color: "#3b82f6", glow: "rgba(59,130,246,0.35)", label: "Owner" },
  co_owner: { color: "#f97316", glow: "rgba(249,115,22,0.35)", label: "Co-Owner" },
};

export function getPlayerTagTheme(tag: string | null | undefined): PlayerTagTheme | null {
  if (!tag) return null;
  const known = TAG_THEMES[tag];
  if (known) return known;
  const label = playerTagLabel(tag) ?? "Tagged";
  return { color: "#eab308", glow: "rgba(234,179,8,0.35)", label };
}

export function playerTagBadgeTextColor(color: string): string {
  return color === "#fbbf24" ? "#111827" : "#ffffff";
}
