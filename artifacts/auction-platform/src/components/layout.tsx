import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  LayoutDashboard, Users, UserPlus, 
  Settings, Activity, BarChart3,
  Link2, LogOut, RefreshCw, ChevronLeft, ChevronRight, MonitorDown, SlidersHorizontal, FileText, Gavel, CircleDot, Sparkles, Menu, X,
} from "lucide-react";
import {
  auctionRoomPath,
  auctionResetPath,
  displayScreenPath,
  mediaCenterPath,
  mediaCenterTournamentPath,
} from "@/lib/tournament-navigation";
import { openScoringApp } from "@workspace/api-base/scoring-urls";
import { getScoringNavLabel } from "@/lib/sport-label";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { logoutOrganizerAccount, checkOrganizerAccountAuth } from "@/lib/auth";
import { useScoringPlatformEnabled } from "@/hooks/use-platform-features";
import { isBuzzStudioEnabled } from "@workspace/api-base/tournament-features";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { TrialLicenseBadge } from "@/components/trial-license-badge";
import { isBidWarLocalHost } from "@/lib/local-mode-host";

const sidebarPreset = getBrandSurfacePreset("sidebar-compact");

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
  scoringEnabled?: boolean | null;
  localModeEnabled?: boolean | null;
};

interface SidebarNavProps {
  expanded: boolean;
  location: string;
  tournamentId: number | undefined;
  tournament: TournamentData | undefined;
  scoringPlatform: boolean;
  buzzStudioActive: boolean;
  localVenue: boolean;
  scoringNavLabel: string;
  onOpenScoringApp: () => void;
}

