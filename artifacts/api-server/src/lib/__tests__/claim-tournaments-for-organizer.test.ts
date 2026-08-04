import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
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

describe("claimTournamentsForOrganizer Phase 1 stability", () => {
  it("keeps claim writes gated to organizer_id IS NULL (idempotent)", async () => {
    const src = await readFile(
      new URL("../claim-tournaments-for-organizer.ts", import.meta.url),
      "utf8",
    );
    expect(src).toContain("isNull(tournamentsTable.organizerId)");
    expect(src).toContain("SCORING_AUTH_CLAIM_STARTED");
    expect(src).toContain("SCORING_AUTH_CLAIM_SUCCESS");
    expect(src).toContain("SCORING_AUTH_CLAIM_SKIPPED");
    expect(src).toContain("SCORING_AUTH_CLAIM_FAILED");
    expect(src).toContain("tryClaimTournamentForOrganizer");
    // Must not overwrite an existing owner.
    expect(src).not.toMatch(/\.set\(\{\s*organizerId\s*\}\)\s*\n\s*\.where\(\s*eq\(tournamentsTable\.id/);
  });
});
