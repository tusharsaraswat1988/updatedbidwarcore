/**
 * Database adapter for demo-session reset.
 * The deletion plan lives in auction-demo-reset-plan.ts and is covered by unit tests.
 */
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import {
  auctionBidEventsTable,
  auctionDemoOwnedRecordsTable,
  auctionDemoSessionsTable,
  auctionPlayerEventsTable,
  auctionSessionsTable,
  auctionTimerEventsTable,
  badmintonGroupMembersTable,
  badmintonGroupsTable,
  bidsTable,
  categoriesTable,
  db,
  masterSponsorsTable,
  masterTeamsTable,
  ownerSessionsTable,
  playerTeamAssignmentsTable,
  playersTable,
  purseBoostersTable,
  scoringFixturesTable,
  scoringMatchesTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import { lockAuctionMutation } from "./auction-mutation-lock";
import {
  DEMO_RESTORABLE_SETTING_KEYS,
  type DemoCleanupInput,
  type DemoCleanupPlan,
  type DemoEntityType,
  type DemoWorld,
  type LiveLicenseInput,
  type LiveLicenseResult,
  type SponsorLogoEntry,
  type TournamentLicensePatch,
  activateTournamentLicense,
  commitDemoCleanup,
  type DemoCleanupOutcome,
} from "./auction-demo-reset-plan";

export {
  DemoResetConflictError,
  DemoResetForbiddenError,
  LicenseTournamentNotFoundError,
} from "./auction-demo-reset-plan";

export type { LiveLicenseResult };

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export type AuctionDbTransaction = Tx;

async function writeTournamentLicense(tx: Tx, tournamentId: number, patch: TournamentLicensePatch): Promise<void> {
  await tx
    .update(tournamentsTable)
    .set({
      licenseStatus: patch.licenseStatus,
      ...(patch.recordGrant
        ? { licenseGrantedAt: new Date(), licenseGrantedBy: patch.licenseGrantedBy }
        : {}),
      ...(patch.scoringEnabled !== undefined ? { scoringEnabled: patch.scoringEnabled } : {}),
      ...(patch.touchUpdatedAt ? { updatedAt: new Date() } : {}),
    })
    .where(eq(tournamentsTable.id, tournamentId));
}

const SETTING_COLUMNS = {
  basePurse: tournamentsTable.basePurse,
  minBid: tournamentsTable.minBid,
  bidIncrement: tournamentsTable.bidIncrement,
  bidTier1UpTo: tournamentsTable.bidTier1UpTo,
  bidTier1Increment: tournamentsTable.bidTier1Increment,
  bidTier2UpTo: tournamentsTable.bidTier2UpTo,
  bidTier2Increment: tournamentsTable.bidTier2Increment,
  bidTier3Increment: tournamentsTable.bidTier3Increment,
  timerSeconds: tournamentsTable.timerSeconds,
  bidTimerSeconds: tournamentsTable.bidTimerSeconds,
  playerSelectionMode: tournamentsTable.playerSelectionMode,
  status: tournamentsTable.status,
} as const;

function parseSponsorLogos(raw: string | null): SponsorLogoEntry[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as SponsorLogoEntry[]) : [];
  } catch {
    return [];
  }
}

async function idsIn<T>(ids: T[], read: (ids: T[]) => Promise<void>): Promise<void> {
  if (ids.length === 0) return;
  await read(ids);
}

