import type { TagTheme } from "@/lib/tag-theme";
import { getTagTheme, TAG_PULSE_ANIMATION, TAG_PULSE_KEYFRAMES } from "@/lib/tag-theme";

export function resolvePortraitPlayerTag(playerTag: string | null | undefined): TagTheme | null {
  return getTagTheme(playerTag);
}

export function portraitTagFrameStyle(tag: TagTheme | null): {
  borderColor: string;
  boxShadow: string;
} {
  if (!tag) {
    return {
      borderColor: "rgba(255,255,255,0.10)",
      boxShadow: "none",
    };
  }
  return {
    borderColor: tag.color,
    boxShadow: `0 0 18px ${tag.glow}, 0 0 42px ${tag.glow}, inset 0 0 36px ${tag.bg}`,
  };
}

function portraitTagBadgeTextColor(tag: TagTheme): string {
  // Yellow icon tag needs dark text; everything else reads best as white on a solid fill.
  return tag.color === "#fbbf24" ? "#111827" : "#ffffff";
}

export function PortraitPlayerTagBadge({
  tag,
  className = "",
  fontSize = "clamp(10px, 2.8cqw, 13px)",
}: {
  tag: TagTheme;
  className?: string;
  fontSize?: string;
}) {
  const textColor = portraitTagBadgeTextColor(tag);

  return (
    <>
      <style>{TAG_PULSE_KEYFRAMES}</style>
      <span
        className={`inline-flex items-center whitespace-nowrap ${className}`}
        style={{
          padding: "5px 12px",
          borderRadius: 999,
          fontSize,
          fontWeight: 900,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          backgroundColor: tag.color,
          border: `2px solid rgba(255,255,255,0.35)`,
          color: textColor,
          boxShadow: `0 0 16px ${tag.glow}, 0 0 32px ${tag.glow}, 0 4px 14px rgba(0,0,0,0.55)`,
          textShadow:
            textColor === "#ffffff"
              ? "0 1px 2px rgba(0,0,0,0.45)"
              : "0 1px 0 rgba(255,255,255,0.25)",
          animation: TAG_PULSE_ANIMATION,
        }}
      >
        {tag.label}
      </span>
    </>
  );
}

export function PortraitPlayerTagGlow({ tag }: { tag: TagTheme }) {
  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{
        boxShadow: `inset 0 0 48px ${tag.glow}, inset 0 -24px 64px ${tag.bg}`,
        border: `1px solid ${tag.border}`,
      }}
      aria-hidden
    />
  );
}
