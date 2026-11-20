import React, { useState, useEffect, useCallback } from "react";

export interface BrandLogoImageProps {
  theme?: "dark" | "light";
  src?: string | null;
  alt?: string;
  className?: string;
  height?: number;
  width?: number;
  loading?: "eager" | "lazy";
}

const BASE = import.meta.env.BASE_URL || "/";
const prefix = BASE.endsWith("/") ? BASE : `${BASE}/`;
const OFFICIAL_FALLBACK_DARK = `${prefix}assets/branding/bidwar-reverse-logo-official.png`;
const OFFICIAL_FALLBACK_LIGHT = `${prefix}assets/branding/bidwar-primary-logo-official.png`;

function resolveBrandSrc(rawSrc: string | null | undefined, fallback: string): string {
  if (!rawSrc || rawSrc.startsWith("data:image/svg+xml")) return fallback;
  if (rawSrc.startsWith("/assets/")) {
    return `${prefix}${rawSrc.slice(1)}`;
  }
  return rawSrc;
}

export function BrandLogoImage({
  theme = "dark",
  src,
  alt = "BidWar",
  className = "h-7 sm:h-8 w-auto object-contain",
  loading = "eager",
}: BrandLogoImageProps) {
  const defaultFallback = theme === "dark" ? OFFICIAL_FALLBACK_DARK : OFFICIAL_FALLBACK_LIGHT;
  const initialSrc = resolveBrandSrc(src, defaultFallback);

  const [currentSrc, setCurrentSrc] = useState<string>(initialSrc);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const candidate = resolveBrandSrc(src, defaultFallback);
    setCurrentSrc(candidate);
    setFailed(false);
  }, [src, defaultFallback]);

  const handleError = useCallback(() => {
    if (currentSrc !== defaultFallback) {
      setCurrentSrc(defaultFallback);
    } else {
      setFailed(true);
    }
  }, [currentSrc, defaultFallback]);

  if (failed) {
    return (
      <div className="flex items-center gap-1 font-display font-black text-lg sm:text-xl tracking-tight text-amber-500">
        <span>BID</span>
        <span className={theme === "dark" ? "text-white" : "text-slate-900"}>WAR</span>
      </div>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      loading={loading}
      decoding="async"
      onError={handleError}
    />
  );
}

export default BrandLogoImage;
