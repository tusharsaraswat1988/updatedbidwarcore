import { useCallback, useEffect, useState } from "react";
import { BRAND_LOGO_FALLBACK_TEXT } from "@/lib/brand-assets";

type BrandLogoImageProps = {
  src: string;
  alt: string;
  className?: string;
  width: number;
  height: number;
  loading?: "eager" | "lazy";
  fallbackText?: string;
};

export function BrandLogoImage({
  src,
  alt,
  className,
  width,
  height,
  loading = "eager",
  fallbackText = BRAND_LOGO_FALLBACK_TEXT,
}: BrandLogoImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setCurrentSrc(src);
    setFailed(false);
  }, [src]);

  const onError = useCallback(() => {
    setFailed(true);
  }, []);

  if (failed) {
    return (
      <span
        className={className}
        role="img"
        aria-label={alt}
        style={{ width, height, lineHeight: `${height}px` }}
      >
        {fallbackText}
      </span>
    );
  }

  return (
    <img
      src={currentSrc}
      alt={alt}
      className={className}
      width={width}
      height={height}
      loading={loading}
      decoding="async"
      onError={onError}
    />
  );
}
