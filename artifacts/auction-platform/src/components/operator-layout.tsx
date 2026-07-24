import type { ReactNode } from "react";
import {
  ArrowLeft,
} from "lucide-react";
import { FullscreenButton } from "@/components/fullscreen-button";
import { useGetTournament, getGetTournamentQueryKey } from "@workspace/api-client-react";
import type { ConnectionStatus } from "@/hooks/use-auction-socket";
import type { AuctionFeedState } from "@workspace/api-base/auction-connection-state";
import { AUCTION_FEED_UI, formatLastActivityDiagnostic } from "@workspace/api-base/auction-connection-state";
import { useBranding } from "@/hooks/use-branding";
import { cldUrl } from "@/lib/cloudinary";
import { openSetupArea } from "@/lib/tournament-navigation";
import { getBrandLogoAlt, getBrandLogoSrc } from "@/lib/brand-assets";
import { AuctionFeedIndicator } from "@/components/auction/auction-connection-banner";

type OperatorLayoutProps = {
  tournamentId: number;
  connectionStatus: ConnectionStatus;
  feedState?: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
  auctionStatus: string;
  isTrialMode?: boolean;
  soldCount?: number;
  remainingCount?: number;
  /** Mobile/tablet only — session control (Start / Pause / Conclude) aligned with status row. */
  headerSessionAction?: ReactNode;
  children: ReactNode;
};

const FEED_BADGE_LABEL: Record<AuctionFeedState, string> = {
  live: "Live",
  awaiting_operator_response: "Waiting",
  reconnecting: "Reconnecting",
  disconnected: "Offline",
};

const FEED_BADGE_STYLE: Record<AuctionFeedState, string> = {
  live: "border-green-500/35 bg-green-500/10 text-green-400",
  awaiting_operator_response: "border-yellow-500/35 bg-yellow-500/10 text-yellow-300",
  reconnecting: "border-orange-500/35 bg-orange-500/10 text-orange-400",
  disconnected: "border-red-500/35 bg-red-500/10 text-red-400",
};

function ConnectionBadge({
  status,
  feedState,
  secondsSinceLastActivity,
}: {
  status: ConnectionStatus;
  feedState?: AuctionFeedState;
  secondsSinceLastActivity?: number | null;
}) {
  const resolved: AuctionFeedState = feedState ?? (
    status === "disconnected" ? "disconnected" : status === "reconnecting" ? "reconnecting" : "live"
  );
  const diagnostic = formatLastActivityDiagnostic(secondsSinceLastActivity ?? null);
  const title = diagnostic
    ? `${AUCTION_FEED_UI[resolved].title} · ${diagnostic}`
    : AUCTION_FEED_UI[resolved].subtitle;

  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border ${FEED_BADGE_STYLE[resolved]}`}
    >
      <AuctionFeedIndicator
        feedState={resolved}
        secondsSinceLastActivity={secondsSinceLastActivity}
        className="w-3 h-3"
      />
      {FEED_BADGE_LABEL[resolved]}
    </span>
  );
}

function OperatorAppIcon({ compact = false }: { compact?: boolean }) {
  const { logos, brandName, loading } = useBranding();
  const iconSrc =
    cldUrl(logos.appIcon, "headerLogo") ||
    cldUrl(logos.mini, "headerLogo") ||
    getBrandLogoSrc(logos, ["appIcon", "mini", "main"]);
  const logoAlt = getBrandLogoAlt(brandName);

  if (loading) {
    return <div className={`${compact ? "h-6 w-6" : "h-8 w-8"} flex-shrink-0`} aria-hidden />;
  }

  return (
    <img
      src={iconSrc}
      alt={logoAlt}
      className={`${compact ? "h-6 w-6" : "h-8 w-8"} object-contain flex-shrink-0 rounded-md`}
      loading="eager"
      decoding="async"
    />
  );
}

function AuctionStatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const isActive = normalized === "active";
  const isPaused = normalized === "paused";
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${
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
  feedState,
  secondsSinceLastActivity,
  auctionStatus,
  isTrialMode = false,
  soldCount,
  remainingCount,
  headerSessionAction,
  children,
}: OperatorLayoutProps) {
  const { data: tournament } = useGetTournament(tournamentId, {
    query: {
      queryKey: getGetTournamentQueryKey(tournamentId),
      enabled: !!tournamentId,
    },
  });

  const tournamentName = tournament?.name || "Auction Room";

  const connectionBadge = (
    <ConnectionBadge
      status={connectionStatus}
      feedState={feedState}
      secondsSinceLastActivity={secondsSinceLastActivity}
    />
  );

  const trialBadge = isTrialMode ? (
    <span className="inline-flex items-center flex-shrink-0 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide border border-yellow-500/30 bg-yellow-500/15 text-yellow-400">
      Trial
    </span>
  ) : null;

  const fullscreenButton = (
    <FullscreenButton
      size="sm"
      className="h-11 w-11 lg:h-8 lg:w-8 flex items-center justify-center rounded-md border border-white/12 text-white/60 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
    />
  );

  const setupButton = (
    <button
      type="button"
      onClick={() => openSetupArea(tournamentId)}
      className="h-8 lg:h-8 px-2.5 flex items-center gap-1 rounded-md border border-white/12 text-[11px] font-medium text-white/70 hover:text-white hover:bg-white/8 transition-colors flex-shrink-0"
      title="Return to tournament setup"
      aria-label="Return to tournament setup"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      <span className="hidden sm:inline">Setup</span>
    </button>
  );

  const statusCounters = (
    <div className="flex items-center gap-2 text-[11px] font-medium min-w-0 flex-wrap">
      {typeof soldCount === "number" && (
        <span className="text-white/40">
          SOLD <span className="text-green-400 font-bold">{soldCount}</span>
        </span>
      )}
      {typeof remainingCount === "number" && (
        <span className="text-white/40">
          LEFT <span className="text-white font-bold">{remainingCount}</span>
        </span>
      )}
      <AuctionStatusBadge status={auctionStatus} />
      {trialBadge}
    </div>
  );

  return (
    <div className="flex flex-col h-screen bg-[#0f1117] text-white overflow-hidden dark">
      <header className="flex-shrink-0 flex flex-col border-b border-white/10 bg-[#141720] z-20">
        {/* Desktop (>1024px): single row — Logo | Tournament Name | LIVE | Trial | Fullscreen | Setup */}
        <div className="hidden lg:flex items-center gap-3 px-3 py-2 min-h-[52px]">
          <OperatorAppIcon />
          <h1 className="text-sm font-bold truncate text-white/90 flex-1 min-w-0">
            {tournamentName}
          </h1>
          {connectionBadge}
          {trialBadge}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {fullscreenButton}
            {setupButton}
          </div>
        </div>

        {/* Mobile + Tablet (<lg): compact 2-row console header (~40% shorter than prior 3-row) */}
        <div className="flex lg:hidden flex-col gap-1 px-2.5 py-1.5">
          <div className="flex items-center gap-2 min-h-[32px]">
            <OperatorAppIcon compact />
            <h1 className="text-[13px] font-bold truncate text-white/90 flex-1 min-w-0 leading-tight">
              {tournamentName}
            </h1>
            {connectionBadge}
            {setupButton}
          </div>
          <div className="flex items-center gap-2 min-h-[40px]">
            <div className="flex-1 min-w-0">{statusCounters}</div>
            {headerSessionAction ? (
              <div className="flex-shrink-0">{headerSessionAction}</div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="flex-1 min-h-0 overflow-hidden">{children}</main>
    </div>
  );
}
