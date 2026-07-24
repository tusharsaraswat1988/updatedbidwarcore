import { ReactNode, createContext, useContext, useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { ChevronLeft, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { checkOrganizerAccountAuth, logoutOrganizerAccount } from "@/lib/auth";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import type { SportNavConfig, SportNavItem } from "@/lib/sports-shell-types";
import { cn } from "@/lib/utils";

const sidebarPreset = getBrandSurfacePreset("sidebar-compact");
const COLLAPSE_STORAGE_KEY = "sports-shell-collapsed";

/** True when already wrapped by SportsShell — HubPageShell skips a second shell. */
const SportsShellContext = createContext(false);

export function useInSportsShell(): boolean {
  return useContext(SportsShellContext);
}

function isScoringAppHost(): boolean {
  return typeof window !== "undefined" && window.location.pathname.startsWith(SCORING_APP_BASE);
}

/** Navigate to auction-platform organizer portal (cross-app when under scoring-app). */
function goToOrganizerPortal() {
  window.location.href = "/organizer";
}

interface SportsShellProps {
  children: ReactNode;
  tournamentId: number;
  nav: SportNavConfig;
  /** Remove default padding so the child owns layout (e.g. dense operator views). */
  noPadding?: boolean;
  className?: string;
}

function SidebarAccountFooter({
  tournamentId,
  collapsed,
}: {
  tournamentId: number;
  collapsed: boolean;
}) {
  const [accountLabel, setAccountLabel] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void checkOrganizerAccountAuth().then((me) => {
      if (cancelled || !me.loggedIn || !me.organizer) return;
      const email = me.organizer.email?.trim();
      setAccountLabel(email || me.organizer.mobile?.trim() || me.organizer.name?.trim() || null);
    });
    return () => {
      cancelled = true;
    };
  }, [tournamentId]);

  return (
    <div className="border-t border-border p-3 flex-shrink-0 space-y-2">
      {!collapsed && accountLabel && (
        <div className="px-3 min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
            Signed in as
          </p>
          <p className="text-xs text-muted-foreground truncate" title={accountLabel}>
            {accountLabel}
          </p>
        </div>
      )}
      <LogoutButton tournamentId={tournamentId} iconOnly={collapsed} accountLabel={accountLabel} />
    </div>
  );
}

