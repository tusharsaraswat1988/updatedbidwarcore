import { describe, expect, it } from "vitest";
import { scoringAppPath, scoringAppPublicUrl, SCORING_APP_BASE } from "../scoring-urls.ts";

describe("scoringAppPath idempotency and formatting", () => {
  it("prefixes canonical internal path with SCORING_APP_BASE", () => {
    expect(scoringAppPath("/tournament/25/cricket/obs/live")).toBe(
      "/scoring-app/tournament/25/cricket/obs/live",
    );
    expect(scoringAppPath("tournament/25/cricket/obs/live")).toBe(
      "/scoring-app/tournament/25/cricket/obs/live",
    );
  });

  it("is strictly idempotent when path already starts with /scoring-app", () => {
    expect(scoringAppPath("/scoring-app/tournament/25/cricket/obs/live")).toBe(
      "/scoring-app/tournament/25/cricket/obs/live",
    );
    expect(
      scoringAppPath("/scoring-app/tournament/25/cricket/obs/live?code=SL972608"),
    ).toBe("/scoring-app/tournament/25/cricket/obs/live?code=SL972608");
    expect(
      scoringAppPath("/scoring-app/tournament/25/cricket/obs/58?code=SL972608"),
    ).toBe("/scoring-app/tournament/25/cricket/obs/58?code=SL972608");
  });

  it("handles base-only path", () => {
    expect(scoringAppPath("/scoring-app")).toBe("/scoring-app");
    expect(scoringAppPath("/scoring-app/")).toBe("/scoring-app/");
    expect(scoringAppPath(SCORING_APP_BASE)).toBe(SCORING_APP_BASE);
  });
});

describe("scoringAppPublicUrl formatting", () => {
  it("generates correct canonical public URL whether input has /scoring-app or not", () => {
    expect(
      scoringAppPublicUrl(
        "https://bidwar.in",
        "/tournament/25/cricket/obs/live?code=SL972608",
      ),
    ).toBe("https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608");

    expect(
      scoringAppPublicUrl(
        "https://bidwar.in",
        "/scoring-app/tournament/25/cricket/obs/live?code=SL972608",
      ),
    ).toBe("https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608");

    expect(
      scoringAppPublicUrl(
        "https://bidwar.in",
        "/scoring-app/tournament/25/cricket/obs/58?code=SL972608",
      ),
    ).toBe("https://bidwar.in/scoring-app/tournament/25/cricket/obs/58?code=SL972608");
  });

  it("handles origin with trailing slash cleanly", () => {
    expect(
      scoringAppPublicUrl(
        "https://bidwar.in/",
        "/tournament/25/cricket/obs/live?code=SL972608",
      ),
    ).toBe("https://bidwar.in/scoring-app/tournament/25/cricket/obs/live?code=SL972608");
  });
});
