/**
 * Demo-aware auction reset.
 *
 * Ownership is an explicit demo session plus owned-record rows.
 * Nothing is selected for deletion by name, image URL, or team order.
 * When no session is loaded, callers keep the practice-reset contract.
 */

export const DEMO_RESTORABLE_SETTING_KEYS = [
  "basePurse",
  "minBid",
  "bidIncrement",
  "bidTier1UpTo",
  "bidTier1Increment",
  "bidTier2UpTo",
  "bidTier2Increment",
  "bidTier3Increment",
  "timerSeconds",
  "bidTimerSeconds",
  "playerSelectionMode",
  "minimumSquadSize",
  "maximumSquadSize",
  "bidTiers",
  "status",
] as const;

export type DemoSettingKey = (typeof DEMO_RESTORABLE_SETTING_KEYS)[number];

export type DemoEntityType =
  | "team"
  | "player"
  | "sponsor"
  | "master_sponsor"
  | "category"
  | "owner_session"
  | "retention"
  | "auction_config";

export interface DemoConflict {
  entityType: string;
  entityId: string;
  reason: string;
}

export class DemoResetConflictError extends Error {
  readonly status = 409;
  readonly code = "DEMO_RESET_CONFLICT";
  constructor(
    message: string,
    readonly conflicts: DemoConflict[],
  ) {
    super(message);
    this.name = "DemoResetConflictError";
  }
}

export class DemoResetForbiddenError extends Error {
  readonly status = 403;
  readonly code = "DEMO_RESET_FORBIDDEN";
  constructor(message: string) {
    super(message);
    this.name = "DemoResetForbiddenError";
  }
}

export class LicenseTournamentNotFoundError extends Error {
  readonly status = 404;
  constructor() {
    super("Tournament not found");
    this.name = "LicenseTournamentNotFoundError";
  }
}

export interface SponsorLogoEntry {
  url: string;
  name?: string;
  demoSponsorId?: string;
  publicId?: string;
  [key: string]: unknown;
}

export interface DemoOwnedRecord {
  sessionId: string;
  tournamentId: number;
  entityType: DemoEntityType;
  entityId: string;
  mediaUrl: string | null;
}

export interface DemoSessionRow {
  id: string;
  tournamentId: number;
  organizerId: number;
  status: "loaded" | "resetting" | "reset";
  settingsBefore: Record<string, unknown>;
  settingsApplied: Record<string, unknown>;
}

export interface DemoPlayerRow {
  id: number;
  tournamentId: number;
  name: string;
  photoUrl: string | null;
  teamId: number | null;
  categoryId: number | null;
  status: string;
  soldPrice: number | null;
  retainedPrice: number | null;
}

export interface DemoTeamRow {
  id: number;
  tournamentId: number;
  name: string;
  logoUrl: string | null;
  accessCode: string | null;
  purseUsed: number;
}

export interface DemoCategoryRow {
  id: number;
  tournamentId: number;
  name: string;
}

export interface DemoAuctionSessionSnap {
  status: string;
  currentPlayerId: number | null;
  currentBid: number | null;
  currentBidTeamId: number | null;
  timerEndsAt: string | null;
  deferredPlayerIds: string | null;
  randomDrawQueue: string | null;
  soldPlayersCount: number;
  unsoldPlayersCount: number;
  lastAction: string | null;
}

export interface DemoWorld {
  tournament: {
    id: number;
    organizerId: number | null;
    licenseStatus: string;
    licenseGrantedAt?: string | null;
    licenseGrantedBy?: string | null;
    scoringEnabled?: boolean;
    updatedAt?: string | null;
    resetCount: number;
    settings: Record<string, unknown>;
    sponsorLogos: SponsorLogoEntry[];
  } | null;
  session: DemoSessionRow | null;
  owned: DemoOwnedRecord[];
  players: DemoPlayerRow[];
  teams: DemoTeamRow[];
  categories: DemoCategoryRow[];
  bids: { id: number; tournamentId: number; playerId: number; teamId: number; amount: number }[];
  bidEvents: { id: number; playerId: number; teamId: number }[];
  playerEvents: { id: number; playerId: number }[];
  timerEvents: { id: number; playerId: number | null }[];
  ownerSessions: { id: string; tournamentId: number; teamId: number }[];
  retentions: {
    id: number;
    tournamentId: number;
    auctionPlayerId: number | null;
    auctionTeamId: number | null;
  }[];
  boosters: { id: number; teamId: number; status: string }[];
  auctionSession: DemoAuctionSessionSnap | null;
  externalTeamRefs: { teamId: number; source: string }[];
  masterSponsorRefs: { sponsorId: string; source: string }[];
  masterSponsors: { id: string; logoUrl: string | null }[];
}

