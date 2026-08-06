/**
 * Tournament Stage Helper — sole public API for category tournament stage.
 *
 * P0.3: Architecture consolidation (read/write SSoT).
 * P0.4: Tournament Stage Machine (advanceStage / completeTournament / hooks).
 *
 * Do NOT create StageUtils / StageResolver / StageMapper / TournamentStageHelper2.
 * Future APIs (canPromote, canSchedule, canScore, …) extend this file.
 *
 * Stage ≠ round name. Round names select gate fixtures only.
 */

import { and, asc, eq } from "drizzle-orm";
import {
  initialStageForDrawType,
  isTerminalMatchStatus,
  isTournamentEngineStage,
  resolveCurrentStage,
  type TournamentEngineStage,
} from "@workspace/badminton-core";
import {
  db,
  badmintonCategoriesTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
} from "@workspace/db";

export type DbExecutor = Pick<typeof db, "select" | "insert" | "delete" | "update">;

/** Values stored in badminton_categories.current_stage today. */
export type PersistedTournamentStage = TournamentEngineStage;

/** Generic engine lifecycle (future DB vocabulary). */
export type LifecycleStage = "league" | "elimination" | "completed";

/**
 * Canonical stage DTO for APIs and consumers.
 * Domain: currentStage + lifecycleStage. displayLabel is presentation only.
 */
export type TournamentStageDto = {
  currentStage: PersistedTournamentStage | null;
  lifecycleStage: LifecycleStage | null;
  displayLabel?: string | null;
};

export type StageResolveInput = {
  drawType: string;
  currentStage: string | null;
  phase?: string | null;
};

/** Explicit aliases only — unknown values are rejected (null). */
const STAGE_ALIASES: Record<string, PersistedTournamentStage> = {
  qf: "quarter_final",
  "quarter final": "quarter_final",
  "quarter-final": "quarter_final",
  "quarter-finals": "quarter_final",
  sf: "semi_final",
  "semi final": "semi_final",
  "semi-final": "semi_final",
  "semi-finals": "semi_final",
  finals: "final",
};

const STAGE_DISPLAY_LABELS: Record<PersistedTournamentStage, string> = {
  league: "League",
  quarter_final: "Quarter Final",
  semi_final: "Semi Final",
  final: "Final",
  completed: "Completed",
};

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * Canonicalize a stage input. Accepts persisted literals and explicit aliases.
 * Unknown values → null (never invent mappings).
 */
export function normalizeStage(value: unknown): PersistedTournamentStage | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (isTournamentEngineStage(trimmed)) return trimmed;
  const alias = STAGE_ALIASES[trimmed.toLowerCase()];
  return alias ?? null;
}

/** Map persisted / resolved stage → lifecycle stage for engine decisions. */
export function toLifecycleStage(
  stage: string | null | undefined,
): LifecycleStage | null {
  if (stage == null) return null;
  if (stage === "league") return "league";
  if (stage === "completed") return "completed";
  if (
    stage === "quarter_final" ||
    stage === "semi_final" ||
    stage === "final" ||
    stage === "elimination"
  ) {
    return "elimination";
  }
  return null;
}

// ─── Presentation ────────────────────────────────────────────────────────────

/** Presentation helper only — never use for business decisions. */
export function stageDisplayLabel(
  stage: PersistedTournamentStage | null | undefined,
): string | null {
  if (stage == null) return null;
  return STAGE_DISPLAY_LABELS[stage] ?? null;
}

// ─── Read ────────────────────────────────────────────────────────────────────

/**
 * Standard entry point: resolve stage DTO from already-loaded category fields.
 * Pure — same input always yields the same DTO; does not mutate input.
 */
export function resolveStageDto(row: StageResolveInput): TournamentStageDto {
  const normalizedStored =
    row.currentStage == null ? null : normalizeStage(row.currentStage);

  const currentStage = resolveCurrentStage({
    drawType: row.drawType,
    currentStage: normalizedStored,
    phase: row.phase,
  });

  const lifecycleStage = toLifecycleStage(currentStage);
  return {
    currentStage,
    lifecycleStage,
    displayLabel: stageDisplayLabel(currentStage),
  };
}

/**
 * Load category row fields and resolve stage DTO.
 * Prefer resolveStageDto when the row is already in memory (no extra query).
 */
export async function getTournamentStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
): Promise<TournamentStageDto | null> {
  const [cat] = await executor
    .select({
      drawType: badmintonCategoriesTable.drawType,
      currentStage: badmintonCategoriesTable.currentStage,
      phase: badmintonCategoriesTable.phase,
    })
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!cat) return null;
  return resolveStageDto({
    drawType: cat.drawType,
    currentStage: cat.currentStage,
    phase: cat.phase,
  });
}

