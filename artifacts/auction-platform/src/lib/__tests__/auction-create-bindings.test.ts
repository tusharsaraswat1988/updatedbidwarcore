import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuctionCreateCatalogBindings } from "../../components/tournament-creation/auction-create-bindings.ts";
import { WIZARD_STEPS } from "../../components/tournament-creation/types.ts";

describe("tournament create wizard steps", () => {
  it("uses the 3-step module-driven creation workflow", () => {
    assert.deepEqual(
      WIZARD_STEPS.map((s) => s.id),
      ["details", "products", "configuration"],
    );
  });

  it("does not include sports catalog sub-steps", () => {
    const ids = new Set(WIZARD_STEPS.map((s) => s.id));
    for (const sportsStep of [
      "variant",
      "competition",
      "registration_mode",
      "team_formation",
      "squad_rules",
      "rule_profile",
      "presentation",
    ]) {
      assert.equal(ids.has(sportsStep as never), false);
    }
  });
});

describe("resolveAuctionCreateCatalogBindings", () => {
  it("defaults cricket create to auction competition when auction_only", () => {
    const bindings = resolveAuctionCreateCatalogBindings("cricket", "auction_only");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "auction");
    assert.match(bindings.variantId, /^cricket\./);
    assert.ok(bindings.ruleProfileId);
    assert.ok(bindings.presentationProfileId);
  });

  it("resolves scoring_only to registered_teams without requiring auction economics", () => {
    const bindings = resolveAuctionCreateCatalogBindings("cricket", "scoring_only");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "registered_teams");
    assert.match(bindings.variantId, /^cricket\./);
  });

  it("resolves both to auction competition type (reusing existing competition type)", () => {
    const bindings = resolveAuctionCreateCatalogBindings("cricket", "both");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "auction");
  });

  it("defaults badminton create to auction when auction_only", () => {
    const bindings = resolveAuctionCreateCatalogBindings("badminton", "auction_only");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "auction");
    assert.equal(bindings.variantId, "badminton.standard");
  });

  it("resolves badminton scoring_only to registered_teams", () => {
    const bindings = resolveAuctionCreateCatalogBindings("badminton", "scoring_only");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "registered_teams");
  });

  it("rejects unknown sports", () => {
    const bindings = resolveAuctionCreateCatalogBindings("not-a-sport");
    assert.deepEqual(bindings, { error: "Unknown sport: not-a-sport" });
  });
});
