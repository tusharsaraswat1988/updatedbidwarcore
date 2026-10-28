import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  organizerTournamentCreatedTimeMs,
  sortOrganizerTournaments,
  sortOrganizerTournamentsOldestFirst,
} from "../organizer-tournament-list";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const portalSrc = readFileSync(
  path.resolve(__dirname, "../../pages/organizer-portal.tsx"),
  "utf8",
);

describe("sortOrganizerTournaments", () => {
  it("orders active tournaments by createdAt descending (newest first)", () => {
    const sorted = sortOrganizerTournaments([
      { id: 1, createdAt: "2026-01-01T00:00:00.000Z", status: "setup", licenseStatus: "trial" },
      { id: 3, createdAt: "2026-03-01T00:00:00.000Z", status: "setup", licenseStatus: "trial" },
      { id: 2, createdAt: "2026-02-01T00:00:00.000Z", status: "active", licenseStatus: "active" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([3, 2, 1]);
  });

  it("uses id descending when createdAt ties (newer id first)", () => {
    const ts = "2026-01-15T12:00:00.000Z";
    const sorted = sortOrganizerTournaments([
      { id: 2, createdAt: ts, status: "setup", licenseStatus: "trial" },
      { id: 10, createdAt: ts, status: "setup", licenseStatus: "trial" },
      { id: 5, createdAt: ts, status: "setup", licenseStatus: "trial" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([10, 5, 2]);
  });

  it("places invalid/missing createdAt after valid timestamps", () => {
    const sorted = sortOrganizerTournaments([
      { id: 1, createdAt: "", status: "setup", licenseStatus: "trial" },
      { id: 2, createdAt: "2026-02-01T00:00:00.000Z", status: "setup", licenseStatus: "trial" },
      { id: 3, createdAt: "not-a-date", status: "setup", licenseStatus: "trial" },
      { id: 4, createdAt: "2026-01-01T00:00:00.000Z", status: "setup", licenseStatus: "trial" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([2, 4, 3, 1]);
  });

  it("places completed tournaments at the end (after all active tournaments)", () => {
    const sorted = sortOrganizerTournaments([
      { id: 1, name: "T1 Old Active", createdAt: "2026-01-01T00:00:00.000Z", status: "setup", licenseStatus: "trial" },
      { id: 2, name: "T2 New Completed", createdAt: "2026-09-01T00:00:00.000Z", status: "completed", licenseStatus: "active" },
      { id: 3, name: "T3 New Active", createdAt: "2026-10-28T00:00:00.000Z", status: "active", licenseStatus: "active" },
      { id: 4, name: "T4 Old Completed", createdAt: "2026-07-01T00:00:00.000Z", status: "setup", licenseStatus: "completed" },
    ]);
    // Active tournaments (3, 1) newest first, then completed tournaments (2, 4) newest first (oldest last)
    expect(sorted.map((t) => t.id)).toEqual([3, 1, 2, 4]);
  });

  it("orders completed tournaments newest first among themselves with oldest completed last", () => {
    const sorted = sortOrganizerTournaments([
      { id: 10, createdAt: "2026-07-01T00:00:00.000Z", status: "completed", licenseStatus: "completed" },
      { id: 20, createdAt: "2026-09-15T00:00:00.000Z", status: "completed", licenseStatus: "completed" },
      { id: 15, createdAt: "2026-08-01T00:00:00.000Z", status: "completed", licenseStatus: "completed" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual([20, 15, 10]);
  });
});

describe("dashboard list pipeline — filter then newest-first sort with completed last", () => {
  const rows = [
    { id: 1, createdAt: "2026-01-01T00:00:00.000Z", sport: "cricket", status: "setup", licenseStatus: "trial" },
    { id: 2, createdAt: "2026-03-01T00:00:00.000Z", sport: "badminton", status: "completed", licenseStatus: "active" },
    { id: 3, createdAt: "2026-02-01T00:00:00.000Z", sport: "cricket", status: "active", licenseStatus: "active" },
    { id: 4, createdAt: "2026-04-01T00:00:00.000Z", sport: "cricket", status: "completed", licenseStatus: "completed" },
  ];

  it("preserves newest-first with completed-last order after sport filter", () => {
    const cricket = rows.filter((t) => t.sport === "cricket");
    // Cricket items: 1 (active, Jan), 3 (active, Feb), 4 (completed, Apr)
    // Active newest first: 3, 1; then completed: 4
    expect(sortOrganizerTournaments(cricket).map((t) => t.id)).toEqual([3, 1, 4]);
  });

  it("preserves newest-first order after search filter", () => {
    const q = "2026-0";
    const matched = rows.filter((t) => t.createdAt.includes(q));
    expect(sortOrganizerTournaments(matched).map((t) => t.id)).toEqual([3, 1, 4, 2]);
  });
});

describe("organizer dashboard — summary cards as sole status filters", () => {
  it("does not render duplicate All/Active/Completed pill row", () => {
    expect(portalSrc).not.toMatch(/Row A — status filters/);
    expect(portalSrc).not.toContain('{ id: "all", label: "All", count:');
    expect(portalSrc).toContain('aria-pressed={statusFilter === "all"}');
    expect(portalSrc).toContain("sortOrganizerTournaments");
  });
});

describe("organizerTournamentCreatedTimeMs", () => {
  it("returns null for empty or invalid values", () => {
    expect(organizerTournamentCreatedTimeMs("")).toBeNull();
    expect(organizerTournamentCreatedTimeMs(undefined)).toBeNull();
    expect(organizerTournamentCreatedTimeMs("bad")).toBeNull();
  });
});
