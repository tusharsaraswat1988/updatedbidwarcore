export type TournamentStatus = 'LIVE' | 'UPCOMING' | 'TODAY' | 'COMPLETED';

export interface TournamentSummary {
  slug: string;
  id: number;
  name: string;
  sport: string;
  status: TournamentStatus;
  dbStatus: string | null;
  city: string | null;
  venue: string | null;
  auctionDate: string | null;
  auctionTime: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  mainBannerUrl?: string | null;
  mainBannerFit?: string | null;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  sponsorLogos?: string | null;
  /** Present when the tournament is on BidWar but has no live module. */
  licensed: boolean;
  featured: boolean;
  featuredPriority: number;
  featuredStartDate?: string | null;
  featuredEndDate?: string | null;
  capabilities?: {
    capabilities?: string[];
    isPubliclyVisible?: boolean;
    activeModules?: string[];
  };

  /** Derived live gameplay indicators */
  liveState?: {
    isLive: boolean;
    primaryLiveType: 'auction' | 'match' | 'stream' | 'none';
    liveMatchCount: number;
    isAuctionLive: boolean;
    isStreaming: boolean;
  };

  /** Organizer-configured public streaming status */
  streamInfo?: {
    enabled: boolean;
    streamUrl: string | null;
    provider: 'youtube' | 'twitch' | 'custom' | null;
  } | null;

  /** Lightweight match scoring preview (populated when match is live) */
  liveMatchSummary?: {
    matchId: number;
    matchLabel: string;
    homeTeam: { id: number; name: string; shortName?: string; logoUrl?: string };
    awayTeam: { id: number; name: string; shortName?: string; logoUrl?: string };
    scoreSummary: string; // e.g. "Titans 142/3 (15.2 ov)"
    targetSummary?: string | null;
    currentBatters?: string[];
    currentBowler?: string | null;
  } | null;

  /** Lightweight auction preview (populated when auction is live) */
  liveAuctionSummary?: {
    currentPlayerId?: number | null;
    currentPlayerName?: string | null;
    currentPlayerRole?: string | null;
    currentPlayerCategory?: string | null;
    currentPlayerPhotoUrl?: string | null;
    currentBid?: number | null;
    currentBidTeamName?: string | null;
    currentBidTeamLogoUrl?: string | null;
    soldCount: number;
    unsoldCount: number;
    totalPlayers: number;
  } | null;
}

export interface FanDiscoveryResponse {
  items: TournamentSummary[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  summary: {
    live: number;
    upcoming: number;
    today: number;
    completed: number;
    total: number;
  };
}

export interface ActivityEvent {
  id: string;
  tournamentId: number;
  tournamentName: string;
  sport: string;
  timestamp: string;
  message: string;
  type: 'AUCTION' | 'CRICKET' | 'BADMINTON';
  badge?: string;
}
