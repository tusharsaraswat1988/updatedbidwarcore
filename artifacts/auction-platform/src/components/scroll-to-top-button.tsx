import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  HOME_SCROLL_TOP_THRESHOLD,
  isPastScrollThreshold,
  scrollBehavior,
} from "@/lib/home-mobile-chrome";

export function scrollPageToTop() {
  const reduce =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  window.scrollTo({ top: 0, behavior: scrollBehavior(reduce) });
}

export function useScrolledPast(threshold = HOME_SCROLL_TOP_THRESHOLD) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let frame = 0;
    const toggleVisible = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const scrolled = window.scrollY || document.documentElement.scrollTop;
        setVisible((current) => {
          const next = isPastScrollThreshold(scrolled, threshold);
          return current === next ? current : next;
        });
      });
    };

    window.addEventListener("scroll", toggleVisible, { passive: true });
    toggleVisible();
    return () => {
      window.removeEventListener("scroll", toggleVisible);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [threshold]);

  return visible;
}

export function ScrollToTopButton({
  placement = "default",
}: {
  /** Homepage parks this control on the left so it stays clear of the desktop demo pill. */
  placement?: "default" | "desktop-left";
}) {
  const visible = useScrolledPast();

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollPageToTop}
      aria-label="Scroll back to top"
      title="Scroll to top"
      className={cn(
        "bw-scroll-top fixed z-40 flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-black/85 text-primary shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_15px_rgba(245,158,11,0.3)] backdrop-blur-md hover:border-primary hover:bg-primary/20 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        placement === "desktop-left"
          ? "bottom-6 left-6 right-auto max-md:hidden"
          : "bottom-24 right-5 sm:right-6",
      )}
    >
      <ArrowUp className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}
