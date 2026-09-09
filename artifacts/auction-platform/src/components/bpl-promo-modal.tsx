import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, ExternalLink } from "lucide-react";

const BPL_POPUP_EXPIRY = new Date("2026-10-15T23:59:59+05:30").getTime();
const BPL_POPUP_DISMISSED_KEY = "bidwar_bpl_promo_popup_dismissed_v1";
const BPL_REGISTRATION_URL = "https://bpl.bidwar.in/";
const BPL_POSTER_SRC = "/assets/events/bpl-2026-poster.jpg";

interface BplPromoModalProps {
  forceOpen?: boolean;
  onClose?: () => void;
}

export function BplPromoModal({ forceOpen, onClose }: BplPromoModalProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (forceOpen !== undefined) {
      setIsOpen(forceOpen);
      return;
    }
    const now = Date.now();
    if (now > BPL_POPUP_EXPIRY) return;

    try {
      const isDismissed = sessionStorage.getItem(BPL_POPUP_DISMISSED_KEY);
      if (!isDismissed) {
        const timer = setTimeout(() => setIsOpen(true), 450);
        return () => clearTimeout(timer);
      }
    } catch {
      setIsOpen(true);
    }
  }, [forceOpen]);

  const handleClose = () => {
    try {
      sessionStorage.setItem(BPL_POPUP_DISMISSED_KEY, "true");
    } catch {
      // ignore
    }
    setIsOpen(false);
    onClose?.();
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
            onClick={handleClose}
            aria-hidden="true"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 15 }}
            transition={{ type: "spring", damping: 26, stiffness: 320 }}
            className="relative z-10 w-full max-w-[440px] sm:max-w-[480px] rounded-2xl border border-amber-500/30 bg-[#090d16] p-2 sm:p-3 shadow-2xl shadow-amber-500/10 flex flex-col items-center"
            role="dialog"
            aria-modal="true"
            aria-label="BidWar Premier League 1st Edition Announcement"
          >
            {/* Close Button Cross */}
            <button
              type="button"
              onClick={handleClose}
              className="absolute -top-3 -right-3 z-30 flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/90 text-white shadow-lg transition-transform hover:scale-110 hover:bg-amber-400 hover:text-black focus:outline-none focus:ring-2 focus:ring-amber-400"
              aria-label="Close popup"
            >
              <X className="h-5 w-5" strokeWidth={2.5} />
            </button>

            {/* Poster Image (Clickable Link) */}
            <a
              href={BPL_REGISTRATION_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative block w-full overflow-hidden rounded-xl border border-white/10 bg-black/40 focus:outline-none focus:ring-2 focus:ring-amber-400"
            >
              <img
                src={BPL_POSTER_SRC}
                alt="BidWar Premier League 1st Edition - Varanasi's First Kids Box Cricket League"
                className="w-full max-h-[72vh] object-contain object-center transition-transform duration-300 group-hover:scale-[1.015]"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100 flex items-end justify-center pb-4 pointer-events-none">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400 px-3.5 py-1.5 text-xs font-bold text-black shadow-lg">
                  Click to Register <ExternalLink className="h-3.5 w-3.5" />
                </span>
              </div>
            </a>

            {/* Bottom Action CTA */}
            <div className="mt-3 flex w-full flex-col sm:flex-row items-center gap-2">
              <a
                href={BPL_REGISTRATION_URL}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleClose}
                className="inline-flex w-full flex-1 items-center justify-center gap-2 rounded-lg border border-amber-400/50 bg-gradient-to-r from-amber-500 to-yellow-500 px-4 py-2.5 text-xs sm:text-sm font-bold uppercase tracking-wider text-black shadow-md shadow-amber-500/20 transition hover:from-amber-400 hover:to-yellow-400 active:scale-[0.98]"
              >
                <span>🏆 Register Your Team</span>
                <ExternalLink className="h-4 w-4" />
              </a>
              <button
                type="button"
                onClick={handleClose}
                className="inline-flex w-full sm:w-auto items-center justify-center rounded-lg border border-white/10 bg-white/5 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:bg-white/10 hover:text-white transition"
              >
                Close ✕
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
