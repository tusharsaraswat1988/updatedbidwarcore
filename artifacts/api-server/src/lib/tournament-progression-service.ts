import {
  db,
  scoringDrawsTable,
  scoringEventsTable,
  scoringFixturesTable,
  scoringGroupMembersTable,
  scoringGroupsTable,
  scoringMatchesTable,
  scoringSessionsTable,
  tournamentsTable,
  type ScoringDrawConfigJson,
} from "@workspace/db";
import {
  buildLeagueKnockoutStages,
  makeSlotKey,
  resolveGroupQualifications,
  resolveParticipantSource,
  createInitialCricketState,
  isCricketMatchTerminalState,
  type GroupStandingsMap,
  type ParticipantSource,
  type PlannedFixtureTemplate,
  type TeamStandingComputed,
} from "@workspace/scoring-core";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getScoringStandings, rebuildTournamentStandings } from "./scoring-standings";
import { broadcastScoringState } from "./scoring-broadcast";
import { logger } from "./logger";

export type FixtureFormatJson = {
  stageId?: string;
  stageName?: string;
  bracketRound?: number;
  bracketSlot?: number;
  homeSource?: ParticipantSource;
  awaySource?: ParticipantSource;
  winnerAdvancesToSlot?: "home" | "away";
  winnerAdvancesToFixtureId?: number;
  targetRoundName?: string;
};

/**
 * Generate knockout placeholder fixtures (and optional matches) for a stage progression graph.
 */
export async function createKnockoutStageFixtures(input: {
  tournamentId: number;
  drawId: number;
  fixtures: PlannedFixtureTemplate[];
  rulePresetId?: number | null;
  venueId?: number | null;
  venueName?: string | null;
  createMatches?: boolean;
  oversLimit?: number;
  startFixtureNumber: number;
}) {
  const createdFixtures: Array<typeof scoringFixturesTable.$inferSelect> = [];
  const fixtureByRoundName = new Map<string, number>();

  for (let i = 0; i < input.fixtures.length; i++) {
    const template = input.fixtures[i]!;
    const formatJson: FixtureFormatJson = {
      bracketRound: template.bracketRound,
      bracketSlot: template.bracketSlot,
      homeSource: template.homeSource,
      awaySource: template.awaySource,
      winnerAdvancesToSlot: template.winnerAdvancesToSlot,
      targetRoundName: template.targetRoundName,
    };

    const [fixture] = await db
      .insert(scoringFixturesTable)
      .values({
        tournamentId: input.tournamentId,
        drawId: input.drawId,
        rulePresetId: input.rulePresetId ?? null,
        fixtureNumber: input.startFixtureNumber + i,
        roundName: template.roundName,
        bracketRound: template.bracketRound ?? null,
        bracketSlot: template.bracketSlot ?? null,
        homeTeamId: template.homeSource.type === "direct" ? template.homeSource.teamId : 0,
        awayTeamId: template.awaySource.type === "direct" ? template.awaySource.teamId : 0,
        status: "scheduled",
        venueId: input.venueId ?? null,
        venue: input.venueName ?? null,
        formatJson: formatJson as Record<string, unknown>,
      })
      .returning();

    createdFixtures.push(fixture);
    fixtureByRoundName.set(template.roundName, fixture.id);

    if (input.createMatches) {
      const [match] = await db
        .insert(scoringMatchesTable)
        .values({
          tournamentId: input.tournamentId,
          fixtureId: fixture.id,
          rulePresetId: input.rulePresetId ?? null,
          sportSlug: "cricket",
          homeTeamId: fixture.homeTeamId,
          awayTeamId: fixture.awayTeamId,
          homeSideJson: { teamId: fixture.homeTeamId },
          awaySideJson: { teamId: fixture.awayTeamId },
          rulesJson: { overs: input.oversLimit ?? 20, maxWickets: 10 },
          roundName: template.roundName,
          venueId: input.venueId ?? null,
          venue: input.venueName ?? null,
          status: "scheduled",
        })
        .returning();

      const initialState = createInitialCricketState({
        matchId: match.id,
        tournamentId: input.tournamentId,
        homeTeamId: match.homeTeamId,
        awayTeamId: match.awayTeamId,
        oversLimit: input.oversLimit ?? 20,
        maxWickets: 10,
      });

      await db.insert(scoringSessionsTable).values({
        matchId: match.id,
        tournamentId: input.tournamentId,
        status: "idle",
        stateJson: initialState,
        lastEventSeq: 0,
      });
    }
  }

  // Backfill winnerAdvancesToFixtureId links
  for (const fixture of createdFixtures) {
    const fmt = fixture.formatJson as FixtureFormatJson | null;
    if (fmt?.targetRoundName && fixtureByRoundName.has(fmt.targetRoundName)) {
      const targetFixtureId = fixtureByRoundName.get(fmt.targetRoundName)!;
      fmt.winnerAdvancesToFixtureId = targetFixtureId;
      await db
        .update(scoringFixturesTable)
        .set({ formatJson: fmt as Record<string, unknown> })
        .where(eq(scoringFixturesTable.id, fixture.id));
    }
  }

  return createdFixtures;
}

