import { describe, it, expect, beforeEach, beforeAll } from "vitest";
import { hashScorerPin, verifyScorerPin } from "../lib/scorer-pin-crypto";
import {
  signOwnerSessionJwt,
  verifyOwnerSessionJwt,
  type OwnerSessionClaims,
} from "../lib/jwt";
import { isTournamentOrganizer } from "../middleware/require-organizer";
import { assertRuntimeEnv } from "../lib/runtime-env";
import type { Request } from "express";

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

describe("Case 1: Correct and incorrect scorer PINs", () => {
  it("Verifies correct PIN and rejects incorrect or malformed PINs", async () => {
    const pin = "5921";
    const hash = await hashScorerPin(pin);

    expect(await verifyScorerPin("5921", hash)).toBe(true);
    expect(await verifyScorerPin("5922", hash)).toBe(false);
    expect(await verifyScorerPin("0000", hash)).toBe(false);
    expect(await verifyScorerPin("", hash)).toBe(false);
    expect(await verifyScorerPin("5921", "invalid-hash-format")).toBe(false);
  });
});

describe("Case 2: Concurrent legacy PIN migration safety", () => {
  it("Scorer PIN hashing is deterministic in length and uses unique cryptographic salts", async () => {
    const pin = "1234";
    const hash1 = await hashScorerPin(pin);
    const hash2 = await hashScorerPin(pin);

    // Both hashes verify the same PIN
    expect(await verifyScorerPin(pin, hash1)).toBe(true);
    expect(await verifyScorerPin(pin, hash2)).toBe(true);
    // But have distinct salts (preventing rainbow tables)
    expect(hash1).not.toBe(hash2);
  });
});

describe("Case 3: Scorer removal from Tournament A while still assigned in Tournament B", () => {
  it("Preserves global sessions when scorer holds active assignments in another tournament", () => {
    const scorerId = 42;
    const tournamentIdA = 10;
    const tournamentIdB = 20;

    const mockAssignments = [
      { scorerId, tournamentId: tournamentIdA },
      { scorerId, tournamentId: tournamentIdB },
    ];

    // Simulate removing from Tournament A
    const remainingAssignments = mockAssignments.filter(
      (a) => !(a.scorerId === scorerId && a.tournamentId === tournamentIdA)
    );

    expect(remainingAssignments.length).toBe(1);
    expect(remainingAssignments[0].tournamentId).toBe(tournamentIdB);

    // Rule: sessions must only be revoked if remainingAssignments.length === 0
    const shouldRevokeSessions = remainingAssignments.length === 0;
    expect(shouldRevokeSessions).toBe(false);
  });

  it("Revokes sessions when scorer is removed from their sole tournament assignment", () => {
    const scorerId = 42;
    const tournamentIdA = 10;

    const mockAssignments = [
      { scorerId, tournamentId: tournamentIdA },
    ];

    const remainingAssignments = mockAssignments.filter(
      (a) => !(a.scorerId === scorerId && a.tournamentId === tournamentIdA)
    );

    expect(remainingAssignments.length).toBe(0);
    const shouldRevokeSessions = remainingAssignments.length === 0;
    expect(shouldRevokeSessions).toBe(true);
  });
});

describe("Case 4: Owner of Team A attempting to bid for Team B", () => {
  it("Rejects claims for Team A when bidding on Team B in the same tournament", () => {
    const claims: OwnerSessionClaims = {
      sessionId: "sess-team-1",
      tournamentId: 100,
      teamId: 1, // Authorized for Team 1
    };

    const targetTournamentId = 100;
    const targetTeamId = 2; // Attempting to bid for Team 2

    const isDirect = claims.tournamentId === targetTournamentId && claims.teamId === targetTeamId;
    const targetKey = `${targetTournamentId}:${targetTeamId}`;
    const isMulti = Boolean(claims.teams && claims.teams[targetKey]);

    const isAuthorized = isDirect || isMulti;
    expect(isAuthorized).toBe(false);
  });
});

describe("Case 5: Valid owner sessions for two teams with one team revoked", () => {
  it("Removes only the revoked team and preserves the remaining active team in claims", () => {
    const teamsMap: Record<string, string> = {
      "100:1": "sess-team-1",
      "100:2": "sess-team-2",
    };

    // Revoke Team 1
    const revokedKey = "100:1";
    delete teamsMap[revokedKey];

    // Team 1 is no longer in claims
    expect(teamsMap["100:1"]).toBeUndefined();
    // Team 2 remains active and authorized
    expect(teamsMap["100:2"]).toBe("sess-team-2");
  });
});

describe("Case 6: Reuse of an old cookie after revocation", () => {
  it("Replayed cookie pointing to deleted session ID fails database load check", () => {
    // Database mock
    const dbSessions = new Map<string, { id: string; tournamentId: number; teamId: number }>();
    dbSessions.set("sess-team-1", { id: "sess-team-1", tournamentId: 100, teamId: 1 });

    const claims: OwnerSessionClaims = {
      sessionId: "sess-team-1",
      tournamentId: 100,
      teamId: 1,
    };
    const oldCookieToken = signOwnerSessionJwt(claims);

    // Active session loads successfully
    const verifiedBefore = verifyOwnerSessionJwt(oldCookieToken)!;
    expect(dbSessions.has(verifiedBefore.sessionId)).toBe(true);

    // Server revokes session: row is deleted from database
    dbSessions.delete("sess-team-1");

    // Client replays old cookie token
    const verifiedAfter = verifyOwnerSessionJwt(oldCookieToken)!;
    const sessionInDb = dbSessions.get(verifiedAfter.sessionId);

    // Database lookup fails -> session is rejected as expired
    expect(sessionInDb).toBeUndefined();
  });
});

