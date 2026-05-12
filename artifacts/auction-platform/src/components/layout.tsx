import { ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { 
  Trophy, LayoutDashboard, Users, UserPlus, 
  Settings, Activity, BarChart3, ChevronLeft,
  Link2, Shuffle
} from "lucide-react";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";

interface LayoutProps {
  children: ReactNode;
  tournamentId?: number;
}

export function AppLayout({ children, tournamentId }: LayoutProps) {
  const [location] = useLocation();
  const { data: tournament } = useGetTournament(tournamentId ?? 0, {
    query: { queryKey: getGetTournamentQueryKey(tournamentId ?? 0), enabled: !!tournamentId },
  });

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-primary-foreground dark">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-border bg-card flex flex-col z-10">
        <div className="h-16 flex items-center px-6 border-b border-border">
          <Trophy className="w-6 h-6 text-primary mr-3" />
          <span className="font-display font-bold text-xl tracking-tight text-white uppercase">BIDWAR</span>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          <div className="px-4 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Main Menu
          </div>
          <nav className="space-y-1 px-2">
            <Link href="/" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === '/' ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
              <LayoutDashboard className="w-5 h-5" />
              <span className="font-medium">All Tournaments</span>
            </Link>
          </nav>

          {tournamentId && (
            <>
              <div className="px-4 mt-8 mb-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                {tournament?.name || 'Tournament'}
              </div>
              <nav className="space-y-1 px-2">
                <Link href={`/tournament/${tournamentId}`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Activity className="w-5 h-5" />
                  <span className="font-medium">Hub / Command</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/teams`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/teams` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Users className="w-5 h-5" />
                  <span className="font-medium">Teams</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/players`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/players` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <UserPlus className="w-5 h-5" />
                  <span className="font-medium">Players</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/categories`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/categories` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Settings className="w-5 h-5" />
                  <span className="font-medium">Categories</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/reports`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/reports` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <BarChart3 className="w-5 h-5" />
                  <span className="font-medium">Reports</span>
                </Link>
              </nav>

              <div className="px-4 mt-8 mb-4 text-xs font-semibold text-primary uppercase tracking-wider">
                Live Action
              </div>
              <nav className="space-y-1 px-2">
                <Link href={`/tournament/${tournamentId}/auction`} className="flex items-center gap-3 px-3 py-3 rounded-md bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                  <Activity className="w-5 h-5" />
                  <span>Operator Panel</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/display`} target="_blank" className="flex items-center gap-3 px-3 py-2 mt-2 rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-all">
                  <LayoutDashboard className="w-5 h-5" />
                  <span>Open LED Display</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/fortune-wheel`} target="_blank" className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/fortune-wheel` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Shuffle className="w-5 h-5" />
                  <span>Fortune Wheel</span>
                </Link>
                <Link href={`/tournament/${tournamentId}/links`} className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${location === `/tournament/${tournamentId}/links` ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'}`}>
                  <Link2 className="w-5 h-5" />
                  <span>Share Links</span>
                </Link>
              </nav>
            </>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-background relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/20 via-background to-background pointer-events-none" />
        <div className="flex-1 overflow-y-auto z-0 relative">
          <div className="p-8 max-w-7xl mx-auto">
            {children}
          </div>
        </div>
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
