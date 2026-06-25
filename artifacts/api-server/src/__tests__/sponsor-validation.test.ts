import { describe, expect, it } from "vitest";
import { parseValidatedSponsorLogos } from "../lib/sponsor-validation";

describe("parseValidatedSponsorLogos", () => {
  it("rejects invalid sponsor priority combinations", () => {
    const result = parseValidatedSponsorLogos(
      JSON.stringify([
        { url: "https://a", isTitleSponsor: true },
        { url: "https://b", isTitleSponsor: true },
      ]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe("Only one Title Sponsor is allowed.");
    }
  });

  it("accepts valid sponsor JSON", () => {
    const result = parseValidatedSponsorLogos(
      JSON.stringify([{ url: "https://a", isCoSponsor: true }]),
    );
    expect(result).toMatchObject({ ok: true });
  });
});
