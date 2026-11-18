import { MOCK_TOURNAMENTS, MOCK_ACTIVITIES } from './fixtures';
import { TournamentSummary, ActivityEvent } from './types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/fan';

export const apiClient = {
  async getTournaments(): Promise<TournamentSummary[]> {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 300));
    return MOCK_TOURNAMENTS;
  },
  async getActivities(): Promise<ActivityEvent[]> {
    return MOCK_ACTIVITIES;
  }
};
