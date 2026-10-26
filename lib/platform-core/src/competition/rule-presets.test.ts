import { describe, it, expect } from "vitest";
import {
  resolveCricketRulePresetSummary,
  formatCricketRulePresetLabel,
} from "./rule-presets.ts";

describe("Cricket Rule Presets Summary Resolution", () => {
  it("resolves baseline values from catalog rule profile (BPL Kids Box Cricket -> 5 overs, 6 wickets, 7 squad)", () => {
    const preset = {
      name: "BPL LEAGUE MATCHES",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.bpl_kids",
      ruleProfileVersion: "1.0.0",
      ruleOverridesJson: null,
      squadRulesJson: null,
      isDefault: false,
    };

    const summary = resolveCricketRulePresetSummary(preset);
    expect(summary.overs).toBe(5);
    expect(summary.wickets).toBe(6);
    expect(summary.squadSize).toBe(7);
    expect(summary.ballsPerOver).toBe(6);
    expect(summary.ballType).toBe("tennis");

    const label = formatCricketRulePresetLabel(preset);
    expect(label).toBe("BPL LEAGUE MATCHES — 5 Overs · 6 Wkts · 7 Players");
  });

  it("resolves when user saved 5 overs with custom 7 wickets on BPL Kids Box Cricket", () => {
    // When user saves 5 overs on bpl_kids, sparseRuleOverrides omits overs because 5 === baseline 5.
    // Only max_wickets: 7 is saved in values.
    const preset = {
      name: "BPL LEAGUE MATCHES",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.bpl_kids",
      ruleProfileVersion: "1.0.0",
      ruleOverridesJson: {
        values: {
          "cricket.match.max_wickets": 7,
        },
      },
      squadRulesJson: {
        minPlayers: 6,
        maxPlayers: 15,
        substitutes: 1,
      },
      isDefault: false,
    };

    const summary = resolveCricketRulePresetSummary(preset);
    expect(summary.overs).toBe(5);
    expect(summary.wickets).toBe(7);
    expect(summary.squadSize).toBe(7);

    const label = formatCricketRulePresetLabel(preset);
    expect(label).toBe("BPL LEAGUE MATCHES — 5 Overs · 7 Wkts · 7 Players");
  });

  it("resolves corporate standard box cricket defaults (6 overs, 10 wickets, 8 squad)", () => {
    const preset = {
      name: "Default Match Rules",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.corporate_standard",
      ruleProfileVersion: "1.0.0",
      ruleOverridesJson: null,
      squadRulesJson: null,
      isDefault: true,
    };

    const summary = resolveCricketRulePresetSummary(preset);
    expect(summary.overs).toBe(6);
    expect(summary.wickets).toBe(10);
    expect(summary.squadSize).toBe(8);

    const label = formatCricketRulePresetLabel(preset);
    expect(label).toBe(
      "Default Match Rules (Tournament Default) — 6 Overs · 10 Wkts · 8 Players",
    );
  });

  it("respects explicit overrides in ruleOverridesJson.values over baseline", () => {
    const preset = {
      name: "Super 8 Special",
      variantId: "cricket.box",
      ruleProfileId: "cricket.box.corporate_standard",
      ruleOverridesJson: {
        values: {
          "cricket.match.overs_per_innings": 8,
          "cricket.match.max_wickets": 8,
          "cricket.match.playing_squad_size": 9,
          "cricket.match.balls_per_over": 8,
          "cricket.match.ball_type": "leather",
        },
      },
    };

    const summary = resolveCricketRulePresetSummary(preset);
    expect(summary.overs).toBe(8);
    expect(summary.wickets).toBe(8);
    expect(summary.squadSize).toBe(9);
    expect(summary.ballsPerOver).toBe(8);
    expect(summary.ballType).toBe("leather");
  });

  it("handles legacy flat overrides gracefully", () => {
    const preset = {
      name: "Legacy Preset",
      variantId: "cricket.box",
      ruleOverridesJson: {
        overs: 12,
        maxWickets: 9,
        playingSquadSize: 10,
      },
    };

    const summary = resolveCricketRulePresetSummary(preset);
    expect(summary.overs).toBe(12);
    expect(summary.wickets).toBe(9);
    expect(summary.squadSize).toBe(10);
  });

  it("falls back to standard defaults when preset is null or missing profile", () => {
    const summary = resolveCricketRulePresetSummary(null);
    expect(summary.overs).toBe(20);
    expect(summary.wickets).toBe(10);
    expect(summary.squadSize).toBe(11);
  });
});
