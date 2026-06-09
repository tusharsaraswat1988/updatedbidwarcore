import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  computeBaseInitials,
  resolveUniqueInitials,
} from "../lib/master-sports/tournament-initials";

const usedByTournament = new Map<number, Set<string>>();

vi.mock("../lib/master-sports/tournament-profile", () => ({
  allocateProfileInitials: vi.fn(
    async (
      tournamentId: number,
      input: { firstName: string; lastName: string; displayName?: string | null },
    ) => {
      const { computeBaseInitials, resolveUniqueInitials } = await import(
        "../lib/master-sports/tournament-initials"
      );
      const base = computeBaseInitials(input.firstName, input.lastName, input.displayName);
      if (!usedByTournament.has(tournamentId)) {
        usedByTournament.set(tournamentId, new Set());
      }
      const used = usedByTournament.get(tournamentId)!;
      const initials = resolveUniqueInitials(base, used);
      used.add(initials);
      return initials;
    },
  ),
  ensureTournamentProfile: vi.fn(),
  syncBadmintonShortNameFromProfile: vi.fn(),
}));

import { allocateTournamentInitials } from "../lib/master-sports/tournament-initials";

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
    usedByTournament.clear();
  });

  it("assigns AK then AK2 for colliding names in same tournament", async () => {
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
    const t1 = await allocateTournamentInitials(1, {
      firstName: "Abhinav",
      lastName: "Keshri",
    });
    const t2 = await allocateTournamentInitials(2, {
      firstName: "Abhinav",
      lastName: "Keshri",
    });

    expect(t1).toBe("AK");
    expect(t2).toBe("AK");
  });
});