export interface DemoCleanupPlan {
  sessionId: string;
  deletePlayerIds: number[];
  deleteTeamIds: number[];
  deleteCategoryIds: number[];
  deleteBidIds: number[];
  deleteBidEventIds: number[];
  deletePlayerEventIds: number[];
  deleteTimerEventIds: number[];
  deleteOwnerSessionIds: string[];
  deleteRetentionIds: number[];
  cancelBoosterIds: number[];
  deleteMasterSponsorIds: string[];
  nextSponsorLogos: SponsorLogoEntry[];
  purseByTeamId: Record<number, number>;
  settingsPatch: Record<string, unknown>;
  resetCount: number;
  actorLabel: string;
  auctionSession: DemoAuctionSessionSnap | null;
  removedMediaUrls: string[];
}

export interface TournamentLicensePatch {
  licenseStatus: string;
  recordGrant: boolean;
  licenseGrantedBy: string | null;
  scoringEnabled?: boolean;
  touchUpdatedAt?: boolean;
}

export interface DemoResetTx {
  read: () => Promise<DemoWorld>;
  apply: (plan: DemoCleanupPlan) => Promise<void>;
  beforeMutate?: () => Promise<void> | void;
  setLicense?: (patch: TournamentLicensePatch) => Promise<void>;
}

export interface DemoResetStore {
  transaction: <T>(fn: (tx: DemoResetTx) => Promise<T>) => Promise<T>;
}

export interface DemoCleanupInput {
  tournamentId: number;
  actorOrganizerId: number;
  actorLabel: string;
}

export type DemoCleanupOutcome =
  | { mode: "practice" }
  | { mode: "demo"; plan: DemoCleanupPlan; removedMediaUrls: string[] };

const CONFLICT_MESSAGE =
  "Demo data is referenced by records that are not part of this demo. Reset was cancelled and nothing was removed.";

function idsOf(world: DemoWorld, entityType: DemoEntityType, sessionId: string): Set<string> {
  const ids = new Set<string>();
  for (const row of world.owned) {
    if (row.sessionId === sessionId && row.entityType === entityType) ids.add(row.entityId);
  }
  return ids;
}

function parseIdList(raw: string | null): number[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((value): value is number => typeof value === "number");
  } catch {
    return [];
  }
}

export function restoreDemoSettings(
  current: Record<string, unknown>,
  before: Record<string, unknown>,
  applied: Record<string, unknown>,
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const key of DEMO_RESTORABLE_SETTING_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(applied, key)) continue;
    if (Object.is(current[key], applied[key])) patch[key] = before[key];
  }
  return patch;
}

