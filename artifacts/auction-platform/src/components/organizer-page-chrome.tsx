import type { ReactNode } from "react";
import { cldUrl } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";
import { DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type TournamentLike = {
  name?: string | null;
  logoUrl?: string | null;
};

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
export function OrganizerSectionHeader({
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
    <div className={cn("flex items-center justify-between gap-4 flex-wrap", className)}>
      <div className="min-w-0">
        {showContext ? (
          <TournamentContextLabel tournament={tournament} className="mb-1.5" />
        ) : null}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className={cn("text-4xl font-bold tracking-tight", titleClassName)}>{title}</h1>
          {titleExtra}
        </div>
        {description ? <p className="text-muted-foreground mt-2">{description}</p> : null}
      </div>
      {actions ? <div className="flex-shrink-0">{actions}</div> : null}
    </div>
  );
}

/** Dialog header with tournament name above the form title. */
export function OrganizerFormDialogHeader({
  title,
  tournament,
  description,
}: {
  title: ReactNode;
  tournament?: TournamentLike | null;
  description?: ReactNode;
}) {
  return (
    <DialogHeader>
      <TournamentContextLabel tournament={tournament} className="mb-1" />
      <DialogTitle>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </DialogHeader>
  );
}
