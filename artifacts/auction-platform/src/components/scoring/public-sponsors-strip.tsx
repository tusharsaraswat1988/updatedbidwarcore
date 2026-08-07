import { getSponsorsByPriority, parseSponsorLogos, type SponsorLogo } from "@/lib/sponsor-logo";
import { cn } from "@/lib/utils";
import { cricketCardClass, cricketSectionTitleClass } from "@/components/scoring/cricket-page-chrome";

export function parseTournamentSponsors(raw: string | null | undefined): SponsorLogo[] {
  return getSponsorsByPriority(parseSponsorLogos(raw ?? null));
}

export function PublicSponsorsStrip({
  sponsors,
  title = "Sponsors",
  className,
}: {
  sponsors: SponsorLogo[];
  title?: string;
  className?: string;
}) {
  if (sponsors.length === 0) return null;

  return (
    <section className={cn("space-y-3", className)}>
      <h2 className={cricketSectionTitleClass}>{title}</h2>
      <div className="flex flex-wrap items-center gap-3 sm:gap-4">
        {sponsors.map((s, idx) => (
          <div
            key={`${s.url}-${idx}`}
            className={cn(
              cricketCardClass,
              "flex items-center justify-center bg-card/60 px-4 py-3 min-h-[72px] min-w-[96px]",
            )}
            title={s.name || undefined}
          >
            {s.url ? (
              <img
                src={s.url}
                alt={s.name || "Sponsor"}
                className="max-h-12 max-w-[140px] object-contain opacity-90"
                loading="lazy"
              />
            ) : (
              <span className="text-xs text-muted-foreground">{s.name || "Sponsor"}</span>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
