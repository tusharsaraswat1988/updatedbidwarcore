import { describe, expect, it } from "vitest";
import { tournamentMatchesOrganizerContact } from "../claim-tournaments-match.js";

describe("tournamentMatchesOrganizerContact", () => {
  it("matches normalized mobile across formatting", () => {
    expect(
      tournamentMatchesOrganizerContact(
        { organizerMobile: "+91 98765 43210", organizerEmail: null },
        { mobileNorm: "9876543210", emailNorm: null },
      ),
    ).toBe(true);
  });

  it("matches email case-insensitively", () => {
    expect(
      tournamentMatchesOrganizerContact(
        { organizerMobile: null, organizerEmail: "Org@Example.COM" },
        { mobileNorm: null, emailNorm: "org@example.com" },
      ),
    ).toBe(true);
  });

  it("does not match when neither contact field aligns", () => {
    expect(
      tournamentMatchesOrganizerContact(
        { organizerMobile: "9123456789", organizerEmail: "a@b.com" },
        { mobileNorm: "9876543210", emailNorm: "other@b.com" },
      ),
    ).toBe(false);
  });
});
