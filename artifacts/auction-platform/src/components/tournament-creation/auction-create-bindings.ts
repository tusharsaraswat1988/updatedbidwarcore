import { CatalogRegistry } from "@workspace/platform-core/catalog";
import type { TournamentProductMode } from "@workspace/platform-core";

/** Silent catalog bindings for tournament create. */
export type AuctionCreateCatalogBindings = {
  variantId: string;
  competitionTypeId: string;
  ruleProfileId: string;
  ruleProfileVersion: string;
  presentationProfileId: string;
  presentationProfileVersion: string;
};

const AUCTION_COMPETITION_TYPE_ID = "auction";

/**
 * Resolve create-time catalog bindings for tournament creation.
 * - When productMode is scoring_only: prefers "registered_teams" if supported by the sport.
 * - When productMode is auction_only or both: reuses existing "auction" competition type.
 *
 * NOTE: Following Phase 2 architectural rules, productMode and competitionType are decoupled.
 * We reuse existing competition types and do not invent new ones.
 */
export function resolveAuctionCreateCatalogBindings(
  sportId: string,
  productMode: TournamentProductMode = "auction_only",
): AuctionCreateCatalogBindings | { error: string } {
  const sport = CatalogRegistry.getSport(sportId);
  if (!sport) return { error: `Unknown sport: ${sportId}` };

  const variants = CatalogRegistry.listVariants(sportId);
  if (variants.length === 0) return { error: "No variants available for this sport." };

  const variant =
    variants.find((v) => v.recommendation === "recommended") ??
    variants.find((v) => v.recommendation === "auto_suggested") ??
    variants[0]!;

  let competitionTypeId: string;
  if (productMode === "scoring_only" && sport.supportedCompetitionTypes.includes("registered_teams")) {
    competitionTypeId = "registered_teams";
  } else if (sport.supportedCompetitionTypes.includes(AUCTION_COMPETITION_TYPE_ID)) {
    competitionTypeId = AUCTION_COMPETITION_TYPE_ID;
  } else {
    competitionTypeId = sport.supportedCompetitionTypes[0] ?? AUCTION_COMPETITION_TYPE_ID;
  }

  if (!sport.supportedCompetitionTypes.includes(competitionTypeId)) {
    return { error: `Sport does not support ${competitionTypeId} competition type.` };
  }

  const suggested = CatalogRegistry.suggestDefaults({
    sportId,
    variantId: variant.id,
    competitionTypeId,
  });

  if (!suggested.ruleProfile || !suggested.presentationProfile) {
    return {
      error:
        "Could not resolve default rule/presentation profiles for this sport. Complete setup in Sports.",
    };
  }

  const validated = CatalogRegistry.validateCreateBindings({
    sportId,
    variantId: variant.id,
    competitionTypeId,
    ruleProfileId: suggested.ruleProfile.id,
    ruleProfileVersion: suggested.ruleProfile.version,
    presentationProfileId: suggested.presentationProfile.id,
    presentationProfileVersion: suggested.presentationProfile.version,
  });

  if (!validated.ok) return { error: validated.error };

  return {
    variantId: validated.bindings.variantId,
    competitionTypeId: validated.bindings.competitionTypeId,
    ruleProfileId: validated.bindings.ruleProfileId,
    ruleProfileVersion: validated.bindings.ruleProfileVersion,
    presentationProfileId: validated.bindings.presentationProfileId,
    presentationProfileVersion: validated.bindings.presentationProfileVersion,
  };
}
