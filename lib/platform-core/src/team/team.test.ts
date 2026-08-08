import { describe, expect, it } from "vitest";
import {
  mapAuctionSignalsToMembers,
  mapAuctionTeamToConfiguration,
  mapAuctionTeamToIdentity,
} from "./bridges.ts";
import { isValidLifecycleTransition, lifecycleAfterLock } from "./lifecycle.ts";
import { buildTeamConfigurationHistoryPayload } from "./plan.ts";
import { validateTeam } from "./validation.ts";

const baseTeam = {
  id: 7,
  tournamentId: 1,
  name: "Thunder",
  shortCode: "THU",
  color: "#111111",
  secondaryColor: "#eeeeee",
  logoUrl: "https://example.com/logo.png",
  displayName: "Thunder XI",
  teamTypeId: "competitive",
  visibility: "tournament",
  ownerName: "Alex Owner",
  masterTeamId: "mt_thunder",
};

describe("Team Identity", () => {
  it("maps identity independently of members", () => {
    const identity = mapAuctionTeamToIdentity(baseTeam);
    expect(identity.id).toBe("7");
    expect(identity.masterTeamId).toBe("mt_thunder");
    expect(identity.typeId).toBe("competitive");
  });

  it("configuration never includes captain or owner properties", () => {
    const config = mapAuctionTeamToConfiguration(baseTeam);
    expect(config.name).toBe("Thunder");
    expect(config.displayName).toBe("Thunder XI");
    expect(config.shortName).toBe("THU");
    expect(config).not.toHaveProperty("captain");
    expect(config).not.toHaveProperty("viceCaptain");
    expect(config).not.toHaveProperty("owner");
    expect(config).not.toHaveProperty("ownerName");
  });
});

describe("Team Members", () => {
  it("exposes participant + role + status only", () => {
    const members = mapAuctionSignalsToMembers(baseTeam, [
      {
        participantId: "auction-player:9",
        participantKind: "individual",
        displayName: "Pat Captain",
        tags: ["captain"],
      },
    ]);
    expect(members.some((m) => m.roleId === "captain")).toBe(true);
    expect(members.some((m) => m.roleId === "owner")).toBe(true);
    for (const m of members) {
      expect(m).toEqual(
        expect.objectContaining({
          participant: expect.objectContaining({
            id: expect.any(String),
            displayName: expect.any(String),
          }),
          roleId: expect.any(String),
          status: expect.any(String),
        }),
      );
      expect(m).not.toHaveProperty("playerId");
      expect(m).not.toHaveProperty("assignmentId");
    }
  });
});

describe("Team Validation", () => {
  it("requires captain from catalog constraints for cricket", () => {
    const config = mapAuctionTeamToConfiguration(baseTeam);
    const members = mapAuctionSignalsToMembers(baseTeam, []);
    const result = validateTeam(config, members, { sportId: "cricket" });
    expect(result.issues.some((i) => i.code === "TEAM_ROLE_REQUIRED")).toBe(true);
    expect(result.errorCount).toBeGreaterThan(0);
  });

  it("does not require captain for badminton", () => {
    const config = mapAuctionTeamToConfiguration(baseTeam);
    const members = mapAuctionSignalsToMembers(baseTeam, []);
    const result = validateTeam(config, members, { sportId: "badminton" });
    expect(result.issues.some((i) => i.code === "TEAM_ROLE_REQUIRED")).toBe(false);
    expect(
      result.issues.some((i) => i.message.toLowerCase().includes("captain")),
    ).toBe(false);
  });

  it("passes when captain present and checks competition squad max", () => {
    const config = mapAuctionTeamToConfiguration(baseTeam);
    const members = mapAuctionSignalsToMembers(baseTeam, [
      {
        participantId: "auction-player:1",
        participantKind: "individual",
        displayName: "C",
        tags: ["captain"],
      },
      {
        participantId: "auction-player:2",
        participantKind: "individual",
        displayName: "P2",
      },
      {
        participantId: "auction-player:3",
        participantKind: "individual",
        displayName: "P3",
      },
    ]);
    const result = validateTeam(config, members, {
      sportId: "cricket",
      competitionSquadRules: { maxPlayers: 2 },
    });
    expect(result.issues.some((i) => i.code === "TEAM_ABOVE_MAX_SQUAD")).toBe(true);
  });

  it("builds history payload without roster", () => {
    const config = mapAuctionTeamToConfiguration(baseTeam);
    const members = mapAuctionSignalsToMembers(baseTeam, [
      {
        participantId: "auction-player:1",
        participantKind: "individual",
        displayName: "C",
        tags: ["captain"],
      },
    ]);
    const validation = validateTeam(config, members, { sportId: "cricket" });
    const payload = buildTeamConfigurationHistoryPayload(
      config,
      validation,
      "2026-08-05T00:00:00.000Z",
    );
    expect(payload.status).toBe("locked");
    expect(payload.name).toBe("Thunder");
    expect(payload).not.toHaveProperty("members");
    expect(payload).not.toHaveProperty("roster");
  });
});

describe("Team Lifecycle", () => {
  it("allows archived only after completed", () => {
    expect(isValidLifecycleTransition("ready", "archived")).toBe(false);
    expect(isValidLifecycleTransition("completed", "archived")).toBe(true);
    expect(isValidLifecycleTransition("ready", "archived", { admin: true })).toBe(true);
  });

  it("moves to locked after lock", () => {
    expect(lifecycleAfterLock("ready")).toBe("locked");
    expect(lifecycleAfterLock("building")).toBe("locked");
  });
});
