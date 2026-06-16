import { cn } from "@/lib/utils";

export interface ScoreBoardSponsor {
  logoUrl: string | null;
  name: string | null;
  title: string | null;
}

export function hasScoreBoardSponsor(sponsor: ScoreBoardSponsor | null | undefined): boolean {
  if (!sponsor) return false;
  return !!(sponsor.logoUrl || sponsor.name || sponsor.title);
}

/** Fixed top-right placement — used on LED scoreboard and OBS browser sources. */
export function ScoreBoardSponsorTopRight({
  sponsor,
  className,
  panelClassName,
}: {
  sponsor: ScoreBoardSponsor | null | undefined;
  className?: string;
  panelClassName?: string;
}) {
  if (!hasScoreBoardSponsor(sponsor) || !sponsor) return null;

  return (
    <div className={cn("absolute top-3 right-6 z-30 pointer-events-none", className)}>
      <ScoreBoardSponsorPanel
        sponsor={sponsor}
        variant="bar"
        className={cn("max-w-[360px]", panelClassName)}
      />
    </div>
  );
}

/** Prominent scoreboard sponsor block — separate from rotating sponsor logos. */
export function ScoreBoardSponsorPanel({
  sponsor,
  variant = "display",
  className,
}: {
  sponsor: ScoreBoardSponsor;
  variant?: "display" | "compact" | "preview" | "bar";
  className?: string;
}) {
  if (!hasScoreBoardSponsor(sponsor)) return null;

  if (variant === "bar") {
    return (
      <div
        className={cn(
          "flex items-center gap-4 rounded-xl border-2 border-[#ffd700]/45",
          "bg-gradient-to-r from-[#1a1400]/95 via-[#0d1529]/95 to-[#0a1628]/95",
          "px-5 py-2.5 shadow-[0_0_24px_rgba(255,215,0,0.12)]",
          className,
        )}
      >
        {sponsor.logoUrl ? (
          <div className="rounded-lg bg-white/95 p-1.5 flex-none shadow-md">
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name ?? "Scoreboard sponsor"}
              className="h-10 w-16 object-contain"
            />
          </div>
        ) : null}
        <div className="min-w-0 text-left">
          {sponsor.title && (
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#ffd700] truncate">
              {sponsor.title}
            </p>
          )}
          {sponsor.name && (
            <p className="text-base font-black text-white truncate">{sponsor.name}</p>
          )}
        </div>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={cn(
          "flex items-center gap-2.5 rounded-lg border border-[#ffd700]/35 bg-gradient-to-r from-[#ffd700]/15 to-[#f59e0b]/10 px-3 py-2",
          className,
        )}
      >
        {sponsor.logoUrl && (
          <img
            src={sponsor.logoUrl}
            alt={sponsor.name ?? "Scoreboard sponsor"}
            className="h-8 w-14 object-contain flex-none"
          />
        )}
        <div className="min-w-0 text-left">
          {sponsor.title && (
            <p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#ffd700]/90 truncate">
              {sponsor.title}
            </p>
          )}
          {sponsor.name && (
            <p className="text-xs font-black text-white truncate">{sponsor.name}</p>
          )}
        </div>
      </div>
    );
  }

  const isPreview = variant === "preview";

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-[#ffd700]/40",
        "bg-gradient-to-br from-[#1a1400]/90 via-[#0d1529]/95 to-[#0a1628]/95",
        "shadow-[0_0_40px_rgba(255,215,0,0.15)]",
        isPreview ? "p-4" : "p-5 min-w-[180px] max-w-[220px]",
        className,
      )}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-[#ffd700]/8 via-transparent to-[#f59e0b]/5 pointer-events-none" />
      <div className="absolute -top-8 -right-8 w-24 h-24 bg-[#ffd700]/10 rounded-full blur-2xl pointer-events-none" />

      <div className="relative flex flex-col items-center text-center gap-3">
        {sponsor.title && (
          <p
            className={cn(
              "font-black uppercase tracking-[0.22em] text-[#ffd700]",
              isPreview ? "text-[10px]" : "text-[11px]",
            )}
          >
            {sponsor.title}
          </p>
        )}

        {sponsor.logoUrl ? (
          <div
            className={cn(
              "rounded-xl bg-white/95 flex items-center justify-center shadow-lg shadow-black/30",
              isPreview ? "w-20 h-20 p-2" : "w-28 h-28 p-3",
            )}
          >
            <img
              src={sponsor.logoUrl}
              alt={sponsor.name ?? "Scoreboard sponsor"}
              className="max-w-full max-h-full object-contain"
            />
          </div>
        ) : (
          <div
            className={cn(
              "rounded-xl border border-dashed border-[#ffd700]/30 flex items-center justify-center text-[#ffd700]/40",
              isPreview ? "w-20 h-20 text-[10px]" : "w-28 h-28 text-xs",
            )}
          >
            Logo
          </div>
        )}

        {sponsor.name && (
          <p
            className={cn(
              "font-black text-white leading-tight",
              isPreview ? "text-sm" : "text-lg",
            )}
          >
            {sponsor.name}
          </p>
        )}
      </div>
    </div>
  );
}
