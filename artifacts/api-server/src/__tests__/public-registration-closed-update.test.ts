import { describe, expect, it } from "vitest";
import {
  buildClosedPublicRegistrationProfileUpdates,
  profileUpdatesAllowedForTournamentStatus,
} from "../lib/public-registration-closed-update";

describe("profileUpdatesAllowedForTournamentStatus", () => {
  it("allows updates only while tournament is in setup", () => {
    expect(profileUpdatesAllowedForTournamentStatus("setup")).toBe(true);
    expect(profileUpdatesAllowedForTournamentStatus(null)).toBe(true);
    expect(profileUpdatesAllowedForTournamentStatus(undefined)).toBe(true);
    expect(profileUpdatesAllowedForTournamentStatus("active")).toBe(false);
    expect(profileUpdatesAllowedForTournamentStatus("completed")).toBe(false);
  });
});

describe("buildClosedPublicRegistrationProfileUpdates", () => {
  it("only returns photo, role, and legacy spec fields", () => {
    const updates = buildClosedPublicRegistrationProfileUpdates(
      {
        role: "Batsman",
        photoUrl: "https://cdn.example/p.jpg",
        photoPublicId: "players/p",
      },
      {
        battingStyle: "Right Hand",
        bowlingStyle: null,
        specialization: "Opener",
      },
    );

    expect(updates).toEqual({
      role: "Batsman",
      photoUrl: "https://cdn.example/p.jpg",
      photoPublicId: "players/p",
      battingStyle: "Right Hand",
      bowlingStyle: null,
      specialization: "Opener",
    });
    expect(Object.keys(updates).sort()).toEqual([
      "battingStyle",
      "bowlingStyle",
      "photoPublicId",
      "photoUrl",
      "role",
      "specialization",
    ]);
  });
});
