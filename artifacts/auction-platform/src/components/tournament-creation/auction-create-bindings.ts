import { CatalogRegistry } from "@workspace/platform-core/catalog";

/** Silent catalog bindings for auction-platform create. Sports entry questions are deferred. */
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
 * Resolve create-time catalog bindings for the auction product.
 * Always prefers competition type `auction` when the sport supports it.
 * Does not set registration mode / team formation / squad rules — those belong
 * to Sports Mission Control Competition setup.
 */
export function resolveAuctionCreateCatalogBindings(
  sportId: string,
): AuctionCreateCatalogBindings | { error: string } {
  const sport = CatalogRegistry.getSport(sportId);
  if (!sport) return { error: `Unknown sport: ${sportId}` };

  const variants = CatalogRegistry.listVariants(sportId);
  if (variants.length === 0) return { error: "No variants available for this sport." };

  const variant =
    variants.find((v) => v.recommendation === "recommended") ??
    variants.find((v) => v.recommendation === "auto_suggested") ??
    variants[0]!;

  const competitionTypeId = sport.supportedCompetitionTypes.includes(
    AUCTION_COMPETITION_TYPE_ID,
  )
    ? AUCTION_COMPETITION_TYPE_ID
    : (sport.supportedCompetitionTypes[0] ?? AUCTION_COMPETITION_TYPE_ID);

  if (!sport.supportedCompetitionTypes.includes(competitionTypeId)) {
    return { error: "Sport does not support an auction competition type." };
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