export function findDemoCleanupConflicts(world: DemoWorld): DemoConflict[] {
  const session = world.session;
  if (!session || session.status !== "loaded") return [];
  const conflicts: DemoConflict[] = [];
  const ownedPlayers = idsOf(world, "player", session.id);
  const ownedTeams = idsOf(world, "team", session.id);
  const ownedCategories = idsOf(world, "category", session.id);
  const ownedRetentions = idsOf(world, "retention", session.id);
  const ownedMasterSponsors = idsOf(world, "master_sponsor", session.id);

  for (const row of world.owned) {
    if (row.sessionId !== session.id) continue;
    if (row.tournamentId !== session.tournamentId) {
      conflicts.push({
        entityType: row.entityType,
        entityId: row.entityId,
        reason: "Ownership record is outside this tournament.",
      });
    }
  }

  for (const player of world.players) {
    const owned = ownedPlayers.has(String(player.id));
    if (owned) {
      if (player.tournamentId !== session.tournamentId) {
        conflicts.push({
          entityType: "player",
          entityId: String(player.id),
          reason: "Demo player belongs to a different tournament.",
        });
      }
      continue;
    }
    if (player.teamId != null && ownedTeams.has(String(player.teamId))) {
      conflicts.push({
        entityType: "player",
        entityId: String(player.id),
        reason: "A tournament player is assigned to a demo team.",
      });
    }
    if (player.categoryId != null && ownedCategories.has(String(player.categoryId))) {
      conflicts.push({
        entityType: "player",
        entityId: String(player.id),
        reason: "A tournament player uses a demo category.",
      });
    }
  }

  for (const team of world.teams) {
    if (ownedTeams.has(String(team.id)) && team.tournamentId !== session.tournamentId) {
      conflicts.push({
        entityType: "team",
        entityId: String(team.id),
        reason: "Demo team belongs to a different tournament.",
      });
    }
  }

  for (const category of world.categories) {
    if (ownedCategories.has(String(category.id)) && category.tournamentId !== session.tournamentId) {
      conflicts.push({
        entityType: "category",
        entityId: String(category.id),
        reason: "Demo category belongs to a different tournament.",
      });
    }
  }

  for (const retention of world.retentions) {
    if (retention.tournamentId !== session.tournamentId) continue;
    if (ownedRetentions.has(String(retention.id))) continue;
    const touchesPlayer =
      retention.auctionPlayerId != null && ownedPlayers.has(String(retention.auctionPlayerId));
    const touchesTeam =
      retention.auctionTeamId != null && ownedTeams.has(String(retention.auctionTeamId));
    if (touchesPlayer || touchesTeam) {
      conflicts.push({
        entityType: "retention",
        entityId: String(retention.id),
        reason: "A non-demo retention assignment references demo data.",
      });
    }
  }

  for (const ref of world.externalTeamRefs) {
    if (ownedTeams.has(String(ref.teamId))) {
      conflicts.push({
        entityType: "team",
        entityId: String(ref.teamId),
        reason: `Demo team is referenced by ${ref.source}.`,
      });
    }
  }

  for (const ref of world.masterSponsorRefs) {
    if (ownedMasterSponsors.has(ref.sponsorId)) {
      conflicts.push({
        entityType: "master_sponsor",
        entityId: ref.sponsorId,
        reason: `Demo sponsor is referenced by ${ref.source}.`,
      });
    }
  }

  return conflicts;
}