async function readWorld(tx: Tx, tournamentId: number): Promise<DemoWorld> {
  const [tournament] = await tx
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId));
  const [session] = await tx
    .select()
    .from(auctionDemoSessionsTable)
    .where(
      and(
        eq(auctionDemoSessionsTable.tournamentId, tournamentId),
        eq(auctionDemoSessionsTable.status, "loaded"),
      ),
    );

  const owned = session
    ? await tx
        .select()
        .from(auctionDemoOwnedRecordsTable)
        .where(eq(auctionDemoOwnedRecordsTable.demoSessionId, session.id))
    : [];
  const players = await tx
    .select({
      id: playersTable.id,
      tournamentId: playersTable.tournamentId,
      name: playersTable.name,
      photoUrl: playersTable.photoUrl,
      teamId: playersTable.teamId,
      categoryId: playersTable.categoryId,
      status: playersTable.status,
      soldPrice: playersTable.soldPrice,
      retainedPrice: playersTable.retainedPrice,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));
  const teams = await tx
    .select({
      id: teamsTable.id,
      tournamentId: teamsTable.tournamentId,
      name: teamsTable.name,
      logoUrl: teamsTable.logoUrl,
      accessCode: teamsTable.accessCode,
      purseUsed: teamsTable.purseUsed,
    })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));
  const categories = await tx
    .select({
      id: categoriesTable.id,
      tournamentId: categoriesTable.tournamentId,
      name: categoriesTable.name,
    })
    .from(categoriesTable)
    .where(eq(categoriesTable.tournamentId, tournamentId));
  const bids = await tx
    .select({
      id: bidsTable.id,
      tournamentId: bidsTable.tournamentId,
      playerId: bidsTable.playerId,
      teamId: bidsTable.teamId,
      amount: bidsTable.amount,
    })
    .from(bidsTable)
    .where(eq(bidsTable.tournamentId, tournamentId));
  const bidEvents = await tx
    .select({
      id: auctionBidEventsTable.id,
      playerId: auctionBidEventsTable.playerId,
      teamId: auctionBidEventsTable.teamId,
    })
    .from(auctionBidEventsTable)
    .where(eq(auctionBidEventsTable.tournamentId, tournamentId));
  const playerEvents = await tx
    .select({
      id: auctionPlayerEventsTable.id,
      playerId: auctionPlayerEventsTable.playerId,
    })
    .from(auctionPlayerEventsTable)
    .where(eq(auctionPlayerEventsTable.tournamentId, tournamentId));
  const timerEvents = await tx
    .select({
      id: auctionTimerEventsTable.id,
      playerId: auctionTimerEventsTable.playerId,
    })
    .from(auctionTimerEventsTable)
    .where(eq(auctionTimerEventsTable.tournamentId, tournamentId));
  const ownerSessions = await tx
    .select({
      id: ownerSessionsTable.id,
      tournamentId: ownerSessionsTable.tournamentId,
      teamId: ownerSessionsTable.teamId,
    })
    .from(ownerSessionsTable)
    .where(eq(ownerSessionsTable.tournamentId, tournamentId));
  const retentions = await tx
    .select({
      id: playerTeamAssignmentsTable.id,
      tournamentId: playerTeamAssignmentsTable.tournamentId,
      auctionPlayerId: playerTeamAssignmentsTable.auctionPlayerId,
      auctionTeamId: playerTeamAssignmentsTable.auctionTeamId,
    })
    .from(playerTeamAssignmentsTable)
    .where(
      and(
        eq(playerTeamAssignmentsTable.tournamentId, tournamentId),
        eq(playerTeamAssignmentsTable.assignmentType, "retained"),
      ),
    );
  const boosters = await tx
    .select({
      id: purseBoostersTable.id,
      teamId: purseBoostersTable.teamId,
      status: purseBoostersTable.status,
    })
    .from(purseBoostersTable)
    .where(eq(purseBoostersTable.tournamentId, tournamentId));
  const [auctionSession] = await tx
    .select({
      status: auctionSessionsTable.status,
      currentPlayerId: auctionSessionsTable.currentPlayerId,
      currentBid: auctionSessionsTable.currentBid,
      currentBidTeamId: auctionSessionsTable.currentBidTeamId,
      timerEndsAt: auctionSessionsTable.timerEndsAt,
      deferredPlayerIds: auctionSessionsTable.deferredPlayerIds,
      randomDrawQueue: auctionSessionsTable.randomDrawQueue,
      soldPlayersCount: auctionSessionsTable.soldPlayersCount,
      unsoldPlayersCount: auctionSessionsTable.unsoldPlayersCount,
      lastAction: auctionSessionsTable.lastAction,
    })
    .from(auctionSessionsTable)
    .where(eq(auctionSessionsTable.tournamentId, tournamentId));

  const fixtureTeams = await tx
    .select({
      homeTeamId: scoringFixturesTable.homeTeamId,
      awayTeamId: scoringFixturesTable.awayTeamId,
    })
    .from(scoringFixturesTable)
    .where(eq(scoringFixturesTable.tournamentId, tournamentId));
  const matchTeams = await tx
    .select({
      homeTeamId: scoringMatchesTable.homeTeamId,
      awayTeamId: scoringMatchesTable.awayTeamId,
    })
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId));
  const groups = await tx
    .select({ id: badmintonGroupsTable.id })
    .from(badmintonGroupsTable)
    .where(eq(badmintonGroupsTable.tournamentId, tournamentId));
  const groupMembers =
    groups.length === 0
      ? []
      : await tx
          .select({ teamId: badmintonGroupMembersTable.teamId })
          .from(badmintonGroupMembersTable)
          .where(
            inArray(
              badmintonGroupMembersTable.groupId,
              groups.map((group) => group.id),
            ),
          );

  const externalTeamRefs: DemoWorld["externalTeamRefs"] = [];
  for (const row of fixtureTeams) {
    externalTeamRefs.push({ teamId: row.homeTeamId, source: "scoring fixture" });
    externalTeamRefs.push({ teamId: row.awayTeamId, source: "scoring fixture" });
  }
  for (const row of matchTeams) {
    externalTeamRefs.push({ teamId: row.homeTeamId, source: "scoring match" });
    externalTeamRefs.push({ teamId: row.awayTeamId, source: "scoring match" });
  }
  for (const row of groupMembers) {
    externalTeamRefs.push({ teamId: row.teamId, source: "badminton group" });
  }

  const masterSponsorIds = owned
    .filter((row) => row.entityType === "master_sponsor")
    .map((row) => row.entityId);
  const masterSponsors =
    masterSponsorIds.length === 0
      ? []
      : await tx
          .select({ id: masterSponsorsTable.id, logoUrl: masterSponsorsTable.logoUrl })
          .from(masterSponsorsTable)
          .where(inArray(masterSponsorsTable.id, masterSponsorIds));
  const masterSponsorRefs: DemoWorld["masterSponsorRefs"] =
    masterSponsorIds.length === 0
      ? []
      : (
          await tx
            .select({ id: masterTeamsTable.id, sponsorId: masterTeamsTable.sponsorId })
            .from(masterTeamsTable)
            .where(inArray(masterTeamsTable.sponsorId, masterSponsorIds))
        ).flatMap((row) =>
          row.sponsorId
            ? [{ sponsorId: row.sponsorId, source: `master team ${row.id}` }]
            : [],
        );

  const settings: Record<string, unknown> = {};
  if (tournament) {
    const row = tournament as unknown as Record<string, unknown>;
    for (const key of DEMO_RESTORABLE_SETTING_KEYS) settings[key] = row[key];
  }

  return {
    tournament: tournament
      ? {
          id: tournament.id,
          organizerId: tournament.organizerId,
          licenseStatus: tournament.licenseStatus,
          resetCount: tournament.resetCount ?? 0,
          settings,
          sponsorLogos: parseSponsorLogos(tournament.sponsorLogos),
        }
      : null,
    session: session
      ? {
          id: session.id,
          tournamentId: session.tournamentId,
          organizerId: session.organizerId,
          status: session.status === "reset" || session.status === "resetting" ? session.status : "loaded",
          settingsBefore: (session.settingsBefore ?? {}) as Record<string, unknown>,
          settingsApplied: (session.settingsApplied ?? {}) as Record<string, unknown>,
        }
      : null,
    owned: owned.map((row) => ({
      sessionId: row.demoSessionId,
      tournamentId: row.tournamentId,
      entityType: row.entityType as DemoEntityType,
      entityId: row.entityId,
      mediaUrl: row.mediaUrl,
    })),
    players,
    teams,
    categories,
    bids,
    bidEvents,
    playerEvents,
    timerEvents,
    ownerSessions,
    retentions: retentions.map((row) => ({
      id: row.id,
      tournamentId: row.tournamentId ?? tournamentId,
      auctionPlayerId: row.auctionPlayerId,
      auctionTeamId: row.auctionTeamId,
    })),
    boosters,
    auctionSession: auctionSession ?? null,
    externalTeamRefs,
    masterSponsorRefs,
    masterSponsors,
  };
}

