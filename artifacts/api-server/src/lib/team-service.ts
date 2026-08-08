import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import {
  db,
  playersTable,
  teamConfigurationHistoryTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";
import {
  mapAuctionPlayersToParticipants,
  resolveCompetitionConfiguration,
  type SquadRules,
} from "@workspace/platform-core/competition";
import {
  buildTeamConfigurationHistoryPayload,
  isValidLifecycleTransition,
  lifecycleAfterLock,
  mapAuctionSignalsToMembers,
  mapAuctionTeamToConfiguration,
  mapAuctionTeamToIdentity,
  validateTeam,
  type TeamConfiguration,
  type TeamConfigurationHistoryEntry,
  type TeamConfigurationHistoryPayload,
  type TeamIdentity,
  type TeamLifecycleStatusId,
  type TeamMember,
  type TeamValidationResult,
} from "@workspace/platform-core/team";

function checksumPayload(payload: unknown): string {
  return createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

export async function loadTeamRow(tournamentId: number, teamId: number) {
  const [team] = await db
    .select()
    .from(teamsTable)
    .where(and(eq(teamsTable.tournamentId, tournamentId), eq(teamsTable.id, teamId)))
    .limit(1);
  return team ?? null;
}

export async function listTeamRows(tournamentId: number) {
  return db
    .select()
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId))
    .orderBy(teamsTable.name);
}

export async function loadLatestTeamHistory(
  teamId: number,
): Promise<TeamConfigurationHistoryEntry | null> {
  const [row] = await db
    .select()
    .from(teamConfigurationHistoryTable)
    .where(eq(teamConfigurationHistoryTable.teamId, teamId))
    .orderBy(desc(teamConfigurationHistoryTable.version))
    .limit(1);
  if (!row) return null;
  return {
    teamId: String(row.teamId),
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as TeamConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  };
}

export async function listTeamHistory(teamId: number): Promise<TeamConfigurationHistoryEntry[]> {
  const rows = await db
    .select()
    .from(teamConfigurationHistoryTable)
    .where(eq(teamConfigurationHistoryTable.teamId, teamId))
    .orderBy(desc(teamConfigurationHistoryTable.version));
  return rows.map((row) => ({
    teamId: String(row.teamId),
    tournamentId: row.tournamentId,
    version: row.version,
    payload: row.payloadJson as TeamConfigurationHistoryPayload,
    frozenAt: row.createdAt.toISOString(),
    frozenBy: row.frozenBy,
  }));
}

function toBridgeRow(team: typeof teamsTable.$inferSelect) {
  return {
    id: team.id,
    tournamentId: team.tournamentId,
    name: team.name,
    shortCode: team.shortCode,
    color: team.color,
    secondaryColor: team.secondaryColor,
    logoUrl: team.logoUrl,
    displayName: team.displayName,
    teamTypeId: team.teamTypeId,
    visibility: team.visibility,
    themeJson: team.themeJson,
    lifecycleStatus: team.lifecycleStatus,
    configurationLocked: team.configurationLocked,
    masterTeamId: team.masterTeamId,
    ownerName: team.ownerName,
  };
}

export function buildTeamIdentity(team: typeof teamsTable.$inferSelect): TeamIdentity {
  return mapAuctionTeamToIdentity(toBridgeRow(team));
}

export function buildTeamConfiguration(
  team: typeof teamsTable.$inferSelect,
  planVersion: number | null,
): TeamConfiguration {
  return mapAuctionTeamToConfiguration(toBridgeRow(team), { planVersion });
}

export async function loadTeamMembers(
  tournamentId: number,
  team: typeof teamsTable.$inferSelect,
): Promise<TeamMember[]> {
  const [tournament] = await db
    .select({ sport: tournamentsTable.sport })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  // Never default missing sport to cricket — capability registry treats unknown safely.
  const sportId = (tournament?.sport ?? "").toLowerCase();

  const players = await db
    .select({
      id: playersTable.id,
      name: playersTable.name,
      status: playersTable.status,
      playerTag: playersTable.playerTag,
      playerTagTeamId: playersTable.playerTagTeamId,
      isNonPlayingMember: playersTable.isNonPlayingMember,
      teamId: playersTable.teamId,
    })
    .from(playersTable)
    .where(eq(playersTable.tournamentId, tournamentId));

  const onTeam = players.filter(
    (p) =>
      p.teamId === team.id ||
      (p.playerTagTeamId === team.id && p.playerTag != null),
  );

  const participants = mapAuctionPlayersToParticipants(
    sportId,
    onTeam.map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
    })),
  );
  const byPlayerId = new Map(participants.map((p) => [p.id, p]));

  const signals = onTeam.map((p) => {
    const participantId = `auction-player:${p.id}`;
    const participant = byPlayerId.get(participantId);
    const tags: string[] = [];
    if (p.playerTag && (p.playerTagTeamId == null || p.playerTagTeamId === team.id)) {
      tags.push(p.playerTag);
    }
    return {
      participantId,
      participantKind: participant?.kind ?? ("individual" as const),
      displayName: participant?.displayName ?? p.name,
      tags,
      isNonPlayingMember: p.isNonPlayingMember,
      status: "active" as const,
    };
  });

  return mapAuctionSignalsToMembers(toBridgeRow(team), signals);
}

