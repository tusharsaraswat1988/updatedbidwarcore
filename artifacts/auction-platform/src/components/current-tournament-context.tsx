import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { TrialLicenseBadge } from "@/components/trial-license-badge";

type CurrentTournamentContextProps = {
  tournamentId: number;
  name?: string | null;
  status?: string | null;
  licenseStatus?: string | null;
  expanded: boolean;
  /** Module landing (Auction Overview or scoring entry) — not legacy Tournament Home. */
  overviewHref: string;
};

/** Real tournament.status only — never invent a status label. */
export function formatTournamentStatusLabel(status?: string | null): string | null {
  if (typeof status !== "string") return null;
  const trimmed = status.trim();
  if (!trimmed) return null;
  return trimmed.toUpperCase();
}

/**
 * Compact "Current Tournament" context for the organizer sidebar.
 * Uses existing tournament fields from AppLayout — no extra fetches.
 */
export function CurrentTournamentContext({
  tournamentId,
  name,
  status,
  licenseStatus,
  expanded,
  overviewHref,
}: CurrentTournamentContextProps) {
  const displayName = name?.trim() || "Tournament";
  const statusLabel = formatTournamentStatusLabel(status);
  const showTrialBadge =
    !!licenseStatus && licenseStatus !== "active" && licenseStatus !== "completed";
  const accessibleLabel = statusLabel
    ? `Current tournament: ${displayName}, status ${statusLabel}`
    : `Current tournament: ${displayName}`;

  if (!expanded) {
    return (
      <div className="sticky top-0 z-20 bg-sidebar/95 backdrop-blur-xs py-2 px-1.5 border-b border-sidebar-border/40">
        <Link
          href={overviewHref}
          title={accessibleLabel}
          aria-label={accessibleLabel}
          className="flex items-center justify-center w-9 h-9 mx-auto rounded-md border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-colors shadow-2xs"
        >
          <Trophy className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 bg-sidebar/95 backdrop-blur-xs px-2 pt-2.5 pb-2.5 border-b border-sidebar-border/60 shadow-2xs">
      <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        Current Tournament
      </p>
      <Link
        href={overviewHref}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className="block rounded-lg border border-primary/20 bg-primary/[0.07] hover:bg-primary/[0.11] transition-colors px-2.5 py-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 shadow-2xs"
      >
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
            aria-hidden
          >
            <Trophy className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold leading-snug text-foreground line-clamp-2 break-words">
              {displayName}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-1.5 min-w-0">
              {statusLabel ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                    status?.trim().toLowerCase() === "active"
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status?.trim().toLowerCase() === "active" ? "bg-emerald-600 dark:bg-emerald-400" : "bg-muted-foreground"
                    }`}
                    aria-hidden
                  />
                  {statusLabel}
                </span>
              ) : null}
              {showTrialBadge ? <TrialLicenseBadge className="shrink-0" /> : null}
            </div>
          </div>
        </div>
      </Link>
    </div>
  );
}
