import { Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function AudioUnlockButton({
  visible,
  onUnlock,
  className,
}: {
  visible: boolean;
  onUnlock: () => void;
  className?: string;
}) {
  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={onUnlock}
      className={cn(
        "absolute bottom-4 right-4 z-[300] flex items-center gap-1.5 rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-[11px] text-white/70 backdrop-blur-sm transition-colors hover:border-white/25 hover:bg-black/75 hover:text-white/90",
        className,
      )}
    >
      <Volume2 className="h-3 w-3 shrink-0" aria-hidden />
      Click to enable audio
    </button>
  );
}