export async function loadCompetitionSquadRules(
  tournamentId: number,
): Promise<{
  squadRules: SquadRules;
  competitionTypeId: string | null;
  registrationModeId: string | null;
  sportId: string | null;
} | null> {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) return null;
  const configuration = resolveCompetitionConfiguration(tournament);
  return {
    squadRules: configuration.squadRules,
    competitionTypeId: configuration.competitionTypeId,
    registrationModeId: configuration.registrationModeId,
    sportId: tournament.sport ?? null,
  };
}

export async function buildTeamValidation(
  tournamentId: number,
  team: typeof teamsTable.$inferSelect,
): Promise<TeamValidationResult> {
  const history = await loadLatestTeamHistory(team.id);
  const configuration = buildTeamConfiguration(team, history?.version ?? null);
  const members = await loadTeamMembers(tournamentId, team);
  const competition = await loadCompetitionSquadRules(tournamentId);
  return validateTeam(configuration, members, {
    competitionSquadRules: competition?.squadRules,
    competitionTypeId: competition?.competitionTypeId,
    registrationModeId: competition?.registrationModeId,
    sportId: competition?.sportId ?? null,
  });
}

export type LockTeamResult =
  | {
      ok: true;
      history: TeamConfigurationHistoryEntry;
      validation: TeamValidationResult;
      configuration: TeamConfiguration;
    }
  | {
      ok: false;
      status: number;
      error: string;
      validation?: TeamValidationResult;
    };

export async function lockTeamSetup(
  tournamentId: number,
  teamId: number,
  frozenBy: string | null,
): Promise<LockTeamResult> {
  const team = await loadTeamRow(tournamentId, teamId);
  if (!team) return { ok: false, status: 404, error: "Team not found" };

  if (team.configurationLocked) {
    return {
      ok: false,
      status: 409,
      error: "Team Setup is already locked. Re-freeze is not allowed in this epic.",
    };
  }

  const validation = await buildTeamValidation(tournamentId, team);
  if (validation.errorCount > 0) {
    return {
      ok: false,
      status: 400,
      error: "Team Setup has blocking validation errors",
      validation,
    };
  }

  const configuration = buildTeamConfiguration(team, null);
  const frozenAt = new Date().toISOString();
  const payload = buildTeamConfigurationHistoryPayload(configuration, validation, frozenAt);
  const checksum = checksumPayload(payload);
  const nextLifecycle = lifecycleAfterLock(
    (team.lifecycleStatus as "draft") ?? "draft",
  );

  const [inserted] = await db
    .insert(teamConfigurationHistoryTable)
    .values({
      tournamentId,
      teamId,
      version: 1,
      payloadJson: payload as unknown as Record<string, unknown>,
      checksum,
      frozenBy,
    })
    .returning();

  const [updated] = await db
    .update(teamsTable)
    .set({
      configurationLocked: true,
      lifecycleStatus: nextLifecycle,
      updatedAt: new Date(),
    })
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)))
    .returning();

  return {
    ok: true,
    history: {
      teamId: String(teamId),
      tournamentId,
      version: inserted.version,
      payload,
      frozenAt: inserted.createdAt.toISOString(),
      frozenBy: inserted.frozenBy,
    },
    validation,
    configuration: buildTeamConfiguration(updated, inserted.version),
  };
}

export async function patchTeamConfiguration(
  tournamentId: number,
  teamId: number,
  patch: {
    name?: string;
    displayName?: string | null;
    shortName?: string;
    logoUrl?: string | null;
    primaryColor?: string | null;
    secondaryColor?: string | null;
    visibility?: string | null;
    typeId?: string | null;
    status?: string | null;
    theme?: Record<string, unknown> | null;
  },
): Promise<
  | { ok: true; configuration: TeamConfiguration }
  | { ok: false; status: number; error: string }
> {
  const team = await loadTeamRow(tournamentId, teamId);
  if (!team) return { ok: false, status: 404, error: "Team not found" };
  if (team.configurationLocked) {
    return {
      ok: false,
      status: 409,
      error: "Team Setup is locked. Working Configuration cannot be edited.",
    };
  }

  if (patch.status !== undefined && patch.status !== null) {
    const from = (team.lifecycleStatus ?? "draft") as TeamLifecycleStatusId;
    const to = patch.status as TeamLifecycleStatusId;
    if (!isValidLifecycleTransition(from, to)) {
      return {
        ok: false,
        status: 400,
        error: `Invalid lifecycle transition from "${from}" to "${to}".`,
      };
    }
  }

  const [updated] = await db
    .update(teamsTable)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.displayName !== undefined ? { displayName: patch.displayName } : {}),
      ...(patch.shortName !== undefined ? { shortCode: patch.shortName } : {}),
      ...(patch.logoUrl !== undefined ? { logoUrl: patch.logoUrl } : {}),
      ...(patch.primaryColor !== undefined ? { color: patch.primaryColor } : {}),
      ...(patch.secondaryColor !== undefined ? { secondaryColor: patch.secondaryColor } : {}),
      ...(patch.visibility !== undefined ? { visibility: patch.visibility } : {}),
      ...(patch.typeId !== undefined ? { teamTypeId: patch.typeId } : {}),
      ...(patch.status !== undefined ? { lifecycleStatus: patch.status } : {}),
      ...(patch.theme !== undefined ? { themeJson: patch.theme } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(teamsTable.id, teamId), eq(teamsTable.tournamentId, tournamentId)))
    .returning();

  return { ok: true, configuration: buildTeamConfiguration(updated, null) };
}
