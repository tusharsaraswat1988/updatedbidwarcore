import type { ReactNode } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft,
  ExternalLink,
  LogOut,
  Monitor,
  Radio,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import { useOrganizerAuth } from "@/hooks/use-auth";
import { logoutOrganizerAccount } from "@/lib/auth";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import {
  openDisplayScreen,
  openObsOverlay,
  openSetupArea,
} from "@/lib/tournament-navigation";

type OperatorLayoutProps = {
  tournamentId: number;
  connectionStatus: ConnectionStatus;
  auctionStatus: string;
  children: ReactNode;
};

function ConnectionBadge({ status }: { status: ConnectionStatus }) {
  if (status === "connected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-green-500/35 bg-green-500/10 text-green-400">
        <Wifi className="w-3 h-3" />
        Connected
      </span>
    );
  }
  if (status === "disconnected") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-red-500/35 bg-red-500/10 text-red-400">
        <WifiOff className="w-3 h-3" />
        Disconnected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-amber-500/35 bg-amber-500/10 text-amber-400">
      <RefreshCw className="w-3 h-3 animate-spin" />
      Reconnecting
    </span>
  );
}

function AuctionStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isActive = normalized === "active";
  const isPaused = normalized === "paused";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
        isActive
          ? "bg-green-500/15 border-green-500/40 text-green-400"
          : isPaused
            ? "bg-yellow-500/15 border-yellow-500/40 text-yellow-400"
            : "bg-white/5 border-white/15 text-white/45"
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full bg-current ${isActive ? "animate-pulse" : ""}`}
      />
      {status.toUpperCase() || "IDLE"}
    </span>
  );
}

export function OperatorLayout({
  tournamentId,
  connectionStatus,
  auctionStatus,
  children,
}: OperatorLayoutProps) {
  const [, navigate] = useLocation();
  const { logout } = useOrganizerAuth(tournamentId);
  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  async function handleLogout() {
    await logout();
    await logoutOrganizerAccount();
    navigate("/organizer");
  }

  const auctionCode = (tournament as { auctionCode?: string | null } | undefined)
    ?.auctionCode;

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-white overflow-hidden dark">
      <header className="flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#141720] min-h-[48px] z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h1 className="text-sm font-bold truncate text-white/90 max-w-[200px] sm:max-w-xs">
            {tournament?.name || "Auction Room"}
          </h1>
          <ConnectionBadge status={connectionStatus} />
          <AuctionStatusBadge status={auctionStatus} />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          <button
            type="button"
            onClick={() => openSetupArea(tournamentId)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-white/12 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            title="Return to tournament setup"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Setup</span>
          </button>
          <button
            type="button"
            onClick={() => openDisplayScreen(tournamentId, auctionCode)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-white/12 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            title="Open LED big-screen display in a new tab"
          >
            <Monitor className="w-3.5 h-3.5" />
            <span className="hidden md:inline">LED Screen</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </button>
          <button
            type="button"
            onClick={() => openObsOverlay(tournamentId)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-white/12 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            title="Open OBS browser overlay in a new tab"
          >
            <Radio className="w-3.5 h-3.5" />
            <span className="hidden md:inline">OBS</span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-white/12 text-[11px] font-medium text-white/55 hover:text-red-300 hover:bg-red-500/10 hover:border-red-500/25 transition-colors"
            title="Sign out"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
