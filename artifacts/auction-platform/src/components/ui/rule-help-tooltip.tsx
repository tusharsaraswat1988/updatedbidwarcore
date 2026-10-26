import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Info, Sparkles, Trophy, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { PORTAL_THEME_CLASS } from "@/lib/portal-theme";

export interface RuleHelpTooltipProps {
  /** Optional title of the rule or configuration */
  title?: string;
  /** Plain language explanation for organizers */
  content: string;
  /** Classification of the rule */
  category?: "cricket" | "bidwar" | "enforcement";
  /** Optional custom trigger button class */
  className?: string;
  /** Popover placement side */
  side?: "top" | "bottom" | "left" | "right";
  /** Popover placement align */
  align?: "start" | "center" | "end";
}

/**
 * Accessible, mobile & desktop contextual help indicator `(i)` for tournament rules.
 * - Desktop: Opens smoothly on hover, pins on click.
 * - Mobile / Touch: Opens and pins on tap, closes on tap-outside or Escape.
 * - Keyboard accessible with clear ARIA labels and focus indicators.
 * - Renders via Radix Portal to prevent clipping or layout shifts.
 */
export function RuleHelpTooltip({
  title,
  content,
  category = "cricket",
  className,
  side = "top",
  align = "center",
}: RuleHelpTooltipProps) {
  const [open, setOpen] = React.useState(false);
  const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPinnedRef = React.useRef(false);

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(true);
    }, 120);
  };

  const handleMouseLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (!isPinnedRef.current) {
      hoverTimeoutRef.current = setTimeout(() => {
        setOpen(false);
      }, 150);
    }
  };

  const handleToggleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (open && isPinnedRef.current) {
      isPinnedRef.current = false;
      setOpen(false);
    } else {
      isPinnedRef.current = true;
      setOpen(true);
    }
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      isPinnedRef.current = false;
    }
  };

  React.useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          aria-label={title ? `Information about ${title}` : "Rule information"}
          aria-expanded={open}
          onClick={handleToggleClick}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(
            "inline-flex items-center justify-center w-3.5 h-3.5 rounded-full",
            "text-muted-foreground/75 hover:text-primary hover:bg-primary/15",
            "focus-visible:outline-none focus-visible:ring-1.5 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "transition-all duration-150 cursor-pointer shrink-0 ml-1 select-none",
            open && "text-primary bg-primary/20 ring-1 ring-primary/40",
            className,
          )}
        >
          <Info className="w-3 h-3" />
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          side={side}
          align={align}
          sideOffset={6}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onPointerDownOutside={() => {
            isPinnedRef.current = false;
            setOpen(false);
          }}
          className={cn(
            PORTAL_THEME_CLASS,
            "z-[350] w-64 sm:w-72 rounded-xl border border-border/80 bg-popover/95 backdrop-blur-md p-3 text-popover-foreground shadow-2xl outline-none",
            "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            "data-[side=bottom]:slide-in-from-top-1.5 data-[side=top]:slide-in-from-bottom-1.5 data-[side=left]:slide-in-from-right-1.5 data-[side=right]:slide-in-from-left-1.5",
          )}
        >
          <div className="space-y-1.5 text-left">
            <div className="flex items-center justify-between gap-2">
              {title ? (
                <p className="text-xs font-bold text-foreground tracking-tight truncate">
                  {title}
                </p>
              ) : null}

              {category === "bidwar" ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-300 shrink-0 ml-auto">
                  <Sparkles className="w-2.5 h-2.5" />
                  BIDWAR Feature
                </span>
              ) : category === "enforcement" ? (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-sky-500/15 border border-sky-500/30 text-sky-300 shrink-0 ml-auto">
                  <ShieldCheck className="w-2.5 h-2.5" />
                  Enforcement
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary shrink-0 ml-auto">
                  <Trophy className="w-2.5 h-2.5" />
                  Cricket Rule
                </span>
              )}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed font-normal">
              {content}
            </p>
          </div>
          <PopoverPrimitive.Arrow className="fill-popover border-t border-border" />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
