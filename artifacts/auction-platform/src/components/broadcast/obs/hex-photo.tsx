import { memo } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { getTagTheme, TAG_PULSE_ANIMATION } from "@/lib/tag-theme";

type HexPhotoProps = {
  src?: string | null;
  color: string;
  size?: number;
  playerTag?: string | null;
};

export const HexPhoto = memo(function HexPhoto({
  src,
  color,
  size = 180,
  playerTag,
}: HexPhotoProps) {
  const hex = "polygon(50% 0%, 93% 25%, 93% 75%, 50% 100%, 7% 75%, 7% 25%)";
  const tag = getTagTheme(playerTag);
  const glowColor = tag?.color ?? color;

  return (
    <div style={{ position: "relative", width: size, height: size * 1.08, flexShrink: 0 }}>
      <div
        style={{
          position: "absolute",
          inset: -3,
          clipPath: hex,
          background: glowColor,
          filter: "blur(8px)",
          opacity: tag ? 0.75 : 0.6,
          animation: tag ? TAG_PULSE_ANIMATION : undefined,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: -2,
          clipPath: hex,
          background: glowColor,
          opacity: 0.9,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 3,
          clipPath: hex,
          background: `${color}22`,
          overflow: "hidden",
        }}
      >
        {src ? (
          <img
            src={cldUrl(src, size > 120 ? "soldCard" : "avatar")}
            alt=""
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <div
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: size * 0.35,
              color,
              fontWeight: 900,
              background: `linear-gradient(135deg, #0d0d0d 0%, ${color}18 100%)`,
            }}
          >
            ?
          </div>
        )}
      </div>
    </div>
  );
});
