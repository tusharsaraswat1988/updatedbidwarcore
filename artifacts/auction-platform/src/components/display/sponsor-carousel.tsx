import { memo, useEffect, useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import type { SponsorLogo } from "@/lib/sponsor-logo";

/**
 * Rotating sponsor logo carousel — top-right corner of LED display.
 *
 * Render isolation: owns its own rotation interval (2s). Only rerenders
 * when `idx`/`visible` change or `logos` prop identity changes. Parent
 * rerenders during bid/timer ticks do NOT cause this component to rerun
 * — it is React.memo'd and the parent passes a useMemo'd logos array.
 */
export const SponsorCarousel = memo(function SponsorCarousel({
  logos,
  compact = false,
}: {
  logos: SponsorLogo[];
  /** Smaller variant for live viewer header / mobile. */
  compact?: boolean;
}) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (logos.length <= 1) return;
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx(i => (i + 1) % logos.length);
        setVisible(true);
      }, 350);
    }, 2000);
    return () => clearInterval(id);
  }, [logos.length]);

  if (!logos.length) return null;
  const current = logos[idx];

  const label = current.name?.trim() || current.type?.trim() || "Sponsor";

  return (
    <div className={`flex flex-col items-end flex-shrink-0 ${compact ? "gap-0.5" : "gap-1.5"}`}>
      {!compact && current.type?.trim() && (
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/60 text-right">
          {current.type}
        </p>
      )}
      <div
        className="flex items-center justify-end transition-opacity duration-300"
        style={{ opacity: visible ? 1 : 0, minWidth: compact ? 72 : 180 }}
      >
        <img
          key={current.url}
          src={cldUrl(current.url, "teamLogo")}
          alt={label}
          className={compact ? "h-9 max-w-[88px] object-contain" : "h-24 max-w-[330px] object-contain"}
          style={{ filter: "brightness(1.25) drop-shadow(0 0 12px rgba(255,255,255,0.25))" }}
          loading="eager"
          decoding="async"
          onError={e => (e.currentTarget.style.display = "none")}
        />
      </div>
      {!compact && current.name?.trim() && (
        <p className="text-sm font-bold uppercase tracking-[0.15em] text-white/90 text-right">
          {current.name}
        </p>
      )}
      {!compact && logos.length > 1 && (
        <div className="flex gap-1 justify-end">
          {logos.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all duration-300"
              style={{ backgroundColor: i === idx ? "#eab308" : "#ffffff30" }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