/** @deprecated Prefer resolveStageDto().lifecycleStage — kept for existing call sites during P0.3. */
export function resolveLifecycleStage(row: StageResolveInput): LifecycleStage | null {
  return resolveStageDto(row).lifecycleStage;
}

// ─── Predicates ──────────────────────────────────────────────────────────────

function lifecycleOf(
  value:
    | TournamentStageDto
    | Pick<TournamentStageDto, "lifecycleStage">
    | LifecycleStage
    | null
    | undefined,
): LifecycleStage | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  return value.lifecycleStage ?? null;
}

export function isLeague(
  value:
    | TournamentStageDto
    | Pick<TournamentStageDto, "lifecycleStage">
    | LifecycleStage
    | null
    | undefined,
): boolean {
  return lifecycleOf(value) === "league";
}

export function isElimination(
  value:
    | TournamentStageDto
    | Pick<TournamentStageDto, "lifecycleStage">
    | LifecycleStage
    | null
    | undefined,
): boolean {
  return lifecycleOf(value) === "elimination";
}

export function isCompleted(
  value:
    | TournamentStageDto
    | Pick<TournamentStageDto, "lifecycleStage">
    | LifecycleStage
    | null
    | undefined,
): boolean {
  return lifecycleOf(value) === "completed";
}

// ─── Write ───────────────────────────────────────────────────────────────────

/**
 * @deprecated Prefer initialKnockoutStageFromRounds() — kept for skipped/idempotent
 * promotion responses when stage cannot be resolved.
 */
export function promotionPersistedStage(): PersistedTournamentStage {
  return "quarter_final";
}

/** Initial current_stage value for new category inserts — derive only via this helper. */
export function stageColumnForNewCategory(
  drawType: string,
): PersistedTournamentStage | null {
  return initialStageForDrawType(drawType);
}

export function assertPersistedStage(
  value: unknown,
): asserts value is PersistedTournamentStage {
  if (!isTournamentEngineStage(value)) {
    throw new Error(`Invalid persisted tournament stage: ${String(value)}`);
  }
}

/** Sole write path for category.current_stage. */
export async function writeCategoryStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
  stage: PersistedTournamentStage | null,
): Promise<void> {
  if (stage != null) assertPersistedStage(stage);
  await executor
    .update(badmintonCategoriesTable)
    .set({ currentStage: stage, updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    );
}

/**
 * Write knockout entry stage after promotion / generate-draw.
 * Pass stage from initialKnockoutStageFromRounds() — never hardcode.
 */
export async function setPromotionStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
  stage: PersistedTournamentStage,
): Promise<PersistedTournamentStage> {
  assertPersistedStage(stage);
  await writeCategoryStage(executor, tournamentId, categoryId, stage);
  return stage;
}

// ─── Stage machine (P0.4) ────────────────────────────────────────────────────

export const MAX_STAGE_TRANSITIONS = 5;

export type AdvanceStageReason =
  | "ADVANCED"
  | "GATE_INCOMPLETE"
  | "ALREADY_SETTLED"
  | "TOURNAMENT_COMPLETED"
  | "NO_KNOCKOUT"
  | "HAS_PENDING_MATCHES"
  | "NOT_IN_ELIMINATION"
  | "MAX_TRANSITIONS"
  | "CATEGORY_NOT_FOUND";

export type AdvanceStageResult = {
  changed: boolean;
  previousStage: PersistedTournamentStage | null;
  currentStage: PersistedTournamentStage | null;
  lifecycleStage: LifecycleStage | null;
  completed: boolean;
  transitionCount: number;
  reason: AdvanceStageReason;
};

export type StageAdvancedEvent = {
  tournamentId: number;
  categoryId: number;
  previousStage: PersistedTournamentStage | null;
  currentStage: PersistedTournamentStage | null;
};

export type TournamentCompletedEvent = {
  tournamentId: number;
  categoryId: number;
};

/** Preferred gate roundName for each persisted elimination stage. */
const STAGE_GATE_ROUND_NAME: Partial<Record<PersistedTournamentStage, string>> = {
  quarter_final: "Quarter-Finals",
  semi_final: "Semi-Finals",
  final: "Final",
};

const NEXT_STAGE: Partial<
  Record<PersistedTournamentStage, PersistedTournamentStage>
> = {
  quarter_final: "semi_final",
  semi_final: "final",
  final: "completed",
};

const EARLY_KO_ROUND_NAMES = new Set([
  "Round of 16",
  "Round of 32",
  "Round of 64",
]);

/**
 * Map first knockout collection roundName → persisted stage.
 * Ro16+ → quarter_final until expanded vocabulary lands.
 */
