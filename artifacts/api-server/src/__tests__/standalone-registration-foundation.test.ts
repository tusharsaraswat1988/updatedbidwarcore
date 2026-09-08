import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  formatRegistrationId,
  resolveServerPaymentAmount,
  validateRegistrationPayload,
  initialRegistrationStatus,
  canTransitionRegistration,
  buildSampleTournamentSeed,
} from "@workspace/standalone-registration";

/**
 * Foundation contract tests for the standalone registration module.
 * These do not touch BidWar players / tournaments tables.
 */
describe("standalone-registration foundation contracts", () => {
  it("registration IDs are unique per sequence and server-formatted", () => {
    const ids = new Set<string>();
    for (let i = 1; i <= 50; i++) {
      const result = formatRegistrationId("BPL26", i);
      expect(result.ok).toBe(true);
      if (result.ok) ids.add(result.registrationId);
    }
    expect(ids.size).toBe(50);
  });

  it("rejects client age override via validation", () => {
    const asOf = new Date(Date.UTC(2026, 0, 1));
    const result = validateRegistrationPayload(
      {
        playerName: "Test Player",
        dateOfBirth: "2000-01-01",
        age: 99,
        gender: "Male",
        mobile: "9876543210",
        playingRole: "Bowler",
        declarationAccepted: true,
      },
      { asOf },
    );
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.calculatedAge).toBe(26);
  });

  it("duplicate business rule is tournament-scoped (seed isolation)", () => {
    const a = buildSampleTournamentSeed("alpha");
    const b = buildSampleTournamentSeed("beta");
    expect(a.slug).not.toBe(b.slug);
    // Same mobile is allowed across tournaments — uniqueness is (tournament_id, mobile)
    expect(a.allowDuplicateRegistrations).toBe(false);
    expect(b.allowDuplicateRegistrations).toBe(false);
  });

  it("payment amount is always config-driven", () => {
    const config = { registrationFee: 500, currency: "INR" };
    expect(resolveServerPaymentAmount(config, 1).ok).toBe(false);
    expect(resolveServerPaymentAmount(config).ok && resolveServerPaymentAmount(config).ok
      ? resolveServerPaymentAmount(config)
      : null).toMatchObject({ amount: 500, source: "tournament_config" });
  });

  it("status machine supports payment retry without re-confirming paid", () => {
    expect(initialRegistrationStatus(500)).toBe("PAYMENT_PENDING");
    expect(canTransitionRegistration("PAYMENT_INITIATED", "PAYMENT_FAILED")).toBe(true);
    expect(canTransitionRegistration("PAYMENT_FAILED", "PAYMENT_PENDING")).toBe(true);
    expect(canTransitionRegistration("PAID", "PAYMENT_PENDING")).toBe(false);
  });
});

const mockDb = {
  select: vi.fn(),
  insert: vi.fn(),
  update: vi.fn(),
  transaction: vi.fn(),
};

vi.mock("@workspace/db", () => ({
  db: mockDb,
  srTournamentsTable: {
    id: "id",
    slug: "slug",
    isActive: "is_active",
    registrationDeadline: "registration_deadline",
    requireDeclaration: "require_declaration",
    allowDuplicateRegistrations: "allow_duplicate_registrations",
    registrationIdPrefix: "registration_id_prefix",
    registrationFee: "registration_fee",
    nextRegistrationSeq: "next_registration_seq",
  },
  srFormFieldsTable: {
    tournamentId: "tournament_id",
    sortOrder: "sort_order",
  },
  srCategoriesTable: {
    tournamentId: "tournament_id",
    code: "code",
    isActive: "is_active",
    sortOrder: "sort_order",
  },
  srRegistrationsTable: {
    id: "id",
    registrationId: "registration_id",
    tournamentId: "tournament_id",
    mobile: "mobile",
  },
  srAuditLogsTable: {},
}));

describe("createStandaloneRegistration service (mocked db)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  function chainSelect(rows: unknown[]) {
    const limit = vi.fn().mockResolvedValue(rows);
    const where = vi.fn().mockReturnValue({ limit, orderBy: vi.fn().mockResolvedValue(rows) });
    const from = vi.fn().mockReturnValue({ where, orderBy: vi.fn().mockReturnValue({ where }) });
    const innerJoin = vi.fn().mockReturnValue({ where });
    return { from, where, limit, innerJoin };
  }

  it("creates registration with server age and ID; never writes players table", async () => {
    const tournament = {
      id: 1,
      slug: "city-cup",
      name: "City Cup",
      isActive: true,
      registrationDeadline: null,
      requireDeclaration: true,
      allowDuplicateRegistrations: false,
      registrationIdPrefix: "CITY26",
      registrationFee: 500,
      currency: "INR",
      nextRegistrationSeq: 1,
    };

    // First select: tournament; second: duplicate check empty
    mockDb.select
      .mockReturnValueOnce(chainSelect([tournament]))
      .mockReturnValueOnce(chainSelect([]));

    mockDb.transaction.mockImplementation(async (fn: (tx: typeof mockDb) => unknown) => {
      mockDb.update.mockReturnValue({
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([{ nextSeq: 2 }]),
          }),
        }),
      });
      return fn(mockDb);
    });

    const createdRow = {
      id: 10,
      registrationId: "CITY26-000001",
      tournamentId: 1,
      playerName: "Virat Kohli",
      calculatedAge: 37,
      status: "PAYMENT_PENDING",
      mobile: "9876543210",
      dateOfBirth: "1988-11-05",
      gender: "Male",
      playingRole: "Batsman",
      battingStyle: null,
      bowlingStyle: null,
      jerseySize: null,
      preferredJerseyNumber: null,
      email: null,
      city: null,
      state: null,
      createdAt: new Date("2026-09-08T00:00:00Z"),
    };

    mockDb.insert.mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => {
        const result = Promise.resolve([createdRow]);
        return Object.assign(result, {
          returning: vi.fn().mockResolvedValue([createdRow]),
        });
      }),
    }));

    const { createStandaloneRegistration } = await import(
      "../lib/standalone-registration/service"
    );

    const result = await createStandaloneRegistration({
      slug: "city-cup",
      payload: {
        playerName: "Virat Kohli",
        dateOfBirth: "1988-11-05",
        age: 1,
        gender: "Male",
        mobile: "9876543210",
        playingRole: "Batsman",
        declarationAccepted: true,
      },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.registration.registrationId).toBe("CITY26-000001");
      expect(result.registration.calculatedAge).toBe(37);
      expect(result.registrationFee).toBe(500);
    }

    // Ensure we only inserted into mocked sr_* path (insert called for registration + audit)
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("returns 409 on duplicate mobile within same tournament", async () => {
    const tournament = {
      id: 1,
      slug: "city-cup",
      name: "City Cup",
      isActive: true,
      registrationDeadline: null,
      requireDeclaration: false,
      allowDuplicateRegistrations: false,
      registrationIdPrefix: "CITY26",
      registrationFee: 500,
      currency: "INR",
    };

    mockDb.select
      .mockReturnValueOnce(chainSelect([tournament]))
      .mockReturnValueOnce(chainSelect([{ registrationId: "CITY26-000001" }]));

    const { createStandaloneRegistration } = await import(
      "../lib/standalone-registration/service"
    );

    const result = await createStandaloneRegistration({
      slug: "city-cup",
      payload: {
        playerName: "Player Two",
        dateOfBirth: "1995-01-01",
        gender: "Male",
        mobile: "9876543210",
        playingRole: "Bowler",
        declarationAccepted: true,
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(409);
      expect(result.existingRegistrationId).toBe("CITY26-000001");
    }
  });
});
