import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { ChevronLeft, ChevronRight, LayoutDashboard, LogOut } from "lucide-react";
import { SCORING_APP_BASE } from "@workspace/api-base/scoring-urls";
import {
  getGetTournamentQueryKey,
  useGetTournament,
} from "@workspace/api-client-react";
import { useOrganizerAuth, useOrganizerAccountAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { useBadmintonBranding } from "@/hooks/use-badminton-branding";
import { logoutOrganizerAccount } from "@/lib/auth";
import { clearOrganizerClientState } from "@/lib/organizer-account-auth-cache";
import { useQueryClient } from "@tanstack/react-query";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import type { SportNavChild, SportNavConfig, SportNavItem } from "@/lib/sports-shell-types";
import { cn } from "@/lib/utils";
import { SportsUnavailableView } from "@/components/sports-unavailable-view";
import { isTournamentScoringSport } from "@/hooks/use-platform-features";

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

/** Leave scoring shell: scoring login when in scoring-app, else Auction portal. */
function goToPostLogoutHome() {
  if (isScoringAppHost()) {
    window.location.href = `${SCORING_APP_BASE}/login`;
    return;
  }
  window.location.href = "/organizer";
}

/** Tournament list / portal entry — scoring-safe when hosted under scoring-app. */
function goToTournamentsHome() {
  if (isScoringAppHost()) {
    window.location.href = `${SCORING_APP_BASE}/login`;
    return;
  }
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
  const { organizer, isLoggedIn } = useOrganizerAccountAuth();
  const accountLabel = isLoggedIn && organizer
    ? (organizer.email?.trim() || organizer.mobile?.trim() || organizer.name?.trim() || null)
    : null;

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
  const queryClient = useQueryClient();

  async function handleLogout() {
    await logout();
    if (!isBidWarLocalHost()) {
      await logoutOrganizerAccount();
      clearOrganizerClientState(queryClient);
      goToPostLogoutHome();
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

const NAV_MOTION =
  "duration-[200ms] ease-out motion-reduce:transition-none motion-reduce:transform-none";

function navItemClass(active: boolean, collapsed: boolean) {
  return cn(
    "relative flex items-center rounded-md",
    "transition-[background-color,color,box-shadow] ",
    NAV_MOTION,
    collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full",
    active
      ? "bg-primary/10 text-primary"
      : "bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground",
  );
}

function childNavClass(active: boolean) {
  return cn(
    "relative flex items-center w-full rounded-md pl-2.5 pr-3 py-1.5 text-sm",
    "transition-[background-color,color,font-weight] ",
    NAV_MOTION,
    active
      ? "bg-primary/10 text-primary font-semibold"
      : "bg-transparent text-muted-foreground font-normal hover:bg-accent hover:text-foreground",
  );
}

function NavActiveAccent({ active }: { active: boolean }) {
  return (
    <span
      className={cn(
        "pointer-events-none absolute left-0 top-1/2 w-[2px] -translate-y-1/2 rounded-full bg-primary",
        "origin-center transition-[transform,opacity,height] ",
        NAV_MOTION,
        active ? "h-4 scale-y-100 opacity-100" : "h-4 scale-y-0 opacity-0",
      )}
      aria-hidden
    />
  );
}

/** Combine wouter pathname + search so query-based child active states work. */
function locationWithSearch(pathname: string, search: string): string {
  if (!search) return pathname;
  return search.startsWith("?") ? `${pathname}${search}` : `${pathname}?${search}`;
}

function SportNavChildLink({
  child,
  tournamentId,
  location,
}: {
  child: SportNavChild;
  tournamentId: number;
  location: string;
}) {
  const href = child.href(tournamentId);
  const active = child.isActive(location, tournamentId);

  return (
    <Link
      href={href}
      title={child.label}
      className={childNavClass(active)}
      aria-current={active ? "page" : undefined}
      onMouseEnter={child.preload}
      onFocus={child.preload}
    >
      {/* Per-item tick on the shared vertical guide */}
      <span
        className={cn(
          "pointer-events-none absolute -left-[calc(0.875rem+1px)] top-1/2 h-px w-2.5 -translate-y-1/2",
          "transition-[background-color,opacity] ",
          NAV_MOTION,
          active ? "bg-primary/70 opacity-100" : "bg-border opacity-80",
        )}
        aria-hidden
      />
      <span className="truncate">{child.label}</span>
    </Link>
  );
}

function SportNavSubmenu({
  expanded,
  label,
  children,
}: {
  expanded: boolean;
  label: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden transition-[max-height,opacity] ",
        NAV_MOTION,
        expanded ? "max-h-56 opacity-100" : "max-h-0 opacity-0 pointer-events-none",
      )}
      aria-hidden={!expanded}
    >
      <div
        className={cn(
          "relative ml-[1.375rem] transition-transform ",
          NAV_MOTION,
          expanded ? "translate-y-0" : "-translate-y-1.5",
        )}
        role="group"
        aria-label={`${label} pages`}
      >
        {/* Vertical hierarchy guide — aligns under parent icon */}
        <span
          className="pointer-events-none absolute left-0 top-0.5 bottom-1 w-px bg-border/70"
          aria-hidden
        />
        <div className="space-y-0.5 pl-3.5 pb-1">{children}</div>
      </div>
    </div>
  );
}

function SportNavLink({
  item,
  tournamentId,
  location,
  collapsed,
  expanded,
  onToggleExpanded,
}: {
  item: SportNavItem;
  tournamentId: number;
  location: string;
  collapsed: boolean;
  expanded: boolean;
  onToggleExpanded: () => void;
}) {
  const href = item.href(tournamentId);
  const active = item.isActive(location, tournamentId);
  const Icon = item.icon ?? LayoutDashboard;
  const children = item.children ?? [];
  const hasChildren = children.length > 0;

  // Collapsed rail: parent remains a direct link (children not visible).
  if (collapsed || item.external || !hasChildren) {
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
          {!collapsed ? <NavActiveAccent active={active} /> : null}
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
        {!collapsed ? <NavActiveAccent active={active} /> : null}
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

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        title={item.label}
        aria-expanded={expanded}
        onClick={onToggleExpanded}
        onMouseEnter={item.preload}
        onFocus={item.preload}
        className={cn(navItemClass(active, false), "font-medium text-left")}
      >
        <NavActiveAccent active={active} />
        <Icon className="w-5 h-5 flex-shrink-0" />
        <span className="flex flex-col leading-tight min-w-0 flex-1">
          <span className="truncate">{item.label}</span>
          {item.hint ? (
            <span className="text-[10px] text-muted-foreground/80 normal-case font-normal truncate">
              {item.hint}
            </span>
          ) : null}
        </span>
        <ChevronRight
          className={cn(
            "w-4 h-4 shrink-0 text-muted-foreground transition-transform ",
            NAV_MOTION,
            expanded && "rotate-90",
          )}
          aria-hidden
        />
      </button>
      <SportNavSubmenu expanded={expanded} label={item.label}>
        {children.map((child) => (
          <SportNavChildLink
            key={child.id}
            child={child}
            tournamentId={tournamentId}
            location={location}
          />
        ))}
      </SportNavSubmenu>
    </div>
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
  const search = useSearch();
  const pathForActive = useMemo(
    () => locationWithSearch(location, search),
    [location, search],
  );
  const { logos, brandName, loading: brandingLoading } = useBranding();
  const sidebarLogoSrc =
    cldUrl(logos.appIcon, "appIcon") ||
    cldUrl(logos.mini, "headerLogo") ||
    getBrandLogoSrc(logos, sidebarPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);
  const isBadminton = nav.sportId === "badminton";

  // Badminton: sidebar title from badminton branding only (shared intentionally).
  const { data: badmintonBranding } = useBadmintonBranding(isBadminton ? tournamentId : 0);
  // Tournament row for title (non-badminton) + scoring gate (all sports in this shell).
  const { data: tournament, isPending: tournamentPending } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: tournamentId > 0,
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    },
  });
  const tournamentTitle =
    (isBadminton ? badmintonBranding?.displayName : tournament?.name)?.trim() || "Tournament";
  const localVenue = isBidWarLocalHost();
  const sportForGate = tournament?.sport ?? nav.sportId;
  const scoringDisabled =
    tournamentId > 0 &&
    !tournamentPending &&
    isTournamentScoringSport(sportForGate) &&
    tournament?.scoringEnabled === false;

  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
      return localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Accordion: keep the active parent open; swap smoothly when the route module changes.
  useEffect(() => {
    const activeParent = nav.sections
      .flatMap((section) => section.items)
      .find((item) => item.children?.length && item.isActive(pathForActive, tournamentId));
    if (!activeParent) return;
    setExpandedIds((prev) => {
      if (prev.size === 1 && prev.has(activeParent.id)) return prev;
      return new Set([activeParent.id]);
    });
  }, [nav, pathForActive, tournamentId]);

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
          "lovable-theme flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark",
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
                  onClick={goToTournamentsHome}
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
                    location={pathForActive}
                    collapsed={collapsed}
                    expanded={expandedIds.has(item.id)}
                    onToggleExpanded={() => {
                      setExpandedIds((prev) => {
                        if (prev.has(item.id)) return new Set();
                        return new Set([item.id]);
                      });
                    }}
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

      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none opacity-100"
          style={{
            background:
              "radial-gradient(ellipse at 20% -10%, oklch(0.42 0.15 265 / 0.45), transparent 55%), radial-gradient(ellipse at 90% 0%, oklch(0.85 0.17 88 / 0.08), transparent 50%)",
          }}
        />
        {noPadding ? (
          <div className="flex-1 overflow-y-auto z-0 relative flex flex-col min-h-0">
            {scoringDisabled ? <SportsUnavailableView /> : children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto z-0 relative">
            <div className="p-8 max-w-7xl mx-auto">
              {scoringDisabled ? <SportsUnavailableView /> : children}
            </div>
          </div>
        )}
      </main>
    </div>
    </SportsShellContext.Provider>
  );
}
