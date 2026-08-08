import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveAuctionCreateCatalogBindings } from "../../components/tournament-creation/auction-create-bindings.ts";
import { WIZARD_STEPS } from "../../components/tournament-creation/types.ts";

describe("auction create wizard steps", () => {
  it("keeps only auction-platform steps", () => {
    assert.deepEqual(
      WIZARD_STEPS.map((s) => s.id),
      ["identity", "sport", "registration", "review"],
    );
  });

  it("does not include sports catalog steps", () => {
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
  it("defaults cricket create to auction competition", () => {
    const bindings = resolveAuctionCreateCatalogBindings("cricket");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "auction");
    assert.match(bindings.variantId, /^cricket\./);
    assert.ok(bindings.ruleProfileId);
    assert.ok(bindings.presentationProfileId);
  });

  it("defaults badminton create to auction when supported", () => {
    const bindings = resolveAuctionCreateCatalogBindings("badminton");
    assert.equal("error" in bindings, false);
    if ("error" in bindings) return;
    assert.equal(bindings.competitionTypeId, "auction");
    assert.equal(bindings.variantId, "badminton.standard");
  });

  it("rejects unknown sports", () => {
    const bindings = resolveAuctionCreateCatalogBindings("not-a-sport");
    assert.deepEqual(bindings, { error: "Unknown sport: not-a-sport" });
  });
});
