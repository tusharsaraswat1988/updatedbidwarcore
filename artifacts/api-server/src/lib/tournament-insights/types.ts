export type TournamentInsightType = "trending" | "insight" | "funFact" | "strategy";

export interface TournamentInsight {
  type: TournamentInsightType;
  emoji: string;
  title: string;
  description: string;
  priority: number;
}

export interface TournamentInsightsSummary {
  tournamentName: string;
  sport: string;
  tournamentPhase: "setup" | "active" | "completed";
  auctionStatus: "idle" | "active" | "paused" | "break" | null;

  totalTeams: number;
  completedTeams: number;

  totalPlayers: number;
  soldPlayers: number;
  unsoldPlayers: number;
  availablePlayers: number;

  highestBid: {
    playerName: string;
    amount: number;
    teamName: string;
  } | null;

  highestRemainingBudgetTeam: { teamName: string; remaining: number } | null;
  lowestRemainingBudgetTeam: { teamName: string; remaining: number } | null;

  totalBudgetSpent: number;
  totalBudgetRemaining: number;

  topSpender: { teamName: string; spent: number } | null;
  biggestBargain: {
    playerName: string;
    soldPrice: number;
    basePrice: number;
    multiplier: number;
  } | null;
  highestBidMultiplier: {
    playerName: string;
    multiplier: number;
    soldPrice: number;
  } | null;
  hottestPlayer: { playerName: string; bidCount: number } | null;

  averagePlayerPrice: number;

  lastFewSales: Array<{ playerName: string; teamName: string; amount: number }>;
  recentAuctionEvents: Array<{ event: string; detail: string }>;
}

export interface TournamentInsightsResponse {
  insights: TournamentInsight[];
  generatedAt: string;
  cacheTtlSeconds: number;
  source: "llm" | "template";
}
