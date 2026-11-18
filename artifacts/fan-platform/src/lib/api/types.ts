export type TournamentStatus = 'LIVE' | 'SOON' | 'COMPLETED';

export interface TournamentSummary {
  slug: string;
  name: string;
  status: TournamentStatus;
  summary: string;
}

export interface TournamentLicensed {
  slug: string;
  name: string;
  teams: { name: string }[];
  venue: string;
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'AUCTION' | 'CRICKET' | 'BADMINTON';
}
