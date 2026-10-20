import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  organizerTournamentCreatedTimeMs,
  sortOrganizerTournamentsOldestFirst,
} from "../organizer-tournament-list";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalSrc = readFileSync(
  path.resolve(__dirname, "../../pages/organizer-portal.tsx"),
  "utf8",
);

describe("sortOrganizerTournamentsOldestFirst", () => {
  it("orders by createdAt ascending (oldest first)", () => {
    const sorted = sortOrganizerTournamentsOldestFirst([
      { id: 3, createdAt: "2026-03-01T00:00:00.000Z" },
      { id: 1, createdAt: "2026-01-01T00:00:00.000Z" },
      { id: 2, createdAt: "2026-02-01T00:00:00.000Z" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([1, 2, 3]);
  });

  it("uses id ascending when createdAt ties", () => {
    const ts = "2026-01-15T12:00:00.000Z";
    const sorted = sortOrganizerTournamentsOldestFirst([
      { id: 10, createdAt: ts },
      { id: 2, createdAt: ts },
      { id: 5, createdAt: ts },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([2, 5, 10]);
  });

  it("places invalid/missing createdAt after valid timestamps", () => {
    const sorted = sortOrganizerTournamentsOldestFirst([
      { id: 1, createdAt: "" },
      { id: 2, createdAt: "2026-02-01T00:00:00.000Z" },
      { id: 3, createdAt: "not-a-date" },
      { id: 4, createdAt: "2026-01-01T00:00:00.000Z" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([4, 2, 1, 3]);
  });
});

describe("dashboard list pipeline — filter then oldest-first sort", () => {
  const rows = [
    { id: 1, createdAt: "2026-01-01T00:00:00.000Z", sport: "cricket", status: "setup", licenseStatus: "trial" },
    { id: 2, createdAt: "2026-03-01T00:00:00.000Z", sport: "badminton", status: "completed", licenseStatus: "active" },
    { id: 3, createdAt: "2026-02-01T00:00:00.000Z", sport: "cricket", status: "active", licenseStatus: "active" },
  ];

  it("preserves oldest-first order after sport filter", () => {
    const cricket = rows.filter((t) => t.sport === "cricket");
    expect(sortOrganizerTournamentsOldestFirst(cricket).map((t) => t.id)).toEqual([1, 3]);
  });

  it("preserves oldest-first order after search filter", () => {
    const q = "2026-02";
    const matched = rows.filter((t) => t.createdAt.includes(q));
    expect(sortOrganizerTournamentsOldestFirst(matched).map((t) => t.id)).toEqual([3]);
  });
});

describe("organizer dashboard — summary cards as sole status filters", () => {
  it("does not render duplicate All/Active/Completed pill row", () => {
    expect(portalSrc).not.toMatch(/Row A — status filters/);
    expect(portalSrc).not.toContain('{ id: "all", label: "All", count:');
    expect(portalSrc).toContain('aria-pressed={statusFilter === "all"}');
    expect(portalSrc).toContain("sortOrganizerTournamentsOldestFirst");
  });
});

describe("organizerTournamentCreatedTimeMs", () => {
  it("returns null for empty or invalid values", () => {
    expect(organizerTournamentCreatedTimeMs("")).toBeNull();
    expect(organizerTournamentCreatedTimeMs(undefined)).toBeNull();
    expect(organizerTournamentCreatedTimeMs("bad")).toBeNull();
  });
});