/**
 * Transactional and idempotent progression solver for tournaments.
 *
 * Called whenever a match finishes:
 * 1. Settle group standings & evaluate group completion.
 * 2. If group stage is complete, resolve qualification rules and populate knockout slots.
 * 3. If a knockout match completed, advance winner to the downstream fixture/match slot.
 * 4. Idempotent and concurrency-safe via database transactions.
 */
export async function advanceTournamentProgression(
  tournamentId: number,
  _triggerMatchId?: number,
): Promise<{
  advancedCount: number;
  qualificationsResolved: boolean;
  winnersAdvanced: number;
}> {
  return await db.transaction(async (tx) => {
    let advancedCount = 0;
    let qualificationsResolved = false;
    let winnersAdvanced = 0;

    // 0. Serialize concurrent progression runs for this tournament at the DB transaction boundary
    await tx
      .select({ id: tournamentsTable.id })
      .from(tournamentsTable)
      .where(eq(tournamentsTable.id, tournamentId))
      .for("update");

    // Load active draws with exclusive lock
    const draws = await tx
      .select()
      .from(scoringDrawsTable)
      .where(eq(scoringDrawsTable.tournamentId, tournamentId))
      .for("update");

    for (const draw of draws) {
      const drawConfig = (draw.configJson ?? {}) as ScoringDrawConfigJson;
      const groups = await tx
        .select()
        .from(scoringGroupsTable)
        .where(eq(scoringGroupsTable.drawId, draw.id))
        .orderBy(asc(scoringGroupsTable.sortOrder));

      // ─── 1. Group Stage → Qualification → Knockout Slot Resolution ───────────
      if (groups.length > 0) {
        // Load all group fixtures with row lock
        const groupFixtures = await tx
          .select()
          .from(scoringFixturesTable)
          .where(
            and(
              eq(scoringFixturesTable.drawId, draw.id),
              sql`${scoringFixturesTable.groupId} IS NOT NULL`,
            ),
          )
          .for("update");

        // Check if every group fixture is completed
        const terminalStatuses = new Set(["completed", "abandoned", "walkover"]);
        const allGroupMatchesCompleted =
          groupFixtures.length > 0 &&
          groupFixtures.every((f) => terminalStatuses.has(f.status));

        if (allGroupMatchesCompleted) {
          // Compute authoritative group standings directly from DB (bypassing in-memory cache)
          const rawStandings = await getScoringStandings(tournamentId, { bypassCache: true });
          const groupStandingsMap: GroupStandingsMap = {};

          for (const g of groups) {
            const groupResult = rawStandings.groups?.find((r) => r.id === g.id || r.name === g.name);
            const computedRows: TeamStandingComputed[] = (groupResult?.rows ?? []).map((r) => ({
              teamId: r.teamId,
              played: r.played,
              won: r.won,
              lost: r.lost,
              tied: r.tied,
              noResult: r.noResult,
              points: r.points,
              netRunRate: r.netRunRate,
              runsScored: Number((r.extrasJson as Record<string, unknown>)?.runsScored ?? 0),
              oversFaced: Number((r.extrasJson as Record<string, unknown>)?.oversFaced ?? 0),
              runsConceded: Number((r.extrasJson as Record<string, unknown>)?.runsConceded ?? 0),
              oversBowled: Number((r.extrasJson as Record<string, unknown>)?.oversBowled ?? 0),
            }));

            groupStandingsMap[g.name] = {
              groupName: g.name,
              groupId: g.id,
              standings: computedRows,
              isComplete: true,
            };
          }

          const qualifiersPerGroup = drawConfig.knockoutTeamsPerGroup ?? 2;
          const qualResult = resolveGroupQualifications(
            groups.map((g) => ({ name: g.name, groupId: g.id })),
            { type: "top_n_per_group", count: qualifiersPerGroup },
            groupStandingsMap,
          );

          if (qualResult.isReady) {
            qualificationsResolved = true;

            // Find all knockout fixtures waiting for group qualifiers with row lock
            const knockoutFixtures = await tx
              .select()
              .from(scoringFixturesTable)
              .where(
                and(
                  eq(scoringFixturesTable.drawId, draw.id),
                  isNull(scoringFixturesTable.groupId),
                ),
              )
              .for("update");

            for (const kf of knockoutFixtures) {
              const fmt = (kf.formatJson ?? {}) as FixtureFormatJson;
              let changed = false;
              let nextHomeId = kf.homeTeamId;
              let nextAwayId = kf.awayTeamId;

              if (fmt.homeSource?.type === "group_rank" && kf.homeTeamId === 0) {
                const homeRes = resolveParticipantSource(fmt.homeSource, qualResult);
                if (homeRes.resolved && homeRes.teamId > 0) {
                  nextHomeId = homeRes.teamId;
                  changed = true;
                }
              }

              if (fmt.awaySource?.type === "group_rank" && kf.awayTeamId === 0) {
                const awayRes = resolveParticipantSource(fmt.awaySource, qualResult);
                if (awayRes.resolved && awayRes.teamId > 0) {
                  nextAwayId = awayRes.teamId;
                  changed = true;
                }
              }

              if (changed) {
                advancedCount++;
                await tx
                  .update(scoringFixturesTable)
                  .set({
                    homeTeamId: nextHomeId,
                    awayTeamId: nextAwayId,
                    updatedAt: new Date(),
                  })
                  .where(eq(scoringFixturesTable.id, kf.id));

                // Also update any attached scoring match
                const [attachedMatch] = await tx
                  .select()
                  .from(scoringMatchesTable)
                  .where(eq(scoringMatchesTable.fixtureId, kf.id))
                  .limit(1);

                if (attachedMatch) {
                  await tx
                    .update(scoringMatchesTable)
                    .set({
                      homeTeamId: nextHomeId,
                      awayTeamId: nextAwayId,
                      homeSideJson: { teamId: nextHomeId },
                      awaySideJson: { teamId: nextAwayId },
                    })
                    .where(eq(scoringMatchesTable.id, attachedMatch.id));

                  // Refresh session initial state if not tossed
                  if (attachedMatch.status === "scheduled") {
                    const newState = createInitialCricketState({
                      matchId: attachedMatch.id,
                      tournamentId,
                      homeTeamId: nextHomeId,
                      awayTeamId: nextAwayId,
                      oversLimit: (attachedMatch.rulesJson as { overs?: number })?.overs ?? 20,
                      maxWickets: (attachedMatch.rulesJson as { maxWickets?: number })?.maxWickets ?? 10,
                    });

                    await tx
                      .update(scoringSessionsTable)
                      .set({ stateJson: newState, updatedAt: new Date() })
                      .where(eq(scoringSessionsTable.matchId, attachedMatch.id));
                  }
                }
              }
            }
          }
        }
      }

      // ─── 2. Knockout Winner Advancement (e.g. Semis → Final) ─────────────────
      const completedKnockoutMatches = await tx
        .select({
          matchId: scoringMatchesTable.id,
          fixtureId: scoringMatchesTable.fixtureId,
          winnerTeamId: scoringMatchesTable.winnerTeamId,
          roundName: scoringMatchesTable.roundName,
          status: scoringMatchesTable.status,
        })
        .from(scoringMatchesTable)
        .where(
          and(
            eq(scoringMatchesTable.tournamentId, tournamentId),
            sql`${scoringMatchesTable.winnerTeamId} IS NOT NULL AND ${scoringMatchesTable.winnerTeamId} > 0`,
          ),
        );

      const matchWinnersByRoundName: Record<string, number> = {};
      const matchWinnersByFixtureId: Record<number, number> = {};

      for (const m of completedKnockoutMatches) {
        if (m.winnerTeamId) {
          if (m.roundName) matchWinnersByRoundName[m.roundName] = m.winnerTeamId;
          if (m.fixtureId) matchWinnersByFixtureId[m.fixtureId] = m.winnerTeamId;
        }
      }

      // Find all target fixtures that require winner advancement with row lock
      const allKnockoutFixtures = await tx
        .select()
        .from(scoringFixturesTable)
        .where(
          and(
            eq(scoringFixturesTable.drawId, draw.id),
            isNull(scoringFixturesTable.groupId),
          ),
        )
        .for("update");

      for (const kf of allKnockoutFixtures) {
        const fmt = (kf.formatJson ?? {}) as FixtureFormatJson;
        let changed = false;
        let nextHomeId = kf.homeTeamId;
        let nextAwayId = kf.awayTeamId;

        // Check home source winner_of
        if (fmt.homeSource?.type === "winner_of" && kf.homeTeamId === 0) {
          const res = resolveParticipantSource(fmt.homeSource, {
            qualifiersBySlotKey: {},
            matchWinnersByRoundName,
            matchWinnersByFixtureId,
          });
          if (res.resolved && res.teamId > 0) {
            nextHomeId = res.teamId;
            changed = true;
          }
        }

        // Check away source winner_of
        if (fmt.awaySource?.type === "winner_of" && kf.awayTeamId === 0) {
          const res = resolveParticipantSource(fmt.awaySource, {
            qualifiersBySlotKey: {},
            matchWinnersByRoundName,
            matchWinnersByFixtureId,
          });
          if (res.resolved && res.teamId > 0) {
            nextAwayId = res.teamId;
            changed = true;
          }
        }

        if (changed) {
          winnersAdvanced++;
          advancedCount++;

          await tx
            .update(scoringFixturesTable)
            .set({
              homeTeamId: nextHomeId,
              awayTeamId: nextAwayId,
              updatedAt: new Date(),
            })
            .where(eq(scoringFixturesTable.id, kf.id));

          const [attachedMatch] = await tx
            .select()
            .from(scoringMatchesTable)
            .where(eq(scoringMatchesTable.fixtureId, kf.id))
            .limit(1);

          if (attachedMatch) {
            await tx
              .update(scoringMatchesTable)
              .set({
                homeTeamId: nextHomeId,
                awayTeamId: nextAwayId,
                homeSideJson: { teamId: nextHomeId },
                awaySideJson: { teamId: nextAwayId },
              })
              .where(eq(scoringMatchesTable.id, attachedMatch.id));

            if (attachedMatch.status === "scheduled") {
              const newState = createInitialCricketState({
                matchId: attachedMatch.id,
                tournamentId,
                homeTeamId: nextHomeId,
                awayTeamId: nextAwayId,
                oversLimit: (attachedMatch.rulesJson as { overs?: number })?.overs ?? 20,
                maxWickets: (attachedMatch.rulesJson as { maxWickets?: number })?.maxWickets ?? 10,
              });

              await tx
                .update(scoringSessionsTable)
                .set({ stateJson: newState, updatedAt: new Date() })
                .where(eq(scoringSessionsTable.matchId, attachedMatch.id));
            }
          }
        }
      }
    }

    return {
      advancedCount,
      qualificationsResolved,
      winnersAdvanced,
    };
  });
}
