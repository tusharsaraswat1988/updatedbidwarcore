import { describe, expect, it } from "vitest";
import { CatalogRegistry } from "@workspace/platform-core/catalog";
import {
  buildTeamConfigurationHistoryPayload,
  isValidLifecycleTransition,
  mapAuctionSignalsToMembers,
  mapAuctionTeamToConfiguration,
  mapAuctionTeamToIdentity,
  validateTeam,
} from "@workspace/platform-core/team";

describe("EPIC-04 team foundation", () => {
  it("exposes team type and role catalogs", () => {
    expect(CatalogRegistry.listTeamTypes().some((t) => t.id === "selection")).toBe(true);
    expect(CatalogRegistry.listTeamTypes().some((t) => t.id === "representative")).toBe(false);
    const captain = CatalogRegistry.getTeamRole("captain");
    expect(captain?.required).toBe(true);
    expect(captain?.multipleAllowed).toBe(false);
    expect(captain?.maxCount).toBe(1);
    const owner = CatalogRegistry.getTeamRole("owner");
    expect(owner?.required).toBe(false);
    expect(owner?.multipleAllowed).toBe(true);
  });

  it("keeps identity independent of members", () => {
    const row = {
      id: 3,
      tournamentId: 10,
      name: "Kings",
      shortCode: "KIN",
      teamTypeId: "competitive",
    };
    const identity = mapAuctionTeamToIdentity(row);
    const membersEmpty = mapAuctionSignalsToMembers(row, []);
    const membersFull = mapAuctionSignalsToMembers(row, [
      {
        participantId: "auction-player:1",
        participantKind: "individual",
        displayName: "A",
        tags: ["captain"],
      },
    ]);
    expect(identity.id).toBe("3");
    expect(membersEmpty.length).not.toBe(membersFull.length);
    // Identity shape unchanged by membership
    expect(mapAuctionTeamToIdentity(row)).toEqual(identity);
  });

  it("configuration omits captain and owner properties", () => {
    const config = mapAuctionTeamToConfiguration({
      id: 1,
      tournamentId: 1,
      name: "A",
      shortCode: "A",
      ownerName: "Owner",
    });
    expect(Object.keys(config)).not.toContain("owner");
    expect(Object.keys(config)).not.toContain("captain");
  });

  it("blocks archive before completed", () => {
    expect(isValidLifecycleTransition("ready", "archived")).toBe(false);
    expect(isValidLifecycleTransition("completed", "archived")).toBe(true);
  });

  it("history payload has no roster", () => {
    const config = mapAuctionTeamToConfiguration({
      id: 1,
      tournamentId: 1,
      name: "A",
      shortCode: "A",
    });
    const members = mapAuctionSignalsToMembers(
      { id: 1, tournamentId: 1, name: "A", shortCode: "A", ownerName: "O" },
      [
        {
          participantId: "auction-player:1",
          participantKind: "individual",
          displayName: "C",
          tags: ["captain"],
        },
      ],
    );
    const validation = validateTeam(config, members);
    const payload = buildTeamConfigurationHistoryPayload(
      config,
      validation,
      "2026-08-05T00:00:00.000Z",
    );
    expect(payload).not.toHaveProperty("members");
    expect(payload.status).toBe("locked");
  });
});
