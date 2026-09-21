import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

/**
 * Cricket Scorer Auth — Regression matrix for the Dedicated Scorer / Empire model.
 *
 * Verifies at source level that:
 *  1. The three mutation endpoints (events, undo, reset) use requireScorerForMutation
 *  2. canWriteScoring and organizer fallback are completely removed from mutation paths
 *  3. scorerPin is not accepted in mutation request schemas
 *  4. The full auth pipeline (JWT → canScore → assignment → tenant → lock) is in place
 *  5. The old organizer scoring pad (scoring-match.tsx) no longer contains LiveScoringPad
 *  6. The frontend mutations use scorerApiFetch (not plain apiFetch)
 *  7. The live-control "Open Scorer" links use cricketScorerConsolePath
 *  8. Offline queue drain is guarded by lock state
 */

const scoringTsUrl = new URL("../routes/scoring.ts", import.meta.url);
const scorerAuthUrl = new URL("../lib/scorer-auth.ts", import.meta.url);
const scorerLockUrl = new URL("../lib/scorer-match-locks.ts", import.meta.url);

const auctionRoot = new URL("../../../auction-platform/src/", import.meta.url);
const scoringApiUrl = new URL("lib/scoring-api.ts", auctionRoot);
const scorerApiUrl = new URL("lib/scorer-api.ts", auctionRoot);
const scoringMatchPageUrl = new URL("pages/scoring-match.tsx", auctionRoot);
const cricketScorerPageUrl = new URL("pages/cricket/scorer.tsx", auctionRoot);
const liveControlPageUrl = new URL("pages/cricket/live-control.tsx", auctionRoot);
const cricketRoutesUrl = new URL("lib/cricket-routes.ts", auctionRoot);

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND: scoring.ts mutation auth pipeline
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — backend mutation gate (scoring.ts)", () => {
  it("imports requireScorerFromRequest from scorer-auth", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).toContain("requireScorerFromRequest");
    expect(src).toContain("from \"../lib/scorer-auth\"");
  });

  it("imports assertSessionOwnsMatchLock from scorer-match-locks", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).toContain("assertSessionOwnsMatchLock");
    expect(src).toContain("from \"../lib/scorer-match-locks\"");
  });

  it("defines requireScorerForMutation with the full auth pipeline", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).toContain("requireScorerForMutation");
    expect(src).toContain("requireScorerFromRequest(req)");
    expect(src).toContain("assertScorerCanScore(scorerAuth)");
    expect(src).toContain("assertScorerMayAccessTournament(scorerAuth.scorerId, tournamentId)");
    expect(src).toContain("assertSessionOwnsMatchLock({ matchId, sessionId: scorerAuth.sessionId })");
  });

  it("tenant isolation: requireScorerForMutation checks match.tournamentId === tournamentId", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    // Must include the tenant mismatch check
    expect(src).toContain("TENANT_MISMATCH");
    expect(src).toContain("match.tournamentId !== tournamentId");
  });

  it("POST events uses requireScorerForMutation — not canWriteScoring", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    // The events endpoint must call requireScorerForMutation
    const eventsIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/events"');
    expect(eventsIdx).toBeGreaterThan(-1);
    const eventsSlice = src.slice(eventsIdx, eventsIdx + 2000);
    expect(eventsSlice).toContain("requireScorerForMutation");
    // Must NOT fall back to canWriteScoring
    expect(eventsSlice).not.toContain("canWriteScoring");
    // scorerPin schema field (z.string) must not be present; comments are allowed
    expect(eventsSlice).not.toContain("scorerPin: z.");
  });

  it("POST undo uses requireScorerForMutation — not canWriteScoring", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    const undoIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/undo"');
    expect(undoIdx).toBeGreaterThan(-1);
    const undoSlice = src.slice(undoIdx, undoIdx + 1500);
    expect(undoSlice).toContain("requireScorerForMutation");
    expect(undoSlice).not.toContain("canWriteScoring");
    // scorerPin schema field (z.string) must not be present; comments are allowed
    expect(undoSlice).not.toContain("scorerPin: z.");
  });

  it("POST reset uses requireScorerForMutation — not canWriteScoring", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    const resetIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/reset"');
    expect(resetIdx).toBeGreaterThan(-1);
    const resetSlice = src.slice(resetIdx, resetIdx + 1500);
    expect(resetSlice).toContain("requireScorerForMutation");
    expect(resetSlice).not.toContain("canWriteScoring");
    // scorerPin schema field (z.string) must not be present; comments are allowed
    expect(resetSlice).not.toContain("scorerPin: z.");
  });

  it("actor type is 'scorer' — not 'organizer' or 'scorer_pin'", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).toContain('type: "scorer"');
    expect(src).not.toContain('type: "organizer"');
    expect(src).not.toContain('type: "scorer_pin"');
  });

  it("canWriteScoring function is completely removed from scoring.ts", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).not.toContain("canWriteScoring");
  });

  it("actorFromRequest function is completely removed from scoring.ts", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).not.toContain("actorFromRequest");
  });

  it("isTournamentOrganizer is NOT used on mutation endpoints", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    // isTournamentOrganizer is imported for the read-only GET match endpoint only
    // It must NOT appear in any mutation endpoint block
    const eventsIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/events"');
    const eventsSlice = src.slice(eventsIdx, eventsIdx + 2000);
    expect(eventsSlice).not.toContain("isTournamentOrganizer");

    const undoIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/undo"');
    const undoSlice = src.slice(undoIdx, undoIdx + 1500);
    expect(undoSlice).not.toContain("isTournamentOrganizer");

    const resetIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/reset"');
    const resetSlice = src.slice(resetIdx, resetIdx + 1500);
    expect(resetSlice).not.toContain("isTournamentOrganizer");
  });

  it("ScorerAuthError and ScorerLockError are mapped to structured HTTP responses", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    expect(src).toContain("sendScorerAuthError");
    expect(src).toContain("sendScorerLockError");
    expect(src).toContain("MATCH_LOCK_REQUIRED");
    expect(src).toContain("MATCH_LOCKED");
    expect(src).toContain("SCORING_AUTH_DENIED");
    expect(src).toContain("SCORING_LOCK_DENIED");
  });
});