export function stageFromKnockoutRoundName(
  roundName: string,
): PersistedTournamentStage {
  if (roundName === "Quarter-Finals") return "quarter_final";
  if (roundName === "Semi-Finals") return "semi_final";
  if (roundName === "Final") return "final";
  if (EARLY_KO_ROUND_NAMES.has(roundName)) return "quarter_final";
  return "quarter_final";
}

/** Dynamic initial stage from planned/created KO rounds (Option D). */
export function initialKnockoutStageFromRounds(
  rounds: Array<{ roundName: string; roundNumber?: number }>,
): PersistedTournamentStage {
  if (rounds.length === 0) return "quarter_final";
  const first = [...rounds].sort(
    (a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0),
  )[0]!;
  return stageFromKnockoutRoundName(first.roundName);
}

/** Lifecycle hook stub — no side effects in P0.4. */
export function onStageAdvanced(_event: StageAdvancedEvent): void {
  // Future: analytics, notifications, broadcast, awards.
}

/** Lifecycle hook stub — no side effects in P0.4. */
export function onTournamentCompleted(_event: TournamentCompletedEvent): void {
  // Future: certificates, awards, broadcast, analytics.
}

export async function completeTournament(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
): Promise<PersistedTournamentStage> {
  await writeCategoryStage(executor, tournamentId, categoryId, "completed");
  onTournamentCompleted({ tournamentId, categoryId });
  return "completed";
}

type KoCollection = {
  id: number;
  roundName: string;
  roundNumber: number | null;
  groupId: number | null;
  metaJson: Record<string, unknown> | null;
};

function isKnockoutCollection(draw: KoCollection): boolean {
  if (draw.groupId != null) return false;
  const meta = draw.metaJson ?? {};
  if (meta.algorithm === "knockout") return true;
  if (
    meta.adapter === "promote_to_knockout" ||
    meta.adapter === "auto_generate"
  ) {
    return true;
  }
  return (
    draw.roundName === "Final" ||
    draw.roundName === "Semi-Finals" ||
    draw.roundName === "Quarter-Finals" ||
    EARLY_KO_ROUND_NAMES.has(draw.roundName)
  );
}

async function loadKnockoutCollections(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
): Promise<KoCollection[]> {
  const rows = await executor
    .select({
      id: badmintonDrawsTable.id,
      roundName: badmintonDrawsTable.roundName,
      roundNumber: badmintonDrawsTable.roundNumber,
      groupId: badmintonDrawsTable.groupId,
      metaJson: badmintonDrawsTable.metaJson,
    })
    .from(badmintonDrawsTable)
    .where(
      and(
        eq(badmintonDrawsTable.tournamentId, tournamentId),
        eq(badmintonDrawsTable.categoryId, categoryId),
      ),
    )
    .orderBy(asc(badmintonDrawsTable.roundNumber));

  return (rows as KoCollection[]).filter(isKnockoutCollection);
}

/**
 * Gate collection for the persisted stage.
 * quarter_final → Quarter-Finals if present (Ro16 alone does not advance);
 * else first KO collection (legacy 4Q stuck on quarter_final).
 */
export function resolveGateCollection(
  stage: PersistedTournamentStage,
  collections: KoCollection[],
): KoCollection | null {
  if (collections.length === 0) return null;
  const preferred = STAGE_GATE_ROUND_NAME[stage];
  if (preferred) {
    const named = collections.find((c) => c.roundName === preferred);
    if (named) return named;
  }
  // Legacy / skip-bracket: no preferred round — use earliest KO collection.
  if (stage === "quarter_final" || stage === "semi_final" || stage === "final") {
    return [...collections].sort(
      (a, b) => (a.roundNumber ?? 0) - (b.roundNumber ?? 0),
    )[0] ?? null;
  }
  return null;
}

function nextPersistedStage(
  stage: PersistedTournamentStage,
): PersistedTournamentStage | null {
  return NEXT_STAGE[stage] ?? null;
}

function resultFromDto(
  previous: PersistedTournamentStage | null,
  dto: TournamentStageDto,
  transitionCount: number,
  reason: AdvanceStageReason,
): AdvanceStageResult {
  return {
    changed: transitionCount > 0,
    previousStage: previous,
    currentStage: dto.currentStage,
    lifecycleStage: dto.lifecycleStage,
    completed: dto.currentStage === "completed",
    transitionCount,
    reason,
  };
}

/**
 * Settle category stage against knockout fixture terminality.
 * Idempotent; may advance multiple times in one call (bye cascades).
 * Prefer calling from match-completion / bye paths — not a public HTTP surface.
 */
