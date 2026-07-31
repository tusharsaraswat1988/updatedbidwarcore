import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AudioUnlockButton({
  visible,
  onUnlock,
  className,
  /** When Control Center has music Play commanded but browser blocked audio. */
  urgent = false,
  label,
}: {
  visible: boolean;
  onUnlock: () => void;
  className?: string;
  urgent?: boolean;
  label?: string;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onUnlock}
      className={cn(
        "absolute bottom-4 right-4 z-[300] flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[11px] backdrop-blur-sm transition-colors",
        urgent
          ? "border-amber-400/50 bg-amber-500/25 text-amber-50 animate-pulse hover:bg-amber-500/35 min-h-11 px-4 text-xs font-semibold"
          : "border-white/15 bg-black/60 text-white/70 hover:border-white/25 hover:bg-black/75 hover:text-white/90",
        className,
      )}
    >
      <Volume2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {label
        ?? (urgent ? "Tap to start venue music" : "Click to enable audio")}
    </button>
  );
}
