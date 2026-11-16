import { vi, describe, it, expect, beforeEach } from "vitest";
import express from "express";
import request from "supertest";

type TournamentRecord = {
  id: number;
  name: string;
  sport: string;
  auctionEnabled: boolean;
  scoringEnabled: boolean;
  scoringPhase: string;
  status: string;
  organizerId: number | null;
  organizerName: string | null;
  organizerMobile: string | null;
  organizerEmail: string | null;
  createdAt: Date;
};

type OrganizerRecord = {
  id: number;
  name: string;
  email: string | null;
  mobile: string;
  maxTournaments: number;
  licenseStatus: string;
};

type LicenseRequestRecord = {
  id: number;
  tournamentId: number;
  organizerId: number | null;
  organizerMobile: string | null;
  status: string;
};

let tournaments: Map<number, TournamentRecord>;
let organizers: Map<number, OrganizerRecord>;
let licenseRequests: Map<number, LicenseRequestRecord>;
let auditLogsList: any[];

function extractIdFromCondition(cond: any): number | undefined {
  if (typeof cond === "number") return cond;
  if (!cond) return undefined;
  if (typeof cond.right === "number") return cond.right;
  if (typeof cond.value === "number") return cond.value;
  if (Array.isArray(cond.conditions)) {
    for (const c of cond.conditions) {
      const found = extractIdFromCondition(c);
      if (found !== undefined) return found;
    }
  }
  if (Array.isArray(cond.queryChunks)) {
    for (const chunk of cond.queryChunks) {
      if (typeof chunk === "number") return chunk;
      const found = extractIdFromCondition(chunk);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

vi.mock("@workspace/db", () => {
  const tournamentsTable = {
    id: "tournaments.id",
    name: "tournaments.name",
    sport: "tournaments.sport",
    status: "tournaments.status",
    organizerId: "tournaments.organizerId",
    organizerName: "tournaments.organizerName",
    organizerMobile: "tournaments.organizerMobile",
    organizerEmail: "tournaments.organizerEmail",
    createdAt: "tournaments.createdAt",
  };

  const organizersTable = {
    id: "organizers.id",
    name: "organizers.name",
    email: "organizers.email",
    mobile: "organizers.mobile",
    maxTournaments: "organizers.maxTournaments",
    licenseStatus: "organizers.licenseStatus",
  };

  const auctionSessionsTable = {
    id: "auctionSessions.id",
    tournamentId: "auctionSessions.tournamentId",
  };

  const sportsTable = {
    id: "sports.id",
    slug: "sports.slug",
    name: "sports.name",
    active: "sports.active",
  };

  const tournamentLicenseRequestsTable = {
    id: "tournamentLicenseRequests.id",
    tournamentId: "tournamentLicenseRequests.tournamentId",
    organizerId: "tournamentLicenseRequests.organizerId",
    organizerMobile: "tournamentLicenseRequests.organizerMobile",
    status: "tournamentLicenseRequests.status",
  };

  const mockDb = {
    select: (fields?: any) => {
      let tbl: any;
      const chain: any = {
        from: (fromTbl: any) => {
          tbl = fromTbl;
          return chain;
        },
        where: (filter: any) => {
          const tid = extractIdFromCondition(filter);
          let res: any[] = [];
          if (tbl === tournamentsTable) {
            if (tid !== undefined && tournaments.has(tid)) {
              res = [tournaments.get(tid)];
            } else {
              res = [];
            }
          } else if (tbl === organizersTable) {
            if (tid !== undefined && organizers.has(tid)) {
              res = [organizers.get(tid)];
            } else {
              res = [];
            }
          } else if (tbl === sportsTable) {
            res = [];
          } else if (tbl === tournamentLicenseRequestsTable) {
            res = Array.from(licenseRequests.values());
          }
          const wherePromise: any = Promise.resolve(res);
          wherePromise.limit = () => wherePromise;
          wherePromise.orderBy = () => wherePromise;
          return wherePromise;
        },
        orderBy: () => chain,
        limit: () => chain,
        then: (resolve: any) => {
          let res: any[] = [];
          if (tbl === tournamentsTable) res = Array.from(tournaments.values());
          else if (tbl === organizersTable) res = Array.from(organizers.values());
          return resolve(res);
        },
      };
      return chain;
    },
    insert: (tbl: any) => {
      let insertValues: any = {};
      const chain: any = {
        values: (vals: any) => {
          insertValues = vals;
          return chain;
        },
        returning: () => {
          if (tbl === tournamentsTable) {
            const nextId = Math.max(0, ...Array.from(tournaments.keys())) + 1;
            const newT = {
              id: nextId,
              ...insertValues,
              createdAt: new Date(),
            };
            tournaments.set(nextId, newT);
            return Promise.resolve([newT]);
          }
          return Promise.resolve([insertValues]);
        },
      };
      return chain;
    },
    update: (tbl: any) => {
      let updateValues: any = {};
      const chain: any = {
        set: (vals: any) => {
          updateValues = vals;
          return chain;
        },
        where: (filter: any) => {
          const tid = extractIdFromCondition(filter);
          const chainInner: any = {
            returning: () => {
              if (tbl === tournamentsTable && tid !== undefined && tournaments.has(tid)) {
                const rec = tournaments.get(tid)!;
                const updated = { ...rec, ...updateValues };
                tournaments.set(tid, updated);
                return Promise.resolve([updated]);
              }
              if (tbl === tournamentLicenseRequestsTable) {
                for (const [id, reqRow] of licenseRequests.entries()) {
                  if (reqRow.tournamentId === tid && reqRow.status === "pending") {
                    licenseRequests.set(id, { ...reqRow, ...updateValues });
                  }
                }
                return Promise.resolve(Array.from(licenseRequests.values()));
              }
              return Promise.resolve([]);
            },
            then: (resolve: any) => {
              if (tbl === tournamentLicenseRequestsTable) {
                for (const [id, reqRow] of licenseRequests.entries()) {
                  if (reqRow.tournamentId === tid && reqRow.status === "pending") {
                    licenseRequests.set(id, { ...reqRow, ...updateValues });
                  }
                }
              }
              return resolve();
            },
          };
          return chainInner;
        },
      };
      return chain;
    },
  };

  return {
    db: mockDb,
    tournamentsTable,
    organizersTable,
    sportsTable,
    auctionSessionsTable,
    tournamentLicenseRequestsTable,
  };
});

vi.mock("../lib/audit-service", () => ({
  auditLog: (req: any, entry: any) => {
    auditLogsList.push(entry);
  },
  auditDenied: vi.fn(),
}));

vi.mock("../lib/audit-snapshots", () => ({
  snapshotTournament: (t: any) => (t ? { id: t.id, name: t.name, organizerId: t.organizerId } : null),
  snapshotOrganizer: (o: any) => (o ? { id: o.id, name: o.name } : null),
  computeFieldChanges: () => [],
}));

vi.mock("../lib/admin-notifications/triggers.js", () => ({
  notifyAdminTournamentCreated: vi.fn(),
  notifyAdminOrganiserRegistered: vi.fn(),
}));

vi.mock("../lib/notifications", () => ({
  notifyAsync: vi.fn(),
}));

vi.mock("../lib/whatsapp", () => ({
  notifyOrganiserOnboardingWelcome: vi.fn(),
}));

import authRouter from "../routes/auth";

function createTestApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).log = { info: vi.fn(), warn: vi.fn(), error: vi.fn() };
    const isAdmin = req.headers["x-is-admin"] === "true";
    (req as any).jwtUser = {
      isAdmin,
      role: isAdmin ? "admin" : "user",
      email: isAdmin ? "admin@bidwar.com" : "user@bidwar.com",
    };
    next();
  });
  app.use(authRouter);
  return app;
}

