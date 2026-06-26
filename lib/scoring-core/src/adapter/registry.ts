import type { ScoringSportSlug } from "../types";
import type { SportManifest, SportScoringAdapter } from "./contract";

export class AdapterRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AdapterRegistryError";
  }
}

export class AdapterRegistry {
  private readonly adapters = new Map<ScoringSportSlug, SportScoringAdapter>();

  register(adapter: SportScoringAdapter): void {
    const slug = adapter.manifest.sportSlug;
    if (this.adapters.has(slug)) {
      throw new AdapterRegistryError(`Scoring adapter already registered: ${slug}`);
    }
    this.adapters.set(slug, adapter);
  }

  get(sportSlug: ScoringSportSlug): SportScoringAdapter {
    const adapter = this.adapters.get(sportSlug);
    if (!adapter) {
      throw new AdapterRegistryError(`No scoring adapter registered for sport: ${sportSlug}`);
    }
    return adapter;
  }

  has(sportSlug: ScoringSportSlug): boolean {
    return this.adapters.has(sportSlug);
  }

  listManifests(): SportManifest[] {
    return [...this.adapters.values()].map((adapter) => adapter.manifest);
  }
}

export const scoringAdapterRegistry = new AdapterRegistry();
