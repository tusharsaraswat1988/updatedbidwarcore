import { describe, expect, it } from "vitest";
import { renderMergeTemplate } from "../merge-variables.js";
import {
  PLAYER_REGISTRATION_HTML,
  PLAYER_REGISTRATION_SUBJECT,
} from "../player-registration-email-template.js";
import {
  formatAuctionDateTimeDisplay,
  formatAuctionTime12h,
  formatIsoDateDdMmYyyy,
  formatMatchDatesDdMmYyyy,
} from "../player-registration-dates.js";

describe("player registration date formatting", () => {
  it("formats auction date/time as DD-MM-YYYY at h:mm AM/PM", () => {
    expect(formatIsoDateDdMmYyyy("2026-09-06")).toBe("06-09-2026");
    expect(formatAuctionTime12h("15:00")).toBe("3:00 PM");
    expect(formatAuctionDateTimeDisplay("2026-09-06", "15:00")).toBe(
      "06-09-2026 at 3:00 PM",
    );
  });

  it("formats matchDates without timezone shifting", () => {
    expect(formatMatchDatesDdMmYyyy("2026-09-26,2026-09-27")).toBe(
      "26-09-2026, 27-09-2026",
    );
    expect(formatMatchDatesDdMmYyyy("2026-09-26, 2026-09-27")).toBe(
      "26-09-2026, 27-09-2026",
    );
  });

  it("keeps auction and match dates separate for the regression case", () => {
    const auctionDate = formatAuctionDateTimeDisplay("2026-09-06", "15:00");
    const tournamentDates = formatMatchDatesDdMmYyyy("2026-09-26,2026-09-27");

    expect(auctionDate).toBe("06-09-2026 at 3:00 PM");
    expect(tournamentDates).toBe("26-09-2026, 27-09-2026");
    expect(tournamentDates).not.toContain("06-09-2026");
    expect(tournamentDates).not.toContain("3:00");
  });
});

describe("player registration email template", () => {
  const sampleData = {
    player_name: "Virat Kohli",
    tournament_name: "Premier League 2026",
    sport_name: "Cricket",
    registration_id: "#42",
    team_name: "Mumbai Warriors",
    auction_date: "06-09-2026 at 3:00 PM",
    tournament_dates: "26-09-2026, 27-09-2026",
    venue: "Wankhede Stadium",
    registration_date: "02-09-2026",
    organiser_name: "Rajesh Kumar",
    organiser_phone: "+91 98765 43210",
    organiser_email: "rajesh@example.com",
    bidwar_logo: "<img alt='BidWar' />",
    tournament_logo: "",
  };

  it("keeps the welcome subject", () => {
    const subject = renderMergeTemplate(PLAYER_REGISTRATION_SUBJECT, sampleData);
    expect(subject).toContain("Premier League 2026");
    expect(subject).toContain("Confirmed");
  });

  it("renders Auction Date and Tournament / Match Dates separately", () => {
    const html = renderMergeTemplate(PLAYER_REGISTRATION_HTML, sampleData);

    expect(html).toContain("Auction Date");
    expect(html).toContain("06-09-2026 at 3:00 PM");
    expect(html).toContain("Tournament / Match Dates");
    expect(html).toContain("26-09-2026, 27-09-2026");
    expect(html).not.toContain(">Tournament Dates<");
    expect(html).not.toMatch(/Tournament Dates(?! \/ Match)/);
  });

  it("hides empty auction or match date rows", () => {
    const html = renderMergeTemplate(PLAYER_REGISTRATION_HTML, {
      ...sampleData,
      auction_date: "",
      tournament_dates: "",
    });
    expect(html).not.toContain("Auction Date");
    expect(html).not.toContain("Tournament / Match Dates");
  });
});