describe("cricket scorer auth — account lifecycle", () => {
  it("deleting a scorer invalidates sessions and removes only the final tournament identity", async () => {
    const auth = await readFile(scorerAuthUrl, "utf8");
    expect(auth).toContain("deleteScorerAccountForTournament");
    expect(auth).toContain("scorerTournamentAssignmentsTable");
    expect(auth).toContain("scorerSessionsTable");
    expect(auth).toContain("scorerMatchLocksTable");
    expect(auth).toContain("remaining.length === 0");
    expect(auth).toContain('"scorer_account_deleted"');
  });

  it("official creation does not persist a scorer row when scorer credentials fail", async () => {
    const serviceUrl = new URL("../lib/scoring-foundation-service.ts", import.meta.url);
    const src = await readFile(serviceUrl, "utf8");
    const fnIdx = src.indexOf("export async function createScoringOfficial");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 1800);
    expect(fnSlice).toContain("createScorerAccountForTournament");
    expect(fnSlice).toContain("SCORER_CREDENTIALS_REQUIRED");
    expect(fnSlice).not.toContain("continue saving official");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND: scorer-auth.ts exports
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — scorer-auth.ts exports", () => {
  it("exports requireScorerFromRequest", async () => {
    const src = await readFile(scorerAuthUrl, "utf8");
    expect(src).toContain("export async function requireScorerFromRequest");
  });

  it("requireScorerFromRequest throws AUTH_REQUIRED when no Bearer token", async () => {
    const src = await readFile(scorerAuthUrl, "utf8");
    const fnIdx = src.indexOf("export async function requireScorerFromRequest");
    const fnSlice = src.slice(fnIdx, fnIdx + 600);
    expect(fnSlice).toContain("AUTH_REQUIRED");
    expect(fnSlice).toContain("extractBearerToken");
    expect(fnSlice).toContain("resolveScorerAuthFromToken");
  });

  it("assertScorerMayAccessTournament preserves zero-assignment bypass", async () => {
    const src = await readFile(scorerAuthUrl, "utf8");
    // Zero-assignment open access — intentional legacy behavior
    expect(src).toContain("assignedCount === 0");
    expect(src).toContain("return;");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND: scorer-match-locks.ts assertSessionOwnsMatchLock
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — match lock enforcement", () => {
  it("assertSessionOwnsMatchLock checks LOCK_NOT_FOUND, MATCH_LOCKED, LOCK_NOT_OWNED", async () => {
    const src = await readFile(scorerLockUrl, "utf8");
    expect(src).toContain("LOCK_NOT_FOUND");
    expect(src).toContain("MATCH_LOCKED");
    expect(src).toContain("LOCK_NOT_OWNED");
    expect(src).toContain("assertSessionOwnsMatchLock");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: scoring-api.ts — mutations use scorerApiFetch
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — frontend scoring-api.ts mutation transport", () => {
  it("imports scorerApiFetch", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    expect(src).toContain("scorerApiFetch");
    expect(src).toContain("from \"./scorer-api\"");
  });

  it("appendScoringEvent uses scorerApiFetch (not apiFetch)", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    const fnIdx = src.indexOf("export async function appendScoringEvent");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 600);
    expect(fnSlice).toContain("scorerApiFetch");
    expect(fnSlice).not.toContain("apiFetch(");
  });

  it("undoScoringEvent uses scorerApiFetch (not apiFetch)", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    const fnIdx = src.indexOf("export async function undoScoringEvent");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 500);
    expect(fnSlice).toContain("scorerApiFetch");
    expect(fnSlice).not.toContain("apiFetch(");
  });

  it("resetScoringMatch uses scorerApiFetch (not apiFetch)", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    const fnIdx = src.indexOf("export async function resetScoringMatch");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 500);
    expect(fnSlice).toContain("scorerApiFetch");
    expect(fnSlice).not.toContain("apiFetch(");
  });

  it("scorerApiFetch URL includes /api/ prefix", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    // All three mutations must use the /api/ prefix
    expect(src).toContain("/api/tournaments/${tournamentId}/scoring/matches/${matchId}/events");
    expect(src).toContain("/api/tournaments/${tournamentId}/scoring/matches/${matchId}/undo");
    expect(src).toContain("/api/tournaments/${tournamentId}/scoring/matches/${matchId}/reset");
  });

  it("getScoringMatch attaches scorerAuthHeaders() so dedicated scorer is authenticated for read", async () => {
    const src = await readFile(scoringApiUrl, "utf8");
    const fnIdx = src.indexOf("export async function getScoringMatch");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 400);
    expect(fnSlice).toContain("scorerAuthHeaders()");
  });
});

