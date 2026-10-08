import { db } from "@workspace/db";
import {
  scoringDrawsTable,
  scoringFixturesTable,
  scoringGroupMembersTable,
  scoringGroupsTable,
  scoringMatchSquadsTable,
  scoringMatchesTable,
  scoringOfficialsTable,
  scoringSessionsTable,
  scoringVenuesTable,
  tournamentsTable,
  teamsTable,
  scorerAccountsTable,
  type MatchSquadJson,
  type ScoringDrawConfigJson,
  type ScoringDrawFormat,
} from "@workspace/db";
import {
  createInitialCricketState,
  distributeMatchDates,
  generateGroupStageSchedules,
  generateKnockoutSchedule,
  generateRoundRobinSchedule,
  type ScheduledFixture,
} from "@workspace/scoring-core";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { resolveBadmintonSponsorLogos } from "@workspace/sports-badminton";
import { ScoringServiceError } from "./scoring-service";
import { parseLiveStreamUrl } from "./sports-branding";
import {
  cricketFranchiseTeamExists,
  listCricketFranchiseTeams,
} from "./master-sports/cricket-franchise-registry";
import { prepareRuntimeMatch } from "./runtime-match-service";
import { deleteScorerAccountForTournament } from "./scorer-auth";
import { getCricketRulePreset } from "./cricket-rule-presets-service";
import {
  resolveCricketRulePresetSummary,
  type CricketRulePresetSummary,
} from "@workspace/platform-core/competition";

async function ensureScoringTournament(tournamentId: number) {
  const [tournament] = await db
    .select()
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) {
    throw new ScoringServiceError(
      "Tournament not found",
      404,
      "TOURNAMENT_NOT_FOUND",
    );
  }
  if (!tournament.scoringEnabled) {
    throw new ScoringServiceError(
      "Scoring is not enabled",
      403,
      "SCORING_DISABLED",
    );
  }
  if (tournament.sport !== "cricket") {
    throw new ScoringServiceError(
      "Cricket scoring only",
      400,
      "UNSUPPORTED_SPORT",
    );
  }
  return tournament;
}

async function ensureTeamsInTournament(
  tournamentId: number,
  teamIds: number[],
) {
  if (teamIds.length === 0) return;
  const unique = [...new Set(teamIds)];

  const [tournamentTeams, franchiseOk] = await Promise.all([
    db
      .select({ id: teamsTable.id })
      .from(teamsTable)
      .where(
        and(
          eq(teamsTable.tournamentId, tournamentId),
          inArray(teamsTable.id, unique),
        ),
      ),
    Promise.all(unique.map((id) => cricketFranchiseTeamExists(tournamentId, id))),
  ]);

  const validTeamIds = new Set(tournamentTeams.map((t) => t.id));
  unique.forEach((id, idx) => {
    if (franchiseOk[idx]) validTeamIds.add(id);
  });

  const missing = unique.filter((id) => !validTeamIds.has(id));
  if (missing.length > 0) {
    throw new ScoringServiceError(
      "One or more teams not in tournament",
      400,
      "INVALID_TEAM",
    );
  }
}

// ─── Venues ───────────────────────────────────────────────────────────────────

export async function listScoringVenues(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  return db
    .select()
    .from(scoringVenuesTable)
    .where(eq(scoringVenuesTable.tournamentId, tournamentId))
    .orderBy(asc(scoringVenuesTable.sortOrder), asc(scoringVenuesTable.name));
}

export async function createScoringVenue(
  tournamentId: number,
  input: {
    name: string;
    city?: string | null;
    address?: string | null;
    surfaceType?: string | null;
    sortOrder?: number;
  },
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .insert(scoringVenuesTable)
    .values({
      tournamentId,
      name: input.name,
      city: input.city ?? null,
      address: input.address ?? null,
      surfaceType: input.surfaceType ?? null,
      sortOrder: input.sortOrder ?? 0,
    })
    .returning();
  return row;
}