async function applyPlan(tx: Tx, tournamentId: number, plan: DemoCleanupPlan): Promise<void> {
  await idsIn(plan.deleteBidIds, async (ids) => {
    await tx.delete(bidsTable).where(inArray(bidsTable.id, ids));
  });
  await idsIn(plan.deleteBidEventIds, async (ids) => {
    await tx.delete(auctionBidEventsTable).where(inArray(auctionBidEventsTable.id, ids));
  });
  await idsIn(plan.deletePlayerEventIds, async (ids) => {
    await tx.delete(auctionPlayerEventsTable).where(inArray(auctionPlayerEventsTable.id, ids));
  });
  await idsIn(plan.deleteTimerEventIds, async (ids) => {
    await tx.delete(auctionTimerEventsTable).where(inArray(auctionTimerEventsTable.id, ids));
  });
  await idsIn(plan.deleteOwnerSessionIds, async (ids) => {
    await tx.delete(ownerSessionsTable).where(inArray(ownerSessionsTable.id, ids));
  });
  await idsIn(plan.deleteRetentionIds, async (ids) => {
    await tx.delete(playerTeamAssignmentsTable).where(inArray(playerTeamAssignmentsTable.id, ids));
  });
  if (plan.cancelBoosterIds.length > 0) {
    await tx
      .update(purseBoostersTable)
      .set({
        status: "cancelled",
        cancelledByType: "tournament_organizer",
        cancelledByLabel: plan.actorLabel,
        cancelledAt: new Date(),
        cancelReason: "Cancelled during demo reset",
      })
      .where(inArray(purseBoostersTable.id, plan.cancelBoosterIds));
  }
  await idsIn(plan.deletePlayerIds, async (ids) => {
    await tx.delete(playersTable).where(inArray(playersTable.id, ids));
  });
  await idsIn(plan.deleteTeamIds, async (ids) => {
    await tx.delete(teamsTable).where(inArray(teamsTable.id, ids));
  });
  await idsIn(plan.deleteCategoryIds, async (ids) => {
    await tx.delete(categoriesTable).where(inArray(categoriesTable.id, ids));
  });
  await idsIn(plan.deleteMasterSponsorIds, async (ids) => {
    await tx.delete(masterSponsorsTable).where(inArray(masterSponsorsTable.id, ids));
  });

  for (const [teamId, purseUsed] of Object.entries(plan.purseByTeamId)) {
    await tx
      .update(teamsTable)
      .set({ purseUsed })
      .where(eq(teamsTable.id, Number(teamId)));
  }

  await tx
    .update(tournamentsTable)
    .set({
      sponsorLogos: JSON.stringify(plan.nextSponsorLogos),
      resetCount: plan.resetCount,
      lastResetAt: new Date(),
      lastResetBy: plan.actorLabel === "super_admin" ? "super_admin" : "operator",
      ...plan.settingsPatch,
    })
    .where(eq(tournamentsTable.id, tournamentId));

  if (plan.auctionSession) {
    await tx
      .update(auctionSessionsTable)
      .set({
        status: plan.auctionSession.status,
        currentPlayerId: plan.auctionSession.currentPlayerId,
        currentBid: plan.auctionSession.currentBid,
        currentBidTeamId: plan.auctionSession.currentBidTeamId,
        timerEndsAt: plan.auctionSession.timerEndsAt,
        deferredPlayerIds: plan.auctionSession.deferredPlayerIds,
        randomDrawQueue: plan.auctionSession.randomDrawQueue,
        soldPlayersCount: plan.auctionSession.soldPlayersCount,
        unsoldPlayersCount: plan.auctionSession.unsoldPlayersCount,
        lastAction: plan.auctionSession.lastAction,
        revision: sql`COALESCE(revision, 0) + 1`,
      })
      .where(eq(auctionSessionsTable.tournamentId, tournamentId));
  }

  await tx
    .update(auctionDemoSessionsTable)
    .set({
      status: "reset",
      resetAt: new Date(),
      resetBy: plan.actorLabel,
    })
    .where(eq(auctionDemoSessionsTable.id, plan.sessionId));
}

