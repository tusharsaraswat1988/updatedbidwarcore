import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
    insert: vi.fn(),
  },
  playersTable: {},
  categoriesTable: {},
  badmintonCategoriesTable: {},
  badmintonRegistrationsTable: {},
}));

import { planKnockoutBracket } from "../badminton-knockout-plan";
import {
  adaptScoringPlayerToBadmintonRegistration,
  decideBadmintonScoringRegistration,
  matchBadmintonCategoryByExactName,
  type BadmintonScoringRegistrationDeps,
} from "../master-sports/badminton-scoring-registration";

const singles = {
  id: 21,
  name: "Men's Singles",
  matchType: "singles",
  gender: "M",
  maxPlayers: 16,
};

const malePlayer = { id: 9, gender: "M" };

function deps(overrides: Partial<BadmintonScoringRegistrationDeps> = {}): BadmintonScoringRegistrationDeps {
  return {
    loadCanonicalPlayer: vi.fn().mockResolvedValue({ categoryId: 3 }),
    loadAuctionCategory: vi.fn().mockResolvedValue({ id: 3, name: "Men's Singles" }),
    loadBadmintonCategories: vi.fn().mockResolvedValue([singles]),
    countAcceptedRegistrations: vi.fn().mockResolvedValue(0),
    loadExistingRegistrations: vi.fn().mockResolvedValue([]),
    insertRegistration: vi.fn().mockResolvedValue({ id: 100 }),
    ...overrides,
  };
}

describe("matchBadmintonCategoryByExactName", () => {
  it("requires an exact unique name in the same tournament list", () => {
    expect(matchBadmintonCategoryByExactName("Men's Singles", [singles]).kind).toBe("exact");
    expect(matchBadmintonCategoryByExactName("Women's Singles", [singles]).kind).toBe("none");
    expect(matchBadmintonCategoryByExactName("Men's Singles", [
      singles,
      { ...singles, id: 22 },
    ]).kind).toBe("ambiguous");
  });

  it("does not copy numeric auction category ids", () => {
    const match = matchBadmintonCategoryByExactName("Men's Singles", [singles]);
    expect(match.kind).toBe("exact");
    if (match.kind === "exact") expect(match.category.id).toBe(21);
  });
});

describe("decideBadmintonScoringRegistration", () => {
  it("skips when scoring registration has no category", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: null,
      badmintonCategories: [singles],
      badmintonPlayer: malePlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("no_category");
  });

  it("creates when exactly one badminton category matches", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: "Men's Singles",
      badmintonCategories: [singles],
      badmintonPlayer: malePlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result).toEqual({ status: "create", badmintonCategoryId: 21 });
  });

  it("skips when no badminton category matches", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: "Open",
      badmintonCategories: [singles],
      badmintonPlayer: malePlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("no_match");
  });

  it("skips when the category name is ambiguous", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: "Men's Singles",
      badmintonCategories: [singles, { ...singles, id: 22 }],
      badmintonPlayer: malePlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("ambiguous");
  });

  it("does not invent a doubles partner", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: "Men's Doubles",
      badmintonCategories: [{
        id: 30,
        name: "Men's Doubles",
        matchType: "doubles",
        gender: "M",
        maxPlayers: 16,
      }],
      badmintonPlayer: malePlayer,
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("doubles_partner_required");
  });

  it("skips gender mismatch instead of creating a broken registration", () => {
    const result = decideBadmintonScoringRegistration({
      auctionCategoryName: "Men's Singles",
      badmintonCategories: [singles],
      badmintonPlayer: { id: 9, gender: "F" },
      acceptedCount: 0,
      existingPlayerIdsInCategory: [],
    });
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") {
      expect(result.reason).toBe("validation_failed");
      expect(result.code).toBe("GENDER_MISMATCH");
    }
  });
});

describe("adaptScoringPlayerToBadmintonRegistration", () => {
  it("skips scoring registration without a canonical category", async () => {
    const result = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({ loadCanonicalPlayer: vi.fn().mockResolvedValue({ categoryId: null }) }),
    );
    expect(result.status).toBe("skipped");
    if (result.status === "skipped") expect(result.reason).toBe("no_category");
  });

  it("creates a TMS registration with the badminton player id, not the auction category id", async () => {
    const insertRegistration = vi.fn().mockResolvedValue({ id: 100 });
    const result = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({ insertRegistration }),
    );
    expect(result).toEqual({
      status: "created",
      registrationId: 100,
      badmintonCategoryId: 21,
    });
    expect(insertRegistration).toHaveBeenCalledWith(expect.objectContaining({
      tournamentId: 1,
      categoryId: 21,
      player1Id: 9,
      status: "accepted",
    }));
  });

  it("does not guess when the badminton category name is missing or ambiguous", async () => {
    const insertRegistration = vi.fn();
    const missing = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({
        loadBadmintonCategories: vi.fn().mockResolvedValue([]),
        insertRegistration,
      }),
    );
    expect(missing.status).toBe("skipped");
    if (missing.status === "skipped") expect(missing.reason).toBe("no_match");

    const ambiguous = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({
        loadBadmintonCategories: vi.fn().mockResolvedValue([singles, { ...singles, id: 22 }]),
        insertRegistration,
      }),
    );
    expect(ambiguous.status).toBe("skipped");
    if (ambiguous.status === "skipped") expect(ambiguous.reason).toBe("ambiguous");
    expect(insertRegistration).not.toHaveBeenCalled();
  });

  it("surfaces badminton registration insert failures instead of swallowing them", async () => {
    await expect(adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({ insertRegistration: vi.fn().mockRejectedValue(new Error("insert failed")) }),
    )).rejects.toThrow("insert failed");
  });

  it("feeds created registrations into existing knockout draw planning", async () => {
    const first = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 12, badmintonPlayer: malePlayer },
      deps({ insertRegistration: vi.fn().mockResolvedValue({ id: 100 }) }),
    );
    const second = await adaptScoringPlayerToBadmintonRegistration(
      { tournamentId: 1, canonicalPlayerId: 13, badmintonPlayer: { id: 10, gender: "M" } },
      deps({ insertRegistration: vi.fn().mockResolvedValue({ id: 101 }) }),
    );
    expect(first.status).toBe("created");
    expect(second.status).toBe("created");
    const rounds = planKnockoutBracket([
      { id: 100, seedNumber: null },
      { id: 101, seedNumber: null },
    ]);
    expect(rounds[0].fixtures.length).toBeGreaterThanOrEqual(1);
    expect(rounds[0].fixtures.some((f) => f.registrationAId === 100 || f.registrationBId === 100)).toBe(true);
  });
});
