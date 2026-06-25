import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import type { Request } from "express";
import {
  checkVerifyAccessAllowed,
  clearAllTeamAccessLockouts,
  getTeamAccessLockoutStatus,
  recordVerifyAccessFailure,
  VERIFY_ACCESS_FAILURE_THRESHOLD,
  _resetVerifyAccessGuardForTests,
} from "../lib/verify-access-guard";
import { isTournamentOrganizer } from "../middleware/require-organizer";

const { mockDbWhere, mockAuditLog } = vi.hoisted(() => ({
  mockDbWhere: vi.fn(),
  mockAuditLog: vi.fn(),
}));

vi.mock("@workspace/db", () => ({
  db: {
    select: () => ({ from: () => ({ where: mockDbWhere, orderBy: () => ({ where: mockDbWhere }) }) }),
    insert: () => ({ values: vi.fn().mockResolvedValue([]) }),
    update: () => ({ set: () => ({ where: vi.fn().mockResolvedValue([]) }) }),
    delete: () => ({ where: vi.fn().mockResolvedValue([]) }),
  },
  teamsTable: { id: {}, tournamentId: {}, accessCode: {}, name: {}, shortCode: {}, color: {}, createdAt: {} },
  tournamentsTable: { id: {}, organizerId: {} },
  organizersTable: {},
  playersTable: {},
  categoriesTable: {},
  auctionSessionsTable: {},
}));

vi.mock("../lib/audit-service", () => ({
  auditLog: mockAuditLog,
}));

vi.mock("../lib/purse-protection", () => ({
  computeAllTeamPurseProtections: vi.fn().mockResolvedValue([]),
}));

import teamsRouter from "../routes/teams";

const TOURNAMENT_ID = 5;
const TEAM_ID = 10;
const ORGANIZER_ACCOUNT_ID = 42;

const sampleTeam = {
  id: TEAM_ID,
  tournamentId: TOURNAMENT_ID,
  name: "Test Team",
  shortCode: "TST",
  accessCode: "ABC123",
  ownerName: "Owner",
  ownerMobile: "919876543210",
  ownerEmail: null,
  ownerPhotoUrl: null,
  color: "#3B82F6",
  logoUrl: null,
  purse: 10000000,
  createdAt: new Date(),
};

function mockReq(ip = "203.0.113.10"): Request {
  return { ip, socket: { remoteAddress: ip } } as Request;
}

function lockOutTeam(ip: string, tournamentId: number, teamId: number) {
  const req = mockReq(ip);
  for (let i = 0; i < VERIFY_ACCESS_FAILURE_THRESHOLD; i++) {
    recordVerifyAccessFailure(req, tournamentId, teamId);
  }
}

function buildApp(jwtUser?: Record<string, unknown>) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (jwtUser) (req as Request & { jwtUser?: unknown }).jwtUser = jwtUser;
    next();
  });
  app.use(teamsRouter);
  return app;
}

function mockTournamentAndTeam() {
  mockDbWhere.mockResolvedValueOnce([{ organizerId: ORGANIZER_ACCOUNT_ID }]);
  mockDbWhere.mockResolvedValueOnce([sampleTeam]);
}

describe("verify-access guard — team-wide lockout", () => {
  beforeEach(() => {
    _resetVerifyAccessGuardForTests();
  });

  it("aggregates lockout across multiple IPs", () => {
    lockOutTeam("1.1.1.1", TOURNAMENT_ID, TEAM_ID);
    lockOutTeam("2.2.2.2", TOURNAMENT_ID, TEAM_ID);

    const status = getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID);
    expect(status.ownerAccessLocked).toBe(true);
    expect(status.ownerAccessLockoutRemainingSec).toBeGreaterThan(0);
  });

  it("clearAllTeamAccessLockouts clears every IP for the team", () => {
    lockOutTeam("1.1.1.1", TOURNAMENT_ID, TEAM_ID);
    lockOutTeam("2.2.2.2", TOURNAMENT_ID, TEAM_ID);
    expect(clearAllTeamAccessLockouts(TOURNAMENT_ID, TEAM_ID)).toBe(2);

    const status = getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID);
    expect(status.ownerAccessLocked).toBe(false);

    const req = mockReq("1.1.1.1");
    expect(checkVerifyAccessAllowed(req, TOURNAMENT_ID, TEAM_ID).allowed).toBe(true);
  });

  it("owner can immediately retry after organiser clears lockout", () => {
    const req = mockReq("203.0.113.55");
    lockOutTeam("203.0.113.55", TOURNAMENT_ID, TEAM_ID);
    expect(checkVerifyAccessAllowed(req, TOURNAMENT_ID, TEAM_ID).allowed).toBe(false);

    clearAllTeamAccessLockouts(TOURNAMENT_ID, TEAM_ID);
    expect(checkVerifyAccessAllowed(req, TOURNAMENT_ID, TEAM_ID).allowed).toBe(true);
  });
});

