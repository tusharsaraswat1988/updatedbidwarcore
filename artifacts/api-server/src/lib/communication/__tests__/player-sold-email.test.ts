import { describe, expect, it } from "vitest";
import { renderMergeTemplate } from "../merge-variables.js";
import {
  PLAYER_SOLD_HTML,
  PLAYER_SOLD_SUBJECT,
} from "../player-sold-email-template.js";

describe("player sold email template", () => {
  const sampleData = {
    player_name: "Virat Kohli",
    team_name: "Mumbai Warriors",
    tournament_name: "Premier League 2026",
    title_sponsor: "DreamSports",
    co_sponsors_line: "PayFast, StarPlay and FanZone",
    player_avatar: "<img />",
    team_logo: "<img />",
    amount_display: "₹12,50,000",
    amount_money: "1",
    auction_name: "Premier League 2026",
    auction_date: "15 March 2026",
    organiser_name: "Rajesh Kumar",
    organiser_email: "rajesh@example.com",
    tournament_url: "https://bidwar.in/tournament/1",
    bidwar_logo: "<img alt='BidWar' />",
    celebration_gif: "https://bidwar.in/assets/email/auction-celebration.gif",
    current_year: "2026",
  };

  it("uses the premium subject line", () => {
    const subject = renderMergeTemplate(PLAYER_SOLD_SUBJECT, sampleData);
    expect(subject).toBe("🎉 Congratulations Virat Kohli! Welcome to Mumbai Warriors");
  });

  it("renders core premium sections", () => {
    const html = renderMergeTemplate(PLAYER_SOLD_HTML, sampleData);
    expect(html).toContain("CONGRATULATIONS");
    expect(html).toContain("YOU HAVE BEEN SOLD TO");
    expect(html).toContain("Mumbai Warriors");
    expect(html).toContain("₹12,50,000");
    expect(html).toContain("Every Champion Starts With A Winning Bid");
    expect(html).toContain("View Tournament");
    expect(html).toContain("#0B0B0B");
  });

  it("hides sponsor and CTA blocks when empty", () => {
    const html = renderMergeTemplate(PLAYER_SOLD_HTML, {
      ...sampleData,
      title_sponsor: "",
      co_sponsors_line: "",
      tournament_url: "",
      organiser_email: "",
    });
    expect(html).not.toContain("Co-powered by");
    expect(html).not.toContain("View Tournament");
    expect(html).not.toContain("rajesh@example.com");
  });

  it("renders points mode when amount_points flag is set", () => {
    const html = renderMergeTemplate(PLAYER_SOLD_HTML, {
      ...sampleData,
      amount_points: "1",
      amount_money: "",
      amount_display: "1,500",
    });
    expect(html).toContain("1,500");
    expect(html).toContain("POINTS");
  });
});
