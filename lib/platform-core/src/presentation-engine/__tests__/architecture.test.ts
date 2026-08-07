import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import * as publicApi from "../index.ts";

const ROOT = join(import.meta.dirname, "../../../../..");
const ENGINE_DIR = join(ROOT, "lib/platform-core/src/presentation-engine");

function walkTsFiles(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name === "dist" || name === ".git") continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkTsFiles(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".tsx")) out.push(full);
  }
  return out;
}

function engineSources(): string[] {
  return walkTsFiles(ENGINE_DIR).filter((f) => !f.includes("__tests__"));
}

describe("Presentation Engine architecture compliance", () => {
  it("package boundaries: must not import auction-platform / api-server / renderer packages", () => {
    const forbidden = [
      "auction-platform",
      "api-server",
      "@workspace/auction",
      "artifacts/auction-platform",
      "artifacts/api-server",
      "obs-overlay",
      "led-display",
      "scoreboard",
    ];
    for (const file of engineSources()) {
      const src = readFileSync(file, "utf8");
      for (const needle of forbidden) {
        expect(src.includes(needle), `${file} must not reference ${needle}`).toBe(false);
      }
    }
  });

  it("only Prepare / Match Start / HTTP façade may import presentation-engine (EPIC-12 Phase 1)", () => {
    const roots = [
      join(ROOT, "artifacts/auction-platform/src"),
      join(ROOT, "artifacts/api-server/src"),
    ];
    const allow = (file: string) =>
      file.includes(`${join("routes", "presentation-engine")}`) ||
      file.includes(`${join("routes", "index.ts")}`) ||
      file.includes(`${join("routes", "runtime-match-foundation")}`) ||
      file.includes(`${join("lib", "runtime-match-service")}`) ||
      file.includes(`${join("lib", "scoring-service")}`) ||
      file.includes(`${join("lib", "__tests__", "presentation-engine")}`) ||
      file.includes(`${join("lib", "__tests__", "epic-12")}`);
    for (const root of roots) {
      for (const file of walkTsFiles(root)) {
        if (allow(file)) continue;
        const src = readFileSync(file, "utf8");
        expect(
          src.includes("@workspace/platform-core/presentation-engine") ||
            /from\s+["'].*presentation-engine/.test(src),
          `renderer/cutover violation: ${file} must not import Presentation Engine (consume paint DTO only)`,
        ).toBe(false);
      }
    }
  });

  it("no stage exported publicly", () => {
    const exported = Object.keys(publicApi);
    expect(exported).not.toContain("runPresentationPipeline");
    expect(exported.some((k) => /stage/i.test(k))).toBe(false);
    const indexSrc = readFileSync(join(ENGINE_DIR, "index.ts"), "utf8");
    expect(indexSrc).not.toMatch(/from\s+["']\.\/pipeline/);
    expect(indexSrc).not.toMatch(/from\s+["']\.\/stages/);
  });

  it("no resolveLatest / resolveFromDatabase", () => {
    for (const file of engineSources()) {
      const src = readFileSync(file, "utf8");
      expect(src).not.toMatch(/resolveLatest/);
      expect(src).not.toMatch(/resolveFromDatabase/);
    }
    expect(Object.keys(publicApi)).not.toContain("resolveLatest");
    expect(Object.keys(publicApi)).not.toContain("resolveFromDatabase");
  });

  it("no DB access inside engine", () => {
    const dbPatterns = [
      /from\s+["']pg["']/,
      /drizzle-orm/,
      /@prisma/,
      /getPool\s*\(/,
      /sql`/,
      /CREATE TABLE/,
      /resolveFromDatabase/,
      /fromDatabase/,
    ];
    for (const file of engineSources()) {
      const src = readFileSync(file, "utf8");
      for (const pattern of dbPatterns) {
        expect(pattern.test(src), `${file} DB leakage: ${pattern}`).toBe(false);
      }
    }
  });

  it("no renderer DTOs / pixel-CSS leakage in public contract types", () => {
    const typesSrc = readFileSync(join(ENGINE_DIR, "types.ts"), "utf8");
    for (const needle of [
      "ReactNode",
      "CSSProperties",
      "className",
      "hexColor",
      "pixel",
      "WidgetTree",
      "jsx",
    ]) {
      expect(typesSrc.toLowerCase()).not.toContain(needle.toLowerCase());
    }
  });

  it("no consumer-specific branches (OBS/LED/Broadcast) in engine computation", () => {
    for (const file of engineSources()) {
      const src = readFileSync(file, "utf8");
      // Forbid hard-coded consumer-name branching (word-boundary; avoid matching "enabled")
      expect(src).not.toMatch(/\bif\s*\([^)]*\bobs\b/i);
      expect(src).not.toMatch(/\bif\s*\([^)]*\bled\b/i);
      expect(src).not.toMatch(/\bif\s*\([^)]*\bbroadcast\b/i);
      expect(src).not.toMatch(/\bswitch\s*\([^)]*\bconsumer\b/i);
      expect(src).not.toMatch(/===\s*["']obs["']/i);
      expect(src).not.toMatch(/===\s*["']led["']/i);
      expect(src).not.toMatch(/===\s*["']broadcast["']/i);
    }
  });

  it("Phase A resolve path must not accept capability profile parameters", () => {
    const engineSrc = readFileSync(join(ENGINE_DIR, "engine.ts"), "utf8");
    expect(engineSrc).not.toMatch(/capabilityProfile/i);
    const typesSrc = readFileSync(join(ENGINE_DIR, "types.ts"), "utf8");
    expect(typesSrc).not.toMatch(/capabilityProfileId/);
  });
});
