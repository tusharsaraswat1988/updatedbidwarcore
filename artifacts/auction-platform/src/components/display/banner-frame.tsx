import type { CSSProperties } from "react";
import { cldUrl } from "@/lib/cloudinary";

/** Matches BannerOverlay / LED display rendering. */
export function bannerImageStyle(fit: string | null | undefined): CSSProperties {
  const isCover = !fit || fit === "cover";
  return {
    objectFit: isCover ? "cover" : "contain",
    objectPosition: "center",
  };
}

type BannerFrameProps = {
  url: string | null | undefined;
  fit?: string | null;
  className?: string;
  emptyLabel?: string;
  /** When true, skip Cloudinary transform (editor source preview). */
  raw?: boolean;
};

/**
 * 16:9 frame — same aspect and object-fit rules as the full-screen LED banner.
 */
export function BannerFrame({
  url,
  fit,
  className = "",
  emptyLabel = "No banner uploaded",
  raw = false,
}: BannerFrameProps) {
  const src = url ? (raw ? url : cldUrl(url, "banner")) : "";

  return (
    <div className={`relative overflow-hidden bg-black aspect-video ${className}`}>
      {src ? (
        <img
          src={src}
          alt="Banner preview"
          className="absolute inset-0 w-full h-full"
          style={bannerImageStyle(fit)}
          draggable={false}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center px-4 text-center text-xs text-white/30 select-none">
          {emptyLabel}
        </div>
      )}
    </div>
  );
}
