import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("../lib/registration-context-service.js", () => ({
  loadTournamentByRegistrationCode: vi.fn(),
}));

vi.mock("../lib/branding-service.js", () => ({
  getPlatformOpenGraphImageUrl: vi.fn(() => "https://cdn.example/admin-og.png"),
}));

import { loadTournamentByRegistrationCode } from "../lib/registration-context-service.js";
import { resolveRegistrationPageMeta } from "../lib/registration-page-meta.js";

describe("resolveRegistrationPageMeta", () => {
  beforeEach(() => {
    vi.mocked(loadTournamentByRegistrationCode).mockReset();
  });

  it("returns tournament-specific metadata for a valid registration code", async () => {
    vi.mocked(loadTournamentByRegistrationCode).mockResolvedValue({
      id: 5,
      name: "Vyapari Network Badminton League",
      sport: "badminton",
      venue: "BLW",
      logoUrl: "https://cdn.example/tournament-logo.jpg",
      mainBannerUrl: null,
      mainBannerEnabled: false,
      organizerName: "Organizer",
      auctionCode: "VN830108",
    } as Awaited<ReturnType<typeof loadTournamentByRegistrationCode>>);

    const meta = await resolveRegistrationPageMeta("/register/VN830108");

    expect(meta).toMatchObject({
      title: "Vyapari Network Badminton League | Player Registration",
      canonical: "https://bidwar.in/register/VN830108",
      ogTitle: "Vyapari Network Badminton League | Player Registration",
      ogImage: "https://cdn.example/tournament-logo.jpg",
      twitterTitle: "Vyapari Network Badminton League | Player Registration",
    });
    expect(meta?.description).toContain("Vyapari Network Badminton League");
    expect(meta?.description).toContain("Badminton");
    expect(meta?.description).toContain("BLW");
    expect(meta?.ogDescription).toContain("Player registrations are now open.");
  });

  it("never falls back to homepage marketing copy for unknown tournaments", async () => {
    vi.mocked(loadTournamentByRegistrationCode).mockResolvedValue(null);

    const meta = await resolveRegistrationPageMeta("/register/TEST1234");

    expect(meta?.title).toBe("Player Registration | BidWar");
    expect(meta?.canonical).toBe("https://bidwar.in/register/TEST1234");
    expect(meta?.ogImage).toBe("https://cdn.example/admin-og.png");
    expect(meta?.description).not.toContain("IPL-style player auctions live");
  });
});
