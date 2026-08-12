/**
 * Cricket Rules & format — apply locked competition setup onto scoring matches
 * so Runtime Prepare / Match Start can proceed without Mission Control modules.
 */
import { and, eq } from "drizzle-orm";
import { db, scoringDrawsTable, scoringFixturesTable, scoringMatchesTable } from "@workspace/db";
import { loadLatestPlan } from "./competition-service";
import { lockMatchSetup } from "./match-service";
import { prepareRuntimeMatch } from "./runtime-match-service";

const CRICKET_SPORT_SLUG = "cricket" as const;

export type ApplyCricketRulesMatchResult = {
  matchId: number;
  ok: boolean;
  steps: {
    drawsReady: boolean;
    matchLocked: boolean;
    prepared: boolean;
  };
  error?: string;
};

export type ApplyCricketRulesResult =
  | { ok: false; status: number; error: string }
  | {
      ok: true;
      matchResults: ApplyCricketRulesMatchResult[];
      preparedCount: number;
      failedCount: number;
    };

async function markTournamentDrawsReady(tournamentId: number): Promise<void> {
  await db
    .update(scoringDrawsTable)
    .set({
      configurationLocked: true,
      lifecycleStatus: "ready",
      schedulingConfigurationLocked: true,
      schedulingLifecycleStatus: "ready",
      updatedAt: new Date(),
    })
    .where(eq(scoringDrawsTable.tournamentId, tournamentId));
}

/**
 * After Competition Setup is locked: ready draws, lock match config, Runtime Prepare.
 * Best-effort per match — one failure does not roll back others.
 */
export async function applyCricketRulesToMatches(
  tournamentId: number,
  actor: string | null,
): Promise<ApplyCricketRulesResult> {
  const plan = await loadLatestPlan(tournamentId);
  if (!plan) {
    return {
      ok: false,
      status: 409,
      error: "Lock Rules & format (Competition Setup) before applying to matches.",
    };
  }

  await markTournamentDrawsReady(tournamentId);

  const matches = await db
    .select()
    .from(scoringMatchesTable)
    .where(
      and(
        eq(scoringMatchesTable.tournamentId, tournamentId),
        eq(scoringMatchesTable.sportSlug, CRICKET_SPORT_SLUG),
      ),
    );

  const matchResults: ApplyCricketRulesMatchResult[] = [];
  let preparedCount = 0;
  let failedCount = 0;

  for (const match of matches) {
    const steps = { drawsReady: true, matchLocked: false, prepared: false };
    try {
      // Ensure linked draw (if any) is covered even if tournament-wide update raced.
      if (match.fixtureId != null) {
        const [fixture] = await db
          .select({ drawId: scoringFixturesTable.drawId })
          .from(scoringFixturesTable)
          .where(
            and(
              eq(scoringFixturesTable.tournamentId, tournamentId),
              eq(scoringFixturesTable.id, match.fixtureId),
            ),
          )
          .limit(1);
        if (fixture?.drawId) {
          await db
            .update(scoringDrawsTable)
            .set({
              configurationLocked: true,
              lifecycleStatus: "ready",
              schedulingConfigurationLocked: true,
              schedulingLifecycleStatus: "ready",
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(scoringDrawsTable.id, fixture.drawId),
                eq(scoringDrawsTable.tournamentId, tournamentId),
              ),
            );
        }
      }

      if (!match.configurationLocked) {
        const locked = await lockMatchSetup(tournamentId, match.id, actor);
        if (!locked.ok && locked.status !== 409) {
          throw new Error(locked.error || "Could not lock match configuration");
        }
      }
      steps.matchLocked = true;

      const prepared = await prepareRuntimeMatch(tournamentId, match.id, actor);
      if (!prepared.ok) {
        throw new Error(prepared.error || "Runtime Prepare failed");
      }
      steps.prepared = true;
      preparedCount += 1;
      matchResults.push({ matchId: match.id, ok: true, steps });
    } catch (e) {
      failedCount += 1;
      matchResults.push({
        matchId: match.id,
        ok: false,
        steps,
        error: e instanceof Error ? e.message : "Apply failed",
      });
    }
  }

  return { ok: true, matchResults, preparedCount, failedCount };
}
