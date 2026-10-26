import { describe, expect, it } from "vitest";
import {
  buildPlayerRoleSelectOptions,
  ledPlayerRoleRaw,
  playerRoleUpdateValue,
} from "@/lib/player-role-options";

const CRICKET_ROLES = ["Batsman", "Bowler", "All-Rounder", "Wicketkeeper"] as const;

function optionValues(
  sportRoles: readonly string[],
  currentRole: string | null | undefined,
  savedRole?: string | null,
) {
  return buildPlayerRoleSelectOptions(sportRoles, currentRole, savedRole).map((option) => option.value);
}

describe("edit player role dropdown", () => {
  it("opens Top-order Batter with that role selected and the cricket catalog intact", () => {
    const saved = "Top-order Batter";
    const options = optionValues(CRICKET_ROLES, saved, saved);

    expect(saved).toBe("Top-order Batter");
    expect(options).toContain("Top-order Batter");
    expect(options).toEqual([
      "Top-order Batter",
      "Batsman",
      "Bowler",
      "All-Rounder",
      "Wicketkeeper",
    ]);
  });

  it("shows other saved roles that are outside the sport catalog", () => {
    for (const saved of ["Fast Bowler", "Spin Bowler", "Wicketkeeper Batter", "All-rounder", "Hard-hitter"]) {
      const options = optionValues(CRICKET_ROLES, saved, saved);
      expect(options[0]).toBe(saved);
      expect(options.slice(1)).toEqual([...CRICKET_ROLES]);
    }
  });

  it("does not duplicate a role that is already in the catalog", () => {
    expect(optionValues(CRICKET_ROLES, "Batsman", "Batsman")).toEqual([...CRICKET_ROLES]);
    expect(optionValues(CRICKET_ROLES, "Bowler", "Bowler")).toEqual([...CRICKET_ROLES]);
    expect(optionValues(CRICKET_ROLES, "All-Rounder", "All-Rounder")).toEqual([...CRICKET_ROLES]);
    expect(optionValues(CRICKET_ROLES, "Wicketkeeper", "Wicketkeeper")).toEqual([...CRICKET_ROLES]);
  });

  it("keeps a differently cased saved role instead of replacing it", () => {
    const options = optionValues(CRICKET_ROLES, "All-rounder", "All-rounder");
    expect(options).toContain("All-rounder");
    expect(options).toContain("All-Rounder");
  });

  it("keeps the original saved role available after the draft changes", () => {
    const options = optionValues(CRICKET_ROLES, "Batsman", "Top-order Batter");
    expect(options).toContain("Top-order Batter");
    expect(options).toContain("Batsman");
  });

  it("does not add a blank option for a player with no role", () => {
    expect(optionValues(CRICKET_ROLES, "", null)).toEqual([...CRICKET_ROLES]);
    expect(optionValues(CRICKET_ROLES, "   ", "   ")).toEqual([...CRICKET_ROLES]);
  });

  it("still offers Player when the sport catalog has not loaded", () => {
    expect(optionValues([], "Top-order Batter", "Top-order Batter")).toEqual([
      "Top-order Batter",
      "Player",
    ]);
    expect(optionValues([], "", null)).toEqual(["Player"]);
  });
});

describe("edit player role save", () => {
  it("persists a changed role", () => {
    const opened = "Top-order Batter";
    const changed = "Bowler";
    expect(playerRoleUpdateValue(opened)).toBe("Top-order Batter");
    expect(playerRoleUpdateValue(changed)).toBe("Bowler");
  });

  it("keeps the current role when unrelated fields are saved", () => {
    const draftRole = "Top-order Batter";
    const payload = {
      city: "Jaipur",
      jerseyNumber: "8",
      battingStyle: "Left-hand bat",
      bowlingStyle: "Right-arm medium",
      role: playerRoleUpdateValue(draftRole),
    };

    expect(payload.role).toBe("Top-order Batter");
    expect(payload.city).toBe("Jaipur");
    expect(payload.jerseyNumber).toBe("8");
    expect(payload.battingStyle).toBe("Left-hand bat");
    expect(payload.bowlingStyle).toBe("Right-arm medium");
  });

  it("omits an empty role so a save does not clear a stored role", () => {
    expect(playerRoleUpdateValue("")).toBeUndefined();
    expect(playerRoleUpdateValue(null)).toBeUndefined();
  });

  it("reopens the edit form on the persisted role", () => {
    const persisted = playerRoleUpdateValue("Top-order Batter");
    const reopened = optionValues(CRICKET_ROLES, persisted, persisted);

    expect(persisted).toBe("Top-order Batter");
    expect(reopened[0]).toBe("Top-order Batter");
    expect(reopened).toEqual(expect.arrayContaining([...CRICKET_ROLES]));
  });
});

describe("LED player role", () => {
  it("renders the saved role without replacing it", () => {
    expect(ledPlayerRoleRaw("Top-order Batter")).toBe("Top-order Batter");
    expect(ledPlayerRoleRaw("Batsman")).toBe("Batsman");
    expect(ledPlayerRoleRaw("  Bowler  ")).toBe("Bowler");
  });

  it("falls back to Player only when the stored role is empty", () => {
    expect(ledPlayerRoleRaw("")).toBe("Player");
    expect(ledPlayerRoleRaw("   ")).toBe("Player");
    expect(ledPlayerRoleRaw(null)).toBe("Player");
  });
});
