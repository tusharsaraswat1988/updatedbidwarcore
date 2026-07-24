import { Play } from "lucide-react";
import { OptimizedImage } from "@/components/ui/optimized-image";
import {
  ASPECT_RATIO_CLASS,
  type HomepageMediaAsset,
} from "@/data/homepage-content";
import { cn } from "@/lib/utils";

const PLACEHOLDER = (
  <div className="absolute inset-0 bg-gradient-to-br from-primary/15 via-card to-background" aria-hidden />
);

type HomepageMediaProps = {
  media: HomepageMediaAsset;
  className?: string;
  /** Override aspect when size maps to a different ratio (gallery masonry). */
  aspectClassName?: string;
  showPlayButton?: boolean;
  playLabel?: string;
  analyticsId?: string;
  duration?: string;
  badge?: string;
  /** Prefer fullImage when available, else thumbnail. */
  preferFull?: boolean;
  hoverZoom?: boolean;
  /** Visual-only play control when the parent element is already a link. */
  decorativePlay?: boolean;
  /** Only for above-the-fold / LCP media. */
  priority?: boolean;
  sizes?: string;
};

/**
 * CLS-safe screenshot / video frame. Always reserves height via aspect-ratio.
 * Drop in Phase 2 assets by filling `thumbnail` / `fullImage` / `videoUrl`
 * on the data object — layout does not change.
 */
export function HomepageMedia({
  media,
  className,
  aspectClassName,
  showPlayButton = false,
  playLabel,
  analyticsId,
  duration,
  badge,
  preferFull = false,
  hoverZoom = false,
  decorativePlay = false,
  priority = false,
  sizes,
}: HomepageMediaProps) {
  const src = preferFull
    ? (media.fullImage ?? media.thumbnail)
    : (media.thumbnail ?? media.fullImage);
  const aspect = aspectClassName ?? ASPECT_RATIO_CLASS[media.aspectRatio] ?? "aspect-video";
  const hasVideo = Boolean(media.videoUrl);
  const playClass =
    "flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground";

  return (
    <figure className={cn("relative overflow-hidden rounded-xl border border-border bg-card/30", aspect, className)}>
      <OptimizedImage
        src={src}
        alt={media.alt}
        preset="marketing"
        lazy={!priority}
        fetchPriority={priority ? "high" : "auto"}
        sizes={sizes}
        className={cn(
          "absolute inset-0 h-full w-full object-cover",
          hoverZoom && "transition-transform duration-300 group-hover:scale-[1.03]",
        )}
        fallback={PLACEHOLDER}
      />
      {badge ? (
        <span className="absolute left-2 top-2 rounded-sm bg-background/70 px-1.5 py-0.5 text-[9px] font-mono uppercase tracking-widest text-primary">
          {badge}
        </span>
      ) : null}
      {duration ? (
        <span className="absolute right-2 top-2 rounded-sm bg-background/70 px-1.5 py-0.5 text-[9px] font-mono text-foreground">
          {duration}
        </span>
      ) : null}
      {showPlayButton ? (
        <div className="absolute inset-0 flex items-center justify-center">
          {decorativePlay ? (
            <span className={cn(playClass, !hasVideo && "opacity-70")} aria-hidden>
              <Play className="w-5 h-5 fill-current" />
            </span>
          ) : hasVideo ? (
            <a
              href={media.videoUrl!}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={playLabel ?? `Play ${media.caption}`}
              data-analytics={analyticsId}
              className={cn(playClass, "transition-opacity hover:opacity-90")}
            >
              <Play className="w-5 h-5 fill-current" aria-hidden />
            </a>
          ) : (
            <button
              type="button"
              disabled
              aria-label={playLabel ?? `${media.caption} — coming soon`}
              data-analytics={analyticsId}
              className={cn(playClass, "opacity-70")}
            >
              <Play className="w-5 h-5 fill-current" aria-hidden />
            </button>
          )}
        </div>
      ) : null}
      {media.caption ? (
        <figcaption className="sr-only">{media.caption}</figcaption>
      ) : null}
    </figure>
  );
}
