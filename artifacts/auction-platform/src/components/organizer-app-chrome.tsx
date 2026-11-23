import { createContext, useContext, type ReactNode } from "react";
import { Link } from "wouter";
import { Menu, ChevronRight, User } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset, type BrandSurfaceId } from "@/lib/brand-usage";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useOrganizerAccountAuth } from "@/hooks/use-auth";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";
import { resolveTournamentOrganizerLandingPath } from "@/lib/tournament-navigation";

type OrganizerBrandSurface = Extract<
  BrandSurfaceId,
  | "organizer-dashboard-header"
  | "organizer-main-toolbar"
  | "organizer-sidebar-wordmark"
  | "sidebar-compact"
>;

type OrganizerShellChromeContextValue = {
  /** Tournament name is already in shell chrome (mobile bar or sidebar card) */
  tournamentInAppChrome: boolean;
};

export const OrganizerShellChromeContext = createContext<OrganizerShellChromeContextValue>({
  tournamentInAppChrome: false,
});

export function useOrganizerShellChrome() {
  return useContext(OrganizerShellChromeContext);
}

/** Platform mark — uses per-surface presets from brand-usage. */
export function BidwarOrganizerBrandMark({
  className,
  surface = "organizer-main-toolbar",
  iconOnly = false,
}: {
  className?: string;
  surface?: OrganizerBrandSurface;
  /** Symbol only — collapsed sidebar rail */
  iconOnly?: boolean;
}) {
  const { logos, brandName, miniBrandText, loading } = useBranding();
  const effectiveSurface = iconOnly ? "sidebar-compact" : surface;
  const preset = getBrandSurfacePreset(effectiveSurface);
  const matchedKey = preset.logoOrder.find((key) => Boolean(logos[key]));
  const isWordmark =
    !iconOnly && (
      matchedKey === "main" ||
      matchedKey === "mainReverse" ||
      (!matchedKey && (preset.logoOrder[0] === "main" || preset.logoOrder[0] === "mainReverse"))
    );
  const logoSrc = iconOnly
    ? (logos.mini ? cldUrl(logos.mini, "appIcon") || logos.mini : logos.appIcon ? cldUrl(logos.appIcon, "appIcon") || logos.appIcon : "")
    : (preset.logoOrder
        .map((key) =>
          cldUrl(
            logos[key],
            key === "appIcon" ? "appIcon" : key === "main" || key === "mainReverse" ? "brandWordmark" : "headerLogo",
          ),
        )
        .find(Boolean) || getBrandLogoSrc(logos, preset.logoOrder));

  if (loading) {
    return (
      <div
        className={cn("h-7 w-20 rounded-md bg-muted/25 animate-pulse shrink-0", className)}
        aria-hidden
      />
    );
  }

  return (
    <Link
      href="/organizer"
      className={cn(
        "flex items-center gap-1.5 sm:gap-2 min-w-0 shrink-0 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className,
      )}
      title="BidWar — All tournaments"
    >
      {logoSrc ? (
        <img
          src={logoSrc}
          alt={getBrandLogoAlt(brandName)}
          className={cn(preset.sizeClass, "object-contain shrink-0")}
        />
      ) : (
        <div
          className={cn(
            preset.sizeClass,
            "rounded-lg bg-gradient-to-br from-primary/25 via-primary/10 to-primary/5 border border-primary/30 flex items-center justify-center font-display font-black text-xs text-primary shrink-0 shadow-sm shadow-primary/10",
          )}
        >
          {miniBrandText}
        </div>
      )}
      {preset.showBrandName && !iconOnly && !isWordmark ? (
        <span className="font-display font-black text-xs sm:text-sm tracking-tight text-foreground leading-none group-hover:text-primary/90 transition-colors">
          {brandName?.trim()?.toUpperCase() || "BIDWAR"}
        </span>
      ) : null}
    </Link>
  );
}

function getSectionLabel(location?: string, tournament?: { status?: string | null } | null): string | null {
  if (!location) return null;
  if (location.endsWith("/auction-overview") || location.endsWith("/overview")) return "Overview";
  if (location.endsWith("/teams")) return "Teams";
  if (location.endsWith("/players")) return "Players";
  if (location.endsWith("/categories")) return "Categories";
  if (location.endsWith("/settings")) return "Settings";
  if (location.endsWith("/reports")) return tournament?.status === "setup" ? "Pre-Auction Report" : "Reports";
  if (location.endsWith("/links")) return "Links";
  if (location.endsWith("/fortune-wheel")) return "Fortune Wheel";
  if (location.endsWith("/break-timer")) return "Break Timer";
  if (location.endsWith("/local-mode")) return "Local Mode";
  if (location.endsWith("/reset")) return "Reset Data";
  if (location.includes("/mission-control")) return "Mission Control";
  if (location.includes("/fixtures")) return "Fixtures";
  if (location.includes("/rules")) return "Rules";
  if (location.includes("/standings")) return "Standings";
  if (location.includes("/stats")) return "Stats";
  if (location.includes("/officials")) return "Officials";
  if (location.includes("/control")) return "Match Control";
  if (location.includes("/results")) return "Results";
  if (location.endsWith("/profile")) return "Profile";
  return null;
}

