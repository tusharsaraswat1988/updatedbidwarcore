import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisible = () => {
      const scrolled = document.documentElement.scrollTop || window.scrollY;
      setVisible(scrolled > 350);
    };

    window.addEventListener("scroll", toggleVisible, { passive: true });
    toggleVisible();
    return () => window.removeEventListener("scroll", toggleVisible);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Scroll back to top"
      title="Scroll to top"
      className="fixed bottom-24 right-5 sm:right-6 z-40 flex h-11 w-11 items-center justify-center rounded-full border border-primary/50 bg-black/85 text-primary shadow-[0_10px_30px_rgba(0,0,0,0.8),0_0_15px_rgba(245,158,11,0.3)] backdrop-blur-md transition-all duration-300 hover:scale-110 hover:border-primary hover:bg-primary/20 hover:text-white focus:outline-none focus:ring-2 focus:ring-primary/50 group animate-in fade-in zoom-in-75 duration-200"
    >
      <ArrowUp className="h-5 w-5 transition-transform duration-200 group-hover:-translate-y-0.5" />
    </button>
  );
}
