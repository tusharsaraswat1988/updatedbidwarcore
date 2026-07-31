import { describe, expect, it } from "vitest";
import { renderMergeTemplate } from "../merge-variables.js";
import {
  BADMINTON_MATCH_WIN_HTML,
  BADMINTON_MATCH_WIN_SUBJECT,
} from "../badminton-match-win-email-template.js";

describe("badminton match win email template", () => {
  const sampleData = {
    recipient_name: "PV Sindhu",
    winner_label: "PV Sindhu",
    opponent_label: "Saina Nehwal",
    tournament_name: "BidWar Badminton Open 2026",
    category_name: "Women's Singles",
    score_line: "21-15, 19-21, 21-18",
    games_score: "2-1",
    result_label: "Match Win",
    franchise_name: "Delhi Smashers",
    organiser_name: "Rajesh Kumar",
    organiser_email: "rajesh@example.com",
    bidwar_logo: "<img alt='BidWar' />",
    current_year: "2026",
  };

  it("uses a congratulatory subject line", () => {
    const subject = renderMergeTemplate(BADMINTON_MATCH_WIN_SUBJECT, sampleData);
    expect(subject).toBe(
      "🏸 Congratulations PV Sindhu! You won your badminton match",
    );
  });

  it("renders core celebration sections and Support BidWar", () => {
    const html = renderMergeTemplate(BADMINTON_MATCH_WIN_HTML, sampleData);
    expect(html).toContain("CONGRATULATIONS");
    expect(html).toContain("MATCH RESULT");
    expect(html).toContain("PV Sindhu");
    expect(html).toContain("Saina Nehwal");
    expect(html).toContain("21-15, 19-21, 21-18");
    expect(html).toContain("Keep the momentum. Own the court.");
    expect(html).toContain("Support BidWar");
    expect(html).toContain("https://bidwar.in");
    expect(html).toContain("#0B0B0B");
  });

  it("hides optional blocks when empty", () => {
    const html = renderMergeTemplate(BADMINTON_MATCH_WIN_HTML, {
      ...sampleData,
      category_name: "",
      score_line: "",
      franchise_name: "",
      organiser_email: "",
    });
    expect(html).not.toContain("Women's Singles");
    expect(html).not.toContain("Scoreline");
    expect(html).not.toContain("Representing");
    expect(html).not.toContain("rajesh@example.com");
  });
});
