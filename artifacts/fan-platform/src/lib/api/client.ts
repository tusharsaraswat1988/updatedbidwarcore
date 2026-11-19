import { TournamentSummary, FanDiscoveryResponse, ActivityEvent } from './types';

export interface TournamentQueryParams {
  search?: string;
  city?: string;
  sport?: string;
  status?: string;
  featured?: boolean;
  page?: number;
  limit?: number;
}

export const apiClient = {
  async getTournaments(params: TournamentQueryParams = {}): Promise<FanDiscoveryResponse> {
    const qs = new URLSearchParams();
    if (params.search) qs.set('search', params.search);
    if (params.city) qs.set('city', params.city);
    if (params.sport) qs.set('sport', params.sport);
    if (params.status) qs.set('status', params.status);
    if (params.featured !== undefined) qs.set('featured', String(params.featured));
    if (params.page) qs.set('page', String(params.page));
    if (params.limit) qs.set('limit', String(params.limit));

    const url = `/api/fan/tournaments${qs.toString() ? `?${qs}` : ''}`;
    const r = await fetch(url);
    if (!r.ok) {
      return {
        items: [],
        pagination: { page: 1, limit: 50, total: 0, pages: 0 },
        summary: { live: 0, upcoming: 0, today: 0, completed: 0, total: 0 },
      };
    }
    const body = (await r.json()) as FanDiscoveryResponse;
    return {
      ...body,
      items: (body.items ?? []).map((item) => {
        const modules = item.capabilities?.activeModules ?? [];
        const auctionEnabled = item.auctionEnabled ?? modules.includes("auction");
        const scoringEnabled = item.scoringEnabled ?? modules.includes("scoring");
        return {
          ...item,
          auctionEnabled,
          scoringEnabled,
          licensed: auctionEnabled || scoringEnabled,
        };
      }),
    };
  },

  async getLiveTicker(): Promise<ActivityEvent[]> {
    try {
      const res = await fetch('/api/fan/ticker');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data?.events) ? data.events : [];
    } catch {
      return [];
    }
  },
};