export async function findLoadedDemoSession(tournamentId: number) {
  const [session] = await db
    .select()
    .from(auctionDemoSessionsTable)
    .where(
      and(
        eq(auctionDemoSessionsTable.tournamentId, tournamentId),
        eq(auctionDemoSessionsTable.status, "loaded"),
      ),
    );
  return session ?? null;
}

export async function getDemoSessionCounts(sessionId: string) {
  const records = await db
    .select({
      entityType: auctionDemoOwnedRecordsTable.entityType,
      count: sql<number>`count(*)::int`,
    })
    .from(auctionDemoOwnedRecordsTable)
    .where(eq(auctionDemoOwnedRecordsTable.demoSessionId, sessionId))
    .groupBy(auctionDemoOwnedRecordsTable.entityType);

  const counts: Record<string, number> = {};
  for (const r of records) counts[r.entityType] = Number(r.count);
  return {
    teams: counts["team"] ?? 0,
    players: counts["player"] ?? 0,
    sponsors: (counts["sponsor"] ?? 0) + (counts["master_sponsor"] ?? 0),
    categories: counts["category"] ?? 0,
    retentions: counts["retention"] ?? 0,
    ownerSessions: counts["owner_session"] ?? 0,
  };
}

export async function commitLoadedDemoReset(
  input: DemoCleanupInput,
  hooks?: { failAfterApply?: boolean },
): Promise<DemoCleanupOutcome> {
  return db.transaction(async (tx) => {
    await lockAuctionMutation(tx, input.tournamentId);
    const store = {
      transaction: async <T>(fn: (txAdapter: {
        read: () => Promise<DemoWorld>;
        apply: (plan: DemoCleanupPlan) => Promise<void>;
        beforeMutate?: () => Promise<void> | void;
      }) => Promise<T>) =>
        fn({
          read: () => readWorld(tx, input.tournamentId),
          apply: (plan) => applyPlan(tx, input.tournamentId, plan),
        }),
    };
    return commitDemoCleanup(store, input, hooks);
  });
}

