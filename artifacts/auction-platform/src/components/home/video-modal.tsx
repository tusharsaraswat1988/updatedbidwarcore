import { useEffect, useRef } from "react";
import { X, Play, ShieldCheck, Film, Sparkles, MessageCircle, ExternalLink } from "lucide-react";

export type VideoModalProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  youtubeId?: string | null;
  videoUrl?: string | null;
  organizerName?: string;
  tournamentTag?: string;
  comingSoon?: boolean;
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
  comingSoon = true, // Videos are in production currently
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

  // Derive embed source ONLY if there's an actual 11-char YouTube ID and not marked coming soon
  let embedSrc: string | null = null;
  if (!comingSoon) {
    if (youtubeId && youtubeId.length === 11) {
      embedSrc = `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`;
    } else if (videoUrl) {
      const match = videoUrl.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
      if (match?.[1]) {
        embedSrc = `https://www.youtube.com/embed/${match[1]}?autoplay=1&rel=0&modestbranding=1`;
      }
    }
  }

  const whatsappDemoUrl = `https://wa.me/918707488250?text=${encodeURIComponent(
    `Hi BidWar Team, I want to see a live demo of "${title}". Please schedule a quick walkthrough.`
  )}`;

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
      <div className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-primary/30 bg-stage shadow-2xl ring-1 ring-white/10 transition-all">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-white/10 bg-black/50 px-5 py-3.5">
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
            className="ghost-button flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Video Screen / Coming Soon View */}
        <div className="relative aspect-video w-full bg-gradient-to-b from-[#080e22] to-[#040714] flex flex-col items-center justify-center p-6 sm:p-10 text-center overflow-hidden">
          {/* Subtle background glow */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/10 rounded-full blur-3xl pointer-events-none" />

          {embedSrc ? (
            <iframe
              src={embedSrc}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="relative z-10 flex flex-col items-center max-w-lg">
              {/* Coming Soon Pill */}
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3.5 py-1 text-xs font-bold text-amber-300 font-mono tracking-wider mb-4">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                </span>
                VIDEO COMING SOON
              </div>

              {/* Icon */}
              <div className="relative mb-3 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10 text-primary shadow-[0_0_30px_rgba(234,179,8,0.2)]">
                <Film className="h-8 w-8" />
                <Sparkles className="absolute -top-1 -right-1 h-4 w-4 text-amber-300" />
              </div>

              <h4 className="font-display text-xl sm:text-2xl font-bold text-foreground">
                Walkthrough Video In Production
              </h4>
              <p className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
                This dedicated video is being finalized for our channel. In the meantime, you can experience a 1-on-1 live walkthrough with our tournament coordinators.
              </p>

              {/* Action Buttons */}
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <a
                  href={whatsappDemoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 text-xs font-semibold shadow-lg transition-all active:scale-[0.98]"
                >
                  <MessageCircle className="w-4 h-4" />
                  Request Live Walkthrough on WhatsApp
                </a>
                <a
                  href="https://www.youtube.com/@bidwarofficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ghost-button flex items-center gap-2 rounded-lg border border-white/15 px-4 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Visit YouTube Channel
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Bottom strip */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-black/40 px-5 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            <span className="font-mono text-[11px] uppercase tracking-wider">Verified BidWar Broadcast Production</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://wa.me/918707488250?text=Hi%2C%20I%20saw%20your%20tutorial%20video%20and%20want%20to%20schedule%20a%20live%20auction%20setup%20call."
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-[11px] uppercase font-mono tracking-wider font-semibold"
            >
              Ask a Producer on WhatsApp (+91-8707488250) &rarr;
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
