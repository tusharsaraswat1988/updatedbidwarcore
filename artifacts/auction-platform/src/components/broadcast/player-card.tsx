import { memo, useEffect } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";
import { BROADCAST_TYPO, BROADCAST_FONTS } from "./tokens";

type PlayerCardProps = {
  name: string;
  photoUrl?: string | null;
  category?: string | null;
  city?: string | null;
  basePrice?: number;
  playerTag?: string | null;
  accentColor: string;
  formatAmount: (n: number) => string;
  size?: "hero" | "compact";
  preload?: boolean;
  obsMode?: boolean;
};

export const PlayerCard = memo(function PlayerCard({
  name,
  photoUrl,
  category,
  city,
  basePrice,
  playerTag,
  accentColor,
  formatAmount,
  size = "hero",
  preload = false,
  obsMode = false,
}: PlayerCardProps) {
  const isHero = size === "hero";
  const photoSize = isHero ? 420 : 200;
  const tag = getTagTheme(playerTag);
  const glowColor = tag?.color ?? accentColor;

  useEffect(() => {
    if (!preload || !photoUrl) return;
    const img = new Image();
    img.src = cldUrl(photoUrl, "playerCard");
  }, [preload, photoUrl]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isHero ? "column" : "row",
        alignItems: isHero ? "center" : "flex-start",
        gap: isHero ? 20 : 16,
      }}
    >
      <div
        style={{
          position: "relative",
          width: photoSize,
          height: isHero ? photoSize * 1.12 : photoSize,
          flexShrink: 0,
        }}
      >
        {!obsMode && (
          <div
            style={{
              position: "absolute",
              inset: -6,
              borderRadius: 12,
              background: glowColor,
              filter: "blur(12px)",
              opacity: 0.5,
            }}
          />
        )}
        <div
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: 12,
            overflow: "hidden",
            border: `3px solid ${glowColor}`,
            boxShadow: obsMode ? undefined : `0 0 32px ${glowColor}55`,
            background: "#111",
          }}
        >
          {photoUrl ? (
            <img
              src={cldUrl(photoUrl, isHero ? "playerCard" : "soldCard")}
              alt=""
              loading="eager"
              decoding="sync"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <div
              style={{
                width: "100%",
                height: "100%",
                display: "grid",
                placeItems: "center",
                fontSize: photoSize * 0.3,
                fontWeight: 900,
                color: accentColor,
              }}
            >
              ?
            </div>
          )}
        </div>
      </div>

      <div style={{ textAlign: isHero ? "center" : "left", minWidth: 0 }}>
        {tag && (
          <div
            style={{
              display: "inline-flex",
              marginBottom: 8,
              padding: "4px 12px",
              borderRadius: 999,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              background: tag.bg,
              border: `1.5px solid ${tag.border}`,
              color: tag.color,
              animation: TAG_PULSE_ANIMATION,
            }}
          >
            {tag.label}
          </div>
        )}
        <div
          style={{
            fontFamily: BROADCAST_FONTS.display,
            fontSize: isHero ? BROADCAST_TYPO.playerName : 36,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            textShadow: obsMode ? undefined : "0 4px 24px rgba(0,0,0,0.8)",
          }}
        >
          {name}
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: BROADCAST_FONTS.body,
            fontSize: BROADCAST_TYPO.meta,
            color: "rgba(255,255,255,0.75)",
            display: "flex",
            gap: 12,
            justifyContent: isHero ? "center" : "flex-start",
            flexWrap: "wrap",
          }}
        >
          {category && <span>{category}</span>}
          {city && <span style={{ opacity: 0.65 }}>· {city}</span>}
        </div>
        {basePrice != null && (
          <div
            style={{
              marginTop: 14,
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
            }}
          >
            <span
              style={{
                fontSize: BROADCAST_TYPO.label,
                fontWeight: 700,
                letterSpacing: "0.2em",
                color: accentColor,
              }}
            >
              BASE
            </span>
            <span
              style={{
                fontFamily: BROADCAST_FONTS.mono,
                fontSize: 18,
                fontWeight: 800,
                fontVariantNumeric: "tabular-nums",
                color: "#fff",
              }}
            >
              {formatAmount(basePrice)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
});
