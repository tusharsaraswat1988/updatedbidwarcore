import { describe, it, expect, vi, beforeEach } from "vitest";
import { getFanTournaments } from "../src/routes/fan/tournaments";
import { Request, Response } from "express";
import { db } from "@workspace/db";
import { resolveFanPageCapabilities } from "@workspace/platform-core";

// Mock dependencies
vi.mock("@workspace/db", () => ({
  db: {
    select: vi.fn(),
  },
  tournamentsTable: {},
}));

vi.mock("@workspace/platform-core", async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual,
    resolveFanPageCapabilities: vi.fn(),
    isAuctionEnabled: vi.fn().mockReturnValue(true),
    isScoringEnabled: vi.fn().mockReturnValue(true),
  };
});

describe("Fan Featured Tournament Discovery - Final Verification", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;

  beforeEach(() => {
    mockReq = { query: { page: '1', limit: '20' } };
    mockRes = { json: vi.fn(), status: vi.fn().mockReturnThis() };
    vi.clearAllMocks();
  });

  it("1. Pagination and Sorting: Featured items come first, sorted by priority", async () => {
    const mockTournaments = [
      { id: "1", name: "T1", sport: "cricket", status: "live", createdAt: new Date("2026-01-01"), featuresJson: { featuredEnabled: true, featuredPriority: 5 } },
      { id: "2", name: "T2", sport: "cricket", status: "live", createdAt: new Date("2026-01-02"), featuresJson: { featuredEnabled: true, featuredPriority: 10 } },
      { id: "3", name: "T3", sport: "cricket", status: "live", createdAt: new Date("2026-01-03"), featuresJson: { featuredEnabled: false } },
    ];

    (db.select as any).mockReturnValue({
      from: () => ({
        orderBy: () => Promise.resolve(mockTournaments),
      }),
    });

    (resolveFanPageCapabilities as any).mockImplementation((t: any) => {
      const isFeatured = t.featuresJson.featuredEnabled;
      return Promise.resolve({
        isPubliclyVisible: true,
        featured: { isFeatured, priority: t.featuresJson.featuredPriority || 0 }
      });
    });

    await getFanTournaments(mockReq as Request, mockRes as Response);

    const call = (mockRes.json as any).mock.calls[0][0];
    expect(call.items[0].id).toBe("2"); // Priority 10
    expect(call.items[1].id).toBe("1"); // Priority 5
    expect(call.items[2].id).toBe("3"); // Not featured
  });

  it("5. Security: Private/archived/unlicensed cannot be featured publicly", async () => {
    const mockTournaments = [
      { id: "1", name: "Private", status: "live", featuresJson: { featuredEnabled: true } },
      { id: "2", name: "Archived", status: "archived", featuresJson: { featuredEnabled: true } },
    ];

    (db.select as any).mockReturnValue({
      from: () => ({
        orderBy: () => Promise.resolve(mockTournaments),
      }),
    });

    (resolveFanPageCapabilities as any).mockImplementation((t: any) => {
      // simulate fail-closed: return not visible for private/archived
      return Promise.resolve({
        isPubliclyVisible: false,
        featured: { isFeatured: true, priority: 10 }
      });
    });

    await getFanTournaments(mockReq as Request, mockRes as Response);

    const call = (mockRes.json as any).mock.calls[0][0];
    expect(call.items.length).toBe(0);
  });
});
