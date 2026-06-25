/**
 * Shared CLI helpers for Sprint 4 repair scripts.
 */

export type RepairStats = {
  scanned: number;
  repaired: number;
  skipped: number;
  errors: { id: string; message: string }[];
};

export function createRepairStats(): RepairStats {
  return { scanned: 0, repaired: 0, skipped: 0, errors: [] };
}

export function parseRepairArgs(argv: string[] = process.argv): {
  dryRun: boolean;
  apply: boolean;
  tournamentId?: number;
  globalPlayerId?: string;
  json: boolean;
} {
  const dryRun = argv.includes("--dry-run");
  const apply = argv.includes("--apply");
  const json = argv.includes("--json");
  const tournamentArg = argv.find((a) => /^\d+$/.test(a));
  const globalPlayerId = argv.find((a) => a.startsWith("gp_"));

  if (!dryRun && !apply) {
    console.error("Specify --dry-run (preview) or --apply (write changes).");
    process.exit(1);
  }

  return {
    dryRun,
    apply: apply && !dryRun,
    tournamentId: tournamentArg ? parseInt(tournamentArg, 10) : undefined,
    globalPlayerId,
    json,
  };
}

export function printRepairSummary(label: string, stats: RepairStats, json: boolean): void {
  const payload = { label, ...stats };
  if (json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    console.log(`\n── ${label} ──`);
    console.log(`Scanned:  ${stats.scanned}`);
    console.log(`Repaired: ${stats.repaired}`);
    console.log(`Skipped:  ${stats.skipped}`);
    console.log(`Errors:   ${stats.errors.length}`);
    if (stats.errors.length > 0) {
      for (const e of stats.errors.slice(0, 20)) {
        console.error(`  ${e.id}: ${e.message}`);
      }
      if (stats.errors.length > 20) {
        console.error(`  … and ${stats.errors.length -  20} more`);
      }
    }
  }
}

export function exitRepair(stats: RepairStats): never {
  process.exit(stats.errors.length > 0 ? 1 : 0);
}
