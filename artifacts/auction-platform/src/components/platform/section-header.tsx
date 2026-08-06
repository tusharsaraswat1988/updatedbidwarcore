import type { ReactNode } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type TournamentLike = {
  name?: string | null;
  logoUrl?: string | null;
};

/**
 * SectionHeader family
 * Auction: OrganizerSectionHeader / TournamentContextLabel (organizer-page-chrome)
 * Badminton: HubSectionHeader (page-chrome)
 */

/** Compact tournament label for section headers and forms. */
export function TournamentContextLabel({
  tournament,
  name,
  logoUrl,
  className,
}: {
  tournament?: TournamentLike | null;
  name?: string | null;
  logoUrl?: string | null;
  className?: string;
}) {
  const displayName = name ?? tournament?.name;
  const displayLogo = logoUrl ?? tournament?.logoUrl;
  if (!displayName) return null;

  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      {displayLogo ? (
        <img
          src={cldUrl(displayLogo, "headerLogo")}
          alt=""
          className="h-5 w-5 rounded object-contain flex-shrink-0 bg-white/5"
        />
      ) : null}
      <p className="text-xs font-semibold uppercase tracking-wider text-primary/90 truncate">
        {displayName}
      </p>
    </div>
  );
}

/** Page section header with optional tournament context above the title. */
export function SectionHeader({
  title,
  description,
  actions,
  tournament,
  hideTournamentContext,
  titleClassName,
  titleExtra,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  tournament?: TournamentLike | null;
  hideTournamentContext?: boolean;
  titleClassName?: string;
  titleExtra?: ReactNode;
  className?: string;
}) {
  const showContext = !hideTournamentContext && !!tournament?.name;

  return (
    <div className={cn("flex items-start justify-between gap-3 flex-wrap", className)}>
      <div className="min-w-0 flex-1">
        {showContext ? (
          <TournamentContextLabel tournament={tournament} className="mb-1.5" />
        ) : null}
        <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
          <h1
            className={cn(
              "text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight leading-tight text-foreground",
              titleClassName,
            )}
          >
            {title}
          </h1>
          {titleExtra}
        </div>
        {description ? (
          <p className="text-muted-foreground mt-1.5 text-sm sm:text-base max-w-2xl leading-relaxed">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex-shrink-0 flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}

/** @deprecated Prefer SectionHeader — alias for progressive rewire */
export const OrganizerSectionHeader = SectionHeader;

export function HubSectionHeader({
  title,
  subtitle,
  badge,
  badgeVariant = "default",
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeVariant?: "default" | "destructive" | "secondary" | "outline";
}) {
  return (
    <div className="flex items-baseline gap-3 flex-wrap">
      <h2 className="text-lg font-display font-bold text-foreground">{title}</h2>
      {badge ? <Badge variant={badgeVariant}>{badge}</Badge> : null}
      {subtitle ? <span className="text-muted-foreground text-sm">{subtitle}</span> : null}
    </div>
  );
}