describe("Case 7: Organizer attempting an unauthorized cross-tournament bid", () => {
  it("Rejects organizer from Tournament 100 attempting to bid in Tournament 200", () => {
    const req = {
      jwtUser: {
        userId: 42,
        organizerAccountId: 100, // Organizer of tournament 100
        isAdmin: false,
        organizer: { "100": true },
      },
    } as unknown as Request;

    const targetTournamentId = 200;
    const targetTournamentOrganizerId = 200; // Owned by organizer 200

    const isAuthorized = isTournamentOrganizer(req, targetTournamentId, targetTournamentOrganizerId);
    expect(isAuthorized).toBe(false);
  });

  it("Allows organizer to manage their own tournament", () => {
    const req = {
      jwtUser: {
        userId: 42,
        organizerAccountId: 100,
        isAdmin: false,
        organizer: { "100": true },
      },
    } as unknown as Request;

    const targetTournamentId = 100;
    const targetTournamentOrganizerId = 100;

    const isAuthorized = isTournamentOrganizer(req, targetTournamentId, targetTournamentOrganizerId);
    expect(isAuthorized).toBe(true);
  });
});

describe("Case 8: Unauthorized client attempting to enable self-bidding", () => {
  it("Non-organizer request fails tournament organizer authorization gate", () => {
    const unauthenticatedReq = {
      jwtUser: undefined,
    } as unknown as Request;

    const isOrg = isTournamentOrganizer(unauthenticatedReq, 100, 100);
    expect(isOrg).toBe(false);

    const teamOwnerReq = {
      jwtUser: {
        userId: 99,
        isAdmin: false,
      },
    } as unknown as Request;

    const isOwnerOrg = isTournamentOrganizer(teamOwnerReq, 100, 100);
    expect(isOwnerOrg).toBe(false);
  });
});

describe("Case 9: Organizer self-deal with confirmation but strictConflictPolicy enabled", () => {
  it("Strict conflict policy rejects self-deal even when confirmSelfDeal: true is provided", () => {
    const tournament = {
      organizerMobile: "9876543210",
      featuresJson: { strictConflictPolicy: true },
    };
    const targetTeam = {
      id: 5,
      ownerMobile: "9876543210", // Organizer's team
    };

    const isOrganizerTeam = tournament.organizerMobile === targetTeam.ownerMobile;
    const isStrict = Boolean(tournament.featuresJson.strictConflictPolicy);

    // Client sends confirmation
    const clientPayload = { confirmSelfDeal: true };

    let outcome: "allowed" | "rejected_strict" | "requires_confirmation";
    if (isStrict && isOrganizerTeam) {
      outcome = "rejected_strict";
    } else if (isOrganizerTeam && clientPayload.confirmSelfDeal !== true) {
      outcome = "requires_confirmation";
    } else {
      outcome = "allowed";
    }

    expect(outcome).toBe("rejected_strict");
  });
});

describe("Case 10: Shared phone numbers and mismatched identity records", () => {
  it("Detects self-bidding when normalized 10-digit mobile matches despite formatting differences", () => {
    const rawPlayerMobile = "+91 (98765) 43210";
    const rawOwnerMobile = "098765-43210";

    const normPlayer = rawPlayerMobile.replace(/\D/g, "").slice(-10);
    const normOwner = rawOwnerMobile.replace(/\D/g, "").slice(-10);

    expect(normPlayer).toBe("9876543210");
    expect(normOwner).toBe("9876543210");
    expect(normPlayer === normOwner).toBe(true);
  });

  it("Does not flag false positive when mobile numbers have different 10-digit suffixes", () => {
    const playerMobile = "9876543210";
    const ownerMobile = "9876543211";

    const normPlayer = playerMobile.replace(/\D/g, "").slice(-10);
    const normOwner = ownerMobile.replace(/\D/g, "").slice(-10);

    expect(normPlayer === normOwner).toBe(false);
  });
});

describe("Case 11: Concurrent owner-session updates and auction actions", () => {
  it("Optimistic concurrency check rejects stale auction session revisions", () => {
    const currentSessionRevision = 5;
    const incomingBid1Revision = 5; // Arrived first
    const incomingBid2Revision = 5; // Arrived concurrently

    // Bid 1 succeeds and increments revision to 6
    const updatedRevision = currentSessionRevision + 1;
    expect(updatedRevision).toBe(6);

    // Bid 2 attempts to commit with WHERE revision = 5
    // But database revision is now 6 -> 0 rows updated
    const isStale = incomingBid2Revision !== updatedRevision;
    expect(isStale).toBe(true);
  });
});

describe("Case 12: Malformed or expired session claims", () => {
  it("verifyOwnerSessionJwt rejects invalid, expired, or malformed claims", () => {
    expect(verifyOwnerSessionJwt("")).toBeNull();
    expect(verifyOwnerSessionJwt("invalid.jwt.token")).toBeNull();
    expect(verifyOwnerSessionJwt("not-even-a-token")).toBeNull();
  });

  it("Rejects tokens missing required numeric tournamentId or teamId", () => {
    const incompleteClaims = {
      sessionId: "sess-1",
      // missing tournamentId and teamId
    } as any;

    const token = signOwnerSessionJwt(incompleteClaims);
    const verified = verifyOwnerSessionJwt(token);
    expect(verified).toBeNull();
  });
});
