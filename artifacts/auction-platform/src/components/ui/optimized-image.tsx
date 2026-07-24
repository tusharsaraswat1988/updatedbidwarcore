import { useState } from "react";
import { cldUrl, cldSrcSet, type CldPreset } from "@/lib/cloudinary";

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
  /** Responsive hint for the browser when srcSet is present. */
  sizes?: string;
  /**
   * Only the LCP / hero image should use `"high"`. Default `"auto"`.
   * Ignored when `lazy` is true (browsers deprioritize lazy images).
   */
  fetchPriority?: "high" | "low" | "auto";
  draggable?: boolean;
  onError?: () => void;
};

/**
 * Optimized image component.
 *
 * Wraps <img> with:
 *  - Cloudinary URL transformation (WebP/AVIF via f_auto, auto quality, resized)
 *  - Responsive srcSet for Cloudinary URLs
 *  - Lazy loading by default (loading="lazy" + decoding="async")
 *  - fetchpriority only when eagerly loaded (hero / LCP)
 *  - Graceful error state — shows `fallback` instead of a broken icon
 *
 * Safe on any URL: cldUrl() / cldSrcSet() pass non-Cloudinary URLs through.
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
  sizes = "(max-width: 768px) 100vw, 80vw",
  fetchPriority = "auto",
  draggable,
  onError,
}: Props) {
  const [errored, setErrored] = useState(false);

  if (!src || errored) {
    return fallback ? <>{fallback}</> : null;
  }

  const url = preset ? cldUrl(src, preset) : src;
  const srcSet = cldSrcSet(src);
  const priority = lazy ? undefined : fetchPriority === "auto" ? undefined : fetchPriority;

  return (
    <img
      src={url}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      className={className}
      style={style}
      width={width}
      height={height}
      loading={lazy ? "lazy" : "eager"}
      decoding="async"
      fetchPriority={priority}
      draggable={draggable}
      onError={() => {
        setErrored(true);
        onError?.();
      }}
    />
  );
}
