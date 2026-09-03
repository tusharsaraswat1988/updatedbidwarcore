import { Link } from "wouter";
import { Trophy } from "lucide-react";
import { TrialLicenseBadge } from "@/components/trial-license-badge";

type CurrentTournamentContextProps = {
  tournamentId: number;
  name?: string | null;
  status?: string | null;
  licenseStatus?: string | null;
  expanded: boolean;
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
}: CurrentTournamentContextProps) {
  const displayName = name?.trim() || "Tournament";
  const statusLabel = formatTournamentStatusLabel(status);
  const overviewHref = `/tournament/${tournamentId}`;
  const showTrialBadge =
    !!licenseStatus && licenseStatus !== "active" && licenseStatus !== "completed";
  const accessibleLabel = statusLabel
    ? `Current tournament: ${displayName}, status ${statusLabel}`
    : `Current tournament: ${displayName}`;

  if (!expanded) {
    return (
      <div className="mt-4 mb-2 px-1.5">
        <Link
          href={overviewHref}
          title={accessibleLabel}
          aria-label={accessibleLabel}
          className="flex items-center justify-center w-9 h-9 mx-auto rounded-md border border-primary/25 bg-primary/10 text-primary hover:bg-primary/15 transition-colors"
        >
          <Trophy className="w-4 h-4" aria-hidden />
        </Link>
      </div>
    );
  }

  return (
    <div className="px-2 mt-5 mb-3">
      <p className="px-1 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80">
        Current Tournament
      </p>
      <Link
        href={overviewHref}
        aria-label={accessibleLabel}
        title={accessibleLabel}
        className="block rounded-md border border-primary/20 bg-primary/[0.07] hover:bg-primary/[0.11] transition-colors px-2.5 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <div className="flex items-start gap-2 min-w-0">
          <span
            className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-primary/15 text-primary"
            aria-hidden
          >
            <Trophy className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[16px] font-extrabold leading-snug text-foreground line-clamp-2 break-words">
              {displayName}
            </p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 min-w-0">
              {statusLabel ? (
                <span
                  className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider ${
                    status?.trim().toLowerCase() === "active"
                      ? "text-emerald-400"
                      : "text-muted-foreground"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status?.trim().toLowerCase() === "active" ? "bg-emerald-400" : "bg-muted-foreground"
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