function LogoutButton({
  tournamentId,
  iconOnly,
  accountLabel,
}: {
  tournamentId: number;
  iconOnly?: boolean;
  accountLabel?: string | null;
}) {
  const { logout } = useOrganizerAuth(tournamentId);

  async function handleLogout() {
    await logout();
    if (!isBidWarLocalHost()) {
      await logoutOrganizerAccount();
      goToOrganizerPortal();
    }
  }

  if (iconOnly) {
    return (
      <button
        type="button"
        onClick={handleLogout}
        title={accountLabel ? `Signed in as ${accountLabel}. Sign out.` : "Sign Out"}
        className="flex items-center justify-center w-9 h-9 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors mx-auto"
      >
        <LogOut className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
    >
      <LogOut className="w-4 h-4" />
      <span>Sign Out</span>
    </button>
  );
}

function navItemClass(active: boolean, collapsed: boolean) {
  return cn(
    "flex items-center rounded-md transition-colors",
    collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full",
    active
      ? "bg-primary/10 text-primary"
      : "text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}

function SportNavLink({
  item,
  tournamentId,
  location,
  collapsed,
}: {
  item: SportNavItem;
  tournamentId: number;
  location: string;
  collapsed: boolean;
}) {
  const href = item.href(tournamentId);
  const active = item.isActive(location, tournamentId);
  const Icon = item.icon ?? LayoutDashboard;
  const className = navItemClass(active, collapsed);

  if (item.external) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        title={item.label}
        className={cn(className, "font-medium")}
      >
        <Icon className="w-5 h-5 flex-shrink-0" />
        {!collapsed && (
          <span className="flex flex-col leading-tight min-w-0">
            <span className="font-medium truncate">{item.label}</span>
            {item.hint ? (
              <span className="text-[10px] text-muted-foreground/80 normal-case font-normal truncate">
                {item.hint}
              </span>
            ) : null}
          </span>
        )}
      </a>
    );
  }

  return (
    <Link
      href={href}
      title={item.label}
      className={cn(className, "font-medium")}
      onMouseEnter={item.preload}
      onFocus={item.preload}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      {!collapsed && (
        <span className="flex flex-col leading-tight min-w-0">
          <span className="truncate">{item.label}</span>
          {item.hint ? (
            <span className="text-[10px] text-muted-foreground/80 normal-case font-normal truncate">
              {item.hint}
            </span>
          ) : null}
        </span>
      )}
    </Link>
  );
}

/**
 * Shared tournament shell for scoring sports.
 * Auction continues to use AppLayout; badminton (and future sports) plug in via `nav`.
 *
 * Badminton only shares players + branding with auction — do not fetch full
 * tournament/auction license payloads here for badminton.
 */
export function SportsShell({
  children,
  tournamentId,
  nav,
  noPadding,
  className,
}: SportsShellProps) {
  const [location] = useLocation();
  const { logos, brandName, loading: brandingLoading } = useBranding();
  const sidebarLogoSrc =
    cldUrl(logos.appIcon, "appIcon") ||
    cldUrl(logos.mini, "headerLogo") ||
    getBrandLogoSrc(logos, sidebarPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);
  const isBadminton = nav.sportId === "badminton";

  // Badminton: sidebar title from badminton branding only (shared intentionally).
  const { data: badmintonBranding } = useBadmintonBranding(isBadminton ? tournamentId : 0);
  // Other sports: tournament name via standard tournament endpoint.
  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0 && !isBadminton,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });
  const tournamentTitle =
    (isBadminton ? badmintonBranding?.displayName : tournament?.name)?.trim() || "Tournament";
  const localVenue = isBidWarLocalHost();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    function sync(e: MediaQueryList | MediaQueryListEvent) {
      const narrow = "matches" in e ? e.matches : mq.matches;
      if (narrow) {
        setCollapsed(true);
      } else {
        try {
          setCollapsed(localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true");
        } catch {
          setCollapsed(false);
        }
      }
    }
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  }

  return (
    <SportsShellContext.Provider value={true}>
      <div
        className={cn(
          "flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark",
          className,
        )}
      >
      <aside
        className="flex-shrink-0 border-r border-border bg-card flex flex-col z-10 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 56 : 256 }}
      >
        <div className="h-16 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
          {collapsed ? (
            <button
              type="button"
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="mx-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {brandingLoading ? (
                <div className="h-9 w-9 flex-shrink-0" />
              ) : (
                <img src={sidebarLogoSrc} alt={logoAlt} className={sidebarPreset.sizeClass} />
              )}
              <button
                type="button"
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          {!localVenue && (
            <>
              {!collapsed && (
                <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Main Menu
                </div>
              )}
              <nav className={cn("space-y-1", collapsed ? "px-1.5" : "px-2")}>
                <button
                  type="button"
                  onClick={goToOrganizerPortal}
                  title="All Tournaments"
                  className={navItemClass(false, collapsed)}
                >
                  <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">All Tournaments</span>}
                </button>
              </nav>
            </>
          )}

          {!collapsed && (
            <div className="px-4 mt-7 mb-1 flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {tournamentTitle}
              </span>
            </div>
          )}
          {!collapsed && (
            <div className="px-4 mb-3 text-[10px] font-semibold text-muted-foreground/50 uppercase tracking-wider">
              {nav.sportLabel}
            </div>
          )}
          {collapsed && <div className="mt-6 mb-2 border-t border-border mx-2" />}

          {nav.sections.map((section, sectionIndex) => (
            <div key={section.id}>
              {!collapsed && section.label.trim() ? (
                <div
                  className={cn(
                    "px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider",
                    sectionIndex === 0 ? "mt-0" : "mt-7",
                  )}
                >
                  {section.label}
                </div>
              ) : null}
              {collapsed && sectionIndex > 0 ? (
                <div className="mt-6 mb-2 border-t border-border mx-2" />
              ) : null}
              <nav className={cn("space-y-1", collapsed ? "px-1.5" : "px-2", !collapsed && "mb-1")}>
                {section.items.map((item) => (
                  <SportNavLink
                    key={item.id}
                    item={item}
                    tournamentId={tournamentId}
                    location={location}
                    collapsed={collapsed}
                  />
                ))}
              </nav>
            </div>
          ))}
        </div>

        {tournamentId && !localVenue && (
          <SidebarAccountFooter tournamentId={tournamentId} collapsed={collapsed} />
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
        {noPadding ? (
          <div className="flex-1 overflow-y-auto z-0 relative flex flex-col min-h-0">{children}</div>
        ) : (
          <div className="flex-1 overflow-y-auto z-0 relative">
            <div className="p-8 max-w-7xl mx-auto">{children}</div>
          </div>
        )}
      </main>
    </div>
    </SportsShellContext.Provider>
  );
}
