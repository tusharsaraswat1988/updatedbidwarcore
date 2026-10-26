import { createContext, useContext, type ReactNode } from "react";
import { Link } from "wouter";
import { Menu } from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset, type BrandSurfaceId } from "@/lib/brand-usage";
import { cn } from "@/lib/utils";

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
  const preset = getBrandSurfacePreset(surface);
  const logoSrc =
    preset.logoOrder
      .map((key) =>
        cldUrl(
          logos[key],
          key === "appIcon" ? "appIcon" : key === "main" || key === "mainReverse" ? "brandWordmark" : "headerLogo",
        ),
      )
      .find(Boolean) || getBrandLogoSrc(logos, preset.logoOrder);

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
      {preset.showBrandName && !iconOnly ? (
        <span className="font-display font-black text-xs sm:text-sm tracking-tight text-foreground leading-none group-hover:text-primary/90 transition-colors">
          {brandName?.trim()?.toUpperCase() || "BIDWAR"}
        </span>
      ) : null}
    </Link>
  );
}

/** Tablet / laptop — persistent BidWar strip above page content (sidebar may be icon-only). */
export function OrganizerDesktopBrandBar({
  tournamentName,
  className,
}: {
  tournamentName?: string | null;
  className?: string;
}) {
  const showTournament = !!tournamentName?.trim();

  return (
    <header
      className={cn(
        "hidden md:flex sticky top-0 z-40 h-12 shrink-0 items-center gap-4 px-4 lg:px-6 border-b border-border bg-background/95 backdrop-blur-md",
        className,
      )}
    >
      <BidwarOrganizerBrandMark surface="organizer-main-toolbar" />
      {showTournament ? (
        <p
          className="min-w-0 flex-1 text-sm font-medium text-muted-foreground truncate text-right lg:text-left lg:max-w-md"
          title={tournamentName ?? undefined}
        >
          {tournamentName}
        </p>
      ) : null}
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
        className="flex items-center justify-center min-h-[44px] min-w-[44px] -ml-0.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/[0.06] transition-colors touch-manipulation shrink-0"
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