export function planDemoCleanup(world: DemoWorld, input: DemoCleanupInput): DemoCleanupPlan {
  const session = world.session;
  const tournament = world.tournament;
  if (!session || !tournament) {
    throw new DemoResetConflictError(CONFLICT_MESSAGE, []);
  }
  const ownedPlayers = idsOf(world, "player", session.id);
  const ownedTeams = idsOf(world, "team", session.id);
  const ownedCategories = idsOf(world, "category", session.id);
  const ownedSponsors = idsOf(world, "sponsor", session.id);
  const ownedMasterSponsors = idsOf(world, "master_sponsor", session.id);
  const ownedSessions = idsOf(world, "owner_session", session.id);
  const ownedRetentions = idsOf(world, "retention", session.id);

  const deletePlayerIds = world.players
    .filter((player) => ownedPlayers.has(String(player.id)) && player.tournamentId === session.tournamentId)
    .map((player) => player.id);
  const deleteTeamIds = world.teams
    .filter((team) => ownedTeams.has(String(team.id)) && team.tournamentId === session.tournamentId)
    .map((team) => team.id);
  const deleteCategoryIds = world.categories
    .filter((category) => ownedCategories.has(String(category.id)) && category.tournamentId === session.tournamentId)
    .map((category) => category.id);

  const playerSet = new Set(deletePlayerIds);
  const teamSet = new Set(deleteTeamIds);

  const removedMediaUrls: string[] = [];
  for (const player of world.players) {
    if (playerSet.has(player.id) && player.photoUrl) removedMediaUrls.push(player.photoUrl);
  }
  for (const team of world.teams) {
    if (teamSet.has(team.id) && team.logoUrl) removedMediaUrls.push(team.logoUrl);
  }
  for (const sponsor of world.tournament?.sponsorLogos ?? []) {
    if (sponsor.demoSponsorId && ownedSponsors.has(sponsor.demoSponsorId) && sponsor.url) {
      removedMediaUrls.push(sponsor.url);
    }
  }
  for (const sponsor of world.masterSponsors) {
    if (ownedMasterSponsors.has(sponsor.id) && sponsor.logoUrl) removedMediaUrls.push(sponsor.logoUrl);
  }

  const purseByTeamId: Record<number, number> = {};
  for (const team of world.teams) {
    if (teamSet.has(team.id) || team.tournamentId !== session.tournamentId) continue;
    const deduct = world.players
      .filter((player) => playerSet.has(player.id) && player.teamId === team.id)
      .reduce((sum, player) => sum + (player.soldPrice ?? player.retainedPrice ?? 0), 0);
    purseByTeamId[team.id] = Math.max(0, team.purseUsed - deduct);
  }

  const remainingPlayers = world.players.filter(
    (player) => !playerSet.has(player.id) && player.tournamentId === session.tournamentId,
  );
  let auctionSession = world.auctionSession;
  if (auctionSession) {
    const deferred = parseIdList(auctionSession.deferredPlayerIds).filter((id) => !playerSet.has(id));
    const queue = parseIdList(auctionSession.randomDrawQueue).filter((id) => !playerSet.has(id));
    const currentPlayerIsDemo =
      auctionSession.currentPlayerId != null && playerSet.has(auctionSession.currentPlayerId);
    const currentTeamIsDemo =
      auctionSession.currentBidTeamId != null && teamSet.has(auctionSession.currentBidTeamId);
    const clearLive = currentPlayerIsDemo || currentTeamIsDemo;
    auctionSession = {
      ...auctionSession,
      currentPlayerId: clearLive ? null : auctionSession.currentPlayerId,
      currentBid: clearLive ? null : auctionSession.currentBid,
      currentBidTeamId: clearLive ? null : auctionSession.currentBidTeamId,
      timerEndsAt: clearLive ? null : auctionSession.timerEndsAt,
      deferredPlayerIds: JSON.stringify(deferred),
      randomDrawQueue: JSON.stringify(queue),
      soldPlayersCount: remainingPlayers.filter((player) => player.status === "sold").length,
      unsoldPlayersCount: remainingPlayers.filter((player) => player.status === "unsold").length,
      status: clearLive && auctionSession.status === "active" ? "idle" : auctionSession.status,
      lastAction: clearLive ? "Demo data removed" : auctionSession.lastAction,
    };
  }

  return {
    sessionId: session.id,
    deletePlayerIds,
    deleteTeamIds,
    deleteCategoryIds,
    deleteBidIds: world.bids
      .filter((bid) => bid.tournamentId === session.tournamentId && (playerSet.has(bid.playerId) || teamSet.has(bid.teamId)))
      .map((bid) => bid.id),
    deleteBidEventIds: world.bidEvents
      .filter((event) => playerSet.has(event.playerId) || teamSet.has(event.teamId))
      .map((event) => event.id),
    deletePlayerEventIds: world.playerEvents
      .filter((event) => playerSet.has(event.playerId))
      .map((event) => event.id),
    deleteTimerEventIds: world.timerEvents
      .filter((event) => event.playerId != null && playerSet.has(event.playerId))
      .map((event) => event.id),
    deleteOwnerSessionIds: world.ownerSessions
      .filter(
        (row) =>
          row.tournamentId === session.tournamentId &&
          (ownedSessions.has(row.id) || teamSet.has(row.teamId)),
      )
      .map((row) => row.id),
    deleteRetentionIds: world.retentions
      .filter((row) => row.tournamentId === session.tournamentId && ownedRetentions.has(String(row.id)))
      .map((row) => row.id),
    cancelBoosterIds: world.boosters
      .filter((row) => row.status === "active" && teamSet.has(row.teamId))
      .map((row) => row.id),
    deleteMasterSponsorIds: world.masterSponsors
      .filter((row) => ownedMasterSponsors.has(row.id))
      .map((row) => row.id),
    nextSponsorLogos: (tournament.sponsorLogos ?? []).filter(
      (logo) => !logo.demoSponsorId || !ownedSponsors.has(logo.demoSponsorId),
    ),
    purseByTeamId,
    settingsPatch: restoreDemoSettings(tournament.settings, session.settingsBefore, session.settingsApplied),
    resetCount: (tournament.resetCount ?? 0) + 1,
    actorLabel: input.actorLabel,
    auctionSession,
    removedMediaUrls,
  };
}

function assertCleanupAllowed(world: DemoWorld, input: DemoCleanupInput): void {
  const tournament = world.tournament;
  const session = world.session;
  if (!tournament || tournament.id !== input.tournamentId) {
    throw new DemoResetConflictError("Tournament not found for this demo reset.", []);
  }
  if (
    tournament.organizerId == null ||
    tournament.organizerId !== input.actorOrganizerId ||
    !session ||
    session.organizerId !== tournament.organizerId ||
    session.tournamentId !== tournament.id
  ) {
    throw new DemoResetForbiddenError("You do not have permission to reset this tournament.");
  }
}

