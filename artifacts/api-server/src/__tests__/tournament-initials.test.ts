import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeBaseInitials,
  resolveUniqueInitials,
  allocateTournamentInitials,
} from "../lib/master-sports/tournament-initials";

const { mockDbWhere } = vi.hoisted(() => ({
  mockDbWhere: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: mockDbWhere,
      }),
    }),
  },
  badmintonPlayersTable: {},
}));

describe("computeBaseInitials", () => {
  it("uses first and last name initials", () => {
    expect(computeBaseInitials("Abhinav", "Keshri")).toBe("AK");
    expect(computeBaseInitials("Ankit", "Kumar")).toBe("AK");
  });

  it("falls back to display name words", () => {
    expect(computeBaseInitials("", "", "Abhinav Keshri")).toBe("AK");
  });

  it("handles single-word names", () => {
    expect(computeBaseInitials("Madonna", "")).toBe("MA");
  });
});

describe("resolveUniqueInitials", () => {
  it("returns base when unused", () => {
    expect(resolveUniqueInitials("AK", new Set())).toBe("AK");
  });

  it("appends numeric suffix on collision", () => {
    const used = new Set(["AK"]);
    expect(resolveUniqueInitials("AK", used)).toBe("AK2");
  });

  it("finds next free suffix", () => {
    const used = new Set(["AK", "AK2"]);
    expect(resolveUniqueInitials("AK", used)).toBe("AK3");
  });
});

describe("allocateTournamentInitials", () => {
  beforeEach(() => {
    mockDbWhere.mockReset();
  });

  it("assigns AK then AK2 for colliding names in same tournament", async () => {
    mockDbWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 1, shortName: "AK" }]);

    const first = await allocateTournamentInitials(10, {
      firstName: "Abhinav",
      lastName: "Keshri",
    });
    const second = await allocateTournamentInitials(10, {
      firstName: "Ankit",
      lastName: "Kumar",
    });

    expect(first).toBe("AK");
    expect(second).toBe("AK2");
  });

  it("allows same base initials in different tournaments", async () => {
    mockDbWhere.mockResolvedValue([]);

    const t1 = await allocateTournamentInitials(1, {
      firstName: "Abhinav",
      lastName: "Keshri",
    });
    mockDbWhere.mockResolvedValue([]);
    const t2 = await allocateTournamentInitials(2, {
      firstName: "Abhinav",
      lastName: "Keshri",
    });

    expect(t1).toBe("AK");
    expect(t2).toBe("AK");
  });
});
