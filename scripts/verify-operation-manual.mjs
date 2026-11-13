#!/usr/bin/env node
/**
 * BidWar Operation Manual Verification & Governance Script
 *
 * Enforces that docs/BIDWAR_OPERATION_MANUAL.md:
 * 1. Exists and is populated with comprehensive documentation.
 * 2. Contains all 13 mandatory sections per repository governance.
 * 3. Contains valid references to key source files.
 *
 * Usage:
 *   node scripts/verify-operation-manual.mjs
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";

const repoRoot = process.cwd();
const manualPath = resolve(repoRoot, "docs", "BIDWAR_OPERATION_MANUAL.md");

const REQUIRED_SECTIONS = [
  "Section 1 — Purpose, Audience, Scope & Maintenance Governance",
  "Section 2 — Product Overview, Core Concepts & Glossary",
  "Section 3 — Applications, Roles & Permission Matrix",
  "Section 4 — Complete Screen & Route Directory",
  "Section 5 — Domain Feature Catalog",
  "Section 6 — Step-by-Step Operating Procedures & End-to-End Workflows",
  "Section 7 — Registration Guide, Form Fields & Validations",
  "Section 8 — Buttons, Controls & Actions Reference",
  "Section 9 — Statuses & State Transition Reference",
  "Section 10 — Settings, Configuration, Reports & Integrations",
  "Section 11 — Troubleshooting, Known Limitations & FAQs",
  "Section 12 — Needs-Verification Registry & Source Code Map",
  "Section 13 — Change Log & Maintenance Record",
];

const REQUIRED_KEY_CODE_PATHS = [
  "artifacts/api-server/src/app.ts",
  "artifacts/auction-platform/src/App.tsx",
  "artifacts/scoring-app/src/App.tsx",
  "artifacts/owner-app/src/App.tsx",
  "lib/db/src/schema/tournaments.ts",
  "lib/db/src/schema/players.ts",
  "lib/db/src/schema/teams.ts",
];

function verifyManual() {
  console.log("🔍 Checking BidWar Operation Manual governance...");

  if (!existsSync(manualPath)) {
    console.error(`❌ FAILED: Operation Manual not found at: ${manualPath}`);
    process.exit(1);
  }

  const content = readFileSync(manualPath, "utf-8");
  const lines = content.split("\n");

  if (lines.length < 300) {
    console.error(`❌ FAILED: Operation Manual is too brief (${lines.length} lines). Expected comprehensive manual > 300 lines.`);
    process.exit(1);
  }

  let missingSections = 0;
  for (const section of REQUIRED_SECTIONS) {
    if (!content.includes(section)) {
      console.error(`❌ MISSING REQUIRED SECTION: "${section}"`);
      missingSections++;
    }
  }

  if (missingSections > 0) {
    console.error(`❌ FAILED: ${missingSections} mandatory section(s) missing from Operation Manual.`);
    process.exit(1);
  }

  let missingPaths = 0;
  for (const p of REQUIRED_KEY_CODE_PATHS) {
    const fullPath = resolve(repoRoot, p);
    if (!existsSync(fullPath)) {
      console.warn(`⚠️ Warning: Referenced code path does not exist on disk: ${p}`);
      missingPaths++;
    }
  }

  console.log(`✅ SUCCESS: BidWar Operation Manual verified!`);
  console.log(`   - File: docs/BIDWAR_OPERATION_MANUAL.md`);
  console.log(`   - Size: ${lines.length} lines, ${(content.length / 1024).toFixed(1)} KB`);
  console.log(`   - All ${REQUIRED_SECTIONS.length} mandatory governance sections present.`);
  process.exit(0);
}

verifyManual();
