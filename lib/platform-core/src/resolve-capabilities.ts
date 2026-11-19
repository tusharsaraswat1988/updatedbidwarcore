import { isAuctionEnabled, isScoringEnabled } from './tournament-modules';
import { resolveTournamentFeatures } from './tournament-features';

export type FanCapability = 'auction' | 'scoring' | 'stats' | 'fixtures';

export interface ResolvedFanCapabilities {
  capabilities: FanCapability[];
  isPubliclyVisible: boolean;
  activeModules: ('auction' | 'scoring')[];
  featured: {
    isFeatured: boolean;
    priority: number;
  };
}

export async function resolveFanPageCapabilities(tournament: any): Promise<ResolvedFanCapabilities> {
  const auctionEnabled = isAuctionEnabled(tournament);
  const scoringEnabled = isScoringEnabled(tournament);
  const features = resolveTournamentFeatures(tournament.featuresJson);
  const fj = tournament.featuresJson as Record<string, unknown> | null;

  const isPubliclyVisible = 
    !tournament.adminLocked && 
    !/\[test\]|\[dev\]|\[demo\]/i.test(tournament.name) &&
    (auctionEnabled || scoringEnabled) &&
    (fj?.visibility !== "private") &&
    tournament.status !== 'archived';
  
  const capabilities: FanCapability[] = [];
  const activeModules: ('auction' | 'scoring')[] = [];

  if (auctionEnabled) {
    capabilities.push('auction');
    activeModules.push('auction');
  }
  
  if (scoringEnabled) {
    capabilities.push('scoring', 'stats', 'fixtures');
    activeModules.push('scoring');
  }

  // Feature flag resolution
  const now = new Date();
  const startDate = fj?.featuredStartDate ? new Date(fj.featuredStartDate as string) : null;
  const endDate = fj?.featuredEndDate ? new Date(fj.featuredEndDate as string) : null;

  const isFeatured = !!(
    isPubliclyVisible &&
    (features as any).featuredEnabled === true &&
    (!startDate || startDate <= now) &&
    (!endDate || endDate >= now)
  );

  return {
    capabilities,
    isPubliclyVisible,
    activeModules,
    featured: {
      isFeatured,
      priority: typeof (features as any).featuredPriority === 'number' ? (features as any).featuredPriority : 0
    }
  };
}
