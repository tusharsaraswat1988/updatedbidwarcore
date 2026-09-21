/** Shared shapes for the public cricket tournament experience (Phase 1). */

export type PublicTournamentMeta = {
  id: number;
  name: string;
  sport: string;
  scoringEnabled: boolean;
  status?: string | null;
  scoringPhase?: string | null;
  venue?: string | null;
  city?: string | null;
  logoUrl?: string | null;
  matchDates?: string | null;
  sponsorLogos?: string | null;
  mainBannerUrl?: string | null;
  mainBannerEnabled?: boolean | null;
  variantId?: string | null;
  presentationProfileId?: string | null;
  streamUrl?: string | null;
  liveStreamUrl?: string | null;
};

export type PublicTeam = {
  id: number;
  name: string;
  shortCode: string;
  color: string | null;
  logoUrl?: string | null;
  squadCount?: number;
};

export type PublicMatch = {
  id: number;
  homeTeamId: number;
  awayTeamId: number;
  status: string;
  roundName: string | null;
  scheduledAt: string | null;
  venue?: string | null;
  resultSummary: string | null;
  winnerTeamId?: number | null;
  completedAt?: string | null;
  summaryJson?: Record<string, unknown> | null;
  matchLabel?: string | null;
  displayName?: string | null;
  streamUrl?: string | null;
};

export type PublicFixture = {
  id: number;
  tournamentId: number;
  drawId?: number | null;
  groupId?: number | null;
  bracketRound?: number | null;
  bracketSlot?: number | null;
  fixtureNumber?: number | null;
  roundName?: string | null;
  scheduledAt?: string | null;
  venue?: string | null;
  status: string;
  homeTeamId: number;
  awayTeamId: number;
  winnerTeamId?: number | null;
  resultSummary?: string | null;
};

export type PublicSchedulePayload = {
  tournament: PublicTournamentMeta;
  teams: PublicTeam[];
  fixtures: PublicFixture[];
  matches: PublicMatch[];
  draws: Array<{
    id: number;
    name?: string | null;
    format?: string | null;
    status?: string | null;
    configJson?: Record<string, unknown> | null;
  }>;
};
