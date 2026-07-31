/**
 * Seed exact VNBL 3.0 Day-1 league fixtures from the organizer schedule sheet.
 *
 * Prerequisites:
 * - Tournament + Men/Women categories exist
 * - Pair registrations accepted and linked to franchise teams
 * - Male groups saved (Group 1 / Group 2)
 *
 * Usage:
 *   pnpm --filter @workspace/scripts exec tsx --env-file=../.env src/seed-vnbl3-league-fixtures.ts \
 *     --tournament=1 --maleCategory=ID --femaleCategory=ID --day1=2026-08-01 [--apply]
 *
 * Default is dry-run (resolve + report only). Pass --apply to write fixtures.
 */
import { config as loadEnv } from "dotenv";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { and, eq, inArray } from "drizzle-orm";
import {
  db,
  pool,
  badmintonCategoriesTable,
  badmintonDrawsTable,
  badmintonFixturesTable,
  badmintonPlayersTable,
  badmintonRegistrationsTable,
  teamsTable,
  tournamentsTable,
} from "@workspace/db";

loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), "../../.env") });

type SheetMatch = {
  n: number;
  time: string;
  teamA: string;
  pairA: [string, string] | string[];
  teamB: string;
  pairB: [string, string] | string[];
};

type ScheduleFile = {
  male: { matches: SheetMatch[] };
  female: { matches: SheetMatch[] };
};

function parseArgs(argv: string[]) {
  const out: Record<string, string | boolean> = { apply: false };
  for (const arg of argv) {
    if (arg === "--apply") out.apply = true;
    else if (arg.startsWith("--tournament=")) out.tournament = arg.slice("--tournament=".length);
    else if (arg.startsWith("--maleCategory=")) out.maleCategory = arg.slice("--maleCategory=".length);
    else if (arg.startsWith("--femaleCategory="))
      out.femaleCategory = arg.slice("--femaleCategory=".length);
    else if (arg.startsWith("--day1=")) out.day1 = arg.slice("--day1=".length);
  }
  return out;
}