export async function commitDemoCleanup(
  store: DemoResetStore,
  input: DemoCleanupInput,
  hooks?: { failAfterApply?: boolean },
): Promise<DemoCleanupOutcome> {
  return store.transaction(async (tx) => {
    const first = await tx.read();
    if (!first.session || first.session.status !== "loaded") return { mode: "practice" };
    assertCleanupAllowed(first, input);
    const conflicts = findDemoCleanupConflicts(first);
    if (conflicts.length > 0) throw new DemoResetConflictError(CONFLICT_MESSAGE, conflicts);
    if (tx.beforeMutate) await tx.beforeMutate();
    const current = await tx.read();
    assertCleanupAllowed(current, input);
    const raced = findDemoCleanupConflicts(current);
    if (raced.length > 0) throw new DemoResetConflictError(CONFLICT_MESSAGE, raced);
    const plan = planDemoCleanup(current, input);
    await tx.apply(plan);
    if (hooks?.failAfterApply) throw new Error("Simulated demo reset failure");
    return { mode: "demo", plan, removedMediaUrls: plan.removedMediaUrls };
  });
}

export interface LiveLicenseInput {
  tournamentId: number;
  nextStatus: "trial" | "active" | "completed";
  grantedBy: string | null;
  actorLabel: string;
  authorized: boolean;
  recordGrant: boolean;
  scoringEnabled?: boolean;
  touchUpdatedAt?: boolean;
}

export interface LiveLicenseResult {
  previousStatus: string;
  licenseStatus: string;
  demoRemoved: boolean;
  demoSessionId: string | null;
  removedMediaUrls: string[];
  plan: DemoCleanupPlan | null;
}

/**
 * Trial → active removes a loaded demo session with the same cleanup plan as Clear Trial Data.
 * licenseStatus is written after that cleanup, so a thrown conflict or failure rolls the license change back with it.
 * Any other transition leaves demo rows in place.
 */
export async function activateTournamentLicense(
  store: DemoResetStore,
  input: LiveLicenseInput,
  hooks?: { failAfterApply?: boolean },
): Promise<LiveLicenseResult> {
  return store.transaction(async (tx) => {
    if (!input.authorized) {
      throw new DemoResetForbiddenError("You do not have permission to change this tournament license.");
    }
    if (!tx.setLicense) {
      throw new Error("License activation requires a setLicense adapter");
    }
    const world = await tx.read();
    if (!world.tournament || world.tournament.id !== input.tournamentId) {
      throw new LicenseTournamentNotFoundError();
    }
    const previousStatus = world.tournament.licenseStatus;
    const removeDemo = previousStatus === "trial" && input.nextStatus === "active";
    let demoRemoved = false;
    let demoSessionId: string | null = null;
    let removedMediaUrls: string[] = [];
    let plan: DemoCleanupPlan | null = null;
    if (removeDemo && world.session?.status === "loaded") {
      const outcome = await commitDemoCleanup(
        store,
        {
          tournamentId: input.tournamentId,
          actorOrganizerId: world.tournament.organizerId ?? -1,
          actorLabel: input.actorLabel,
        },
        hooks,
      );
      if (outcome.mode === "demo") {
        demoRemoved = true;
        demoSessionId = outcome.plan.sessionId;
        removedMediaUrls = outcome.removedMediaUrls;
        plan = outcome.plan;
      }
    }
    await tx.setLicense({
      licenseStatus: input.nextStatus,
      recordGrant: input.recordGrant,
      licenseGrantedBy: input.grantedBy,
      scoringEnabled: input.scoringEnabled,
      touchUpdatedAt: input.touchUpdatedAt,
    });
    return {
      previousStatus,
      licenseStatus: input.nextStatus,
      demoRemoved,
      demoSessionId,
      removedMediaUrls,
      plan,
    };
  });
}