describe("Tournament Transfer & Organiser Reassignment Integration", () => {
  let app: express.Express;

  beforeEach(() => {
    vi.clearAllMocks();
    tournaments = new Map();
    organizers = new Map();
    licenseRequests = new Map();
    auditLogsList = [];

    // Organiser 1 (Source host)
    organizers.set(10, {
      id: 10,
      name: "Ramesh Sharma",
      email: "ramesh@gmail.com",
      mobile: "+919876543210",
      maxTournaments: 2,
      licenseStatus: "active",
    });

    // Organiser 2 (Target host)
    organizers.set(20, {
      id: 20,
      name: "Pooja Verma",
      email: "pooja@gmail.com",
      mobile: "+919123456789",
      maxTournaments: 5,
      licenseStatus: "active",
    });

    // Tournament 1
    tournaments.set(100, {
      id: 100,
      name: "Mumbai Premier League 2026",
      sport: "cricket",
      auctionEnabled: true,
      scoringEnabled: true,
      scoringPhase: "setup",
      status: "setup",
      organizerId: 10,
      organizerName: "Ramesh Sharma",
      organizerMobile: "+919876543210",
      organizerEmail: "ramesh@gmail.com",
      createdAt: new Date("2026-01-01"),
    });

    // Pending license request for Tournament 1
    licenseRequests.set(500, {
      id: 500,
      tournamentId: 100,
      organizerId: 10,
      organizerMobile: "+919876543210",
      status: "pending",
    });

    app = createTestApp();
  });

  it("1. Rejects unauthenticated or non-admin callers with 401", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/100/link-organizer")
      .send({ organizerId: 20 });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Not authorised");
  });

  it("2. Returns 404 when tournament does not exist", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/999/link-organizer")
      .set("x-is-admin", "true")
      .send({ organizerId: 20 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Tournament not found");
  });

  it("3. Returns 404 when target organiser account does not exist", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/100/link-organizer")
      .set("x-is-admin", "true")
      .send({ organizerId: 999 });

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Target organiser account not found");
  });

  it("4. Successfully transfers tournament to new organiser with contact sync", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/100/link-organizer")
      .set("x-is-admin", "true")
      .send({ organizerId: 20, syncContact: true });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.linkedOrganizerId).toBe(20);
    expect(res.body.linkedOrganizerName).toBe("Pooja Verma");
    expect(res.body.linkedOrganizerMobile).toBe("+919123456789");

    // Verify tournament record was updated
    const updated = tournaments.get(100)!;
    expect(updated.organizerId).toBe(20);
    expect(updated.organizerName).toBe("Pooja Verma");
    expect(updated.organizerMobile).toBe("+919123456789");
    expect(updated.organizerEmail).toBe("pooja@gmail.com");

    // Verify pending license request reassignment
    const updatedLic = licenseRequests.get(500)!;
    expect(updatedLic.organizerId).toBe(20);
    expect(updatedLic.organizerMobile).toBe("+919123456789");

    // Verify audit log
    expect(auditLogsList.length).toBeGreaterThan(0);
    const lastAudit = auditLogsList[auditLogsList.length - 1];
    expect(lastAudit.action).toBe("tournament.organizer_transferred");
    expect(lastAudit.metadata.previousOrganizerId).toBe(10);
    expect(lastAudit.metadata.newOrganizerId).toBe(20);
  });

  it("5. Successfully unlinks tournament when organizerId is null", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/100/link-organizer")
      .set("x-is-admin", "true")
      .send({ organizerId: null });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.linkedOrganizerId).toBeNull();
    expect(res.body.linkedOrganizerName).toBeNull();

    const updated = tournaments.get(100)!;
    expect(updated.organizerId).toBeNull();

    const lastAudit = auditLogsList[auditLogsList.length - 1];
    expect(lastAudit.action).toBe("tournament.organizer_unlinked");
  });

  it("6. transfer-organizer route alias works identically", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments/100/transfer-organizer")
      .set("x-is-admin", "true")
      .send({ organizerId: 20 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.linkedOrganizerId).toBe(20);
    expect(res.body.linkedOrganizerName).toBe("Pooja Verma");
  });

  it("7. Creating a tournament with pre-created organizer assigns organizerId and contact", async () => {
    const res = await request(app)
      .post("/auth/admin/tournaments")
      .set("x-is-admin", "true")
      .send({
        name: "Bangalore Super Cup 2026",
        sport: "cricket",
        city: "Bangalore",
        organizerId: 20,
      });

    if (res.status !== 200) throw new Error(res.text);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const createdId = res.body.id;
    const created = tournaments.get(createdId)!;
    expect(created.organizerId).toBe(20);
    expect(created.organizerName).toBe("Pooja Verma");
    expect(created.organizerMobile).toBe("+919123456789");
    expect(created.organizerEmail).toBe("pooja@gmail.com");
  });

  it("8. Creating a tournament with Google-placeholder mobile does not fail validation", async () => {
    organizers.set(30, {
      id: 30,
      name: "Google Auth Host",
      email: "googlehost@gmail.com",
      mobile: "gid_123456789",
      maxTournaments: 1,
      licenseStatus: "active",
    });

    const res = await request(app)
      .post("/auth/admin/tournaments")
      .set("x-is-admin", "true")
      .send({
        name: "Delhi Winter Carnival",
        sport: "cricket",
        city: "Delhi",
        organizerId: 30,
        organizerMobile: "gid_123456789",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const created = tournaments.get(res.body.id)!;
    expect(created.organizerId).toBe(30);
    expect(created.organizerName).toBe("Google Auth Host");
  });
});
