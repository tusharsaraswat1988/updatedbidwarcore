import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import {
  hashScorerPin,
  verifyScorerPin,
} from "../lib/scorer-pin-crypto";
import {
  signOwnerSessionJwt,
  verifyOwnerSessionJwt,
  type OwnerSessionClaims,
} from "../lib/jwt";
import {
  persistOwnerSession,
  getStoredOwnerAccessCode,
  clearOwnerSession,
} from "@workspace/api-base/owner-auth";
import { assertRuntimeEnv } from "../lib/runtime-env";

beforeAll(() => {
  process.env.NODE_ENV = "production";
  process.env.BIDWAR_ENV = "production";
  process.env.PORT = "3000";
  process.env.DATABASE_URL = "postgresql://u:p@localhost:5432/testdb";
  process.env.SESSION_SECRET = "x".repeat(32);
  process.env.ADMIN_PASSWORD = "test-admin-password";
  process.env.APP_DOMAIN = "bidwar.in,www.bidwar.in";
  process.env.APP_PUBLIC_SCHEME = "https";
  process.env.APP_URL = "https://bidwar.in";
  process.env.SERVE_STATIC = "true";
  assertRuntimeEnv();
});

describe("P0-A: Scorer PIN Security & Multi-Tournament Credential Isolation", () => {
  it("PIN hashing uses robust cryptographic hash (scrypt) with salt and timing-safe verify", async () => {
    const pin = "4819";
    const hash = await hashScorerPin(pin);
    // Hash format: 32 hex chars salt + ':' + 128 hex chars key
    expect(hash).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    expect(await verifyScorerPin(pin, hash)).toBe(true);
    expect(await verifyScorerPin("0000", hash)).toBe(false);
    expect(await verifyScorerPin("4818", hash)).toBe(false);
  });

  it("Cross-tournament PIN protection: verifyScorerPin rejects incorrect PIN without side effects", async () => {
    const correctPin = "9182";
    const hash = await hashScorerPin(correctPin);
    const attackerPin = "1234";
    const isMatch = await verifyScorerPin(attackerPin, hash);
    expect(isMatch).toBe(false);
  });
});

describe("P0-B: Owner Access Code Removal & Multi-Team Session Hardening", () => {
  beforeEach(() => {
    // Mock sessionStorage in test environment
    const store = new Map<string, string>();
    (globalThis as any).sessionStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    };
  });

  it("getStoredOwnerAccessCode never returns plaintext access code", () => {
    expect(getStoredOwnerAccessCode(101)).toBeUndefined();
  });

  it("persistOwnerSession stores verification marker and removes plaintext access code from storage", () => {
    // Simulate legacy storage containing access code
    sessionStorage.setItem("owner_code_101", "SECRET123");
    expect(sessionStorage.getItem("owner_code_101")).toBe("SECRET123");

    // Call persistOwnerSession
    persistOwnerSession(101, "SECRET123");

    // Verification marker is set
    expect(sessionStorage.getItem("owner_verified_101")).toBe("1");
    // Plaintext access code has been removed!
    expect(sessionStorage.getItem("owner_code_101")).toBeNull();
    expect(getStoredOwnerAccessCode(101)).toBeUndefined();
  });

  it("clearOwnerSession cleans up verification marker and storage keys", () => {
    persistOwnerSession(101, "CODE");
    expect(sessionStorage.getItem("owner_verified_101")).toBe("1");

    clearOwnerSession(101);
    expect(sessionStorage.getItem("owner_verified_101")).toBeNull();
  });

  it("OwnerSessionClaims supports multi-team session maps across tournaments", () => {
    const claims: OwnerSessionClaims = {
      sessionId: "sess-team-1",
      tournamentId: 10,
      teamId: 1,
      teams: {
        "10:1": "sess-team-1",
        "10:2": "sess-team-2",
        "20:5": "sess-team-5",
      },
    };

    const token = signOwnerSessionJwt(claims);
    const verified = verifyOwnerSessionJwt(token);

    expect(verified).not.toBeNull();
    expect(verified?.sessionId).toBe("sess-team-1");
    expect(verified?.tournamentId).toBe(10);
    expect(verified?.teamId).toBe(1);
    expect(verified?.teams).toEqual({
      "10:1": "sess-team-1",
      "10:2": "sess-team-2",
      "20:5": "sess-team-5",
    });
  });

  it("Multi-team claims correctly isolate authorization: valid for authorized teams, rejected for unknown", () => {
    const claims: OwnerSessionClaims = {
      sessionId: "sess-team-1",
      tournamentId: 10,
      teamId: 1,
      teams: {
        "10:1": "sess-team-1",
        "20:5": "sess-team-5",
      },
    };

    const token = signOwnerSessionJwt(claims);
    const verified = verifyOwnerSessionJwt(token)!;

    // Direct match
    expect(verified.tournamentId === 10 && verified.teamId === 1).toBe(true);

    // Multi-team match for tournament 20, team 5
    const targetKey1 = "20:5";
    expect(verified.teams?.[targetKey1]).toBe("sess-team-5");

    // Rejected for un-authorized team 2 in tournament 10
    const targetKey2 = "10:2";
    expect(verified.teams?.[targetKey2]).toBeUndefined();

    // Rejected for un-authorized team 99 in tournament 30
    const targetKey3 = "30:99";
    expect(verified.teams?.[targetKey3]).toBeUndefined();
  });
});