export function applyPlanToWorld(world: DemoWorld, plan: DemoCleanupPlan): void {
  const players = new Set(plan.deletePlayerIds);
  const teams = new Set(plan.deleteTeamIds);
  const categories = new Set(plan.deleteCategoryIds);
  const bids = new Set(plan.deleteBidIds);
  const bidEvents = new Set(plan.deleteBidEventIds);
  const playerEvents = new Set(plan.deletePlayerEventIds);
  const timerEvents = new Set(plan.deleteTimerEventIds);
  const sessions = new Set(plan.deleteOwnerSessionIds);
  const retentions = new Set(plan.deleteRetentionIds);
  const boosters = new Set(plan.cancelBoosterIds);
  const masterSponsors = new Set(plan.deleteMasterSponsorIds);

  world.players = world.players.filter((row) => !players.has(row.id));
  world.teams = world.teams.filter((row) => !teams.has(row.id));
  world.categories = world.categories.filter((row) => !categories.has(row.id));
  world.bids = world.bids.filter((row) => !bids.has(row.id));
  world.bidEvents = world.bidEvents.filter((row) => !bidEvents.has(row.id));
  world.playerEvents = world.playerEvents.filter((row) => !playerEvents.has(row.id));
  world.timerEvents = world.timerEvents.filter((row) => !timerEvents.has(row.id));
  world.ownerSessions = world.ownerSessions.filter((row) => !sessions.has(row.id));
  world.retentions = world.retentions.filter((row) => !retentions.has(row.id));
  world.boosters = world.boosters.map((row) =>
    boosters.has(row.id) ? { ...row, status: "cancelled" } : row,
  );
  world.masterSponsors = world.masterSponsors.filter((row) => !masterSponsors.has(row.id));
  for (const team of world.teams) {
    if (plan.purseByTeamId[team.id] != null) team.purseUsed = plan.purseByTeamId[team.id]!;
  }
  if (world.tournament) {
    world.tournament.sponsorLogos = plan.nextSponsorLogos;
    world.tournament.settings = { ...world.tournament.settings, ...plan.settingsPatch };
    world.tournament.resetCount = plan.resetCount;
  }
  world.auctionSession = plan.auctionSession;
  if (world.session && world.session.id === plan.sessionId) world.session.status = "reset";
}

function cloneWorld(world: DemoWorld): DemoWorld {
  return structuredClone(world);
}

function restoreWorld(target: DemoWorld, source: DemoWorld): void {
  target.tournament = source.tournament;
  target.session = source.session;
  target.owned = source.owned;
  target.players = source.players;
  target.teams = source.teams;
  target.categories = source.categories;
  target.bids = source.bids;
  target.bidEvents = source.bidEvents;
  target.playerEvents = source.playerEvents;
  target.timerEvents = source.timerEvents;
  target.ownerSessions = source.ownerSessions;
  target.retentions = source.retentions;
  target.boosters = source.boosters;
  target.auctionSession = source.auctionSession;
  target.externalTeamRefs = source.externalTeamRefs;
  target.masterSponsorRefs = source.masterSponsorRefs;
  target.masterSponsors = source.masterSponsors;
}

export function createMemoryDemoStore(
  world: DemoWorld,
  hooks?: { beforeMutate?: () => void },
): DemoResetStore {
  return {
    async transaction(fn) {
      const backup = cloneWorld(world);
      try {
        return await fn({
          read: async () => cloneWorld(world),
          apply: async (plan) => applyPlanToWorld(world, plan),
          beforeMutate: hooks?.beforeMutate,
          setLicense: async (patch) => {
            if (!world.tournament) return;
            world.tournament.licenseStatus = patch.licenseStatus;
            if (patch.recordGrant) {
              world.tournament.licenseGrantedAt = new Date().toISOString();
              world.tournament.licenseGrantedBy = patch.licenseGrantedBy;
            }
            if (patch.scoringEnabled !== undefined) world.tournament.scoringEnabled = patch.scoringEnabled;
            if (patch.touchUpdatedAt) world.tournament.updatedAt = new Date().toISOString();
          },
        });
      } catch (error) {
        restoreWorld(world, backup);
        throw error;
      }
    },
  };
}

export interface DemoLoadSpec {
  sessionId?: string;
  organizerId: number;
  settingsApplied?: Partial<Record<DemoSettingKey, string | number>>;
  teams?: Array<Omit<DemoTeamRow, "tournamentId" | "purseUsed" | "logoUrl" | "accessCode"> & {
    logoUrl?: string | null;
    accessCode?: string | null;
    purseUsed?: number;
  }>;
  players?: Array<Omit<DemoPlayerRow, "tournamentId" | "photoUrl" | "teamId" | "categoryId" | "status" | "soldPrice" | "retainedPrice"> & {
    photoUrl?: string | null;
    teamId?: number | null;
    categoryId?: number | null;
    status?: string;
    soldPrice?: number | null;
    retainedPrice?: number | null;
  }>;
  sponsors?: SponsorLogoEntry[];
  categories?: Array<Omit<DemoCategoryRow, "tournamentId">>;
  ownerSessions?: { id: string; teamId: number }[];
  retentions?: { id: number; auctionPlayerId: number | null; auctionTeamId: number | null }[];
  bids?: { id: number; playerId: number; teamId: number; amount: number }[];
  bidEvents?: { id: number; playerId: number; teamId: number }[];
  playerEvents?: { id: number; playerId: number }[];
  timerEvents?: { id: number; playerId: number | null }[];
  masterSponsors?: { id: string; logoUrl?: string | null }[];
  boosters?: { id: number; teamId: number; status?: string }[];
}