function norm(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameTokens(s: string): string[] {
  return norm(s)
    .split(" ")
    .filter((t) => t.length > 1);
}

function playerScore(needle: string, haystack: string): number {
  const n = norm(needle);
  const h = norm(haystack);
  if (!n || !h) return 0;
  if (h === n) return 100;
  if (h.includes(n) || n.includes(h)) return 80;
  const nt = nameTokens(needle);
  const ht = new Set(nameTokens(haystack));
  if (nt.length === 0) return 0;
  let hit = 0;
  for (const t of nt) if (ht.has(t)) hit += 1;
  return (hit / nt.length) * 60;
}

function pairLabel(a: string, b: string): string {
  return `${a} & ${b}`;
}

function scheduledAtIst(day1: string, hhmm: string): Date {
  // Store as IST wall-clock via fixed +05:30 offset.
  const [h, m] = hhmm.split(":").map((x) => Number.parseInt(x, 10));
  const iso = `${day1}T${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00+05:30`;
  return new Date(iso);
}

async function loadCategoryContext(tournamentId: number, categoryId: number) {
  const [category] = await db
    .select({ id: badmintonCategoriesTable.id, name: badmintonCategoriesTable.name })
    .from(badmintonCategoriesTable)
    .where(
      and(
        eq(badmintonCategoriesTable.id, categoryId),
        eq(badmintonCategoriesTable.tournamentId, tournamentId),
      ),
    )
    .limit(1);
  if (!category) throw new Error(`Category ${categoryId} not found in tournament ${tournamentId}`);

  const regs = await db
    .select()
    .from(badmintonRegistrationsTable)
    .where(
      and(
        eq(badmintonRegistrationsTable.tournamentId, tournamentId),
        eq(badmintonRegistrationsTable.categoryId, categoryId),
        eq(badmintonRegistrationsTable.status, "accepted"),
      ),
    );

  const playerIds = [
    ...new Set(regs.flatMap((r) => [r.player1Id, r.player2Id].filter(Boolean) as number[])),
  ];
  const players =
    playerIds.length > 0
      ? await db
          .select()
          .from(badmintonPlayersTable)
          .where(inArray(badmintonPlayersTable.id, playerIds))
      : [];
  const playerById = new Map(players.map((p) => [p.id, p]));

  const teams = await db
    .select({ id: teamsTable.id, name: teamsTable.name, shortCode: teamsTable.shortCode })
    .from(teamsTable)
    .where(eq(teamsTable.tournamentId, tournamentId));

  return { category, regs, playerById, teams };
}

function resolveTeamId(
  teams: Array<{ id: number; name: string; shortCode: string }>,
  code: string,
): number | null {
  const n = norm(code);
  for (const t of teams) {
    if (norm(t.shortCode) === n) return t.id;
    if (norm(t.name) === n) return t.id;
    if (norm(t.shortCode).includes(n) || norm(t.name).includes(n)) return t.id;
  }
  return null;
}

function resolveRegistrationId(
  ctx: Awaited<ReturnType<typeof loadCategoryContext>>,
  pairNames: string[],
  teamCode: string,
): { id: number | null; detail: string } {
  const teamId = resolveTeamId(ctx.teams, teamCode);
  const [n1, n2] = pairNames;
  let best: { id: number; score: number } | null = null;

  for (const reg of ctx.regs) {
    const p1 = ctx.playerById.get(reg.player1Id);
    const p2 = reg.player2Id != null ? ctx.playerById.get(reg.player2Id) : null;
    const labels = [
      p1?.displayName,
      [p1?.firstName, p1?.lastName].filter(Boolean).join(" "),
      p2?.displayName,
      [p2?.firstName, p2?.lastName].filter(Boolean).join(" "),
    ].filter(Boolean) as string[];

    const scoreAB =
      Math.max(...labels.map((l) => playerScore(n1, l)), 0) +
      Math.max(...labels.map((l) => playerScore(n2, l)), 0);
    const scoreBA =
      Math.max(...labels.map((l) => playerScore(n2, l)), 0) +
      Math.max(...labels.map((l) => playerScore(n1, l)), 0);
    const score = Math.max(scoreAB, scoreBA);

    // Soft team hint via metaJson.teamId when present
    const metaTeam = reg.metaJson && typeof reg.metaJson === "object"
      ? (reg.metaJson as { teamId?: number }).teamId
      : undefined;
    const teamBonus = teamId != null && metaTeam === teamId ? 15 : 0;
    const total = score + teamBonus;

    if (!best || total > best.score) best = { id: reg.id, score: total };
  }

  if (!best || best.score < 70) {
    return {
      id: null,
      detail: `no match for ${teamCode} ${pairLabel(n1, n2)} (best=${best?.score ?? 0})`,
    };
  }
  return { id: best.id, detail: `reg#${best.id} score=${best.score}` };
}

async function seedCategory(opts: {
  tournamentId: number;
  categoryId: number;
  day1: string;
  matches: SheetMatch[];
  collectionName: string;
  apply: boolean;
}) {
  const ctx = await loadCategoryContext(opts.tournamentId, opts.categoryId);
  console.log(`\n=== ${opts.collectionName} (category ${opts.categoryId}: ${ctx.category.name}) ===`);
  console.log(`Accepted registrations: ${ctx.regs.length}`);

  const resolved: Array<{
    match: SheetMatch;
    registrationAId: number | null;
    registrationBId: number | null;
    aDetail: string;
    bDetail: string;
  }> = [];

  for (const match of opts.matches) {
    const a = resolveRegistrationId(ctx, match.pairA, match.teamA);
    const b = resolveRegistrationId(ctx, match.pairB, match.teamB);
    resolved.push({
      match,
      registrationAId: a.id,
      registrationBId: b.id,
      aDetail: a.detail,
      bDetail: b.detail,
    });
    const ok = a.id != null && b.id != null;
    console.log(
      `${ok ? "OK" : "MISS"} #${match.n} ${match.time} ${match.teamA} ${pairLabel(match.pairA[0]!, match.pairA[1]!)} vs ${match.teamB} ${pairLabel(match.pairB[0]!, match.pairB[1]!)}`,
    );
    if (!ok) {
      console.log(`     A: ${a.detail}`);
      console.log(`     B: ${b.detail}`);
    }
  }

  const missing = resolved.filter((r) => r.registrationAId == null || r.registrationBId == null);
  if (missing.length > 0) {
    console.log(`\n${missing.length} match(es) unresolved — fix pair registrations, then re-run.`);
    return { written: 0, unresolved: missing.length };
  }

  if (!opts.apply) {
    console.log(`Dry-run OK — ${resolved.length} fixtures ready. Re-run with --apply to write.`);
    return { written: 0, unresolved: 0 };
  }

  const [collection] = await db
    .insert(badmintonDrawsTable)
    .values({
      tournamentId: opts.tournamentId,
      categoryId: opts.categoryId,
      roundName: opts.collectionName,
      roundNumber: 1,
      drawKind: "imported",
      status: "active",
      metaJson: {
        adapter: "vnbl3_sheet_seed",
        day1: opts.day1,
      },
    })
    .returning();

  const fixtures = await db
    .insert(badmintonFixturesTable)
    .values(
      resolved.map((r) => ({
        tournamentId: opts.tournamentId,
        categoryId: opts.categoryId,
        drawId: collection.id,
        slotNumber: r.match.n,
        registrationAId: r.registrationAId!,
        registrationBId: r.registrationBId!,
        status: "scheduled",
        scheduledAt: scheduledAtIst(opts.day1, r.match.time),
        metaJson: {
          sheetMatchNumber: r.match.n,
          teamA: r.match.teamA,
          teamB: r.match.teamB,
          sheetTime: r.match.time,
        },
      })),
    )
    .returning();

  await db
    .update(badmintonCategoriesTable)
    .set({ phase: "draw_generated", updatedAt: new Date() })
    .where(
      and(
        eq(badmintonCategoriesTable.id, opts.categoryId),
        eq(badmintonCategoriesTable.tournamentId, opts.tournamentId),
      ),
    );

  console.log(`Wrote collection #${collection.id} with ${fixtures.length} fixtures.`);
  return { written: fixtures.length, unresolved: 0 };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const tournamentId = Number.parseInt(String(args.tournament ?? ""), 10);
  const maleCategoryId = Number.parseInt(String(args.maleCategory ?? ""), 10);
  const femaleCategoryId = Number.parseInt(String(args.femaleCategory ?? ""), 10);
  const day1 = String(args.day1 ?? "");
  const apply = Boolean(args.apply);

  if (
    !Number.isFinite(tournamentId) ||
    !Number.isFinite(maleCategoryId) ||
    !Number.isFinite(femaleCategoryId) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day1)
  ) {
    console.error(
      "Usage: seed-vnbl3-league-fixtures.ts --tournament=ID --maleCategory=ID --femaleCategory=ID --day1=YYYY-MM-DD [--apply]",
    );
    process.exit(1);
  }

  const [tournament] = await db
    .select({ id: tournamentsTable.id, name: tournamentsTable.name })
    .from(tournamentsTable)
    .where(eq(tournamentsTable.id, tournamentId))
    .limit(1);
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

  const schedulePath = resolve(
    dirname(fileURLToPath(import.meta.url)),
    "data/vnbl-3-league-schedule.json",
  );
  const schedule = JSON.parse(readFileSync(schedulePath, "utf8")) as ScheduleFile;

  console.log(`Tournament #${tournament.id}: ${tournament.name}`);
  console.log(`Day 1: ${day1} (IST) · mode=${apply ? "APPLY" : "DRY-RUN"}`);

  const male = await seedCategory({
    tournamentId,
    categoryId: maleCategoryId,
    day1,
    matches: schedule.male.matches,
    collectionName: "VNBL 3.0 Male League (Sheet)",
    apply,
  });
  const female = await seedCategory({
    tournamentId,
    categoryId: femaleCategoryId,
    day1,
    matches: schedule.female.matches,
    collectionName: "VNBL 3.0 Female League (Sheet)",
    apply,
  });

  console.log(
    `\nSummary: male written=${male.written} unresolved=${male.unresolved}; female written=${female.written} unresolved=${female.unresolved}`,
  );

  if (male.unresolved + female.unresolved > 0) process.exitCode = 2;
  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
