import { useState } from "react";
import { cldUrl, type CldPreset } from "@/lib/cloudinary";

type Props = {
  src: string | null | undefined;
  alt: string;
  /** Cloudinary transformation preset. Omit to use the URL as-is. */
  preset?: CldPreset;
  className?: string;
  style?: React.CSSProperties;
  /**
   * When true (default) the image loads lazily — ideal for list views.
   * Set to false for above-fold / immediately-visible images.
   */
  lazy?: boolean;
  /**
   * Rendered when src is absent or the image fails to load.
   * If omitted the component renders nothing on error.
   */
  fallback?: React.ReactNode;
  width?: number;
  height?: number;
  draggable?: boolean;
  onError?: () => void;
};

/**
 * Optimized image component.
 *
 * Wraps <img> with:
 *  - Cloudinary URL transformation (WebP, auto quality, resized)
 *  - Lazy loading by default (loading="lazy" + decoding="async")
 *  - Graceful error state — shows `fallback` instead of a broken icon
 *
 * Safe on any URL: cldUrl() passes non-Cloudinary URLs through unchanged.
 */
export function OptimizedImage({
  src,
  alt,
  preset,
  className,
  style,
  lazy = true,
  fallback = null,
  width,
  height,
  draggable,
  onError,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return fallback ? <>{fallback}</> : null;
  }

  const url = preset ? cldUrl(src, preset) : src;

  return (
    <img
      src={url}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      draggable={draggable}
      onError={() => {
        setErrored(true);
        onError?.();
      }}
    />
  );
}
