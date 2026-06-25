import { ReactNode, useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { 
  Trophy, LayoutDashboard, Users, UserPlus, 
  Settings, Activity, BarChart3,
  Link2, LogOut, RefreshCw, ChevronLeft, ChevronRight, MonitorDown, SlidersHorizontal, FileText, Gavel, CircleDot, Calendar, Globe, Sparkles,
} from "lucide-react";
import {
  auctionRoomPath,
  auctionResetPath,
  cricketPublicPath,
  displayScreenPath,
  mediaCenterPath,
  scoringPath,
  scoringSchedulePath,
} from "@/lib/tournament-navigation";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
import { logoutOrganizerAccount } from "@/lib/auth";
import { useBadmintonScoringActive, useCricketScoringActive } from "@/hooks/use-platform-features";
import { isBuzzStudioEnabled } from "@workspace/api-base/tournament-features";
import { cldUrl } from "@/lib/cloudinary";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { getBrandSurfacePreset } from "@/lib/brand-usage";
import { isBidWarLocalHost } from "@/lib/local-mode-host";

const sidebarPreset = getBrandSurfacePreset("sidebar-compact");

interface LayoutProps {
  children: ReactNode;
  tournamentId?: number;
  /** Remove the default p-8 / max-w-7xl wrapper so the child can own its own layout (e.g. the fullscreen operator panel). */
  noPadding?: boolean;
}

function LogoutButton({ tournamentId, iconOnly }: { tournamentId: number; iconOnly?: boolean }) {
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
        title="Sign Out"
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
  const cricketScoringActive = useCricketScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const badmintonScoringActive = useBadmintonScoringActive(tournament?.sport, tournament?.scoringEnabled);
  const buzzStudioActive = isBuzzStudioEnabled(tournament?.features);
  const localVenue = isBidWarLocalHost();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      if (typeof window !== "undefined" && window.innerWidth < 1024) return true;
      return localStorage.getItem("sidebar-collapsed") === "true";
    } catch { return false; }
  });
  // Auto-collapse sidebar on narrow viewports so main content is never squeezed
  // (e.g. accidental mobile emulation or small browser window).
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    function sync(e: MediaQueryList | MediaQueryListEvent) {
      const narrow = "matches" in e ? e.matches : mq.matches;
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
    sync(mq);
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  // Helper: nav link class
  function navCls(path: string) {
    let active = location === path;
    if (!active && tournamentId && path === mediaCenterPath(tournamentId)) {
      active = location === mediaCenterTournamentPath(tournamentId);
    }
    return `flex items-center rounded-md transition-colors ${
      collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
    } ${active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`;
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark">
      {/* Sidebar */}
      <aside
        className="flex-shrink-0 border-r border-border bg-card flex flex-col z-10 transition-[width] duration-200 ease-in-out overflow-hidden"
        style={{ width: collapsed ? 56 : 256 }}
      >
        {/* Header */}
        <div className="h-16 flex items-center border-b border-border flex-shrink-0 px-3 gap-2 min-w-0">
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
                ? <div className="h-9 w-9 flex-shrink-0" />
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

        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden">
          {/* Main Menu */}
          {!collapsed && (
            <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Main Menu
            </div>
          )}
          <nav className={`space-y-1 ${collapsed ? "px-1.5" : "px-2"}`}>
            {!localVenue ? (
              <Link href="/organizer" title="All Tournaments" className={navCls("/organizer")}>
                <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">All Tournaments</span>}
              </Link>
            ) : tournamentId ? (
              <Link href={`/tournament/${tournamentId}/auction`} title="Auction Control" className={navCls(`/tournament/${tournamentId}/auction`)}>
                <Gavel className="w-5 h-5 flex-shrink-0" />
                {!collapsed && <span className="font-medium">Auction Control</span>}
              </Link>
            ) : null}
          </nav>

          {tournamentId && (
            <>
              {!collapsed && (
                <div className="px-4 mt-7 mb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wider truncate">
                  {tournament?.name || "Tournament"}
                </div>
              )}
              {!collapsed && (
                <div className="px-4 mb-3 text-xs font-semibold text-muted-foreground/50 uppercase tracking-wider">
                  Setup
                </div>
              )}
              {collapsed && <div className="mt-6 mb-2 border-t border-border mx-2" />}
              <nav className={`space-y-1 ${collapsed ? "px-1.5" : "px-2"}`}>
                <Link href={`/tournament/${tournamentId}`} title="Tournament Home" className={navCls(`/tournament/${tournamentId}`)}>
                  <Activity className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Tournament Home</span>}
                </Link>
                <Link href={`/tournament/${tournamentId}/teams`} title="Teams" className={navCls(`/tournament/${tournamentId}/teams`)}>
                  <Users className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Teams</span>}
                </Link>
                <Link href={`/tournament/${tournamentId}/players`} title="Players" className={navCls(`/tournament/${tournamentId}/players`)}>
                  <UserPlus className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Players</span>}
                </Link>
                <Link href={`/tournament/${tournamentId}/categories`} title="Categories" className={navCls(`/tournament/${tournamentId}/categories`)}>
                  <Settings className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Categories <span className="text-[10px] text-muted-foreground font-normal">(optional)</span></span>}
                </Link>
                <Link href={`/tournament/${tournamentId}/settings`} title="Tournament Settings" className={navCls(`/tournament/${tournamentId}/settings`)}>
                  <SlidersHorizontal className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Settings</span>}
                </Link>
                {buzzStudioActive && !localVenue ? (
                  <Link href={mediaCenterPath(tournamentId)} title="Media Center" className={navCls(mediaCenterPath(tournamentId))}>
                    <Sparkles className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Media Center</span>}
                  </Link>
                ) : null}
                {cricketScoringActive && !localVenue ? (
                  <>
                    <Link href={scoringPath(tournamentId)} title="Match Scoring" className={navCls(`/tournament/${tournamentId}/score`)}>
                      <CircleDot className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="font-medium">Match Scoring</span>}
                    </Link>
                    <Link
                      href={scoringSchedulePath(tournamentId)}
                      title="Fixtures & Schedule"
                      className={navCls(`/tournament/${tournamentId}/score/schedule`)}
                    >
                      <Calendar className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && <span className="font-medium">Schedule</span>}
                    </Link>
                    <Link
                      href={cricketPublicPath(tournamentId)}
                      title="Public scorecards & leaderboards"
                      className={navCls(`/tournament/${tournamentId}/cricket`)}
                    >
                      <Globe className="w-5 h-5 flex-shrink-0" />
                      {!collapsed && (
                        <span className="font-medium">
                          Fan page
                          <span className="block text-[10px] text-muted-foreground font-normal">
                            Scorecards & stats
                          </span>
                        </span>
                      )}
                    </Link>
                  </>
                ) : null}
                {badmintonScoringActive && !localVenue ? (
                  <Link href={`/tournament/${tournamentId}/badminton`} title="Badminton Scoring" className={navCls(`/tournament/${tournamentId}/badminton`)}>
                    <Trophy className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Badminton Scoring</span>}
                  </Link>
                ) : null}
                {tournament?.status === "completed" ? (
                  <Link href={`/tournament/${tournamentId}/reports`} title="Reports & Analytics" className={navCls(`/tournament/${tournamentId}/reports`)}>
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Reports & Analytics</span>}
                  </Link>
                ) : (
                  <div
                    title="Opens after auction is marked completed"
                    className={`flex items-center rounded-md opacity-30 cursor-not-allowed select-none ${
                      collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <div className="flex flex-col min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">Reports & Analytics</span>
                          <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto shrink-0">Locked</span>
                        </div>
                        <span className="text-[10px] text-muted-foreground leading-tight mt-0.5">
                          Opens after auction is marked completed
                        </span>
                      </div>
                    )}
                  </div>
                )}
                {tournament?.licenseStatus === "active" ? (
                  <Link href={`/tournament/${tournamentId}/team-reports`} title="Pre-Auction Reports" className={navCls(`/tournament/${tournamentId}/team-reports`)}>
                    <FileText className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Pre-Auction Reports</span>}
                  </Link>
                ) : (
                  <div
                    title="Pre-Auction Reports available only for licensed tournaments"
                    className={`flex items-center rounded-md opacity-30 cursor-not-allowed select-none ${
                      collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2"
                    }`}
                  >
                    <FileText className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="font-medium">Pre-Auction Reports</span>
                        <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto">Practice</span>
                      </>
                    )}
                  </div>
                )}
              </nav>

              {!collapsed && (
                <div className="px-4 mt-7 mb-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Run the Auction
                </div>
              )}
              {collapsed && <div className="mt-6 mb-2 border-t border-border mx-2" />}
              <nav className={`space-y-1 ${collapsed ? "px-1.5" : "px-2"}`}>
                <a
                  href={auctionRoomPath(tournamentId)}
                  target="_blank"
                  title="Open auction control in a new tab"
                  className={`flex items-center rounded-md transition-colors font-bold ${
                    collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2 w-full"
                  } text-muted-foreground hover:bg-accent hover:text-foreground border border-primary/20`}
                >
                  <Gavel className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>Auction Control</span>}
                </a>
                {!collapsed && (
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
                <Link href={`/tournament/${tournamentId}/links`} title="Share Links" className={navCls(`/tournament/${tournamentId}/links`)}>
                  <Link2 className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>Share Links</span>}
                </Link>
                {!collapsed && (
                  <Link href={auctionResetPath(tournamentId, location)} title="Clear practice auction data before going live" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    location === `/tournament/${tournamentId}/reset` ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                  }`}>
                    <RefreshCw className="w-5 h-5 flex-shrink-0" />
                    <span>Clear Practice Data</span>
                  </Link>
                )}
                {tournament?.localModeEnabled && !localVenue ? (
                  <Link href={`/tournament/${tournamentId}/local-mode`} title="Local Mode setup" className={navCls(`/tournament/${tournamentId}/local-mode`)}>
                    <MonitorDown className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>Local Mode</span>}
                  </Link>
                ) : null}
              </nav>
            </>
          )}
        </div>

        {/* Sign out — cloud only; local uses auto venue session */}
        {tournamentId && !localVenue && (
          <div className="border-t border-border p-3 flex-shrink-0">
            <LogoutButton tournamentId={tournamentId} iconOnly={collapsed} />
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
        {noPadding ? (
          <div className="flex-1 overflow-hidden z-0 relative flex flex-col min-h-0">
            {children}
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto z-0 relative">
            <div className="p-8 max-w-7xl mx-auto">
              {children}
            </div>
          </div>
        )}
      </main>

    </div>
  );
}

export function FullscreenLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground dark overflow-x-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/30 via-background to-background pointer-events-none" />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
