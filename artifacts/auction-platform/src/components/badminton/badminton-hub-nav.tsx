/**
 * Sticky navigation for all badminton organizer hub pages —
 * contextual back control + Tournament Mode–prioritized section jumps.
 *
 * Navigation priority only — does not change permissions, routing, or lifecycle.
 * Optimized for tablets: large touch targets, minimal primary chrome.
 */

import { useState } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
import { cn } from "@/lib/utils";
import { useBadmintonDashboard } from "@/hooks/use-badminton-match";
import {
  BADMINTON_TOURNAMENT_MODE_LABEL,
  detectBadmintonTournamentMode,
  getBadmintonHubBackNav,
  getBadmintonHubNavLayout,
  type BadmintonHubNavItem,
} from "@/lib/badminton-routes";

function NavChip({
  item,
  tournamentId,
  location,
  tone = "default",
}: {
  item: BadmintonHubNavItem;
  tournamentId: number;
  location: string;
  /** Visual-only read-only styling for COMPLETED setup (links still navigate). */
  tone?: "default" | "readonly";
}) {
  const active = item.isActive(location, tournamentId);
  return (
    <Link
      href={item.href(tournamentId)}
      aria-current={active ? "page" : undefined}
      title={tone === "readonly" ? `${item.label} (setup — view only)` : item.label}
      className={cn(
        "shrink-0 rounded-lg min-h-12 px-4 py-3 text-sm font-semibold whitespace-nowrap transition-colors border inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background touch-manipulation",
        active
          ? "bg-primary/15 text-primary border-primary/30"
          : tone === "readonly"
            ? "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted/60"
            : "bg-secondary/50 text-muted-foreground border-transparent hover:text-foreground hover:bg-accent hover:border-border",
      )}
    >
      {item.label}
    </Link>
  );
}

function CollapsibleNavSection({
  label,
  items,
  tournamentId,
  location,
  readOnly = false,
  defaultOpen = false,
}: {
  label: string;
  items: BadmintonHubNavItem[];
  tournamentId: number;
  location: string;
  readOnly?: boolean;
  defaultOpen?: boolean;
}) {
  const sectionActive = items.some((item) => item.isActive(location, tournamentId));
  const [userOpen, setUserOpen] = useState<boolean | null>(null);
  const open = userOpen ?? (defaultOpen || sectionActive);

  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setUserOpen(!(userOpen ?? (defaultOpen || sectionActive)))}
        aria-expanded={open}
        className={cn(
          "inline-flex items-center gap-1.5 min-h-11 px-2 -ml-2 rounded-md text-xs font-bold uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation",
          sectionActive || open
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground",
        )}
      >
        <ChevronDown
          className={cn(
            "w-4 h-4 shrink-0 transition-transform",
            open ? "rotate-0" : "-rotate-90",
          )}
          aria-hidden
        />
        {label}
        {readOnly ? (
          <span className="normal-case font-semibold tracking-normal text-muted-foreground">
            (view only)
          </span>
        ) : null}
      </button>
      {open ? (
        <div
          className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none"
          role="group"
          aria-label={label}
        >
          {items.map((item) => (
            <NavChip
              key={item.id}
              item={item}
              tournamentId={tournamentId}
              location={location}
              tone={readOnly ? "readonly" : "default"}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function BadmintonHubNav({ tournamentId }: { tournamentId: number }) {
  const [location] = useLocation();
  const back = getBadmintonHubBackNav(tournamentId, location);

  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0,
    },
  });
  const { data: dashboard } = useBadmintonDashboard(tournamentId);

  const mode = detectBadmintonTournamentMode({
    tournamentStatus: tournament?.status ?? null,
    matchesLive: dashboard?.matchesLive ?? null,
    matchesCompleted: dashboard?.matchesCompleted ?? null,
  });
  const layout = getBadmintonHubNavLayout({ mode, broadcastEnabled: true });

  const setupOpenByDefault = layout.setupCollapsed.some((item) =>
    item.isActive(location, tournamentId),
  );
  const moreOpenByDefault = layout.more.some((item) =>
    item.isActive(location, tournamentId),
  );

  return (
    <nav
      className="sticky top-0 z-20 border-b border-border bg-card/80 backdrop-blur-md"
      aria-label="Badminton tournament navigation"
      data-tournament-mode={layout.mode}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          {back.kind === "history" ? (
            <button
              type="button"
              onClick={() => window.history.back()}
              className="inline-flex items-center gap-1 min-h-12 text-sm font-semibold text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden />
              {back.label}
            </button>
          ) : (
            <Link
              href={back.href}
              className="inline-flex items-center gap-1 min-h-12 text-sm font-semibold text-primary hover:text-primary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md touch-manipulation"
            >
              <ChevronLeft className="w-5 h-5 shrink-0" aria-hidden />
              {back.label}
            </Link>
          )}
          <span
            className={cn(
              "inline-flex items-center min-h-10 px-3 rounded-md text-xs font-bold uppercase tracking-wide border",
              layout.mode === "live"
                ? "bg-primary/10 text-primary border-primary/25"
                : layout.mode === "completed"
                  ? "bg-muted text-muted-foreground border-border"
                  : "bg-secondary/60 text-muted-foreground border-transparent",
            )}
            aria-label={`Tournament mode: ${BADMINTON_TOURNAMENT_MODE_LABEL[layout.mode]}`}
          >
            {BADMINTON_TOURNAMENT_MODE_LABEL[layout.mode]}
          </span>
        </div>

        <div
          className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none"
          aria-label="Primary sections"
        >
          {layout.primary.map((item) => (
            <NavChip
              key={item.id}
              item={item}
              tournamentId={tournamentId}
              location={location}
            />
          ))}
        </div>

        {layout.secondary.length > 0 ? (
          <div
            className="flex items-center gap-2 overflow-x-auto pb-0.5 -mx-1 px-1 scrollbar-none"
            aria-label="Secondary sections"
          >
            {layout.secondary.map((item) => (
              <NavChip
                key={item.id}
                item={item}
                tournamentId={tournamentId}
                location={location}
              />
            ))}
          </div>
        ) : null}

        <CollapsibleNavSection
          label="Setup"
          items={layout.setupCollapsed}
          tournamentId={tournamentId}
          location={location}
          readOnly={layout.setupReadOnly}
          defaultOpen={setupOpenByDefault}
        />

        <CollapsibleNavSection
          label="More"
          items={layout.more}
          tournamentId={tournamentId}
          location={location}
          defaultOpen={moreOpenByDefault}
        />
      </div>
    </nav>
  );
}
