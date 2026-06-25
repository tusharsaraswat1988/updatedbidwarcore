import { describe, expect, it } from "vitest";
import { organiserWelcomeEmail } from "./templates/organiser-welcome";
import { playerRegisteredEmail } from "./templates/player-registered";
import { tournamentCreatedEmail } from "./templates/tournament-created";
import { hasEmailTemplate, renderEmailTemplate } from "./templates/registry";

describe("email templates", () => {
  it("renders organiser welcome email", () => {
    const result = organiserWelcomeEmail({ name: "Rahul Sharma", appUrl: "https://bidwar.in" });
    expect(result.subject).toContain("Welcome");
    expect(result.html).toContain("Rahul");
    expect(result.html).toContain("https://bidwar.in/organizer");
  });

  it("renders tournament created email", () => {
    const result = tournamentCreatedEmail({
      tournamentName: "Summer League 2026",
      sport: "cricket",
      auctionCode: "SU42",
      auctionDate: "2026-06-15",
      auctionTime: "18:00",
      venue: "Mumbai",
      organizerName: "Rahul",
      appUrl: "https://bidwar.in",
      tournamentId: 42,
    });
    expect(result.subject).toContain("Summer League 2026");
    expect(result.html).toContain("SU42");
    expect(result.html).toContain("Cricket");
    expect(result.html).toContain("Your Tournament Is Now Live on BidWar");
    expect(result.html).toContain("Open Tournament Dashboard");
    expect(result.html).toContain("https://bidwar.in/tournament/42");
    expect(result.html).toContain("favicon-32.png");
    expect(result.html).toContain("bidwarsupport@gmail.com");
    expect(result.html).toContain("Add Teams");
    expect(result.html).toContain("#FBBF24");
  });

  it("renders player registered email", () => {
    const result = playerRegisteredEmail({
      playerName: "Virat Kohli",
      photoUrl: "https://res.cloudinary.com/demo/image/upload/sample.jpg",
      tournamentName: "Corporate Premier League",
      tournamentLogoUrl: "https://res.cloudinary.com/demo/image/upload/logo.png",
      paymentPending: false,
      appUrl: "https://bidwar.in",
      bidwarLogoUrl: "https://res.cloudinary.com/demo/image/upload/bidwar.png",
      poweredByText: "Powered by BidWar",
    });
    expect(result.subject).toContain("Corporate Premier League");
    expect(result.html).toContain("Virat");
    expect(result.html).toContain("Corporate Premier League");
    expect(result.html).toContain("https://bidwar.in/");
    expect(result.html).toContain('target="_blank"');
    expect(result.html).toContain("This mail is powered by");
    expect(result.html).toContain("sample.jpg");
    expect(result.html).toContain("logo.png");
  });

  it("registry resolves known event types", () => {
    expect(hasEmailTemplate("ORGANISER_REGISTERED")).toBe(true);
    expect(hasEmailTemplate("TOURNAMENT_CREATED")).toBe(true);
    expect(hasEmailTemplate("PLAYER_REGISTERED")).toBe(true);
    expect(hasEmailTemplate("AUCTION_STARTED")).toBe(false);

    const rendered = renderEmailTemplate("ORGANISER_REGISTERED", {
      name: "Test User",
      appUrl: "https://bidwar.in",
    });
    expect(rendered?.subject).toBeTruthy();
    expect(rendered?.html).toContain("BidWar");
  });
});
