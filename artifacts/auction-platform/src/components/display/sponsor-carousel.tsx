import { memo, useEffect, useState } from "react";
import { cldUrl } from "@/lib/cloudinary";
import type { SponsorLogo } from "@/lib/sponsor-logo";

/**
 * Rotating sponsor logo carousel — top-right of LED display.
 * Sized for venue visibility with high-contrast backing panel.
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
    <div className={`flex flex-col items-end flex-shrink-0 ${compact ? "gap-0.5" : "gap-2"}`}>
      {!compact && current.type?.trim() && (
        <p className="text-xs md:text-sm font-bold uppercase tracking-[0.2em] text-white/75 text-right">
          {current.type}
        </p>
      )}
      <div
        className={`flex items-center justify-end transition-opacity duration-300 rounded-xl ${compact ? "" : "px-3 py-2 md:px-4 md:py-3 bg-black/55 border border-white/12"}`}
        style={{ opacity: visible ? 1 : 0, minWidth: compact ? 72 : 220 }}
      >
        <img
          key={current.url}
          src={cldUrl(current.url, "teamLogo")}
          alt={label}
          className={compact ? "h-9 max-w-[88px] object-contain" : "h-20 md:h-28 lg:h-32 max-w-[min(28vw,420px)] object-contain"}
          style={{ filter: "brightness(1.35) contrast(1.1) drop-shadow(0 0 16px rgba(255,255,255,0.35))" }}
          loading="eager"
          decoding="async"
          onError={e => (e.currentTarget.style.display = "none")}
        />
      </div>
      {!compact && current.name?.trim() && (
        <p className="text-base md:text-lg lg:text-xl font-bold uppercase tracking-[0.12em] text-white text-right max-w-[min(28vw,420px)] truncate">
          {current.name}
        </p>
      )}
      {!compact && logos.length > 1 && (
        <div className="flex gap-1.5 justify-end">
          {logos.map((_, i) => (
            <div
              key={i}
              className="w-2 h-2 rounded-full transition-all duration-300"
              style={{ backgroundColor: i === idx ? "#eab308" : "#ffffff35" }}
            />
          ))}
        </div>
      )}
    </div>
  );
});
