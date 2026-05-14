import { memo } from "react";

/**
 * Footer marquee — currently unused in the live display (kept for
 * scalability when a sponsor ticker is needed at the bottom of the
 * broadcast). Animated via CSS keyframes (defined in display-shell).
 */
export const DisplayFooter = memo(function DisplayFooter({ logos }: {
  logos: { url: string; name: string }[];
}) {
  if (!logos.length) return null;
  const doubled = [...logos, ...logos];
  return (
    <div className="overflow-hidden flex items-center gap-0 h-12 bg-black/40 border-t border-border/20">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground px-4 whitespace-nowrap flex-shrink-0">POWERED BY</span>
      <div className="flex items-center gap-8 animate-[marquee_20s_linear_infinite] whitespace-nowrap">
        {doubled.map((logo, i) => (
          <div key={i} className="flex items-center gap-2 flex-shrink-0">
            {logo.url ? (
              <img src={logo.url} alt={logo.name} className="h-7 w-auto object-contain opacity-80" />
            ) : (
              <span className="text-sm font-bold text-muted-foreground">{logo.name}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
});