function own(
  sessionId: string,
  tournamentId: number,
  entityType: DemoEntityType,
  entityId: string,
  mediaUrl: string | null = null,
): DemoOwnedRecord {
  return { sessionId, tournamentId, entityType, entityId, mediaUrl };
}

/** Records every loaded row against the demo session. This is the organiser loader's ownership write. */
export function loadOrganizerDemo(world: DemoWorld, spec: DemoLoadSpec): { sessionId: string } {
  if (!world.tournament) throw new Error("Tournament is required before loading demo data");
  if (world.session?.status === "loaded") {
    throw new Error("A demo session is already loaded for this tournament");
  }
  const tournamentId = world.tournament.id;
  const sessionId = spec.sessionId ?? `demo_${tournamentId}_${crypto.randomUUID()}`;
  const settingsBefore: Record<string, unknown> = {};
  for (const key of DEMO_RESTORABLE_SETTING_KEYS) {
    if (world.tournament.settings[key] !== undefined) settingsBefore[key] = world.tournament.settings[key];
  }
  const settingsApplied = { ...settingsBefore, ...(spec.settingsApplied ?? {}) };
  world.tournament.settings = { ...world.tournament.settings, ...settingsApplied };
  world.session = {
    id: sessionId,
    tournamentId,
    organizerId: spec.organizerId,
    status: "loaded",
    settingsBefore,
    settingsApplied,
  };
  world.owned.push(own(sessionId, tournamentId, "auction_config", sessionId));

  for (const team of spec.teams ?? []) {
    world.teams.push({
      id: team.id,
      tournamentId,
      name: team.name,
      logoUrl: team.logoUrl ?? null,
      accessCode: team.accessCode ?? null,
      purseUsed: team.purseUsed ?? 0,
    });
    world.owned.push(own(sessionId, tournamentId, "team", String(team.id), team.logoUrl ?? null));
  }
  for (const category of spec.categories ?? []) {
    world.categories.push({ id: category.id, tournamentId, name: category.name });
    world.owned.push(own(sessionId, tournamentId, "category", String(category.id)));
  }
  for (const player of spec.players ?? []) {
    world.players.push({
      id: player.id,
      tournamentId,
      name: player.name,
      photoUrl: player.photoUrl ?? null,
      teamId: player.teamId ?? null,
      categoryId: player.categoryId ?? null,
      status: player.status ?? "available",
      soldPrice: player.soldPrice ?? null,
      retainedPrice: player.retainedPrice ?? null,
    });
    world.owned.push(own(sessionId, tournamentId, "player", String(player.id), player.photoUrl ?? null));
  }
  for (const sponsor of spec.sponsors ?? []) {
    if (!sponsor.demoSponsorId) throw new Error("Demo sponsors require demoSponsorId");
    world.tournament.sponsorLogos = [...world.tournament.sponsorLogos, sponsor];
    world.owned.push(own(sessionId, tournamentId, "sponsor", sponsor.demoSponsorId, sponsor.url));
  }
  for (const row of spec.ownerSessions ?? []) {
    world.ownerSessions.push({ id: row.id, tournamentId, teamId: row.teamId });
    world.owned.push(own(sessionId, tournamentId, "owner_session", row.id));
  }
  for (const row of spec.retentions ?? []) {
    world.retentions.push({
      id: row.id,
      tournamentId,
      auctionPlayerId: row.auctionPlayerId,
      auctionTeamId: row.auctionTeamId,
    });
    world.owned.push(own(sessionId, tournamentId, "retention", String(row.id)));
  }
  for (const bid of spec.bids ?? []) {
    world.bids.push({ ...bid, tournamentId });
  }
  for (const event of spec.bidEvents ?? []) world.bidEvents.push(event);
  for (const event of spec.playerEvents ?? []) world.playerEvents.push(event);
  for (const event of spec.timerEvents ?? []) world.timerEvents.push(event);
  for (const sponsor of spec.masterSponsors ?? []) {
    world.masterSponsors.push({ id: sponsor.id, logoUrl: sponsor.logoUrl ?? null });
    world.owned.push(own(sessionId, tournamentId, "master_sponsor", sponsor.id, sponsor.logoUrl ?? null));
  }
  for (const booster of spec.boosters ?? []) {
    world.boosters.push({ id: booster.id, teamId: booster.teamId, status: booster.status ?? "active" });
  }
  return { sessionId };
}

