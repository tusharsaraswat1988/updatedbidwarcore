import { ReactNode, useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Trophy, LayoutDashboard, Users, UserPlus, 
  Settings, Activity, BarChart3, Coffee,
  Link2, LogOut, RefreshCw, ChevronLeft, ChevronRight, MonitorDown,
} from "lucide-react";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { logoutOrganizerAccount } from "@/lib/auth";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";

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
    await logoutOrganizerAccount();
    navigate("/organizer");
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
  const { data: tournament } = useGetTournament(tournamentId ?? 0, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId ?? 0), enabled: !!tournamentId },
  });

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem("sidebar-collapsed") === "true"; } catch { return false; }
  });

  function toggleCollapsed() {
    setCollapsed(prev => {
      const next = !prev;
      try { localStorage.setItem("sidebar-collapsed", String(next)); } catch {}
      return next;
    });
  }

  // Helper: nav link class
  function navCls(path: string) {
    const active = location === path;
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
                : <img src={cldUrl(logos.mini, "headerLogo") || "/bidwar-logo-transparent.png"} alt={brandName} className="h-9 w-9 object-contain flex-shrink-0" />}
              <span className="font-display font-bold text-xl tracking-tight text-white uppercase truncate">{brandName.toUpperCase()}</span>
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
            <Link href="/organizer" title="All Tournaments" className={navCls("/organizer")}>
              <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
              {!collapsed && <span className="font-medium">All Tournaments</span>}
            </Link>
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
                <Link href={`/tournament/${tournamentId}`} title="Auction Control Center" className={navCls(`/tournament/${tournamentId}`)}>
                  <Activity className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span className="font-medium">Control Center</span>}
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
                  {!collapsed && <span className="font-medium">Categories</span>}
                </Link>
                {tournament?.status === "completed" ? (
                  <Link href={`/tournament/${tournamentId}/reports`} title="Reports" className={navCls(`/tournament/${tournamentId}/reports`)}>
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="font-medium">Reports</span>}
                  </Link>
                ) : (
                  <div
                    title="Available after auction is marked completed"
                    className={`flex items-center rounded-md opacity-30 cursor-not-allowed select-none ${
                      collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2"
                    }`}
                  >
                    <BarChart3 className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="font-medium">Reports</span>
                        <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto">Locked</span>
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
                <Link
                  href={`/tournament/${tournamentId}/auction`}
                  title="Operator Panel"
                  className={navCls(`/tournament/${tournamentId}/auction`) + ` font-bold`}
                >
                  <Activity className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>Operator Panel</span>}
                </Link>
                {!collapsed && (
                  <Link
                    href={`/tournament/${tournamentId}/break-timer`}
                    title="Break Timer"
                    className={navCls(`/tournament/${tournamentId}/break-timer`)}
                  >
                    <Coffee className="w-5 h-5 flex-shrink-0" />
                    <span>Break Timer</span>
                  </Link>
                )}
                {!collapsed && (
                  <Link
                    href={`/tournament/${tournamentId}/display`}
                    target="_blank"
                    title="Open LED Display"
                    className="flex items-center gap-3 px-3 py-2 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-all mt-1"
                  >
                    <LayoutDashboard className="w-5 h-5 flex-shrink-0" />
                    <span>Open LED Display</span>
                  </Link>
                )}
                <Link href={`/tournament/${tournamentId}/links`} title="Share Links" className={navCls(`/tournament/${tournamentId}/links`)}>
                  <Link2 className="w-5 h-5 flex-shrink-0" />
                  {!collapsed && <span>Share Links</span>}
                </Link>
                {!collapsed && (
                  <Link href={`/tournament/${tournamentId}/reset`} title="Reset Auction" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                    location === `/tournament/${tournamentId}/reset` ? "bg-red-500/15 text-red-300" : "text-muted-foreground hover:bg-red-500/10 hover:text-red-300"
                  }`}>
                    <RefreshCw className="w-5 h-5 flex-shrink-0" />
                    <span>Reset Auction</span>
                  </Link>
                )}
                {tournament?.localModeEnabled ? (
                  <Link
                    href={`/tournament/${tournamentId}/local-mode`}
                    title="Local Mode"
                    className={navCls(`/tournament/${tournamentId}/local-mode`)}
                  >
                    <MonitorDown className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span>Local Mode</span>}
                  </Link>
                ) : (
                  <div
                    title="Local Mode is not enabled for this tournament. Contact your admin."
                    className={`flex items-center rounded-md opacity-30 cursor-not-allowed select-none ${
                      collapsed ? "justify-center w-9 h-9 mx-auto" : "gap-3 px-3 py-2"
                    }`}
                  >
                    <MonitorDown className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="font-medium">Local Mode</span>
                        <span className="text-[10px] bg-border text-muted-foreground px-1.5 py-0.5 rounded ml-auto">Disabled</span>
                      </>
                    )}
                  </div>
                )}
              </nav>
            </>
          )}
        </div>

        {/* Sign out */}
        {tournamentId && (
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
    <div className="min-h-screen bg-background text-foreground selection:bg-primary selection:text-primary-foreground dark overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/30 via-background to-background pointer-events-none" />
      <div className="relative z-10 w-full h-full">
        {children}
      </div>
    </div>
  );
}