export async function updateScoringVenue(
  tournamentId: number,
  venueId: number,
  patch: Partial<{
    name: string;
    city: string | null;
    address: string | null;
    surfaceType: string | null;
    status: string;
    sortOrder: number;
  }>,
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .update(scoringVenuesTable)
    .set(patch)
    .where(
      and(
        eq(scoringVenuesTable.id, venueId),
        eq(scoringVenuesTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row)
    throw new ScoringServiceError("Venue not found", 404, "VENUE_NOT_FOUND");
  return row;
}

export async function deleteScoringVenue(
  tournamentId: number,
  venueId: number,
) {
  await ensureScoringTournament(tournamentId);
  const [row] = await db
    .delete(scoringVenuesTable)
    .where(
      and(
        eq(scoringVenuesTable.id, venueId),
        eq(scoringVenuesTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  if (!row)
    throw new ScoringServiceError("Venue not found", 404, "VENUE_NOT_FOUND");
  return row;
}

// ─── Officials ────────────────────────────────────────────────────────────────

export async function listScoringOfficials(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  const officials = await db
    .select()
    .from(scoringOfficialsTable)
    .where(eq(scoringOfficialsTable.tournamentId, tournamentId))
    .orderBy(asc(scoringOfficialsTable.name));

  let scorerAccounts: import("./scorer-auth").ScorerAccountAdminRow[] = [];
  try {
    const { listScorerAccountsForTournament } = await import("./scorer-auth");
    scorerAccounts = await listScorerAccountsForTournament(tournamentId);
  } catch {
    scorerAccounts = [];
  }

  const accountByMobile = new Map(scorerAccounts.map((a) => [a.mobile, a]));

  return officials.map((off) => {
    const acc = off.mobile ? accountByMobile.get(off.mobile) : undefined;
    return {
      ...off,
      isActive: acc ? acc.isActive : true,
      lastLoginAt: acc ? acc.lastLoginAt : null,
      loginLocked: acc ? acc.loginLocked : false,
      loginLockoutRemainingSec: acc ? acc.loginLockoutRemainingSec : undefined,
      scorerAccountId: acc ? acc.id : undefined,
    };
  });
}

export async function createScoringOfficial(
  tournamentId: number,
  input: {
    name: string;
    role?: string;
    mobile?: string | null;
    email?: string | null;
    pin?: string | null;
  },
) {
  await ensureScoringTournament(tournamentId);
  const role = input.role ?? "scorer";

  if (input.mobile && input.mobile.trim()) {
    const rawDigits = input.mobile.replace(/\D/g, "").slice(-10);
    if (rawDigits.length >= 10) {
      const existingInTournament = await db
        .select({ id: scoringOfficialsTable.id, mobile: scoringOfficialsTable.mobile })
        .from(scoringOfficialsTable)
        .where(eq(scoringOfficialsTable.tournamentId, tournamentId));

      const isDuplicate = existingInTournament.some((o) => {
        if (!o.mobile) return false;
        return o.mobile.replace(/\D/g, "").slice(-10) === rawDigits;
      });

      if (isDuplicate) {
        throw new ScoringServiceError(
          "An official with this mobile number is already registered in this tournament.",
          409,
          "OFFICIAL_ALREADY_REGISTERED",
        );
      }
    }
  }
  
  if (role === "scorer") {
    if (!input.mobile || !input.pin || input.pin.trim().length < 4) {
      throw new ScoringServiceError(
        "Scorer requires a mobile number and 4-digit PIN",
        400,
        "SCORER_CREDENTIALS_REQUIRED",
      );
    }
    const { createScorerAccountForTournament } = await import("./scorer-auth");
    await createScorerAccountForTournament(tournamentId, {
      name: input.name.trim(),
      mobile: input.mobile.trim(),
      pin: input.pin.trim(),
    });
  }

  const [row] = await db
    .insert(scoringOfficialsTable)
    .values({
      tournamentId,
      name: input.name.trim(),
      role,
      mobile: input.mobile ? input.mobile.trim() : null,
      email: input.email ? input.email.trim() : null,
      pin: input.pin ? input.pin.trim() : null,
    })
    .returning();
  return row;
}

export async function updateScoringOfficial(
  tournamentId: number,
  officialId: number,
  patch: Partial<{
    name: string;
    role: string;
    mobile: string | null;
    email: string | null;
    pin: string | null;
    isActive: boolean;
  }>,
) {
  await ensureScoringTournament(tournamentId);
  const [existing] = await db
    .select()
    .from(scoringOfficialsTable)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ScoringServiceError(
      "Official not found",
      404,
      "OFFICIAL_NOT_FOUND",
    );
  }

  if (patch.mobile !== undefined && patch.mobile && patch.mobile.trim()) {
    const rawDigits = patch.mobile.replace(/\D/g, "").slice(-10);
    if (rawDigits.length >= 10) {
      const existingInTournament = await db
        .select({ id: scoringOfficialsTable.id, mobile: scoringOfficialsTable.mobile })
        .from(scoringOfficialsTable)
        .where(eq(scoringOfficialsTable.tournamentId, tournamentId));

      const isDuplicate = existingInTournament.some((o) => {
        if (o.id === officialId || !o.mobile) return false;
        return o.mobile.replace(/\D/g, "").slice(-10) === rawDigits;
      });

      if (isDuplicate) {
        throw new ScoringServiceError(
          "An official with this mobile number is already registered in this tournament.",
          409,
          "OFFICIAL_ALREADY_REGISTERED",
        );
      }
    }
  }

  const targetRole = patch.role ?? existing.role;
  const targetMobile = patch.mobile !== undefined ? (patch.mobile ? patch.mobile.trim() : null) : existing.mobile;
  const targetName = patch.name !== undefined ? patch.name.trim() : existing.name;

  if (targetRole === "scorer" && targetMobile) {
    try {
      const { createScorerAccountForTournament, removeScorerFromTournament, clearAllScorerLoginLockouts } = await import("./scorer-auth");
      
      // If mobile changed, unassign old mobile
      if (existing.mobile && existing.mobile !== targetMobile) {
        await removeScorerFromTournament(tournamentId, existing.mobile);
      }

      const effectivePin =
        patch.pin && patch.pin.trim().length >= 4
          ? patch.pin.trim()
          : existing.pin && existing.pin.trim().length >= 4
            ? existing.pin.trim()
            : null;

      if (effectivePin) {
        await createScorerAccountForTournament(tournamentId, {
          name: targetName,
          mobile: targetMobile,
          pin: effectivePin,
        });
      } else {
        clearAllScorerLoginLockouts(targetMobile);
      }
    } catch {
      // non-fatal
    }
  }

  const updateData: Record<string, unknown> = {};
  if (patch.name !== undefined) updateData.name = patch.name.trim();
  if (patch.role !== undefined) updateData.role = patch.role;
  if (patch.mobile !== undefined) updateData.mobile = patch.mobile ? patch.mobile.trim() : null;
  if (patch.email !== undefined) updateData.email = patch.email ? patch.email.trim() : null;
  if (patch.pin !== undefined) updateData.pin = patch.pin ? patch.pin.trim() : null;

  const [row] = await db
    .update(scoringOfficialsTable)
    .set(updateData)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .returning();
  return row;
}


async function resolveScorerAccountIdByMobile(mobile: string): Promise<number> {
  const [account] = await db
    .select({ id: scorerAccountsTable.id })
    .from(scorerAccountsTable)
    .where(eq(scorerAccountsTable.mobile, mobile.trim()))
    .limit(1);
  if (!account) throw new ScoringServiceError("Scorer account not found", 404, "SCORER_ACCOUNT_NOT_FOUND");
  return account.id;
}

export async function deleteScoringOfficial(
  tournamentId: number,
  officialId: number,
) {
  await ensureScoringTournament(tournamentId);

  const [existing] = await db
    .select()
    .from(scoringOfficialsTable)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new ScoringServiceError(
      "Official not found",
      404,
      "OFFICIAL_NOT_FOUND",
    );
  }

  // If this official was a scorer, revoke active sessions, release locks, and unassign from tournament
  if (existing.role === "scorer" && existing.mobile) {
    try {
      const { removeScorerFromTournament } = await import("./scorer-auth");
      await removeScorerFromTournament(tournamentId, existing.mobile);
    } catch {
      // non-fatal
    }
  }

  const [row] = await db
    .delete(scoringOfficialsTable)
    .where(
      and(
        eq(scoringOfficialsTable.id, officialId),
        eq(scoringOfficialsTable.tournamentId, tournamentId),
      ),
    )
    .returning();

  return row;
}

// ─── Draws & schedule generation ──────────────────────────────────────────────

function buildFixturesForFormat(
  format: ScoringDrawFormat,
  config: ScoringDrawConfigJson,
): ScheduledFixture[] {
  const teamIds = config.teamIds ?? [];
  if (teamIds.length < 2) {
    throw new ScoringServiceError(
      "At least 2 teams required",
      400,
      "INVALID_TEAMS",
    );
  }

  switch (format) {
    case "round_robin":
    case "league":
      return generateRoundRobinSchedule(teamIds);
    case "knockout":
      return generateKnockoutSchedule(teamIds);
    case "league_knockout": {
      const groups = config.groups;
      if (!groups?.length) {
        throw new ScoringServiceError(
          "groups required for league_knockout",
          400,
          "INVALID_GROUPS",
        );
      }
      return generateGroupStageSchedules(groups);
    }
    default:
      throw new ScoringServiceError(
        `Unknown format: ${format}`,
        400,
        "INVALID_FORMAT",
      );
  }
}

export async function listScoringDraws(tournamentId: number) {
  await ensureScoringTournament(tournamentId);
  return db
    .select()
    .from(scoringDrawsTable)
    .where(eq(scoringDrawsTable.tournamentId, tournamentId))
    .orderBy(desc(scoringDrawsTable.createdAt));
}

export async function generateScoringDraw(input: {
  tournamentId: number;
  name: string;
  format: ScoringDrawFormat;
  teamIds: number[];
  groups?: Array<{ name: string; teamIds: number[] }>;
  rulePresetId?: number | null;
  oversLimit?: number;
  venueId?: number | null;
  startDate?: string | null;
  matchesPerDay?: number;
  createMatches?: boolean;
  officials?: { scorers?: number[]; matchReferee?: number | null };
}) {
  await ensureScoringTournament(input.tournamentId);
  await ensureTeamsInTournament(input.tournamentId, input.teamIds);

  let presetSummary: CricketRulePresetSummary | null = null;
  if (input.rulePresetId != null) {
    const preset = await getCricketRulePreset(input.tournamentId, input.rulePresetId);
    if (!preset) {
      throw new ScoringServiceError(
        "Rule Preset not found or does not belong to this tournament",
        400,
        "INVALID_RULE_PRESET",
      );
    }
    presetSummary = resolveCricketRulePresetSummary(preset);
  }

  const effectiveOvers = input.oversLimit ?? presetSummary?.overs ?? 20;
  const effectiveWickets = presetSummary?.wickets ?? 10;

  const config: ScoringDrawConfigJson = {
    // Non-authoritative draw default — Runtime Prepare overwrites match rulesJson.
    oversLimit: effectiveOvers,
    teamIds: input.teamIds,
    groups: input.groups,
  };

  const rawFixtures = buildFixturesForFormat(input.format, config);
  const scheduled =
    input.startDate != null
      ? distributeMatchDates(
          rawFixtures,
          input.startDate,
          input.matchesPerDay ?? 2,
        )
      : rawFixtures.map((f) => ({
          ...f,
          scheduledAt: undefined as string | undefined,
        }));

  const [draw] = await db
    .insert(scoringDrawsTable)
    .values({
      tournamentId: input.tournamentId,
      name: input.name,
      format: input.format,
      configJson: config,
      status: "published",
    })
    .returning();

  const groupIdByName = new Map<string, number>();
  const groupNameCounts = new Map<string, number>();
  for (const group of input.groups ?? []) {
    groupNameCounts.set(group.name, (groupNameCounts.get(group.name) ?? 0) + 1);
  }
  if (input.format === "league_knockout" && input.groups?.length) {
    for (let i = 0; i < input.groups.length; i++) {
      const g = input.groups[i]!;
      const [groupRow] = await db
        .insert(scoringGroupsTable)
        .values({
          tournamentId: input.tournamentId,
          drawId: draw.id,
          name: g.name,
          sortOrder: i,
        })
        .returning();
      if ((groupNameCounts.get(g.name) ?? 0) === 1) {
        groupIdByName.set(g.name, groupRow.id);
      }
      for (let s = 0; s < g.teamIds.length; s++) {
        await db.insert(scoringGroupMembersTable).values({
          groupId: groupRow.id,
          teamId: g.teamIds[s]!,
          seed: s + 1,
        });
      }
    }
  }

  let venueName: string | null = null;
  if (input.venueId) {
    const [venue] = await db
      .select()
      .from(scoringVenuesTable)
      .where(
        and(
          eq(scoringVenuesTable.id, input.venueId),
          eq(scoringVenuesTable.tournamentId, input.tournamentId),
        ),
      )
      .limit(1);
    venueName = venue?.name ?? null;
  }

  const fixtureRows = [];
  for (let i = 0; i < scheduled.length; i++) {
    const f = scheduled[i]!;
    const effectiveRoundName =
      input.name && f.roundName && !f.roundName.toLowerCase().startsWith(input.name.toLowerCase())
        ? `${input.name} · ${f.roundName}`
        : f.roundName;

    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: input.tournamentId,
        drawId: draw.id,
        rulePresetId: input.rulePresetId ?? null,
        groupId: f.groupName ? (groupIdByName.get(f.groupName) ?? null) : null,
        bracketRound: f.bracketRound ?? null,
        bracketSlot: f.bracketSlot ?? null,
        fixtureNumber: i + 1,
        roundName: effectiveRoundName,
        scheduledAt: f.scheduledAt ? new Date(f.scheduledAt) : null,
        venueId: input.venueId ?? null,
        venue: venueName,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        status: "scheduled",
      })
      .returning();
    fixtureRows.push(fixture);

    if (input.createMatches) {
      const [match] = await db
        .insert(scoringMatchesTable)
        .values({
          tournamentId: input.tournamentId,
          fixtureId: fixture.id,
          rulePresetId: input.rulePresetId ?? null,
          sportSlug: "cricket",
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          homeSideJson: { teamId: f.homeTeamId },
          awaySideJson: { teamId: f.awayTeamId },
          // Placeholder only — Runtime Prepare replaces via RuntimeExecutionPolicy.
          rulesJson: { overs: effectiveOvers, maxWickets: effectiveWickets },
          roundName: effectiveRoundName,
          scheduledAt: f.scheduledAt ? new Date(f.scheduledAt) : null,
          venueId: input.venueId ?? null,
          venue: venueName,
          officialsJson: input.officials ?? null,
          status: "scheduled",
        })
        .returning();

      const initialState = createInitialCricketState({
        matchId: match.id,
        tournamentId: input.tournamentId,
        homeTeamId: f.homeTeamId,
        awayTeamId: f.awayTeamId,
        oversLimit: effectiveOvers,
        maxWickets: effectiveWickets,
      });

      await db.insert(scoringSessionsTable).values({
        matchId: match.id,
        tournamentId: input.tournamentId,
        status: "idle",
        stateJson: initialState,
        lastEventSeq: 0,
      });

      // Best-effort: freeze tournament rules at create so Match Start isn't blocked.
      await prepareRuntimeMatch(input.tournamentId, match.id, null);
    }
  }

  if (input.format === "league_knockout" && input.groups?.length) {
    const { buildLeagueKnockoutStages } = await import("@workspace/scoring-core");
    const { createKnockoutStageFixtures } = await import("./tournament-progression-service");

    const progressionConfig = buildLeagueKnockoutStages(input.groups, {
      qualifiersPerGroup: config.knockoutTeamsPerGroup,
    });

    const knockoutStages = progressionConfig.stages.filter((s) => s.type === "knockout");
    const knockoutFixturesToCreate = knockoutStages.flatMap((s) => s.fixtures ?? []);

    if (knockoutFixturesToCreate.length > 0) {
      const createdKnockout = await createKnockoutStageFixtures({
        tournamentId: input.tournamentId,
        drawId: draw.id,
        fixtures: knockoutFixturesToCreate,
        rulePresetId: input.rulePresetId ?? null,
        venueId: input.venueId ?? null,
        venueName,
        createMatches: input.createMatches,
        oversLimit: config.oversLimit ?? 20,
        startFixtureNumber: fixtureRows.length + 1,
        groupIdByName,
      });

      fixtureRows.push(...createdKnockout);
    }
  }

  return { draw, fixtures: fixtureRows, fixtureCount: fixtureRows.length };
}

// ─── Fixtures (list) ──────────────────────────────────────────────────────────

export async function listScoringFixtures(
  tournamentId: number,
  drawId?: number,
) {
  await ensureScoringTournament(tournamentId);
  const conditions = [eq(scoringFixturesTable.tournamentId, tournamentId)];
  if (drawId != null) {
    conditions.push(eq(scoringFixturesTable.drawId, drawId));
  }
  return db
    .select()
    .from(scoringFixturesTable)
    .where(and(...conditions))
    .orderBy(
      asc(scoringFixturesTable.fixtureNumber),
      asc(scoringFixturesTable.id),
    );
}

export async function listScoringGroups(tournamentId: number, drawId: number) {
  await ensureScoringTournament(tournamentId);
  const groups = await db
    .select()
    .from(scoringGroupsTable)
    .where(
      and(
        eq(scoringGroupsTable.tournamentId, tournamentId),
        eq(scoringGroupsTable.drawId, drawId),
      ),
    )
    .orderBy(asc(scoringGroupsTable.sortOrder));

  const result = [];
  for (const group of groups) {
    const members = await db
      .select()
      .from(scoringGroupMembersTable)
      .where(eq(scoringGroupMembersTable.groupId, group.id))
      .orderBy(asc(scoringGroupMembersTable.seed));
    result.push({ ...group, members });
  }
  return result;
}

// ─── Match squads ─────────────────────────────────────────────────────────────

export async function getMatchSquads(tournamentId: number, matchId: number) {
  await ensureScoringTournament(tournamentId);
  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (!match)
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");

  const squads = await db
    .select()
    .from(scoringMatchSquadsTable)
    .where(eq(scoringMatchSquadsTable.matchId, matchId));

  return { match, squads };
}

export async function setMatchSquad(
  tournamentId: number,
  matchId: number,
  teamId: number,
  squad: MatchSquadJson,
) {
  await ensureScoringTournament(tournamentId);
  await ensureTeamsInTournament(tournamentId, [teamId]);

  const [match] = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.id, matchId),
        eq(scoringMatchesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (!match)
    throw new ScoringServiceError("Match not found", 404, "MATCH_NOT_FOUND");
  if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
    throw new ScoringServiceError(
      "Team not in this match",
      400,
      "INVALID_TEAM",
    );
  }
  const rules = (match.rulesJson ?? {}) as {
    playingSquadSize?: number;
    benchSize?: number;
    playingXiEnforced?: boolean;
    source?: string;
  };
  const fromPolicy = rules.source === "runtime_execution_policy";
  if (fromPolicy) {
    if (
      typeof rules.playingSquadSize !== "number" ||
      typeof rules.benchSize !== "number"
    ) {
      throw new ScoringServiceError(
        "Match squad requires playingSquadSize/benchSize from RuntimeExecutionPolicy.",
        409,
        "RUNTIME_EXECUTION_POLICY_REQUIRED",
      );
    }
  }
  const maxXi =
    typeof rules.playingSquadSize === "number" ? rules.playingSquadSize : null;
  const maxBench = typeof rules.benchSize === "number" ? rules.benchSize : null;
  const exactXiRequired = rules.playingXiEnforced === true;
  if (
    maxXi == null ||
    (exactXiRequired
      ? squad.playingXi.length !== maxXi
      : squad.playingXi.length < 1 || squad.playingXi.length > maxXi)
  ) {
    throw new ScoringServiceError(
      maxXi == null
        ? "Playing XI size requires Runtime Prepare (RuntimeExecutionPolicy playingSquadSize)."
        : exactXiRequired
          ? `Playing XI must have exactly ${maxXi} players (RuntimeExecutionPolicy playingSquadSize)`
          : `Playing XI must have 1–${maxXi} players (RuntimeExecutionPolicy playingSquadSize)`,
      maxXi == null ? 409 : 400,
      maxXi == null ? "RUNTIME_EXECUTION_POLICY_REQUIRED" : "INVALID_XI",
    );
  }
  if (maxBench == null || squad.bench.length > maxBench) {
    throw new ScoringServiceError(
      maxBench == null
        ? "Bench size requires Runtime Prepare (RuntimeExecutionPolicy benchSize)."
        : `Bench cannot exceed ${maxBench} (RuntimeExecutionPolicy benchSize)`,
      maxBench == null ? 409 : 400,
      maxBench == null ? "RUNTIME_EXECUTION_POLICY_REQUIRED" : "INVALID_BENCH",
    );
  }

  const [existing] = await db
    .select()
    .from(scoringMatchSquadsTable)
    .where(
      and(
        eq(scoringMatchSquadsTable.matchId, matchId),
        eq(scoringMatchSquadsTable.teamId, teamId),
      ),
    )
    .limit(1);

  if (existing) {
    const [row] = await db
      .update(scoringMatchSquadsTable)
      .set({ squadJson: squad })
      .where(eq(scoringMatchSquadsTable.id, existing.id))
      .returning();
    return row;
  }

  const [row] = await db
    .insert(scoringMatchSquadsTable)
    .values({ matchId, teamId, squadJson: squad })
    .returning();
  return row;
}