export function referencedMediaUrls(world: DemoWorld): Set<string> {
  const urls = new Set<string>();
  for (const player of world.players) if (player.photoUrl) urls.add(player.photoUrl);
  for (const team of world.teams) if (team.logoUrl) urls.add(team.logoUrl);
  for (const logo of world.tournament?.sponsorLogos ?? []) if (logo.url) urls.add(logo.url);
  for (const sponsor of world.masterSponsors) if (sponsor.logoUrl) urls.add(sponsor.logoUrl);
  return urls;
}

export function ownerCredentialWorks(
  world: DemoWorld,
  accessCode: string,
  sessionId?: string,
): boolean {
  if (world.teams.some((team) => team.accessCode === accessCode)) return true;
  if (sessionId && world.ownerSessions.some((row) => row.id === sessionId)) return true;
  return false;
}

export interface PracticeResetPlan {
  clearPlayerIds: number[];
  purseByTeamId: Record<number, number>;
  deletesAllBids: true;
  deletesAllIntelligenceEvents: true;
  resetsSessionToIdle: true;
  setsTournamentStatus: "setup";
  preservesRetainedPlayers: true;
  preservesTeams: true;
  preservesSponsors: true;
  preservesNonStatusSettings: true;
}

/** Existing practice reset when no demo session is loaded. Does not delete teams, players, or sponsors. */
export function planPracticeReset(
  players: { id: number; status: string; teamId: number | null; retainedPrice: number | null }[],
  teams: { id: number }[],
): PracticeResetPlan {
  const purseByTeamId: Record<number, number> = {};
  for (const team of teams) {
    purseByTeamId[team.id] = players
      .filter((player) => player.status === "retained" && player.teamId === team.id)
      .reduce((sum, player) => sum + (player.retainedPrice ?? 0), 0);
  }
  return {
    clearPlayerIds: players.filter((player) => player.status !== "retained").map((player) => player.id),
    purseByTeamId,
    deletesAllBids: true,
    deletesAllIntelligenceEvents: true,
    resetsSessionToIdle: true,
    setsTournamentStatus: "setup",
    preservesRetainedPlayers: true,
    preservesTeams: true,
    preservesSponsors: true,
    preservesNonStatusSettings: true,
  };
}

export function applyPracticeResetToWorld(world: DemoWorld): PracticeResetPlan {
  const plan = planPracticeReset(world.players, world.teams);
  const clear = new Set(plan.clearPlayerIds);
  for (const player of world.players) {
    if (!clear.has(player.id)) continue;
    player.status = "available";
    player.teamId = null;
    player.soldPrice = null;
  }
  for (const team of world.teams) {
    if (plan.purseByTeamId[team.id] != null) team.purseUsed = plan.purseByTeamId[team.id]!;
  }
  world.bids = [];
  world.bidEvents = [];
  world.playerEvents = [];
  world.timerEvents = [];
  world.boosters = world.boosters.map((row) =>
    row.status === "active" ? { ...row, status: "cancelled" } : row,
  );
  if (world.auctionSession) {
    world.auctionSession = {
      ...world.auctionSession,
      status: "idle",
      currentPlayerId: null,
      currentBid: null,
      currentBidTeamId: null,
      timerEndsAt: null,
      deferredPlayerIds: null,
      randomDrawQueue: null,
      soldPlayersCount: 0,
      unsoldPlayersCount: 0,
      lastAction: "Reset complete — ready for live auction",
    };
  }
  if (world.tournament) {
    world.tournament.settings = { ...world.tournament.settings, status: "setup" };
    world.tournament.resetCount += 1;
  }
  return plan;
}

export function emptyDemoWorld(tournament: NonNullable<DemoWorld["tournament"]>): DemoWorld {
  return {
    tournament,
    session: null,
    owned: [],
    players: [],
    teams: [],
    categories: [],
    bids: [],
    bidEvents: [],
    playerEvents: [],
    timerEvents: [],
    ownerSessions: [],
    retentions: [],
    boosters: [],
    auctionSession: null,
    externalTeamRefs: [],
    masterSponsorRefs: [],
    masterSponsors: [],
  };
}
