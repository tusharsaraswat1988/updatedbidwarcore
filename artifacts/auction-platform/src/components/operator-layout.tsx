import type { ReactNode } from "react";
import {
  ArrowLeft,
  RefreshCw,
  Wifi,
  WifiOff,
} from "lucide-react";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { openSetupArea } from "@/lib/tournament-navigation";

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

function OperatorAppIcon() {
  const { logos, brandName, loading } = useBranding();
  const iconSrc =
    cldUrl(logos.appIcon, "headerLogo") ||
    cldUrl(logos.mini, "headerLogo") ||
    "/bidwar-logo-transparent.png";

  if (loading) {
    return <div className="h-8 w-8 flex-shrink-0" aria-hidden />;
  }

  return (
    <img
      src={iconSrc}
      alt={brandName}
      className="h-8 w-8 object-contain flex-shrink-0 rounded-md"
      loading="eager"
      decoding="async"
    />
  );
}

function OperatorCenterBrand() {
  const { logos, brandName, poweredByText, loading } = useBranding();
  const mainLogoSrc = cldUrl(logos.main, "headerLogo");

  if (loading) {
    return <div className="h-11 w-32" aria-hidden />;
  }

  return (
    <div className="flex flex-col items-center gap-0.5 leading-none text-center px-3 py-1 rounded-lg bg-white/[0.03] border border-white/8">
      {mainLogoSrc ? (
        <img
          src={mainLogoSrc}
          alt={brandName}
          className="h-7 sm:h-8 max-w-[160px] sm:max-w-[200px] object-contain"
          loading="eager"
          decoding="async"
        />
      ) : (
        <span className="font-display font-black text-sm sm:text-base tracking-tight text-white uppercase">
          {brandName}
        </span>
      )}
      <span className="text-[8px] sm:text-[9px] font-semibold uppercase tracking-[0.22em] text-white/40 whitespace-nowrap">
        {poweredByText}
      </span>
    </div>
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
  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-white overflow-hidden dark">
      <header className="relative flex-shrink-0 flex items-center gap-2 px-3 py-2 border-b border-white/10 bg-[#141720] min-h-[52px] z-20">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <OperatorAppIcon />
          <h1 className="text-sm font-bold truncate text-white/90 max-w-[140px] sm:max-w-xs">
            {tournament?.name || "Auction Room"}
          </h1>
          <ConnectionBadge status={connectionStatus} />
          <AuctionStatusBadge status={auctionStatus} />
        </div>

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none">
          <OperatorCenterBrand />
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0 flex-1 justify-end">
          <button
            type="button"
            onClick={() => openSetupArea(tournamentId)}
            className="h-8 px-2.5 flex items-center gap-1.5 rounded-md border border-white/12 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors"
            title="Return to tournament setup"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Back to Setup</span>
          </button>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {children}
      </main>
    </div>
  );
}