/** Public fixture + match list for tournament pages (no auth). */
export async function getPublicTournamentSchedule(tournamentId: number) {
  const [tournament] = await db
    .select({
      id: tournamentsTable.id,
      name: tournamentsTable.name,
      sport: tournamentsTable.sport,
      scoringEnabled: tournamentsTable.scoringEnabled,
      status: tournamentsTable.status,
      scoringPhase: tournamentsTable.scoringPhase,
      venue: tournamentsTable.venue,
      city: tournamentsTable.city,
      logoUrl: tournamentsTable.logoUrl,
      matchDates: tournamentsTable.matchDates,
      sponsorLogos: tournamentsTable.sponsorLogos,
      scoringSettingsJson: tournamentsTable.scoringSettingsJson,
      mainBannerUrl: tournamentsTable.mainBannerUrl,
      mainBannerEnabled: tournamentsTable.mainBannerEnabled,
      variantId: tournamentsTable.variantId,
      presentationProfileId: tournamentsTable.presentationProfileId,
    })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);

  if (!tournament?.scoringEnabled || tournament.sport !== "cricket") {
    throw new ScoringServiceError(
      "Scoring not available",
      404,
      "SCORING_NOT_AVAILABLE",
    );
  }

  const scoringSettings = (tournament.scoringSettingsJson ?? {}) as Record<string, unknown>;
  const brandingRaw = (scoringSettings.branding ?? {}) as Record<string, unknown>;
  const broadcastRaw = (scoringSettings.broadcast ?? {}) as Record<string, unknown>;
  const liveStreamUrl = parseLiveStreamUrl(broadcastRaw.liveStreamUrl);
  const { scoringSettingsJson: _scoringSettingsJson, ...publicTournament } = tournament;
  const resolvedTournament = {
    ...publicTournament,
    sponsorLogos: resolveBadmintonSponsorLogos(brandingRaw, tournament.sponsorLogos),
    streamUrl: liveStreamUrl,
    liveStreamUrl,
  };

  const franchiseTeams = await listCricketFranchiseTeams(tournamentId);
  const teams = franchiseTeams.map((t) => ({
    id: t.teamId,
    name: t.name,
    shortCode: t.shortCode,
    color: t.color,
    logoUrl: t.logoUrl,
    squadCount: t.squadCount,
  }));

  const fixtures = await listScoringFixtures(tournamentId);
  const matches = await db
    .select()
    .from(scoringMatchesTable)
    .where(eq(scoringMatchesTable.tournamentId, tournamentId))
    .orderBy(asc(scoringMatchesTable.scheduledAt), asc(scoringMatchesTable.id));

  const draws = await db
    .select()
    .from(scoringDrawsTable)
    .where(eq(scoringDrawsTable.tournamentId, tournamentId));

  return { tournament: resolvedTournament, teams, fixtures, matches, draws };
}
