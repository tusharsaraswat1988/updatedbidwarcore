import { describe, expect, it } from "vitest";
import {
  filterPlayerTagOptions,
  getSportCapabilities,
  isTeamFormationSupportedByCapabilities,
  isTeamRoleSupportedByCapabilities,
  playingTeamRoleIds,
} from "../sport-capabilities.ts";

describe("getSportCapabilities", () => {
  it("cricket declares cricket-specific capabilities", () => {
    const caps = getSportCapabilities("cricket");
    expect(caps.hasPlayingXi).toBe(true);
    expect(caps.hasBench).toBe(true);
    expect(caps.hasOvers).toBe(true);
    expect(caps.hasCaptain).toBe(true);
    expect(caps.hasLBW).toBe(true);
    expect(caps.hasBroadcast).toBe(true);
    expect(caps.hasSets).toBe(false);
    expect(caps.hasCourts).toBe(false);
    expect(caps.playingSquadLabel).toBe("Playing XI");
    expect(caps.hasLegacyCricketSpecs).toBe(true);
  });

  it("badminton does not declare cricket capabilities", () => {
    const caps = getSportCapabilities("badminton");
    expect(caps.hasPlayingXi).toBe(false);
    expect(caps.hasBench).toBe(false);
    expect(caps.hasOvers).toBe(false);
    expect(caps.hasCaptain).toBe(false);
    expect(caps.hasLBW).toBe(false);
    expect(caps.hasSets).toBe(true);
    expect(caps.hasCourts).toBe(true);
    expect(caps.hasServiceSide).toBe(true);
    expect(caps.hasLegacyCricketSpecs).toBe(false);
    expect(caps.playingSquadLabel).toBe("Lineup");
  });

  it("unknown / missing sport never defaults to cricket", () => {
    for (const sport of [null, undefined, "", "volleyball", "football"]) {
      const caps = getSportCapabilities(sport);
      expect(caps.hasCaptain).toBe(false);
      expect(caps.hasPlayingXi).toBe(false);
      expect(caps.hasOvers).toBe(false);
      expect(caps.hasLegacyCricketSpecs).toBe(false);
    }
  });
});

describe("capability helpers", () => {
  it("hides captain roles and tags when hasCaptain is false", () => {
    const badminton = getSportCapabilities("badminton");
    expect(isTeamRoleSupportedByCapabilities("captain", badminton)).toBe(false);
    expect(isTeamRoleSupportedByCapabilities("vice_captain", badminton)).toBe(false);
    expect(isTeamRoleSupportedByCapabilities("player", badminton)).toBe(true);
    expect(isTeamFormationSupportedByCapabilities("captain_pick", badminton)).toBe(false);

    const tags = filterPlayerTagOptions(badminton, [
      { value: "captain" },
      { value: "icon" },
      { value: "vice_captain" },
    ]);
    expect(tags.map((t) => t.value)).toEqual(["icon"]);
    expect([...playingTeamRoleIds(badminton)]).toEqual(["player"]);
  });

  it("keeps captain roles for cricket", () => {
    const cricket = getSportCapabilities("cricket");
    expect(isTeamRoleSupportedByCapabilities("captain", cricket)).toBe(true);
    expect(isTeamFormationSupportedByCapabilities("captain_pick", cricket)).toBe(true);
    expect(playingTeamRoleIds(cricket).has("captain")).toBe(true);
  });
});
