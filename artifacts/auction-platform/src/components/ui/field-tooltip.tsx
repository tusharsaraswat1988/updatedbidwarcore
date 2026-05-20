import { useState, useRef, useEffect } from "react";
import { Info } from "lucide-react";

/**
 * Reusable ⓘ info icon with a floating tooltip.
 * Click or hover to reveal. Closes on outside click.
 */
export function FieldTooltip({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [open]);

  return (
    <span ref={ref} className="relative inline-flex items-center">
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setOpen(v => !v)}
        className="text-muted-foreground hover:text-foreground transition-colors ml-1 flex-shrink-0"
        aria-label="More information"
      >
        <Info className="w-3.5 h-3.5" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-56 px-3 py-2 rounded-lg bg-popover border border-border text-xs text-popover-foreground shadow-xl leading-relaxed pointer-events-none">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" style={{ marginTop: -1 }} />
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-popover" />
        </span>
      )}
    </span>
  );
}