describe("cricket scorer render safety — PreMatchSetup", () => {
  it("PreMatchSetup destructures onResetMatch to prevent ReferenceError at runtime", async () => {
    const preMatchUrl = new URL("components/scoring/pre-match-setup.tsx", auctionRoot);
    const src = await readFile(preMatchUrl, "utf8");
    const fnIdx = src.indexOf("export function PreMatchSetup({");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSignature = src.slice(fnIdx, fnIdx + 300);
    expect(fnSignature).toContain("onResetMatch,");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: scorer-api.ts — scorerApiFetch helper
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — scorer-api.ts scorerApiFetch helper", () => {
  it("exports scorerApiFetch", async () => {
    const src = await readFile(scorerApiUrl, "utf8");
    expect(src).toContain("export async function scorerApiFetch");
  });

  it("scorerApiFetch adds Authorization: Bearer header from session", async () => {
    const src = await readFile(scorerApiUrl, "utf8");
    const fnIdx = src.indexOf("export async function scorerApiFetch");
    const fnSlice = src.slice(fnIdx, fnIdx + 800);
    expect(fnSlice).toContain("Authorization");
    expect(fnSlice).toContain("Bearer");
    expect(fnSlice).toContain("getScorerAuthSession");
    expect(fnSlice).toContain("session.token");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: scoring-match.tsx — old organizer scoring pad removed
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — scoring-match.tsx (old organizer pad removed)", () => {
  it("scoring-match.tsx does NOT import LiveScoringPad", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    expect(src).not.toContain("LiveScoringPad");
  });

  it("scoring-match.tsx does NOT import PreMatchSetup", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    expect(src).not.toContain("PreMatchSetup");
  });

  it("scoring-match.tsx does NOT call appendScoringEvent, undoScoringEvent, or resetScoringMatch", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    expect(src).not.toContain("appendScoringEvent");
    expect(src).not.toContain("undoScoringEvent");
    expect(src).not.toContain("resetScoringMatch");
  });

  it("scoring-match.tsx does NOT use the offline queue", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    expect(src).not.toContain("scoring-offline-queue");
    expect(src).not.toContain("enqueueScoringEvent");
  });

  it("scoring-match.tsx links to cricketScorerConsolePath (Empire redirect)", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    expect(src).toContain("cricketScorerConsolePath");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: cricket/scorer.tsx — lock-lost handling and error mapping
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — scorer.tsx lock-lost and error handling", () => {
  it("tracks lockLost state", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("lockLost");
    expect(src).toContain("setLockLost");
  });

  it("heartbeat failure sets lockLost=true and disables controls", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    // Find the heartbeat interval callback (not the import) — look for the setInterval usage
    const heartbeatCallbackIdx = src.indexOf("setInterval(async");
    expect(heartbeatCallbackIdx).toBeGreaterThan(-1);
    const hbSlice = src.slice(heartbeatCallbackIdx, heartbeatCallbackIdx + 600);
    expect(hbSlice).toContain("setLockLost(true)");
    expect(hbSlice).toContain("setLockAcquired(false)");
    expect(hbSlice).toContain("lockHeldRef.current = false");
  });

  it("drainQueue is guarded by lockHeldRef.current", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    const drainIdx = src.indexOf("const drainQueue = useCallback");
    const drainSlice = src.slice(drainIdx, drainIdx + 300);
    expect(drainSlice).toContain("lockHeldRef.current");
  });

  it("sendEvent maps 401 AUTH errors to session-expired redirect", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("err.status === 401");
    expect(src).toContain("clearScorerAuthSession");
    expect(src).toContain("cricketScorerHomePath");
  });

  it("sendEvent maps 403 TOURNAMENT_NOT_ASSIGNED", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("TOURNAMENT_NOT_ASSIGNED");
  });

  it("sendEvent maps 409 MATCH_LOCKED and MATCH_LOCK_REQUIRED to lockLost state", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("MATCH_LOCKED");
    expect(src).toContain("MATCH_LOCK_REQUIRED");
    // When these are received, lockLost must be set
    expect(src).toContain("setLockLost(true)");
  });

  it("offline queue enqueue is guarded by lockHeldRef.current", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    // Find the enqueueScoringEvent call and check that lockHeldRef.current
    // appears within 300 chars before it (inside the surrounding if-block).
    const enqueueIdx = src.indexOf("enqueueScoringEvent({");
    expect(enqueueIdx).toBeGreaterThan(-1);
    const surrounding = src.slice(Math.max(0, enqueueIdx - 400), enqueueIdx + 50);
    expect(surrounding).toContain("lockHeldRef.current");
  });

  it("LiveScoringPad busy prop includes lockLost", async () => {
    const src = await readFile(cricketScorerPageUrl, "utf8");
    expect(src).toContain("lockLost}");
    // busy includes lockLost
    expect(src).toMatch(/busy=\{busy[^}]*lockLost/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: live-control.tsx — "Open Scorer" links
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — live-control.tsx scorer links", () => {
  it("uses cricketScorerConsolePath (not cricketScorerPath) for scorerHref", async () => {
    const src = await readFile(liveControlPageUrl, "utf8");
    expect(src).toContain("cricketScorerConsolePath");
    // The old cricketScorerPath must not appear in any scorerHref usage
    const scorerHrefOccurrences = [...src.matchAll(/scorerHref=\{cricketScorerPath/g)];
    expect(scorerHrefOccurrences).toHaveLength(0);
  });

  it("copyScorerLink uses cricketScorerConsolePath", async () => {
    const src = await readFile(liveControlPageUrl, "utf8");
    const fnIdx = src.indexOf("function copyScorerLink");
    const fnSlice = src.slice(fnIdx, fnIdx + 300);
    expect(fnSlice).toContain("cricketScorerConsolePath");
    expect(fnSlice).not.toContain("cricketScorerPath(");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FRONTEND: cricket-routes.ts — cricketScorerPath deprecated
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — cricket-routes.ts route deprecation", () => {
  it("cricketScorerPath is marked @deprecated", async () => {
    const src = await readFile(cricketRoutesUrl, "utf8");
    // Find the @deprecated annotation that appears directly before cricketScorerPath function
    const fnIdx = src.indexOf("export function cricketScorerPath");
    expect(fnIdx).toBeGreaterThan(-1);
    const before = src.slice(Math.max(0, fnIdx - 400), fnIdx);
    expect(before).toContain("@deprecated");
    expect(before).toContain("cricketScorerConsolePath");
  });

  it("cricketScorerConsolePath is exported and uses /cricket/ URL", async () => {
    const src = await readFile(cricketRoutesUrl, "utf8");
    expect(src).toContain("export function cricketScorerConsolePath");
    expect(src).toContain("/cricket/");
    expect(src).toContain("?tid=");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// NEGATIVE: Organizer cannot reach scoring mutation endpoints
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer auth — NEGATIVE: organizer exclusion from mutations", () => {
  it("scoring.ts mutation endpoints do NOT call requireTournamentOrganizer", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    // requireTournamentOrganizer is allowed for read-only GET match
    // but must NOT appear inside any mutation (events/undo/reset) endpoint body
    const eventsIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/events"');
    const endIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/reset"');
    const mutationBlock = src.slice(eventsIdx, endIdx + 2000);
    expect(mutationBlock).not.toContain("requireTournamentOrganizer");
    expect(mutationBlock).not.toContain("isTournamentOrganizer");
  });

  it("scoring.ts does NOT accept scorerPin anywhere in mutation schemas", async () => {
    const src = await readFile(scoringTsUrl, "utf8");
    const eventsIdx = src.indexOf('"/tournaments/:tournamentId/scoring/matches/:matchId/events"');
    const endIdx = src.lastIndexOf("export default router");
    const mutationBlock = src.slice(eventsIdx, endIdx > eventsIdx ? endIdx : src.length);
    // scorerPin must not be in any mutation schema
    expect(mutationBlock).not.toContain("scorerPin: z.");
  });

  it("scoring-match.tsx no longer has a functional scoring implementation", async () => {
    const src = await readFile(scoringMatchPageUrl, "utf8");
    // All of these indicate a functional scoring implementation
    expect(src).not.toContain("sendEvent");
    expect(src).not.toContain("drainQueue");
    expect(src).not.toContain("LiveScoringPad");
    expect(src).not.toContain("appendScoringEvent");
    expect(src).not.toContain("scorerPin");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// ROUTE & SESSION TRANSPORT: Canonical route and header construction
// ─────────────────────────────────────────────────────────────────────────────

describe("cricket scorer route & transport — canonical path and headers", () => {
  it("cricket-routes.ts implements cricketScorerConsolePath with /cricket/:matchId/score?tid=:tournamentId", async () => {
    const src = await readFile(cricketRoutesUrl, "utf8");
    const fnIdx = src.indexOf("export function cricketScorerConsolePath");
    expect(fnIdx).toBeGreaterThan(-1);
    const fnSlice = src.slice(fnIdx, fnIdx + 300);
    expect(fnSlice).toContain("/cricket/${matchId}/score?tid=${tournamentId}");
  });

  it("badminton-scorer-session.ts exports scorerAuthHeaders attaching Bearer token", async () => {
    const sessionUrl = new URL("lib/badminton-scorer-session.ts", auctionRoot);
    const src = await readFile(sessionUrl, "utf8");
    expect(src).toContain("export function scorerAuthHeaders()");
    expect(src).toContain("Authorization: `Bearer ${session.token}`");
  });
});
