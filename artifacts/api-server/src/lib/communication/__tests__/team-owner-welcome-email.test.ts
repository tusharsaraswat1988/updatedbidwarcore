import { describe, expect, it } from "vitest";
import { renderMergeTemplate } from "../merge-variables.js";
import {
  TEAM_OWNER_WELCOME_HTML,
  TEAM_OWNER_WELCOME_SUBJECT,
} from "../team-owner-welcome-email-template.js";

describe("team owner welcome email template", () => {
  const sampleData = {
    tournament_name: "Premier Cricket League 2026",
    sport_name: "Cricket",
    team_name: "Mumbai Warriors",
    owner_name: "Rahul Sharma",
    owner_mobile: "+91 98765 43210",
    access_code: "MW2026",
    auction_date: "06-09-2026 at 3:00 PM",
    tournament_dates: "26-09-2026, 27-09-2026",
    venue: "Wankhede Stadium, Mumbai",
    organiser_name: "Rajesh Kumar",
    organiser_phone: "+91 98765 43210",
    organiser_email: "rajesh@example.com",
    login_link: "https://bidwar.in/t/1/team/2/join",
    bidwar_logo: "<img src='https://bidwar.in/bidwar-primary-logo.png' alt='BidWar' />",
    tournament_logo: "<img src='https://bidwar.in/tournament-logo.png' alt='Tournament' />",
  };

  it("renders the branded subject line", () => {
    const subject = renderMergeTemplate(TEAM_OWNER_WELCOME_SUBJECT, sampleData);
    expect(subject).toBe("🎉 Welcome to Premier Cricket League 2026 — Mumbai Warriors Owner Panel");
  });

  it("renders BidWar branding, tournament logo, and team owner details", () => {
    const html = renderMergeTemplate(TEAM_OWNER_WELCOME_HTML, sampleData);

    // Logos & Branding
    expect(html).toContain("bidwar-primary-logo.png");
    expect(html).toContain("tournament-logo.png");
    expect(html).toContain("Team Owner Panel");

    // Greeting
    expect(html).toContain("Welcome, Rahul Sharma!");
    expect(html).toContain("Mumbai Warriors");
    expect(html).toContain("Premier Cricket League 2026");

    // Details table
    expect(html).toContain("Franchise &amp; Tournament Details");
    expect(html).toContain("Sport");
    expect(html).toContain("Cricket");
    expect(html).toContain("Registered Mobile (For Login)");
    expect(html).toContain("+91 98765 43210");
    expect(html).toContain("Use this mobile number to log in &amp; access your owner panel");
    expect(html).toContain("Team Access Code");
    expect(html).toContain("MW2026");
    expect(html).toContain("Auction Date &amp; Time");
    expect(html).toContain("06-09-2026 at 3:00 PM");
    expect(html).toContain("Tournament / Match Dates");
    expect(html).toContain("26-09-2026, 27-09-2026");
    expect(html).toContain("Venue");
    expect(html).toContain("Wankhede Stadium, Mumbai");
    expect(html).toContain("Organiser Name");
    expect(html).toContain("Rajesh Kumar");
    expect(html).toContain("Organiser Contact (Software/Support)");
    expect(html).toContain("Call for tournament or software related issues");

    // CTA Button
    expect(html).toContain("Open Owner Panel");
    expect(html).toContain("https://bidwar.in/t/1/team/2/join");

    // Instructions
    expect(html).toContain("Important Instructions for Team Owners");
    expect(html).toContain("Owner Panel Access:");
    expect(html).toContain("Auction Day Login:");

    // Referral / Support BidWar Banner
    expect(html).toContain("Support BidWar &mdash; Recommend to Other Tournaments");
    expect(html).toContain("Visit BidWar.in");

    // BidWar Contact Details
    expect(html).toContain("Team BidWar");
    expect(html).toContain("+91 8707488250");
    expect(html).toContain("support@bidwar.in");
    expect(html).toContain("https://bidwar.in");
  });

  it("handles missing optional fields cleanly without broken template tags", () => {
    const minimalData = {
      tournament_name: "Premier Cricket League 2026",
      team_name: "Mumbai Warriors",
      owner_name: "Rahul Sharma",
      owner_mobile: "+91 98765 43210",
      login_link: "https://bidwar.in/t/1/team/2/join",
      bidwar_logo: "<img src='https://bidwar.in/bidwar-primary-logo.png' alt='BidWar' />",
      tournament_logo: "",
      access_code: "",
      auction_date: "",
      tournament_dates: "",
      venue: "",
      organiser_name: "",
      organiser_phone: "",
      organiser_email: "",
    };

    const html = renderMergeTemplate(TEAM_OWNER_WELCOME_HTML, minimalData);

    expect(html).not.toContain("tournament-logo.png");
    expect(html).not.toContain("Team Access Code");
    expect(html).not.toContain("Auction Date &amp; Time");
    expect(html).not.toContain("Tournament / Match Dates");
    expect(html).not.toContain("Organiser Contact (Software/Support)");
    expect(html).toContain("Welcome, Rahul Sharma!");
    expect(html).toContain("Open Owner Panel");
  });
});