export interface OrganizerDemoLoadInput {
  tournamentId: number;
  organizerId: number;
  settingsApplied?: Record<string, string | number>;
  teams?: {
    name: string;
    shortCode: string;
    ownerName: string;
    ownerMobile: string;
    accessCode?: string | null;
    logoUrl?: string | null;
    color?: string | null;
    purse?: number;
    purseUsed?: number;
  }[];
  players?: {
    name: string;
    photoUrl?: string | null;
    role?: string | null;
    city?: string | null;
    battingStyle?: string | null;
    bowlingStyle?: string | null;
    age?: number | null;
    basePrice?: number | null;
    teamIndex?: number | null;
    categoryIndex?: number | null;
    status?: string;
    soldPrice?: number | null;
    retainedPrice?: number | null;
  }[];
  sponsors?: { demoSponsorId: string; name?: string; url: string; tier?: string }[];
  categories?: { name: string; minBid?: number; bidIncrement?: number; colorCode?: string }[];
  ownerSessions?: { id: string; teamIndex: number }[];
  retentions?: { auctionPlayerIndex: number; auctionTeamIndex: number }[];
  masterSponsors?: { id: string; name: string; logoUrl?: string | null }[];
}

export async function grantTournamentLiveLicense(
  input: LiveLicenseInput & {
    hooks?: { failAfterApply?: boolean };
    afterWrite?: (tx: Tx) => Promise<void>;
  },
): Promise<LiveLicenseResult & { tournament: typeof tournamentsTable.$inferSelect | null }> {
  return db.transaction(async (tx) => {
    await lockAuctionMutation(tx, input.tournamentId);
    const store = {
      transaction: async <T>(fn: (txAdapter: {
        read: () => Promise<DemoWorld>;
        apply: (plan: DemoCleanupPlan) => Promise<void>;
        setLicense: (patch: TournamentLicensePatch) => Promise<void>;
      }) => Promise<T>) =>
        fn({
          read: () => readWorld(tx, input.tournamentId),
          apply: (plan) => applyPlan(tx, input.tournamentId, plan),
          setLicense: (patch) => writeTournamentLicense(tx, input.tournamentId, patch),
        }),
    };
    const result = await activateTournamentLicense(store, input, input.hooks);
    if (input.afterWrite) await input.afterWrite(tx);
    const [tournament] = await tx
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, input.tournamentId));
    return { ...result, tournament: tournament ?? null };
  });
}

