import { useState, useRef, useCallback, type ReactNode } from "react";
import { Info } from "lucide-react";

type HintLabelProps = {
  children: ReactNode;
  /** Plain-language hint — shown on hover (desktop) or long-press (touch). */
  hint?: string;
  className?: string;
};

/**
 * Label with optional ⓘ hint. Hinglish / extra explanation stays hidden until
 * hover or long-press so the UI stays clean for English-first copy.
 */
export function HintLabel({ children, hint, className = "" }: HintLabelProps) {
  const [open, setOpen] = useState(false);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearPress = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  if (!hint) {
    return <span className={className}>{children}</span>;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onTouchStart={() => {
        clearPress();
        pressTimer.current = setTimeout(() => setOpen(true), 450);
      }}
      onTouchEnd={clearPress}
      onTouchCancel={clearPress}
    >
      {children}
      <span className="relative inline-flex">
        <Info className="w-3 h-3 text-muted-foreground/70 flex-shrink-0" aria-hidden />
        {open && (
          <span
            role="tooltip"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 w-52 px-2.5 py-2 rounded-md bg-popover border border-border text-[11px] text-popover-foreground shadow-lg leading-relaxed pointer-events-none"
          >
            {hint}
          </span>
        )}
      </span>
    </span>
  );
}
