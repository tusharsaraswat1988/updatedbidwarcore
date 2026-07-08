import { getPlayerTagTheme, playerTagBadgeTextColor } from "../lib/player-tag-theme";

export function PlayerTagBadge({
  tagKey,
  size = "sm",
  className = "",
}: {
  tagKey: string;
  size?: "sm" | "md";
  className?: string;
}) {
  const tag = getPlayerTagTheme(tagKey);
  if (!tag) return null;

  const textColor = playerTagBadgeTextColor(tag.color);
  const isMd = size === "md";

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full font-black uppercase tracking-wide ${className}`}
      style={{
        padding: isMd ? "5px 12px" : "3px 9px",
        fontSize: isMd ? 11 : 9,
        letterSpacing: "0.08em",
        backgroundColor: tag.color,
        border: "1.5px solid rgba(255,255,255,0.35)",
        color: textColor,
        boxShadow: `0 0 12px ${tag.glow}, 0 2px 8px rgba(0,0,0,0.45)`,
        textShadow: textColor === "#ffffff" ? "0 1px 2px rgba(0,0,0,0.35)" : undefined,
      }}
    >
      {tag.label}
    </span>
  );
}
