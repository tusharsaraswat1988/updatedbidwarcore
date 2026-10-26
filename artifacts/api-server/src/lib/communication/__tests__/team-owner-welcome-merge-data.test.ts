import { describe, expect, it, vi, beforeEach } from "vitest";

const mockDbSelect = vi.fn();

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: mockDbSelect,
        }),
        limit: mockDbSelect,
      }),
    }),
  },
  brandingSettingsTable: { brandName: "brandName", poweredByText: "poweredByText" },
  teamsTable: { id: "id" },
  tournamentsTable: { id: "id" },
}));

vi.mock("../../branding-service.js", () => ({
  brandingService: {
    resolveEmailLogoAssetUrl: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock("../../runtime-env.js", () => ({
  buildPublicUrl: (path: string) => `https://bidwar.in${path.startsWith("/") ? path : `/${path}`}`,
  getPublicOrigin: () => "https://bidwar.in",
  getRuntimeConfig: () => ({ publicOrigin: "https://bidwar.in" }),
}));

import { buildTeamOwnerWelcomeMergeData } from "../team-owner-welcome-merge-data.js";

describe("buildTeamOwnerWelcomeMergeData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("suppresses access code, auction date, owner panel link, and login hints for cricket tournaments", async () => {
    const mockTeam = {
      id: 86,
      tournamentId: 40,
      name: "CWP SMASHERS",
      ownerName: "TUSHAR SARASWAT",
      ownerMobile: "7054007733",
      ownerEmail: "tushar@example.com",
      accessCode: "HNYXGA",
      purse: 5000000,
    };

    const mockTournament = {
      id: 40,
      name: "BIDWAR PREMIER LEAGUE",
      sport: "cricket",
      auctionEnabled: true, // even if legacy default is true, cricket suppresses auction data
      venue: "Pitch & Paddle",
      city: "Varanasi",
      matchDates: "2026-10-10,2026-10-11",
      organizerName: "Tushar Saraswat",
      organizerMobile: "8707488250",
      organizerEmail: "tusharsaraswat1988@gmail.com",
      auctionDate: "2026-10-05",
      auctionTime: "18:00",
    };

    const mockBranding = {
      brandName: "BidWar",
      poweredByText: "Powered by BidWar",
    };

    mockDbSelect
      .mockResolvedValueOnce([mockTeam])
      .mockResolvedValueOnce([mockTournament])
      .mockResolvedValueOnce([mockBranding]);

    const result = await buildTeamOwnerWelcomeMergeData(86);

    // Core identity preserved
    expect(result.team_name).toBe("CWP SMASHERS");
    expect(result.owner_name).toBe("TUSHAR SARASWAT");
    expect(result.owner_mobile).toBe("7054007733");
    expect(result.tournament_name).toBe("BIDWAR PREMIER LEAGUE");
    expect(result.sport_name).toBe("Cricket");

    // Auction fields suppressed
    expect(result.access_code).toBe("");
    expect(result.auction_date).toBe("");
    expect(result.auction_name).toBe("");
    expect(result.login_link).toBe("");
    expect(result.owner_app_link).toBe("");
    expect(result.team_budget).toBe("");

    // Flags and labels
    expect(result.has_auction).toBe("");
    expect(result.no_auction).toBe("1");
    expect(result.is_cricket).toBe("1");
    expect(result.mobile_label).toBe("Registered Mobile");
    expect(result.mobile_login_hint).toBe("");
    expect(result.header_badge).toBe("Cricket Tournament");
    expect(result.intro_schedule_line).toContain("Below are your team details");
    expect(result.intro_schedule_line).not.toContain("live player auction");
    expect(result.important_info_heading).toBe("Important Tournament Information");
  });

  it("includes access code, auction date, and owner panel link for auction tournaments", async () => {
    const mockTeam = {
      id: 12,
      tournamentId: 5,
      name: "Warriors",
      ownerName: "Alice",
      ownerMobile: "9876543210",
      ownerEmail: "alice@example.com",
      accessCode: "ACC123",
      purse: 10000000,
    };

    const mockTournament = {
      id: 5,
      name: "Badminton Super League",
      sport: "badminton",
      auctionEnabled: true,
      venue: "Sports Complex",
      city: "Mumbai",
      auctionDate: "2026-11-01",
      auctionTime: "15:00",
    };

    const mockBranding = {
      brandName: "BidWar",
      poweredByText: "Powered by BidWar",
    };

    mockDbSelect
      .mockResolvedValueOnce([mockTeam])
      .mockResolvedValueOnce([mockTournament])
      .mockResolvedValueOnce([mockBranding]);

    const result = await buildTeamOwnerWelcomeMergeData(12);

    expect(result.access_code).toBe("ACC123");
    expect(result.has_auction).toBe("1");
    expect(result.no_auction).toBe("");
    expect(result.login_link).toContain("/owner-app/join?tournamentId=5&teamId=12");
    expect(result.mobile_label).toBe("Registered Mobile (For Login)");
    expect(result.mobile_login_hint).toBe("Use this mobile number to log in & access your owner panel");
    expect(result.header_badge).toBe("Team Owner Panel");
  });
});