export async function loadOrganizerDemoSession(rawInput: OrganizerDemoLoadInput) {
  return db.transaction(async (tx) => {
    await lockAuctionMutation(tx, rawInput.tournamentId);
    let input = rawInput;
    if ((!input.teams || input.teams.length === 0) && (!input.players || input.players.length === 0)) {
      const { buildDefaultTrialDemoPayload } = await import("./auction-trial-demo-data");
      const defaultPayload = buildDefaultTrialDemoPayload(input.tournamentId, input.organizerId);
      input = {
        ...defaultPayload,
        ...input,
        settingsApplied: { ...defaultPayload.settingsApplied, ...(input.settingsApplied ?? {}) },
      };
    }
    const existing = await tx
      .select({ id: auctionDemoSessionsTable.id })
      .from(auctionDemoSessionsTable)
      .where(
        and(
          eq(auctionDemoSessionsTable.tournamentId, input.tournamentId),
          eq(auctionDemoSessionsTable.status, "loaded"),
        ),
      );
    if (existing.length > 0) {
      throw new Error("A demo session is already loaded for this tournament");
    }
    const [tournament] = await tx
      .select()
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, input.tournamentId));
    if (!tournament || tournament.organizerId !== input.organizerId) {
      throw new Error("You do not have permission to load demo data for this tournament");
    }
    if (tournament.licenseStatus !== "trial") {
      throw new Error("Demo data can only be loaded while the tournament license is a trial. Licensed tournaments cannot load trial demo data.");
    }

    const settingsBefore: Record<string, unknown> = {};
    const tournamentRow = tournament as unknown as Record<string, unknown>;
    for (const key of DEMO_RESTORABLE_SETTING_KEYS) settingsBefore[key] = tournamentRow[key];
    const settingsApplied = { ...settingsBefore, ...(input.settingsApplied ?? {}) };
    const sessionId = `demo_${input.tournamentId}_${crypto.randomUUID()}`;
    await tx.insert(auctionDemoSessionsTable).values({
      id: sessionId,
      tournamentId: input.tournamentId,
      organizerId: input.organizerId,
      status: "loaded",
      settingsBefore,
      settingsApplied,
    });

    const owned: {
      demoSessionId: string;
      tournamentId: number;
      entityType: string;
      entityId: string;
      mediaUrl: string | null;
    }[] = [
      {
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "auction_config",
        entityId: sessionId,
        mediaUrl: null,
      },
    ];

    const teamIds: number[] = [];
    for (const team of input.teams ?? []) {
      const [created] = await tx
        .insert(teamsTable)
        .values({
          tournamentId: input.tournamentId,
          name: team.name,
          shortCode: team.shortCode,
          ownerName: team.ownerName,
          ownerMobile: team.ownerMobile,
          accessCode: team.accessCode ?? null,
          logoUrl: team.logoUrl ?? null,
          color: team.color ?? "#3B82F6",
          purse: team.purse ?? 10000000,
          purseUsed: team.purseUsed ?? 0,
        })
        .returning({ id: teamsTable.id });
      teamIds.push(created!.id);
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "team",
        entityId: String(created!.id),
        mediaUrl: team.logoUrl ?? null,
      });
    }

    const categoryIds: number[] = [];
    for (const [index, category] of (input.categories ?? []).entries()) {
      const [created] = await tx
        .insert(categoriesTable)
        .values({
          tournamentId: input.tournamentId,
          name: category.name,
          minBid: category.minBid ?? null,
          bidIncrement: category.bidIncrement ?? null,
          colorCode: category.colorCode ?? "#F59E0B",
          sortOrder: 1000 + index,
        })
        .returning({ id: categoriesTable.id });
      categoryIds.push(created!.id);
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "category",
        entityId: String(created!.id),
        mediaUrl: null,
      });
    }

    const [maxSerial] = await tx
      .select({ serialNo: playersTable.serialNo })
      .from(playersTable)
      .where(eq(playersTable.tournamentId, input.tournamentId))
      .orderBy(desc(playersTable.serialNo))
      .limit(1);
    let serial = maxSerial?.serialNo ?? 0;
    const playerIds: number[] = [];
    for (const player of input.players ?? []) {
      serial += 1;
      const teamId =
        player.teamIndex != null && player.teamIndex >= 0 ? (teamIds[player.teamIndex] ?? null) : null;
      const categoryId =
        player.categoryIndex != null && player.categoryIndex >= 0
          ? (categoryIds[player.categoryIndex] ?? null)
          : null;
      const [created] = await tx
        .insert(playersTable)
        .values({
          tournamentId: input.tournamentId,
          serialNo: serial,
          name: player.name,
          photoUrl: player.photoUrl ?? null,
          teamId,
          categoryId,
          status: player.status ?? "available",
          soldPrice: player.soldPrice ?? null,
          retainedPrice: player.retainedPrice ?? null,
          role: player.role ?? "Player",
          city: player.city ?? null,
          battingStyle: player.battingStyle ?? null,
          bowlingStyle: player.bowlingStyle ?? null,
          age: player.age ?? null,
          basePrice: player.basePrice ?? 100000,
        })
        .returning({ id: playersTable.id });
      playerIds.push(created!.id);
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "player",
        entityId: String(created!.id),
        mediaUrl: player.photoUrl ?? null,
      });
    }

    const logos = parseSponsorLogos(tournament.sponsorLogos);
    for (const sponsor of input.sponsors ?? []) {
      logos.push(sponsor);
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "sponsor",
        entityId: sponsor.demoSponsorId,
        mediaUrl: sponsor.url,
      });
    }

    for (const row of input.ownerSessions ?? []) {
      const teamId = teamIds[row.teamIndex];
      if (teamId == null) continue;
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      await tx.insert(ownerSessionsTable).values({
        id: row.id,
        tournamentId: input.tournamentId,
        teamId,
        expiresAt,
      });
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "owner_session",
        entityId: row.id,
        mediaUrl: null,
      });
    }

    for (const row of input.retentions ?? []) {
      const auctionPlayerId = playerIds[row.auctionPlayerIndex];
      const auctionTeamId = teamIds[row.auctionTeamIndex];
      if (auctionPlayerId == null || auctionTeamId == null) continue;
      const [created] = await tx
        .insert(playerTeamAssignmentsTable)
        .values({
          playerId: `demo-player-${auctionPlayerId}`,
          teamId: `demo-team-${auctionTeamId}`,
          tournamentId: input.tournamentId,
          assignmentType: "retained",
          auctionPlayerId,
          auctionTeamId,
        })
        .returning({ id: playerTeamAssignmentsTable.id });
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "retention",
        entityId: String(created!.id),
        mediaUrl: null,
      });
    }

    for (const sponsor of input.masterSponsors ?? []) {
      await tx.insert(masterSponsorsTable).values({
        id: sponsor.id,
        name: sponsor.name,
        logoUrl: sponsor.logoUrl ?? null,
      });
      owned.push({
        demoSessionId: sessionId,
        tournamentId: input.tournamentId,
        entityType: "master_sponsor",
        entityId: sponsor.id,
        mediaUrl: sponsor.logoUrl ?? null,
      });
    }

    const appliedPatch: Record<string, unknown> = {};
    for (const key of DEMO_RESTORABLE_SETTING_KEYS) {
      if (Object.prototype.hasOwnProperty.call(input.settingsApplied ?? {}, key)) {
        appliedPatch[key] = settingsApplied[key];
      }
    }
    await tx
      .update(tournamentsTable)
      .set({
        sponsorLogos: JSON.stringify(logos),
        ...appliedPatch,
      })
      .where(eq(tournamentsTable.id, input.tournamentId));

    if (owned.length > 0) {
      await tx.insert(auctionDemoOwnedRecordsTable).values(owned);
    }

    return {
      sessionId,
      teams: teamIds.length,
      players: playerIds.length,
      sponsors: (input.sponsors ?? []).length + (input.masterSponsors ?? []).length,
      categories: categoryIds.length,
      retentions: (input.retentions ?? []).length,
      ownerSessions: (input.ownerSessions ?? []).length,
    };
  });
}
