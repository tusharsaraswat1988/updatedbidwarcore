import { createContext, ReactNode, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, UserPlus, 
  Settings, Activity, BarChart3,
  Link2, LogOut, RefreshCw, ChevronLeft, ChevronRight, MonitorDown, SlidersHorizontal, Gavel, Sparkles, X,
} from "lucide-react";
import {
  auctionRoomPath,
  auctionResetPath,
  resolveTournamentOrganizerLandingPath,
} from "@/lib/tournament-navigation";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useOrganizerAuth, useOrganizerAccountAuth } from "@/hooks/use-auth";
import { logoutOrganizerAccount } from "@/lib/auth";
import { clearOrganizerClientState } from "@/lib/organizer-account-auth-cache";
import { useQueryClient } from "@tanstack/react-query";
import { CurrentTournamentContext } from "@/components/current-tournament-context";
import {
  BidwarOrganizerBrandMark,
  OrganizerDesktopBrandBar,
  OrganizerMobileTopBar,
  OrganizerShellChromeContext,
} from "@/components/organizer-app-chrome";
import { isBidWarLocalHost } from "@/lib/local-mode-host";
import { isAuctionEnabled, isScoringEnabled } from "@workspace/platform-core";
import { sidebarActiveScrollDelta } from "@/lib/sidebar-active-scroll";

/** Set by the mounted organiser shell so page-level AppLayout wrappers do not render a second sidebar. */
const OrganizerShellContext = createContext(false);

interface LayoutProps {
  children: ReactNode;
  tournamentId?: number;
  /** Remove the default p-8 / max-w-7xl wrapper so the child can own its own layout (e.g. the fullscreen operator panel). */
  noPadding?: boolean;
}

type TournamentData = {
  name?: string | null;
  sport?: string | null;
  auctionCode?: string | null;
  status?: string | null;
  licenseStatus?: string | null;
  features?: unknown;
  auctionEnabled?: boolean | null;
  scoringEnabled?: boolean | null;
  localModeEnabled?: boolean | null;
};

interface SidebarNavProps {
  expanded: boolean;
  location: string;
  tournamentId: number | undefined;
  tournament: TournamentData | undefined;
  localVenue: boolean;
}

function navLinkCls(path: string, currentLocation: string, expanded: boolean, _tournamentId?: number) {
  const active = currentLocation === path;
  return `relative flex items-center rounded-md transition-colors cursor-pointer ${
    !expanded ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
  } ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground"}`;
}

function isNavActive(path: string, currentLocation: string, _tournamentId?: number) {
  return currentLocation === path;
}

function SidebarLink({
  href,
  title,
  className,
  active,
  showAccent,
  children,
}: {
  href: string;
  title: string;
  className: string;
  active: boolean;
  showAccent: boolean;
  children: ReactNode;
}) {
  return (
    <Link href={href} title={title} className={className} aria-current={active ? "page" : undefined}>
      {showAccent && active ? (
        <span
          className="pointer-events-none absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary"
          aria-hidden
        />
      ) : null}
      {children}
    </Link>
  );
}

