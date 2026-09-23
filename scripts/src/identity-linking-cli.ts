#!/usr/bin/env node
/**
 * BIDWAR — PHASE 5D IDENTITY LINKING CLI
 * Controlled, auditable, non-destructive historical identity resolution & backfill.
 *
 * Usage:
 *   pnpm --filter @workspace/scripts run identity:dry-run
 *   pnpm --filter @workspace/scripts run identity:apply
 *   pnpm --filter @workspace/scripts run identity:rollback <runId>
 */

import { pool } from "@workspace/db";
import {
  runIdentityLinkingDryRun,
  applyIdentityLinkingProposal,
  rollbackIdentityLinkingRun,
} from "@workspace/db/identity-linking";

async function main() {
  const args = process.argv.slice(2);
  const isApply = args.includes("--apply");
  const rollbackIndex = args.indexOf("--rollback");
  const rollbackRunId = rollbackIndex !== -1 ? args[rollbackIndex + 1] : null;

  console.log("================================================================");
  console.log("  BIDWAR PHASE 5D — HISTORICAL IDENTITY LINKING & SAFE BACKFILL  ");
  console.log("================================================================\n");

  if (rollbackRunId) {
    console.log(`[ROLLBACK MODE] Rolling back Phase 5D run: ${rollbackRunId}...`);
    const res = await rollbackIdentityLinkingRun(pool, rollbackRunId);
    console.log(`✓ Rollback complete. Deleted ${res.deletedMembers} members and ${res.deletedLinks} links.`);
    console.log("  Legacy tables were untouched.\n");
    await pool.end();
    return;
  }

  if (isApply) {
    console.log("⚠️  APPLY MODE ENABLED — Applying Category A links to canonical tables...");
    const applyRes = await applyIdentityLinkingProposal(pool);
    console.log("\n==================== APPLY RESULTS ====================");
    console.log(`Migration Run ID: ${applyRes.migrationRunId}`);
    console.log(`Members Created: ${applyRes.appliedStats.membersCreated}`);
    console.log(`Roles Created: ${applyRes.appliedStats.rolesCreated}`);
    console.log(`Sport Profiles Created: ${applyRes.appliedStats.sportProfilesCreated}`);
    console.log(`Participations Created: ${applyRes.appliedStats.participationsCreated}`);
    console.log(`Identity Links Created: ${applyRes.appliedStats.linksCreated}`);
    console.log(`Legacy Table Integrity Verified: ${applyRes.legacyTableIntegrityVerified ? "PASSED (100% Intact)" : "FAILED"}`);
    console.log("========================================================\n");
    await pool.end();
    return;
  }

  // DEFAULT: DRY RUN MODE
  console.log("ℹ️  DEFAULT MODE: DRY-RUN (Zero database writes)\n");
  const dryRun = await runIdentityLinkingDryRun(pool);

  console.log("==================== SOURCE RECORDS ANALYZED ====================");
  console.log(`Total Source Records Analyzed: ${dryRun.stats.totalSourceRecords}`);
  for (const [source, s] of Object.entries(dryRun.stats.sources)) {
    console.log(`  - ${source.padEnd(20)}: Total=${s.total}, CatA=${s.categoryA}, CatB=${s.categoryB}, CatC=${s.categoryC}`);
  }
  console.log("=================================================================\n");

  console.log("==================== CONFIDENCE CLASSIFICATION ==================");
  console.log(`Category A (High Confidence — Eligible for Member/Link): ${dryRun.stats.categoryACount}`);
  console.log(`Category B (Review Required — Excluded from Auto-Apply):  ${dryRun.stats.categoryBCount}`);
  console.log(`Category C (Unresolved / Legacy-Only — Untouched):      ${dryRun.stats.categoryCCount}`);
  console.log(`Collisions / Ambiguities Detected:                      ${dryRun.stats.collisionsDetected}`);
  console.log("=================================================================\n");

  console.log("==================== PROPOSED CANONICAL ENTITIES ================");
  console.log(`Proposed New Canonical Members:    ${dryRun.stats.proposedNewMembers}`);
  console.log(`Reused Existing Canonical Members: ${dryRun.stats.reusedExistingMembers}`);
  console.log(`Proposed Member Roles:             ${dryRun.stats.proposedRoles}`);
  console.log(`Proposed Sport Profiles:           ${dryRun.stats.proposedSportProfiles}`);
  console.log(`Proposed Tournament Participations:${dryRun.stats.proposedParticipations}`);
  console.log(`Proposed Identity Links:           ${dryRun.stats.proposedLinks}`);
  console.log("=================================================================\n");

  if (dryRun.collisions.length > 0) {
    console.log("⚠️  COLLISION REPORT (Excluded from Auto-Apply):");
    for (const c of dryRun.collisions) {
      console.log(`  [Key: ${c.key}] Conflict: ${c.conflictType} -> Action: ${c.resolution}`);
      for (const r of c.records) {
        console.log(`     - ${r.sourceTable}:${r.sourceRecordId} (Name: "${r.name}")`);
      }
    }
    console.log();
  }

  console.log("✓ DRY-RUN COMPLETE: 0 database writes executed.");
  console.log("  To apply Category A linkages, execute with --apply flag.\n");

  await pool.end();
}

main().catch((err) => {
  console.error("Fatal error during Phase 5D Identity Linking CLI:", err);
  process.exit(1);
});
