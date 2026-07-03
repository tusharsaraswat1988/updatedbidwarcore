import { memo, useState } from "react";
import { Play } from "lucide-react";

interface YoutubePlayerProps {
  videoId: string;
  title: string;
  thumbnailUrl?: string | null;
}

const YT_THUMB = (id: string) => `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
const YT_THUMB_FALLBACK = (id: string) => `https://img.youtube.com/vi/${id}/mqdefault.jpg`;

/** Loads YouTube iframe only after user clicks — no autoplay on page load. */
export const YoutubePlayer = memo(function YoutubePlayer({
  videoId,
  title,
  thumbnailUrl,
}: YoutubePlayerProps) {
  const [active, setActive] = useState(false);
  const [thumbSrc, setThumbSrc] = useState(thumbnailUrl ?? YT_THUMB(videoId));

  return (
    <div className="relative w-full overflow-hidden rounded-xl border border-border bg-black aspect-video">
      {active ? (
        <iframe
          title={title}
          src={`https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0`}
          className="absolute inset-0 h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          onClick={() => setActive(true)}
          className="group absolute inset-0 block h-full w-full text-left"
          aria-label={`Play video: ${title}`}
        >
          <img
            src={thumbSrc}
            alt={title}
            width={1280}
            height={720}
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            fetchPriority="high"
            onError={() => {
              if (thumbSrc !== YT_THUMB_FALLBACK(videoId)) {
                setThumbSrc(YT_THUMB_FALLBACK(videoId));
              }
            }}
          />
          <div className="absolute inset-0 flex items-center justify-center bg-black/30 transition-colors group-hover:bg-black/40">
            <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform group-hover:scale-110 group-active:scale-95 animate-[pulse_2.5s_ease-in-out_infinite]">
              <Play className="h-7 w-7 ml-1" fill="currentColor" />
            </span>
          </div>
        </button>
      )}
    </div>
  );
});
