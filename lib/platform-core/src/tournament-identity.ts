/**
 * Tournament Identity — event-level brand & media contract.
 *
 * Ownership: PLATFORM / EVENT (not Auction, not Sports, not Broadcast).
 *
 * Auction, Sports, Broadcast, and Public surfaces consume this identity so the
 * tournament feels like one IPL-like event. Products must NEVER claim Identity
 * in their navigation or treat Identity fields as product-owned workflow state.
 *
 * This module is a thin normalization layer over existing tournament + branding
 * payloads. It does not introduce new APIs or a CMS.
 */

/** Event-level identity fields inherited by every BidWar product. */
export type TournamentIdentity = {
  tournamentId: number;
  name: string;
  sport: string | null;
  city: string | null;
  venue: string | null;
  organizerName: string | null;
  logoUrl: string | null;
  /** Raw sponsor logos payload (JSON string or structured — consumers parse). */
  sponsorLogos: unknown;
  mainBannerUrl: string | null;
  mainBannerEnabled: boolean;
  mainBannerFit: string | null;
  /** Optional theme / presentation hooks already present on tournament records. */
  themePackId?: string | null;
  features?: unknown;
};

/** Loose input shape from GET tournament / branding-adjacent responses. */
export type TournamentIdentitySource = {
  id?: number | null;
  name?: string | null;
  sport?: string | null;
  city?: string | null;
  venue?: string | null;
  organizerName?: string | null;
  logoUrl?: string | null;
  sponsorLogos?: unknown;
  mainBannerUrl?: string | null;
  mainBannerEnabled?: boolean | null;
  mainBannerFit?: string | null;
  themePackId?: string | null;
  features?: unknown;
};

/**
 * Normalize a tournament API row into Tournament Identity.
 * Missing fields become null / defaults — never invent brand assets.
 */
export function normalizeTournamentIdentity(
  source: TournamentIdentitySource | null | undefined,
  tournamentIdFallback = 0,
): TournamentIdentity {
  const tournamentId =
    typeof source?.id === "number" && Number.isFinite(source.id)
      ? source.id
      : tournamentIdFallback;

  return {
    tournamentId,
    name: (source?.name ?? "").trim() || "Tournament",
    sport: source?.sport ?? null,
    city: source?.city ?? null,
    venue: source?.venue ?? null,
    organizerName: source?.organizerName ?? null,
    logoUrl: source?.logoUrl ?? null,
    sponsorLogos: source?.sponsorLogos ?? null,
    mainBannerUrl: source?.mainBannerUrl ?? null,
    mainBannerEnabled: source?.mainBannerEnabled === true,
    mainBannerFit: source?.mainBannerFit ?? null,
    themePackId: source?.themePackId ?? null,
    features: source?.features,
  };
}

/** Display label for Identity consumers (headers, public chrome). */
export function tournamentIdentityTitle(identity: TournamentIdentity): string {
  return identity.name;
}
