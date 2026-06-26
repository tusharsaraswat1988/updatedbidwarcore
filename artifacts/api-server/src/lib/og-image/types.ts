/** Reusable Open Graph card badge — extensible for future states (closed, live, sponsors, etc.). */
export interface OgCardBadge {
  id: string;
  label: string;
  tone?: "default" | "urgent" | "success" | "info";
}

/** Input contract for registration OG card composition. */
export interface RegistrationOgCardInput {
  registrationCode: string;
  tournamentName: string;
  sport: string;
  venue?: string | null;
  organizerName?: string | null;
  registrationDeadline?: string | null;
  /** Resolved background source URL (banner → logo → platform → default). */
  backgroundImageUrl: string;
  /** Optional crisp logo overlay (usually tournament logo). */
  logoImageUrl?: string | null;
  /** Bump when card layout/design changes to invalidate disk cache. */
  generatorVersion: number;
  /** Tournament row updatedAt ISO — invalidates cache when branding changes. */
  contentVersion: string;
  badges?: OgCardBadge[];
}

export interface RegistrationOgImageResult {
  buffer: Buffer;
  cacheHit: boolean;
  etag: string;
}