/** Tablet / laptop — persistent BidWar strip above page content (sidebar may be icon-only). */
export function OrganizerDesktopBrandBar({
  tournamentName,
  tournamentId,
  tournament,
  location,
  className,
  sidebarCollapsed = false,
}: {
  tournamentName?: string | null;
  tournamentId?: number;
  tournament?: {
    name?: string | null;
    sport?: string | null;
    status?: string | null;
    licenseStatus?: string | null;
    auctionEnabled?: boolean | null;
    scoringEnabled?: boolean | null;
  } | null;
  location?: string;
  className?: string;
  sidebarCollapsed?: boolean;
}) {
  const showTournament = !!tournamentName?.trim();
  const { organizer, isLoggedIn } = useOrganizerAccountAuth();
  const accountLabel = isLoggedIn && organizer
    ? (organizer.name?.trim() || organizer.email?.trim() || organizer.mobile?.trim() || null)
    : null;

  const auctionActive = isAuctionEnabled(tournament);
  const scoringActive = isScoringEnabled(tournament);
  const sectionLabel = getSectionLabel(location, tournament);
  const tournamentLandingHref =
    tournamentId && tournament
      ? resolveTournamentOrganizerLandingPath(tournamentId, tournament)
      : tournamentId
        ? `/tournament/${tournamentId}/auction-overview`
        : "/organizer";

  return (
    <header
      className={cn(
        "hidden md:flex sticky top-0 z-40 h-12 shrink-0 items-center justify-between gap-3 px-4 lg:px-6 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {sidebarCollapsed && (
          <BidwarOrganizerBrandMark surface="organizer-main-toolbar" />
        )}
        {showTournament && tournamentId ? (
          <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 min-w-0 text-xs sm:text-sm font-medium">
            <Link
              href="/organizer"
              className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
            >
              Tournaments
            </Link>
            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" aria-hidden />
            <Link
              href={tournamentLandingHref}
              className={cn(
                "truncate max-w-[12rem] sm:max-w-[16rem] transition-colors",
                sectionLabel ? "text-muted-foreground hover:text-foreground" : "text-foreground font-semibold"
              )}
              title={tournamentName ?? undefined}
            >
              {tournamentName}
            </Link>
            {sectionLabel && (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 shrink-0" aria-hidden />
                <span className="text-foreground font-semibold truncate shrink-0">{sectionLabel}</span>
              </>
            )}
          </nav>
        ) : showTournament ? (
          <p
            className="min-w-0 text-sm font-medium text-foreground truncate"
            title={tournamentName ?? undefined}
          >
            {tournamentName}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {showTournament && (
          <div className="hidden sm:flex items-center gap-1.5 shrink-0">
            {auctionActive && (
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-300/60"
              >
                Auction
              </Badge>
            )}
            {scoringActive && (
              <Badge
                variant="outline"
                className="text-[10px] sm:text-[11px] font-semibold px-2 py-0.5 bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-300/60"
              >
                {tournament?.sport ? `${tournament.sport.charAt(0).toUpperCase() + tournament.sport.slice(1)} Scoring` : "Scoring"}
              </Badge>
            )}
            {tournament?.status && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] sm:text-[11px] font-semibold px-2 py-0.5",
                  tournament.status === "active"
                    ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-300/60"
                    : "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-slate-300/60"
                )}
              >
                {tournament.status === "active" ? "Live" : tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
              </Badge>
            )}
          </div>
        )}

        {isLoggedIn && organizer && (
          <Link
            href="/organizer/profile"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent/80 border border-border transition-colors ml-auto shrink-0"
            title={accountLabel ? `Signed in as ${accountLabel}` : "Organiser Profile"}
          >
            <User className="w-3.5 h-3.5 text-muted-foreground" aria-hidden />
            <span className="hidden lg:inline max-w-[10rem] truncate">{accountLabel || "Profile"}</span>
          </Link>
        )}
      </div>
    </header>
  );
}

/** Mobile — menu + BidWar (always) + tournament as subtitle when in an event. */
export function OrganizerMobileTopBar({
  onOpenMenu,
  menuExpanded,
  tournamentName,
  className,
  trailing,
}: {
  onOpenMenu: () => void;
  menuExpanded?: boolean;
  tournamentName?: string | null;
  className?: string;
  trailing?: ReactNode;
}) {
  const inTournament = !!tournamentName?.trim();

  return (
    <header
      className={cn(
        "md:hidden sticky top-0 z-40 flex items-center gap-2 min-h-[3.25rem] py-2 px-3 border-b border-border bg-background/95 backdrop-blur-md flex-shrink-0",
        className,
      )}
    >
      <button
        type="button"
        onClick={onOpenMenu}
        aria-label="Open navigation"
        aria-expanded={menuExpanded}
        className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors touch-manipulation shrink-0"
      >
        <Menu className="w-5 h-5" aria-hidden />
      </button>

      <div className="min-w-0 flex-1">
        <BidwarOrganizerBrandMark surface="organizer-main-toolbar" className="max-w-[9rem]" />
        {inTournament ? (
          <p
            className="text-xs font-medium text-muted-foreground leading-snug truncate mt-0.5 pl-0.5"
            title={tournamentName ?? undefined}
          >
            {tournamentName}
          </p>
        ) : null}
      </div>

      {trailing ? <div className="flex items-center gap-2 shrink-0">{trailing}</div> : null}
    </header>
  );
}

/** @deprecated Use OrganizerMobileTopBar */
export const OrganizerAppStickyHeader = OrganizerMobileTopBar;
