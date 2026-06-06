import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import {
  normalizeOwnerMobile,
  isEligibleOwnerTournament,
  rowToOwnerOnboardingEntry,
  sortOwnerOnboardingEntries,
} from "../lib/owner-onboarding";

const { mockDbWhere } = vi.hoisted(() => ({
  mockDbWhere: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        innerJoin: () => ({
          leftJoin: () => ({
            where: mockDbWhere,
          }),
        }),
      }),
    }),
  },
  teamsTable: { id: {}, tournamentId: {}, ownerMobile: {}, accessCode: {}, name: {}, shortCode: {}, color: {} },
  tournamentsTable: { id: {}, name: {}, licenseStatus: {}, status: {}, adminLocked: {} },
  auctionSessionsTable: { tournamentId: {}, status: {} },
}));

vi.mock("../lib/rate-limiters", () => ({
  ownerLookupLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}));

import ownerOnboardingRouter from "../routes/owner-onboarding";

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(ownerOnboardingRouter);
  return app;
}

describe("normalizeOwnerMobile", () => {
  it("strips non-digits and normalizes leading 0 to 91", () => {
    expect(normalizeOwnerMobile("+91 98765 43210")).toBe("919876543210");
    expect(normalizeOwnerMobile("09876543210")).toBe("919876543210");
  });
});

describe("isEligibleOwnerTournament", () => {
  it("accepts trial and active unlocked non-completed tournaments", () => {
    expect(isEligibleOwnerTournament({
      licenseStatus: "trial",
      tournamentStatus: "setup",
      adminLocked: false,
    })).toBe(true);
    expect(isEligibleOwnerTournament({
      licenseStatus: "active",
      tournamentStatus: "active",
      adminLocked: false,
    })).toBe(true);
  });

  it("rejects locked, completed, or non-eligible license", () => {
    expect(isEligibleOwnerTournament({
      licenseStatus: "active",
      tournamentStatus: "setup",
      adminLocked: true,
    })).toBe(false);
    expect(isEligibleOwnerTournament({
      licenseStatus: "completed",
      tournamentStatus: "setup",
      adminLocked: false,
    })).toBe(false);
    expect(isEligibleOwnerTournament({
      licenseStatus: "trial",
      tournamentStatus: "completed",
      adminLocked: false,
    })).toBe(false);
  });
});

describe("rowToOwnerOnboardingEntry", () => {
  it("omits access code and exposes requiresAccessCode", () => {
    const entry = rowToOwnerOnboardingEntry({
      tournamentId: 1,
      tournamentName: "Cup",
      teamId: 2,
      teamName: "Warriors",
      teamShortCode: "WAR",
      teamColor: "#F59E0B",
      teamLogoUrl: "https://res.cloudinary.com/demo/image/upload/team.png",
      licenseStatus: "trial",
      tournamentStatus: "setup",
      auctionStatus: "active",
      accessCode: "ABC123",
    });
    expect(entry.requiresAccessCode).toBe(true);
    expect(entry).not.toHaveProperty("accessCode");
  });
});

describe("sortOwnerOnboardingEntries", () => {
  it("puts live auctions first", () => {
    const sorted = sortOwnerOnboardingEntries([
      {
        tournamentId: 1,
        tournamentName: "B",
        teamId: 1,
        teamName: "A",
        teamShortCode: "A",
        teamColor: null,
        teamLogoUrl: null,
        licenseStatus: "trial",
        tournamentStatus: "setup",
        auctionStatus: "idle",
        requiresAccessCode: false,
      },
      {
        tournamentId: 2,
        tournamentName: "A",
        teamId: 2,
        teamName: "B",
        teamShortCode: "B",
        teamColor: null,
        teamLogoUrl: null,
        licenseStatus: "active",
        tournamentStatus: "active",
        auctionStatus: "active",
        requiresAccessCode: true,
      },
    ]);
    expect(sorted[0].auctionStatus).toBe("active");
  });
});

describe("POST /owner/onboarding/lookup", () => {
  beforeEach(() => {
    mockDbWhere.mockReset();
  });

  it("returns 400 for invalid mobile", async () => {
    const res = await request(makeApp())
      .post("/owner/onboarding/lookup")
      .send({ mobile: "123" });
    expect(res.status).toBe(400);
  });

  it("returns eligible entries without access codes", async () => {
    mockDbWhere.mockResolvedValue([
      {
        tournamentId: 5,
        tournamentName: "Summer League",
        teamId: 4,
        teamName: "Titans",
        teamShortCode: "TIT",
        teamColor: "#3B82F6",
        teamLogoUrl: "https://res.cloudinary.com/demo/image/upload/titans.png",
        licenseStatus: "active",
        tournamentStatus: "active",
        auctionStatus: "active",
        accessCode: "SECRET1",
      },
    ]);

    const res = await request(makeApp())
      .post("/owner/onboarding/lookup")
      .send({ mobile: "9876543210" });

    expect(res.status).toBe(200);
    expect(res.body.entries).toHaveLength(1);
    expect(res.body.entries[0]).toMatchObject({
      tournamentId: 5,
      teamId: 4,
      requiresAccessCode: true,
      teamLogoUrl: "https://res.cloudinary.com/demo/image/upload/titans.png",
    });
    expect(res.body.entries[0].accessCode).toBeUndefined();
  });

  it("returns empty array when no teams match", async () => {
    mockDbWhere.mockResolvedValue([]);
    const res = await request(makeApp())
      .post("/owner/onboarding/lookup")
      .send({ mobile: "9876543210" });
    expect(res.status).toBe(200);
    expect(res.body.entries).toEqual([]);
  });
});