function SidebarNav({
  expanded,
  location,
  tournamentId,
  tournament,
  localVenue,
}: SidebarNavProps) {
  const cls = (path: string) => navLinkCls(path, location, expanded, tournamentId);
  const active = (path: string) => isNavActive(path, location, tournamentId);
  const auctionActive = isAuctionEnabled(tournament);
  const scoringActive = isScoringEnabled(tournament);
  const tournamentLandingHref =
    tournamentId && tournament
      ? resolveTournamentOrganizerLandingPath(tournamentId, tournament)
      : tournamentId
        ? `/tournament/${tournamentId}/auction-overview`
        : "/organizer";
  const scrollRef = useRef<HTMLDivElement>(null);
  const menuLayoutKey = [
    expanded,
    auctionActive,
    scoringActive,
    localVenue,
    tournament?.name,
    tournament?.status,
    tournament?.licenseStatus,
    tournament?.sport,
    tournament?.localModeEnabled,
  ].join("|");

  useLayoutEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const active = container.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active) return;
    const delta = sidebarActiveScrollDelta(container.getBoundingClientRect(), active.getBoundingClientRect());
    if (delta !== 0) container.scrollTop += delta;
  }, [location, menuLayoutKey]);

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
      {expanded && (
        <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Main Menu
        </div>
      )}
      <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
        {!localVenue ? (
          <SidebarLink href="/organizer" title="All Tournaments" className={cls("/organizer")} active={active("/organizer")} showAccent={expanded}>
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-medium">All Tournaments</span>}
          </SidebarLink>
        ) : tournamentId ? (
          <SidebarLink
            href={`/tournament/${tournamentId}/auction`}
            title="Auction Control"
            className={cls(`/tournament/${tournamentId}/auction`)}
            active={active(`/tournament/${tournamentId}/auction`)}
            showAccent={expanded}
          >
            <Gavel className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-medium">Auction Control</span>}
          </SidebarLink>
        ) : null}
      </nav>

      {tournamentId && (
        <>
          <CurrentTournamentContext
            tournamentId={tournamentId}
            name={tournament?.name}
            status={tournament?.status}
            licenseStatus={tournament?.licenseStatus}
            expanded={expanded}
            overviewHref={tournamentLandingHref}
          />
          {expanded && (
            <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">
              Setup
            </div>
          )}
          {!expanded && <div className="mb-2 border-t border-border mx-2" />}
          <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
            {auctionActive && (
              <>
                <SidebarLink href={`/tournament/${tournamentId}/auction-overview`} title="Auction Overview" className={cls(`/tournament/${tournamentId}/auction-overview`)} active={active(`/tournament/${tournamentId}/auction-overview`) || active(`/tournament/${tournamentId}/overview`)} showAccent={expanded}>
                  <Gavel className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="font-medium">Auction Overview</span>}
                </SidebarLink>
                <SidebarLink href={`/tournament/${tournamentId}/teams`} title="Teams" className={cls(`/tournament/${tournamentId}/teams`)} active={active(`/tournament/${tournamentId}/teams`)} showAccent={expanded}>
                  <Users className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="font-medium">Teams</span>}
                </SidebarLink>
                <SidebarLink href={`/tournament/${tournamentId}/players`} title="Players" className={cls(`/tournament/${tournamentId}/players`)} active={active(`/tournament/${tournamentId}/players`)} showAccent={expanded}>
                  <UserPlus className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="font-medium">Players</span>}
                </SidebarLink>
                <SidebarLink href={`/tournament/${tournamentId}/categories`} title="Categories" className={cls(`/tournament/${tournamentId}/categories`)} active={active(`/tournament/${tournamentId}/categories`)} showAccent={expanded}>
                  <SlidersHorizontal className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="font-medium">Categories</span>}
                </SidebarLink>
              </>
            )}
            <SidebarLink href={`/tournament/${tournamentId}/settings`} title={auctionActive ? "Auction Setting" : "Tournament Settings"} className={cls(`/tournament/${tournamentId}/settings`)} active={active(`/tournament/${tournamentId}/settings`)} showAccent={expanded}>
              <Settings className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">{auctionActive ? "Auction Setting" : "Settings"}</span>}
            </SidebarLink>
            {auctionActive && (
              <>
                <SidebarLink href={`/tournament/${tournamentId}/reports`} title="Reports" className={cls(`/tournament/${tournamentId}/reports`)} active={active(`/tournament/${tournamentId}/reports`)} showAccent={expanded}>
                  <BarChart3 className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span className="font-medium">Reports</span>}
                </SidebarLink>
              </>
            )}
          </nav>

          {auctionActive && (
            <>
              {expanded && (
                <div className="px-4 mt-7 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Run the Auction
                </div>
              )}
              {!expanded && <div className="mt-6 mb-2 border-t border-border mx-2" />}
              <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
                <a
                  href={auctionRoomPath(tournamentId)}
                  target="_blank"
                  title="Open auction control in a new tab"
                  className={`flex items-center rounded-md transition-colors font-bold ${
                    !expanded ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
                  } text-muted-foreground hover:bg-white/[0.06] hover:text-foreground border border-primary/20`}
                >
                  <Gavel className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span>Auction Control</span>}
                </a>
                <SidebarLink href={`/tournament/${tournamentId}/links`} title="Links" className={cls(`/tournament/${tournamentId}/links`)} active={active(`/tournament/${tournamentId}/links`)} showAccent={expanded}>
                  <Link2 className="w-5 h-5 flex-shrink-0" />
                  {expanded && <span>Links</span>}
                </SidebarLink>
                {expanded && tournament?.licenseStatus === "trial" && (
                  <SidebarLink
                    href={auctionResetPath(tournamentId, location)}
                    title="Clear practice auction data before going live"
                    className={`relative flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                      location === `/tournament/${tournamentId}/reset` ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                    }`}
                    active={location === `/tournament/${tournamentId}/reset`}
                    showAccent={false}
                  >
                    <RefreshCw className="w-5 h-5 flex-shrink-0" />
                    <span>Clear Trial Data</span>
                  </SidebarLink>
                )}
                {tournament?.localModeEnabled && !localVenue ? (
                  <SidebarLink href={`/tournament/${tournamentId}/local-mode`} title="Local Mode setup" className={cls(`/tournament/${tournamentId}/local-mode`)} active={active(`/tournament/${tournamentId}/local-mode`)} showAccent={expanded}>
                    <MonitorDown className="w-5 h-5 flex-shrink-0" />
                    {expanded && <span>Local Mode (Offline)</span>}
                  </SidebarLink>
                ) : null}
              </nav>
            </>
          )}

          {/* ── Match Scoring (scoring-only shell — hidden inside Auction module sidebar) ── */}
          {scoringActive && !auctionActive && (
            <>
              {expanded && (
                <div className="px-4 mt-7 mb-3 text-xs font-semibold text-sky-400 uppercase tracking-wider flex items-center justify-between">
                  <span>Match Scoring</span>
                  <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                </div>
              )}
              {!expanded && <div className="mt-6 mb-2 border-t border-sky-500/30 mx-2" />}
              <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
                <SidebarLink
                  href={tournament?.sport === "badminton" ? `/scoring-app/tournament/${tournamentId}/badminton` : `/scoring-app/tournament/${tournamentId}/score`}
                  title="Match Scoring Hub & Dashboard"
                  className={cls(tournament?.sport === "badminton" ? `/scoring-app/tournament/${tournamentId}/badminton` : `/scoring-app/tournament/${tournamentId}/score`)}
                  active={active(tournament?.sport === "badminton" ? `/scoring-app/tournament/${tournamentId}/badminton` : `/scoring-app/tournament/${tournamentId}/score`)}
                  showAccent={expanded}
                >
                  <Activity className="w-5 h-5 flex-shrink-0 text-sky-400" />
                  {expanded && <span className="font-semibold text-sky-200">Scoring Hub</span>}
                </SidebarLink>
                {tournament?.sport === "cricket" && (
                  <>
                    <SidebarLink
                      href={`/scoring-app/tournament/${tournamentId}/score/fixtures`}
                      title="Fixtures & Matches"
                      className={cls(`/scoring-app/tournament/${tournamentId}/score/fixtures`)}
                      active={active(`/scoring-app/tournament/${tournamentId}/score/fixtures`)}
                      showAccent={expanded}
                    >
                      <LayoutDashboard className="w-5 h-5 flex-shrink-0 text-sky-400/80" />
                      {expanded && <span>Fixtures</span>}
                    </SidebarLink>
                    <SidebarLink
                      href={`/scoring-app/tournament/${tournamentId}/score/rules`}
                      title="Rules & Format"
                      className={cls(`/scoring-app/tournament/${tournamentId}/score/rules`)}
                      active={active(`/scoring-app/tournament/${tournamentId}/score/rules`)}
                      showAccent={expanded}
                    >
                      <SlidersHorizontal className="w-5 h-5 flex-shrink-0 text-sky-400/80" />
                      {expanded && <span>Rules & Format</span>}
                    </SidebarLink>
                  </>
                )}
              </nav>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SidebarAccountFooter({ tournamentId, collapsed }: { tournamentId: number; collapsed: boolean }) {
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
  const [, navigate] = useLocation();

  async function handleLogout() {
    if (isBidWarLocalHost()) {
      await logout();
    } else {
      await logoutOrganizerAccount();
      clearOrganizerClientState(queryClient);
      navigate("/organizer");
    }
  }

  if (iconOnly) {
    return (
      <button
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
      onClick={handleLogout}
      className="flex items-center gap-3 w-full px-3 py-2 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors text-sm font-medium"
    >
      <LogOut className="w-4 h-4" />
      <span>Sign Out</span>
    </button>
  );
}

export function AppLayout({ children, tournamentId, noPadding }: LayoutProps) {
  const inShell = useContext(OrganizerShellContext);
  if (inShell) return <>{children}</>;
  return (
    <OrganizerShellContext.Provider value={true}>
      <OrganizerAppLayout tournamentId={tournamentId} noPadding={noPadding}>
        {children}
      </OrganizerAppLayout>
    </OrganizerShellContext.Provider>
  );
}

function OrganizerAppLayout({ children, tournamentId, noPadding }: LayoutProps) {
  const [location] = useLocation();
  const { data: tournament } = useGetTournament(tournamentId ?? 0, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId ?? 0), enabled: !!tournamentId },
  });
  const localVenue = isBidWarLocalHost();

  // Three sidebar states:
  // - mobile (< 768px): hidden by default, opens as overlay drawer
  // - tablet (768px–1023px): always collapsed (icon-only)
  // - desktop (≥ 1024px): full or collapsed based on localStorage
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch { return false; }
  });

  useEffect(() => {
    const mqTablet = window.matchMedia("(max-width: 1023px)");
    function sync(e: MediaQueryList | MediaQueryListEvent) {
      const narrow = "matches" in e ? e.matches : mqTablet.matches;
      if (narrow) {
        setCollapsed(true);
      } else {
        try {
          setCollapsed(localStorage.getItem("sidebar-collapsed") === "true");
        } catch {
          setCollapsed(false);
        }
      }
    }
    sync(mqTablet);
    mqTablet.addEventListener("change", sync);
    return () => mqTablet.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  const sidebarNavProps: SidebarNavProps = {
    location,
    tournamentId,
    tournament,
    localVenue,
    expanded: false,
  };

  const tournamentName = tournament?.name?.trim() || null;
  const shellChrome = {
    tournamentInAppChrome: !!(tournamentId && tournamentName),
  };

  return (
    <OrganizerShellChromeContext.Provider value={shellChrome}>
    <div className="lovable-theme auction-ops flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark">
      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-stage/70 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-card/95 backdrop-blur-md border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0 pointer-events-auto" : "-translate-x-full pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        <div className="h-14 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
          <BidwarOrganizerBrandMark surface="organizer-main-toolbar" className="min-w-0 flex-1" />
          <button
            onClick={() => setMobileOpen(false)}
            title="Close menu"
            aria-label="Close sidebar"
            className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <SidebarNav {...sidebarNavProps} expanded={true} />
        {tournamentId && !localVenue && (
          <SidebarAccountFooter tournamentId={tournamentId} collapsed={false} />
        )}
      </aside>

      {/* Desktop sidebar — icon-only on tablet, full on desktop */}
      <aside
        className="hidden md:flex flex-shrink-0 border-r border-border bg-card/90 backdrop-blur-md flex-col z-10 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 56 : 256 }}
      >
        {/* Header */}
        <div className="h-14 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
          {collapsed ? (
            <div className="flex flex-col items-center gap-1.5 w-full py-0.5">
              <BidwarOrganizerBrandMark surface="organizer-main-toolbar" iconOnly />
              <button
                onClick={toggleCollapsed}
                title="Expand sidebar"
                className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              <BidwarOrganizerBrandMark surface="organizer-sidebar-wordmark" className="min-w-0 flex-1" />
              <button
                onClick={toggleCollapsed}
                title="Collapse sidebar"
                className="ml-auto flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        <SidebarNav {...sidebarNavProps} expanded={!collapsed} />

        {/* Sign out — cloud only; local uses auto venue session */}
        {tournamentId && !localVenue && (
          <SidebarAccountFooter tournamentId={tournamentId} collapsed={collapsed} />
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-transparent relative overflow-hidden">
        {noPadding ? (
          <div className="flex-1 overflow-hidden z-0 relative flex flex-col min-h-0">
            <OrganizerMobileTopBar
              onOpenMenu={() => setMobileOpen(true)}
              menuExpanded={mobileOpen}
              tournamentName={tournamentName}
            />
            <OrganizerDesktopBrandBar tournamentName={tournamentName} />
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto overflow-x-hidden z-0 relative flex flex-col min-h-0">
            <OrganizerMobileTopBar
              onOpenMenu={() => setMobileOpen(true)}
              menuExpanded={mobileOpen}
              tournamentName={tournamentName}
            />
            <OrganizerDesktopBrandBar tournamentName={tournamentName} />
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-7 w-full max-w-[90rem] mx-auto flex-1 min-w-0">
              {children}
            </div>
          </div>
        )}
      </main>

    </div>
    </OrganizerShellChromeContext.Provider>
  );
}

export { FullscreenLayout } from "@/components/fullscreen-layout";
