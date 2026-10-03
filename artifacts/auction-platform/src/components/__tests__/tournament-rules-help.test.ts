import { describe, it, expect } from "vitest";
import { CRICKET_KEY_RULE_OVERRIDE_IDS } from "@workspace/platform-core/competition";
import { CatalogRegistry } from "@workspace/platform-core/catalog";

describe("Tournament Rules Terminology & Context Help UX", () => {
  const KEY_RULE_LABELS: Record<
    (typeof CRICKET_KEY_RULE_OVERRIDE_IDS)[number],
    string
  > = {
    "cricket.match.overs_per_innings": "Overs per innings",
    "cricket.match.max_wickets": "Max wickets",
    "cricket.match.playing_squad_size": "Playing XI size",
    "cricket.match.playing_xi_enforced": "Exact Playing XI",
    "cricket.match.bench_size": "Bench / substitute players",
    "cricket.match.balls_per_over": "Balls per over",
    "cricket.match.ball_type": "Match ball",
    "cricket.batting.retire_at_runs": "Retire at runs",
    "cricket.dismissal.lbw_enabled": "LBW dismissals",
    "cricket.extras.leg_bye_enabled": "Leg byes",
    "cricket.bowling.free_hit_enabled": "Free hit (no balls)",
    "cricket.powerplay.enabled": "Powerplay overs",
    "cricket.powerplay.overs": "Powerplay overs selection",
    "cricket.special.super_ball_enabled": "Super Ball",
    "cricket.special.super_ball_doubles_boundaries_only": "Super Ball doubling mode",
    "cricket.tie_break.super_over_enabled": "Super Over tie-break",
    "cricket.tie_break.super_over_overs": "Super Over overs",
    "cricket.tie_break.super_over_wickets": "Super Over wickets",
    "cricket.tie_break.super_over_trigger": "Super Over trigger",
  };

  it("covers all 19 key rule override definitions in label mapping", () => {
    expect(CRICKET_KEY_RULE_OVERRIDE_IDS.length).toBe(19);
    for (const ruleId of CRICKET_KEY_RULE_OVERRIDE_IDS) {
      expect(KEY_RULE_LABELS[ruleId]).toBeDefined();
      expect(KEY_RULE_LABELS[ruleId].length).toBeGreaterThan(0);
    }
  });

  it("uses standard cricket terminology for overs, balls, XI, and dismissals", () => {
    expect(KEY_RULE_LABELS["cricket.match.overs_per_innings"]).toBe("Overs per innings");
    expect(KEY_RULE_LABELS["cricket.match.balls_per_over"]).toBe("Balls per over");
    expect(KEY_RULE_LABELS["cricket.match.playing_squad_size"]).toBe("Playing XI size");
    expect(KEY_RULE_LABELS["cricket.match.bench_size"]).toBe("Bench / substitute players");
    expect(KEY_RULE_LABELS["cricket.dismissal.lbw_enabled"]).toBe("LBW dismissals");
    expect(KEY_RULE_LABELS["cricket.extras.leg_bye_enabled"]).toBe("Leg byes");
    expect(KEY_RULE_LABELS["cricket.bowling.free_hit_enabled"]).toBe("Free hit (no balls)");
  });

  it("maintains catalog definition integrity for cricket rule profiles", () => {
    const boxProfile = CatalogRegistry.getRuleProfile("cricket.box.corporate_standard");
    expect(boxProfile).toBeDefined();
    expect(boxProfile?.sportId).toBe("cricket");

    const outdoorProfile = CatalogRegistry.getRuleProfile("cricket.outdoor.t20_standard");
    expect(outdoorProfile).toBeDefined();
    expect(outdoorProfile?.sportId).toBe("cricket");
  });
});
