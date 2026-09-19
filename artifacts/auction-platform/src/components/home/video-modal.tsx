import { useEffect, useRef } from "react";
import { X, Play, Volume2, ShieldCheck } from "lucide-react";

export type VideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  youtubeId?: string | null;
  videoUrl?: string | null;
  organizerName?: string;
  tournamentTag?: string;
};

export function VideoModal({
  isOpen,
  onClose,
  title,
  subtitle,
  youtubeId,
  videoUrl,
  organizerName,
  tournamentTag,
}: VideoModalProps) {
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    closeBtnRef.current?.focus();

    // Prevent body scroll
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Derive embed source
  let embedSrc: string | null = null;
  if (youtubeId) {
    embedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
  } else if (videoUrl) {
    if (videoUrl.includes("youtube.com") || videoUrl.includes("youtu.be")) {
      const match = videoUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) {
        embedSrc = `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`;
      } else {
        embedSrc = videoUrl;
      }
    } else {
      embedSrc = videoUrl;
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 md:p-10"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/85 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-4xl overflow-hidden rounded-2xl border border-primary/30 bg-stage shadow-2xl ring-1 ring-white/10 transition-all">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/40 px-5 py-3.5">
          <div className="flex items-center gap-3 truncate pr-4">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary">
              <Play className="h-3.5 w-3.5 fill-current" />
            </div>
            <div className="truncate">
              <h3 id="video-modal-title" className="font-display text-base font-bold text-foreground truncate">
                {title}
              </h3>
              {(subtitle || organizerName || tournamentTag) && (
                <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground truncate">
                  {tournamentTag && <span className="text-primary mr-2 font-bold">[{tournamentTag}]</span>}
                  {organizerName && <span className="mr-2">By {organizerName}</span>}
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            aria-label="Close video player"
            className="ghost-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video Screen */}
        <div className="relative aspect-video w-full bg-black">
          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary mb-4">
                <Volume2 className="h-8 w-8" />
              </div>
              <h4 className="font-display text-lg text-foreground">Video Stream Ready</h4>
              <p className="mt-2 max-w-md text-xs text-muted-foreground">
                This walkthrough is available directly on our official YouTube channel or during a live producer demo.
              </p>
              <a
                href="https://www.youtube.com/@bidwarofficial"
                target="_blank"
                rel="noopener noreferrer"
                className="gold-button gold-button-hover mt-5 rounded-md px-5 py-2.5 text-xs font-semibold"
              >
                Watch on YouTube @bidwarofficial →
              </a>
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/30 px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Verified BidWar Broadcast Tape</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/918707488250?text=Hi%2C%20I%20saw%20your%20tutorial%20video%20and%20want%20to%20schedule%20a%20live%20auction%20setup%20call."
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-[11px] uppercase font-mono tracking-wider"
            >
              Ask a Producer on WhatsApp (+91-8707488250) →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
