import { Maximize2, Minimize2 } from "lucide-react";
import { useFullscreen } from "@/hooks/use-fullscreen";

type FullscreenButtonProps = {
  className?: string;
  size?: "sm" | "md";
};

export function FullscreenButton({ className, size = "md" }: FullscreenButtonProps) {
  const { isFullscreen, toggle } = useFullscreen();
  const iconClass = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      className={
        className ??
        "p-2 sm:p-2.5 rounded-xl border border-white/12 text-white/60 hover:text-white hover:bg-white/8 transition-colors"
      }
      title={isFullscreen ? "Exit fullscreen (Esc)" : "Fullscreen"}
      aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
    >
      {isFullscreen ? <Minimize2 className={iconClass} /> : <Maximize2 className={iconClass} />}
    </button>
  );
}