function navLinkCls(path: string, currentLocation: string, expanded: boolean, tournamentId?: number) {
  let active = currentLocation === path;
  if (!active && tournamentId && path === mediaCenterPath(tournamentId)) {
    active = currentLocation === mediaCenterTournamentPath(tournamentId);
  }
  return `flex items-center rounded-md transition-colors ${
    !expanded ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
  } ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;
}

function SidebarNav({
  expanded,
  location,
  tournamentId,
  tournament,
  scoringPlatform,
  buzzStudioActive,
  localVenue,
  scoringNavLabel,
  onOpenScoringApp,
}: SidebarNavProps) {
  const cls = (path: string) => navLinkCls(path, location, expanded, tournamentId);

  return (
    <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
      {expanded && (
        <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Main Menu
        </div>
      )}
      <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
        {!localVenue ? (
          <Link href="/organizer" title="All Tournaments" className={cls("/organizer")}>
            <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-medium">All Tournaments</span>}
          </Link>
        ) : tournamentId ? (
          <Link href={`/tournament/${tournamentId}/auction`} title="Auction Control" className={cls(`/tournament/${tournamentId}/auction`)}>
            <Gavel className="w-5 h-5 flex-shrink-0" />
            {expanded && <span className="font-medium">Auction Control</span>}
          </Link>
        ) : null}
      </nav>

      {tournamentId && (
        <>
          {expanded && (
            <div className="px-4 mt-7 mb-1 flex items-center gap-2 min-w-0">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                {tournament?.name || "Tournament"}
              </span>
              {tournament?.licenseStatus && tournament.licenseStatus !== "active" && tournament.licenseStatus !== "completed" ? (
                <TrialLicenseBadge className="shrink-0" />
              ) : null}
            </div>
          )}
          {expanded && (
            <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">
              Setup
            </div>
          )}
          {!expanded && <div className="mt-6 mb-2 border-t border-border mx-2" />}
          <nav className={`space-y-1 ${!expanded ? "px-1.5" : "px-2"}`}>
            <Link href={`/tournament/${tournamentId}`} title="Tournament Home" className={cls(`/tournament/${tournamentId}`)}>
              <Activity className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">Tournament Home</span>}
            </Link>
            <Link href={`/tournament/${tournamentId}/teams`} title="Teams" className={cls(`/tournament/${tournamentId}/teams`)}>
              <Users className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">Teams</span>}
            </Link>
            <Link href={`/tournament/${tournamentId}/players`} title="Players" className={cls(`/tournament/${tournamentId}/players`)}>
              <UserPlus className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">Players</span>}
            </Link>
            <Link href={`/tournament/${tournamentId}/categories`} title="Categories" className={cls(`/tournament/${tournamentId}/categories`)}>
              <Settings className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">Categories <span className="text-[10px] text-muted-foreground font-normal">(optional)</span></span>}
            </Link>
            <Link href={`/tournament/${tournamentId}/settings`} title="Tournament Settings" className={cls(`/tournament/${tournamentId}/settings`)}>
              <SlidersHorizontal className="w-5 h-5 flex-shrink-0" />
              {expanded && <span className="font-medium">Settings</span>}
            </Link>
            {buzzStudioActive && !localVenue ? (
              <Link href={mediaCenterPath(tournamentId)} title="Media Center" className={cls(mediaCenterPath(tournamentId))}>
                <Sparkles className="w-5 h-5 flex-shrink-0" />
                {expanded && <span className="font-medium">Media Center</span>}
              </Link>
            ) : null}
            {scoringPlatform && tournament?.scoringEnabled && !localVenue ? (
              <button
                type="button"
                onClick={onOpenScoringApp}
                title={`Open ${scoringNavLabel} in a new tab`}
                className={`flex items-center rounded-md transition-colors font-medium ${
                  !expanded ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
                } text-muted-foreground hover:bg-accent hover:text-foreground border border-primary/20`}
              >
                <CircleDot className="w-5 h-5 flex-shrink-0" />
                {expanded && <span>{scoringNavLabel}</span>}
              </button>
            ) : null}
            {tournament?.status === "completed" ? (
              <Link href={`/tournament/${tournamentId}/reports`} title="Reports & Analytics" className={cls(`/tournament/${tournamentId}/reports`)}>
                <BarChart3 className="w-5 h-5 flex-shrink-0" />
                {expanded && <span className="font-medium">Reports & Analytics</span>}
              </Link>
            ) : (
              <div
                title="Opens after auction is marked completed"
                className={`flex items-center rounded-md cursor-not-allowed select-none ${
                  !expanded ? "justify-center w-9 h-9 mx-auto opacity-30" : "gap-3 px-3 py-2"
                }`}
              >
                <BarChart3 className={`w-5 h-5 flex-shrink-0 ${!expanded ? "" : "opacity-30"}`} />
                {expanded && (
                  <div className="flex flex-col min-w-0 flex-1">
                    <div className="flex items-center gap-2 opacity-30">
                      <span className="font-medium">Reports & Analytics</span>
                      <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto shrink-0">Locked</span>
                    </div>
                    <span className="text-[11px] text-yellow-400/85 leading-tight mt-0.5 normal-case">
                      Opens after auction is marked completed
                    </span>
                  </div>
                )}
              </div>
            )}
            {tournament?.licenseStatus === "active" ? (
              <Link href={`/tournament/${tournamentId}/team-reports`} title="Pre-Auction Reports" className={cls(`/tournament/${tournamentId}/team-reports`)}>
                <FileText className="w-5 h-5 flex-shrink-0" />
                {expanded && <span className="font-medium">Pre-Auction Reports</span>}
              </Link>
            ) : (
              <div
                title="Pre-Auction Reports available only for licensed tournaments"
                className={`flex items-center rounded-md opacity-30 cursor-not-allowed select-none ${
                  !expanded ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2"
                }`}
              >
                <FileText className="w-5 h-5 flex-shrink-0" />
                {expanded && (
                  <>
                    <span className="font-medium">Pre-Auction Reports</span>
                    <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto">Trial</span>
                  </>
                )}
              </div>
            )}
          </nav>

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
              } text-muted-foreground hover:bg-accent hover:text-foreground border border-primary/20`}
            >
              <Gavel className="w-5 h-5 flex-shrink-0" />
              {expanded && <span>Auction Control</span>}
            </a>
            {expanded && (
              <a
                href={displayScreenPath(tournamentId, tournament?.auctionCode)}
                target="_blank"
                rel="noopener noreferrer"
                title={
                  tournament?.auctionCode
                    ? `LED display screen — tournament code: ${tournament.auctionCode}`
                    : "LED display screen — use tournament code to open"
                }
                className="flex items-center gap-3 px-3 py-2 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-all mt-1"
              >
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                <span className="flex flex-col leading-tight min-w-0">
                  <span className="font-medium">LED Display Screen</span>
                  <span className="text-[10px] text-muted-foreground/80 normal-case">
                    (use tournament code to open)
                  </span>
                </span>
              </a>
            )}
            <Link href={`/tournament/${tournamentId}/links`} title="Share Links" className={cls(`/tournament/${tournamentId}/links`)}>
              <Link2 className="w-5 h-5 flex-shrink-0" />
              {expanded && <span>Share Links</span>}
            </Link>
            {expanded && (
              <Link href={auctionResetPath(tournamentId, location)} title="Clear practice auction data before going live" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                location === `/tournament/${tournamentId}/reset` ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
              }`}>
                <RefreshCw className="w-5 h-5 flex-shrink-0" />
                <span>Clear Trial Data</span>
              </Link>
            )}
            {tournament?.localModeEnabled && !localVenue ? (
              <Link href={`/tournament/${tournamentId}/local-mode`} title="Local Mode setup" className={cls(`/tournament/${tournamentId}/local-mode`)}>
                <MonitorDown className="w-5 h-5 flex-shrink-0" />
                {expanded && <span>Local Mode</span>}
              </Link>
            ) : null}
          </nav>
        </>
      )}
    </div>
  );
}

function SidebarAccountFooter({ tournamentId, collapsed }: { tournamentId: number; collapsed: boolean }) {
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
  const [, navigate] = useLocation();

  async function handleLogout() {
    await logout();
    if (!isBidWarLocalHost()) {
      await logoutOrganizerAccount();
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
  const [location] = useLocation();
  const { logos, brandName, loading: brandingLoading } = useBranding();
  const sidebarLogoSrc =
    cldUrl(logos.appIcon, "appIcon") ||
    cldUrl(logos.mini, "headerLogo") ||
    getBrandLogoSrc(logos, sidebarPreset.logoOrder);
  const logoAlt = getBrandLogoAlt(brandName);
  const { data: tournament } = useGetTournament(tournamentId ?? 0, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId ?? 0), enabled: !!tournamentId },
  });
  const scoringPlatform = useScoringPlatformEnabled();
  const buzzStudioActive = isBuzzStudioEnabled(tournament?.features);
  const localVenue = isBidWarLocalHost();
  const scoringNavLabel = getScoringNavLabel(tournament?.sport);

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
    scoringPlatform,
    buzzStudioActive,
    localVenue,
    scoringNavLabel,
    onOpenScoringApp: () => openScoringApp(tournamentId ?? 0, tournament?.sport),
    expanded: false,
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark">
      {/* Mobile sidebar backdrop */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/60 md:hidden"
          onClick={() => setMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile sidebar overlay */}
      <aside
        className={`fixed inset-y-0 left-0 z-30 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:hidden ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-14 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
          {brandingLoading
            ? <div className="h-8 w-8 flex-shrink-0" />
            : <img src={sidebarLogoSrc} alt={logoAlt} className={sidebarPreset.sizeClass} />}
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
        className="hidden md:flex flex-shrink-0 border-r border-border bg-card flex-col z-10 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 56 : 256 }}
      >
        {/* Header */}
        <div className="h-14 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
          {collapsed ? (
            <button
              onClick={toggleCollapsed}
              title="Expand sidebar"
              className="mx-auto text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <>
              {brandingLoading
                ? <div className="h-8 w-8 flex-shrink-0" />
                : <img src={sidebarLogoSrc} alt={logoAlt} className={sidebarPreset.sizeClass} />}
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
      <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
        {noPadding ? (
          <div className="flex-1 overflow-hidden z-0 relative flex flex-col min-h-0">
            {/* Mobile hamburger for noPadding pages */}
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="md:hidden absolute top-3 left-3 z-10 p-2 rounded-md bg-card/80 border border-border text-muted-foreground hover:text-foreground hover:bg-card transition-colors"
            >
              <Menu className="w-4 h-4" />
            </button>
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto z-0 relative">
            {/* Mobile top bar with hamburger */}
            <div className="md:hidden sticky top-0 z-10 h-12 flex items-center px-4 gap-3 border-b border-border bg-background/95 backdrop-blur-sm flex-shrink-0">
              <button
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              {tournament?.name && (
                <p className="text-sm font-medium text-foreground truncate">{tournament.name}</p>
              )}
            </div>
            <div className="px-4 py-5 sm:px-6 sm:py-6 lg:p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

export { FullscreenLayout } from "@/components/fullscreen-layout";