describe("isTournamentOrganizer — reset-access-lockout auth", () => {
  it("denies public user", () => {
    expect(isTournamentOrganizer({ jwtUser: undefined } as Request, TOURNAMENT_ID, ORGANIZER_ACCOUNT_ID)).toBe(false);
  });

  it("denies team owner JWT (no organizer scope)", () => {
    expect(
      isTournamentOrganizer(
        { jwtUser: { organizerAccountId: 99 } } as Request,
        TOURNAMENT_ID,
        ORGANIZER_ACCOUNT_ID,
      ),
    ).toBe(false);
  });

  it("denies wrong organiser account", () => {
    expect(
      isTournamentOrganizer(
        { jwtUser: { organizerAccountId: 99 } } as Request,
        TOURNAMENT_ID,
        ORGANIZER_ACCOUNT_ID,
      ),
    ).toBe(false);
  });

  it("allows tournament organiser", () => {
    expect(
      isTournamentOrganizer(
        { jwtUser: { organizerAccountId: ORGANIZER_ACCOUNT_ID } } as Request,
        TOURNAMENT_ID,
        ORGANIZER_ACCOUNT_ID,
      ),
    ).toBe(true);
  });

  it("allows admin", () => {
    expect(
      isTournamentOrganizer(
        { jwtUser: { isAdmin: true } } as Request,
        TOURNAMENT_ID,
        ORGANIZER_ACCOUNT_ID,
      ),
    ).toBe(true);
  });
});

describe("POST /tournaments/:tid/teams/:teamId/reset-access-lockout", () => {
  let app: ReturnType<typeof buildApp>;

  beforeEach(() => {
    _resetVerifyAccessGuardForTests();
    mockAuditLog.mockClear();
    mockDbWhere.mockReset();
    lockOutTeam("203.0.113.10", TOURNAMENT_ID, TEAM_ID);
  });

  it("returns 403 for unauthenticated public user", async () => {
    app = buildApp();
    mockTournamentAndTeam();

    const res = await request(app).post(
      `/tournaments/${TOURNAMENT_ID}/teams/${TEAM_ID}/reset-access-lockout`,
    );

    expect(res.status).toBe(403);
    expect(res.body.error).toBe("Authentication required");
    expect(getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID).ownerAccessLocked).toBe(true);
  });

  it("returns 403 for wrong organiser", async () => {
    app = buildApp({ organizerAccountId: 99 });
    mockTournamentAndTeam();

    const res = await request(app).post(
      `/tournaments/${TOURNAMENT_ID}/teams/${TEAM_ID}/reset-access-lockout`,
    );

    expect(res.status).toBe(403);
    expect(getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID).ownerAccessLocked).toBe(true);
  });

  it("returns 200 for tournament organiser and clears lockout", async () => {
    app = buildApp({ organizerAccountId: ORGANIZER_ACCOUNT_ID });
    mockTournamentAndTeam();

    const res = await request(app).post(
      `/tournaments/${TOURNAMENT_ID}/teams/${TEAM_ID}/reset-access-lockout`,
    );

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      message: "Owner access lockout cleared",
    });
    expect(getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID).ownerAccessLocked).toBe(false);
  });

  it("returns 200 for admin and clears lockout", async () => {
    app = buildApp({ isAdmin: true });
    mockTournamentAndTeam();

    const res = await request(app).post(
      `/tournaments/${TOURNAMENT_ID}/teams/${TEAM_ID}/reset-access-lockout`,
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(getTeamAccessLockoutStatus(TOURNAMENT_ID, TEAM_ID).ownerAccessLocked).toBe(false);
  });

  it("writes OWNER_ACCESS_LOCKOUT_RESET audit log", async () => {
    app = buildApp({ organizerAccountId: ORGANIZER_ACCOUNT_ID });
    mockTournamentAndTeam();

    await request(app).post(
      `/tournaments/${TOURNAMENT_ID}/teams/${TEAM_ID}/reset-access-lockout`,
    );

    expect(mockAuditLog).toHaveBeenCalledTimes(1);
    const [, event] = mockAuditLog.mock.calls[0] as [Request, { action: string; metadata: Record<string, unknown> }];
    expect(event.action).toBe("OWNER_ACCESS_LOCKOUT_RESET");
    expect(event.metadata).toMatchObject({
      organizerId: ORGANIZER_ACCOUNT_ID,
      teamId: TEAM_ID,
      tournamentId: TOURNAMENT_ID,
    });
    expect(event.metadata.ip).toBeDefined();
  });
});
