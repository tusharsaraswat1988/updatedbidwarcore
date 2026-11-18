import { TournamentSummary, ActivityEvent } from './types';

export const MOCK_TOURNAMENTS: TournamentSummary[] = [
  { slug: 'bpl-2026', name: 'BidWar Premier League 2026', status: 'LIVE', summary: 'Ongoing tournament' },
  { slug: 'vdc-badminton', name: 'Varanasi Badminton Cup', status: 'SOON', summary: '5 matches scheduled today' },
  { slug: 'cricket-junior-cup', name: 'Junior Cricket Cup', status: 'COMPLETED', summary: '10 teams participating' },
];

export const MOCK_ACTIVITIES: ActivityEvent[] = [
  { id: '1', timestamp: '14:25', message: 'Team A just bought Player P1 for 500pt', type: 'AUCTION' },
  { id: '2', timestamp: '14:20', message: 'Team B scored 10 runs in last over', type: 'CRICKET' },
];
