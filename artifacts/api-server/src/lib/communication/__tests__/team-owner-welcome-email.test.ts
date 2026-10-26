import { describe, expect, it } from "vitest";
import { renderMergeTemplate } from "../merge-variables.js";
import {
  TEAM_OWNER_WELCOME_HTML,
  TEAM_OWNER_WELCOME_SUBJECT,
} from "../team-owner-welcome-email-template.js";

describe("team owner welcome email template", () => {
  const cricketTournamentData = {
    tournament_name: "Premier Cricket League 2026",
    sport_name: "Cricket",
    team_name: "Mumbai Warriors",
    owner_name: "Rahul Sharma",
    owner_mobile: "+91 98765 43210",
    tournament_dates: "26-09-2026, 27-09-2026",
    venue: "Wankhede Stadium, Mumbai",
    organiser_name: "Rajesh Kumar",
    organiser_phone: "+91 98765 43210",
    organiser_email: "rajesh@example.com",
    bidwar_logo: "<img src='https://bidwar.in/bidwar-primary-logo.png' alt='BidWar' />",
    tournament_logo: "<img src='https://bidwar.in/tournament-logo.png' alt='Tournament' />",
    has_auction: "",
    no_auction: "1",
    is_cricket: "1",
    access_code: "",
    auction_date: "",
    login_link: "",
  };

  const auctionTournamentData = {
    tournament_name: "Premier League 2026",
    sport_name: "Badminton",
    team_name: "Mumbai Smashers",
    owner_name: "Rahul Sharma",
    owner_mobile: "+91 98765 43210",
    access_code: "MW2026",
    auction_date: "06-09-2026 at 3:00 PM",
    tournament_dates: "26-09-2026, 27-09-2026",
    venue: "National Stadium, Mumbai",
    organiser_name: "Rajesh Kumar",
    organiser_phone: "+91 98765 43210",
    organiser_email: "rajesh@example.com",
    login_link: "https://bidwar.in/t/1/team/2/join",
    bidwar_logo: "<img src='https://bidwar.in/bidwar-primary-logo.png' alt='BidWar' />",
    tournament_logo: "<img src='https://bidwar.in/tournament-logo.png' alt='Tournament' />",
    has_auction: "1",
    no_auction: "",
    is_cricket: "",
  };

  it("renders cricket tournament email without access code, without owner panel button, and without live auction details", () => {
    const subject = renderMergeTemplate(TEAM_OWNER_WELCOME_SUBJECT, cricketTournamentData);
    expect(subject).toBe("🎉 Welcome to Premier Cricket League 2026 — Mumbai Warriors Registration Confirmed");

    const html = renderMergeTemplate(TEAM_OWNER_WELCOME_HTML, cricketTournamentData);

    // Logos & Branding
    expect(html).toContain("bidwar-primary-logo.png");
    expect(html).toContain("tournament-logo.png");
    expect(html).toContain("Team Registration");
    expect(html).not.toContain("Team Owner Panel");

    // Greeting & Intro — no live player auction text
    expect(html).toContain("Welcome, Rahul Sharma!");
    expect(html).toContain("Mumbai Warriors");
    expect(html).toContain("Premier Cricket League 2026");
    expect(html).toContain("Below are your team details, tournament schedule, and coordinator support information.");
    expect(html).not.toContain("Get ready for the live player auction");

    // Details table — clean mobile, no access code, no auction date
    expect(html).toContain("Team &amp; Tournament Details");
    expect(html).toContain("Sport");
    expect(html).toContain("Cricket");
    expect(html).toContain("Registered Mobile");
    expect(html).not.toContain("Registered Mobile (For Login)");
    expect(html).toContain("+91 98765 43210");
    expect(html).not.toContain("Use this mobile number to log in &amp; access your owner panel");
    expect(html).not.toContain("Team Access Code");
    expect(html).not.toContain("Auction Date &amp; Time");
    expect(html).toContain("Tournament / Match Dates");
    expect(html).toContain("26-09-2026, 27-09-2026");
    expect(html).toContain("Venue");
    expect(html).toContain("Wankhede Stadium, Mumbai");
    expect(html).toContain("Organiser Name");
    expect(html).toContain("Rajesh Kumar");
    expect(html).toContain("Organiser Contact (Software/Support)");

    // No Owner Panel CTA button or direct link
    expect(html).not.toContain("Open Owner Panel");
    expect(html).not.toContain("Direct link to your Owner Panel:");

    // Instructions — tournament info only, no bidding controls or auction day login
    expect(html).toContain("Important Tournament Information");
    expect(html).not.toContain("Important Instructions for Team Owners");
    expect(html).not.toContain("Owner Panel Access:");
    expect(html).not.toContain("Auction Day Login:");
    expect(html).not.toContain("Live Auction Access:");
    expect(html).toContain("Match Schedule &amp; Fixtures:");
    expect(html).toContain("Squad &amp; Players:");
    expect(html).toContain("Support:");

    // Referral / Support BidWar Banner
    expect(html).toContain("Support BidWar &mdash; Recommend to Other Tournaments");
    expect(html).toContain("Visit BidWar.in");
  });

  it("renders auction tournament email with access code, owner panel button, and live auction instructions", () => {
    const subject = renderMergeTemplate(TEAM_OWNER_WELCOME_SUBJECT, auctionTournamentData);
    expect(subject).toBe("🎉 Welcome to Premier League 2026 — Mumbai Smashers Owner Panel");

    const html = renderMergeTemplate(TEAM_OWNER_WELCOME_HTML, auctionTournamentData);

    // Header & Greeting
    expect(html).toContain("Team Owner Panel");
    expect(html).toContain("Get ready for the live player auction");

    // Details table
    expect(html).toContain("Franchise &amp; Tournament Details");
    expect(html).toContain("Registered Mobile (For Login)");
    expect(html).toContain("Use this mobile number to log in &amp; access your owner panel");
    expect(html).toContain("Team Access Code");
    expect(html).toContain("MW2026");
    expect(html).toContain("Auction Date &amp; Time");
    expect(html).toContain("06-09-2026 at 3:00 PM");

    // CTA Button
    expect(html).toContain("Open Owner Panel");
    expect(html).toContain("https://bidwar.in/t/1/team/2/join");

    // Instructions
    expect(html).toContain("Important Instructions for Team Owners");
    expect(html).toContain("Owner Panel Access:");
    expect(html).toContain("Auction Day Login:");
    expect(html).toContain("Live Auction Access:");
  });

  it("handles missing optional fields cleanly without broken template tags", () => {
    const minimalData = {
      tournament_name: "Premier Cricket League 2026",
      team_name: "Mumbai Warriors",
      owner_name: "Rahul Sharma",
      owner_mobile: "+91 98765 43210",
      bidwar_logo: "<img src='https://bidwar.in/bidwar-primary-logo.png' alt='BidWar' />",
      tournament_logo: "",
      access_code: "",
      auction_date: "",
      tournament_dates: "",
      venue: "",
      organiser_name: "",
      organiser_phone: "",
      organiser_email: "",
      login_link: "",
      has_auction: "",
    };

    const html = renderMergeTemplate(TEAM_OWNER_WELCOME_HTML, minimalData);

    expect(html).not.toContain("tournament-logo.png");
    expect(html).not.toContain("Team Access Code");
    expect(html).not.toContain("Auction Date &amp; Time");
    expect(html).not.toContain("Tournament / Match Dates");
    expect(html).not.toContain("Organiser Contact (Software/Support)");
    expect(html).toContain("Welcome, Rahul Sharma!");
    expect(html).not.toContain("Open Owner Panel");
  });
});