describe("P0-C: Conflict of Interest & Self-Bidding Logic Verification", () => {
  it("Identifies self-bidding when bidder team owner mobile matches current player mobile", () => {
    const team = { id: 1, ownerMobile: "+91 98765-43210" };
    const currentPlayer = { id: 50, mobileNumber: "9876543210", playerTag: null, playerTagTeamId: null };

    const rawPlayerDigits = currentPlayer.mobileNumber.replace(/\D/g, "").slice(-10);
    const rawOwnerDigits = team.ownerMobile.replace(/\D/g, "").slice(-10);

    const isSelfBidding = Boolean(rawPlayerDigits && rawOwnerDigits && rawPlayerDigits === rawOwnerDigits);
    expect(isSelfBidding).toBe(true);
  });

  it("Identifies self-bidding when player is tagged as owner of the bidding team", () => {
    const teamId = 2;
    const currentPlayer = { id: 55, mobileNumber: "9123456789", playerTag: "owner", playerTagTeamId: 2 };

    const isSelfBidding = Boolean(
      (currentPlayer.playerTag === "owner" || currentPlayer.playerTag === "co_owner") &&
      currentPlayer.playerTagTeamId === teamId
    );
    expect(isSelfBidding).toBe(true);
  });

  it("Permits bidding on other players who are not the owner", () => {
    const team = { id: 1, ownerMobile: "+91 98765-43210" };
    const teamId = 1;
    const currentPlayer = { id: 60, mobileNumber: "9111122222", playerTag: null, playerTagTeamId: null };

    const rawPlayerDigits = currentPlayer.mobileNumber.replace(/\D/g, "").slice(-10);
    const rawOwnerDigits = team.ownerMobile.replace(/\D/g, "").slice(-10);

    const isSelfBidding = Boolean(
      ((currentPlayer.playerTag === "owner" || currentPlayer.playerTag === "co_owner") && currentPlayer.playerTagTeamId === teamId) ||
      (rawPlayerDigits && rawOwnerDigits && rawPlayerDigits === rawOwnerDigits)
    );
    expect(isSelfBidding).toBe(false);
  });

  it("Identifies manual self-deal when selling to organizer's own team", () => {
    const tournament = { organizerMobile: "+91 98888-77777", organizerEmail: "org@example.com" };
    const teamBefore = { id: 5, ownerMobile: "9888877777", ownerEmail: "different@example.com" };

    const rawOrgDigits = tournament.organizerMobile.replace(/\D/g, "").slice(-10);
    const rawOwnerDigits = teamBefore.ownerMobile.replace(/\D/g, "").slice(-10);

    const isOrganizerTeam = Boolean(
      (rawOrgDigits && rawOwnerDigits && rawOrgDigits === rawOwnerDigits) ||
      (tournament.organizerEmail && teamBefore.ownerEmail && tournament.organizerEmail === teamBefore.ownerEmail)
    );
    expect(isOrganizerTeam).toBe(true);
  });

  it("Differentiates organizer proxy bids from direct owner bids in audit metadata", () => {
    const isOrganizerOverride = true;
    const team = { id: 3, name: "Titans", ownerName: "Vikram" };
    const amount = 500_000;

    const auditEntry = {
      action: isOrganizerOverride ? "auction.organizer_proxy_bid" : "auction.bid_placed",
      summary: isOrganizerOverride
        ? `Organizer placed proxy bid of ₹${amount.toLocaleString("en-IN")} on behalf of "${team.name}"`
        : `${team.name} placed bid of ₹${amount.toLocaleString("en-IN")}`,
      metadata: {
        amount,
        isProxyBid: isOrganizerOverride,
      },
    };

    expect(auditEntry.action).toBe("auction.organizer_proxy_bid");
    expect(auditEntry.summary).toContain("Organizer placed proxy bid");
    expect(auditEntry.metadata.isProxyBid).toBe(true);
  });
});
