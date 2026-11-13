import { useState, useRef, useEffect, useId, useCallback } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface FieldTooltipProps {
  text: string;
  className?: string;
  side?: "top" | "bottom" | "auto";
}

/**
 * Reusable accessible ⓘ info tooltip.
 * - Keyboard accessible: tabIndex={0}, Enter/Space toggles, Escape closes.
 * - Touch & Click: toggle open/close, click outside closes.
 * - Hover: reveals with slight delay, closes on mouse leave.
 * - Collision detection: auto-adjusts horizontal & vertical placement so it never clips viewport.
 * - Styled for crisp light mode and semantic tokens.
 */
export function FieldTooltip({ text, className, side = "auto" }: FieldTooltipProps) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<"top" | "bottom">("top");
  const [horizontalShift, setHorizontalShift] = useState<number>(0);
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tooltipId = useId();

  const updatePosition = useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const tooltipWidth = 240; // max expected width
    const padding = 12;

    // Vertical placement
    if (side === "top") {
      setPlacement("top");
    } else if (side === "bottom") {
      setPlacement("bottom");
    } else {
      // auto: if too close to top of viewport, flip to bottom
      if (rect.top < 110) {
        setPlacement("bottom");
      } else {
        setPlacement("top");
      }
    }

    // Horizontal placement check against screen edges
    const center = rect.left + rect.width / 2;
    const halfWidth = tooltipWidth / 2;
    let shift = 0;

    if (center - halfWidth < padding) {
      shift = padding - (center - halfWidth);
    } else if (center + halfWidth > window.innerWidth - padding) {
      shift = (window.innerWidth - padding) - (center + halfWidth);
    }

    setHorizontalShift(shift);
  }, [side]);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, updatePosition]);

  function handleMouseEnter() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, 120);
  }

  function handleMouseLeave() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(false);
    }, 150);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(v => !v);
    }
  }

  return (
    <span
      ref={containerRef}
      className={cn("relative inline-flex items-center align-middle", className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        tabIndex={0}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(v => !v);
        }}
        onKeyDown={handleKeyDown}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        aria-label="More information"
        className="text-muted-foreground hover:text-foreground focus-visible:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-full transition-colors ml-1 p-0.5 flex-shrink-0 cursor-pointer"
      >
        <Info className="w-3.5 h-3.5" aria-hidden />
      </button>

      {open && (
        <span
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          style={{
            transform: `translateX(calc(-50% + ${horizontalShift}px))`,
          }}
          className={cn(
            "absolute left-1/2 z-50 w-60 max-w-[calc(100vw-2rem)] px-3 py-2 rounded-lg bg-popover border border-border text-xs text-popover-foreground shadow-lg leading-relaxed select-text animate-in fade-in-0 zoom-in-95 pointer-events-auto",
            placement === "top" ? "bottom-full mb-2" : "top-full mt-2"
          )}
        >
          {text}
          {/* Arrow */}
          <span
            style={{
              left: `calc(50% - ${horizontalShift}px)`,
            }}
            className={cn(
              "absolute -translate-x-1/2 border-4 border-transparent pointer-events-none",
              placement === "top"
                ? "top-full border-t-border"
                : "bottom-full border-b-border"
            )}
          />
          <span
            style={{
              left: `calc(50% - ${horizontalShift}px)`,
            }}
            className={cn(
              "absolute -translate-x-1/2 border-4 border-transparent pointer-events-none",
              placement === "top"
                ? "top-full -mt-[1px] border-t-popover"
                : "bottom-full -mb-[1px] border-b-popover"
            )}
          />
        </span>
      )}
    </span>
  );
}
