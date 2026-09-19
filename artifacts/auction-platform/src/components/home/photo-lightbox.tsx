import { useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";

export type LightboxItem = {
  src: string;
  title: string;
  description?: string;
  tag?: string;
  location?: string;
  alt?: string;
  isPortrait?: boolean;
};

export type PhotoLightboxProps = {
  isOpen: boolean;
  onClose: () => void;
  items: LightboxItem[];
  currentIndex: number;
  onIndexChange: (nextIndex: number) => void;
};

export function PhotoLightbox({
  isOpen,
  onClose,
  items,
  currentIndex,
  onIndexChange,
}: PhotoLightboxProps) {
  const current = items[currentIndex];

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        onIndexChange((currentIndex - 1 + items.length) % items.length);
      } else if (e.key === "ArrowRight") {
        onIndexChange((currentIndex + 1) % items.length);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = origOverflow;
    };
  }, [isOpen, onClose, currentIndex, items.length, onIndexChange]);

  if (!isOpen || !current) return null;

  const hasMultiple = items.length > 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={current.title}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 md:p-10"
    >
      {/* Dark backdrop */}
      <div
        className="absolute inset-0 bg-black/92 backdrop-blur-lg"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Main container */}
      <div className={`relative flex max-h-[92vh] w-full ${current.isPortrait ? "max-w-2xl" : "max-w-5xl"} flex-col overflow-hidden rounded-2xl border border-white/15 bg-black/85 shadow-2xl transition-all`}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3.5 bg-black/50">
          <div className="flex items-center gap-3">
            {current.tag && (
              <span className="rounded bg-primary/20 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-primary font-bold">
                {current.tag}
              </span>
            )}
            <h3 className="font-display text-base font-bold text-foreground">{current.title}</h3>
            {current.location && (
              <span className="hidden sm:inline-block font-mono text-xs text-muted-foreground">
                · {current.location}
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="font-mono text-xs text-muted-foreground">
              {currentIndex + 1} / {items.length}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close image lightbox"
              className="ghost-button flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-white/10 hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Media Frame */}
        <div className="relative flex min-h-[300px] max-h-[75vh] w-full flex-1 items-center justify-center overflow-hidden bg-black/90 p-2 sm:p-4">
          {current.isPortrait ? (
            /* Realistic Smartphone Mockup Frame in Lightbox - height constrained so it never cuts off */
            <div className="relative my-auto h-[58vh] max-h-[520px] aspect-[9/18.5] rounded-[36px] sm:rounded-[40px] border-4 border-neutral-700 bg-black shadow-[0_25px_60px_rgba(0,0,0,0.95),0_0_35px_rgba(245,158,11,0.25)] ring-1 ring-primary/40 overflow-hidden flex flex-col shrink-0">
              {/* Dynamic Island */}
              <div className="absolute top-2 inset-x-0 z-20 flex justify-center pointer-events-none">
                <div className="h-3.5 w-20 bg-black rounded-full border border-white/10 flex items-center justify-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-neutral-900 border border-neutral-700" />
                  <span className="h-1 w-1 rounded-full bg-blue-900/60" />
                </div>
              </div>

              {/* Mobile Screen Image */}
              <div className="relative flex-1 overflow-hidden bg-neutral-950">
                <img
                  src={current.src}
                  alt={current.alt || current.title}
                  className="h-full w-full object-cover"
                />
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 pointer-events-none" />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent" />
              </div>

              {/* Home indicator bar */}
              <div className="absolute bottom-1.5 inset-x-0 z-20 flex justify-center pointer-events-none">
                <div className="h-1 w-20 bg-white/40 rounded-full" />
              </div>
            </div>
          ) : (
            <img
              src={current.src}
              alt={current.alt || current.title}
              className="max-h-[65vh] w-auto max-w-full rounded-lg object-contain shadow-2xl"
            />
          )}

          {hasMultiple && (
            <>
              <button
                type="button"
                onClick={() => onIndexChange((currentIndex - 1 + items.length) % items.length)}
                aria-label="Previous image"
                className="absolute left-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/90 transition-all hover:scale-110"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={() => onIndexChange((currentIndex + 1) % items.length)}
                aria-label="Next image"
                className="absolute right-3 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white shadow-lg backdrop-blur hover:bg-black/90 transition-all hover:scale-110"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}
        </div>

        {/* Footer / Caption */}
        {current.description && (
          <div className="border-t border-white/10 bg-black/60 px-5 py-3 text-xs text-muted-foreground flex items-center justify-between">
            <p className="max-w-2xl">{current.description}</p>
            <span className="font-mono text-[10px] text-primary uppercase tracking-widest hidden sm:inline-flex items-center gap-1">
              <Maximize2 className="h-3 w-3" /> Real Venue Capture
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