export async function advanceStage(
  executor: DbExecutor,
  tournamentId: number,
  categoryId: number,
): Promise<AdvanceStageResult> {
  const [cat] = await executor
    .select({
      drawType: badmintonCategoriesTable.drawType,
      currentStage: badmintonCategoriesTable.currentStage,
      phase: badmintonCategoriesTable.phase,
    })
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);

  if (!cat) {
    return {
      changed: false,
      previousStage: null,
      currentStage: null,
      lifecycleStage: null,
      completed: false,
      transitionCount: 0,
      reason: "CATEGORY_NOT_FOUND",
    };
  }

  const startDto = resolveStageDto({
    drawType: cat.drawType,
    currentStage: cat.currentStage,
    phase: cat.phase,
  });
  const previousStage = startDto.currentStage;

  if (startDto.currentStage === "completed") {
    return resultFromDto(previousStage, startDto, 0, "TOURNAMENT_COMPLETED");
  }

  if (startDto.currentStage === "league" || startDto.currentStage == null) {
    return resultFromDto(previousStage, startDto, 0, "NOT_IN_ELIMINATION");
  }

  const collections = await loadKnockoutCollections(
    executor,
    tournamentId,
    categoryId,
  );
  if (collections.length === 0) {
    return resultFromDto(previousStage, startDto, 0, "NO_KNOCKOUT");
  }

  let workingStage = startDto.currentStage;
  let workingDto = startDto;
  let transitionCount = 0;
  let lastReason: AdvanceStageReason = "ALREADY_SETTLED";

  while (transitionCount < MAX_STAGE_TRANSITIONS) {
    if (workingStage === "completed") {
      lastReason =
        transitionCount > 0 ? "ADVANCED" : "TOURNAMENT_COMPLETED";
      break;
    }

    const gate = resolveGateCollection(workingStage, collections);
    if (!gate) {
      lastReason = transitionCount > 0 ? "ADVANCED" : "NO_KNOCKOUT";
      break;
    }

    const fixtures = await executor
      .select({
        id: badmintonFixturesTable.id,
        status: badmintonFixturesTable.status,
      })
      .from(badmintonFixturesTable)
      .where(
        and(
          eq(badmintonFixturesTable.tournamentId, tournamentId),
          eq(badmintonFixturesTable.categoryId, categoryId),
          eq(badmintonFixturesTable.drawId, gate.id),
        ),
      );

    if (fixtures.length === 0) {
      lastReason = transitionCount > 0 ? "ADVANCED" : "GATE_INCOMPLETE";
      break;
    }

    const pending = fixtures.filter((f) => !isTerminalMatchStatus(f.status));
    if (pending.length > 0) {
      lastReason =
        transitionCount > 0 ? "ADVANCED" : "HAS_PENDING_MATCHES";
      break;
    }

    const next = nextPersistedStage(workingStage);
    if (!next) {
      lastReason = transitionCount > 0 ? "ADVANCED" : "ALREADY_SETTLED";
      break;
    }

    if (next === "completed") {
      await completeTournament(executor, tournamentId, categoryId);
    } else {
      await writeCategoryStage(executor, tournamentId, categoryId, next);
      onStageAdvanced({
        tournamentId,
        categoryId,
        previousStage: workingStage,
        currentStage: next,
      });
    }

    workingStage = next;
    workingDto = resolveStageDto({
      drawType: cat.drawType,
      currentStage: next,
      phase: cat.phase,
    });
    transitionCount += 1;
    lastReason = "ADVANCED";
  }

  if (transitionCount >= MAX_STAGE_TRANSITIONS && lastReason === "ADVANCED") {
    // Cap hit while still potentially able to advance further.
    const gate = resolveGateCollection(workingStage, collections);
    if (gate && workingStage !== "completed") {
      lastReason = "MAX_TRANSITIONS";
    }
  }

  if (transitionCount === 0 && lastReason === "ALREADY_SETTLED") {
    // Gate complete but no next? treat as settled; else incomplete already set.
    const gate = resolveGateCollection(workingStage, collections);
    if (gate) {
      const fixtures = await executor
        .select({ status: badmintonFixturesTable.status })
        .from(badmintonFixturesTable)
        .where(
          and(
            eq(badmintonFixturesTable.tournamentId, tournamentId),
            eq(badmintonFixturesTable.categoryId, categoryId),
            eq(badmintonFixturesTable.drawId, gate.id),
          ),
        );
      if (
        fixtures.length > 0 &&
        fixtures.every((f) => isTerminalMatchStatus(f.status))
      ) {
        lastReason = "ALREADY_SETTLED";
      }
    }
  }

  return resultFromDto(previousStage, workingDto, transitionCount, lastReason);
}
