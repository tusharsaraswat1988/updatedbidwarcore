import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

describe("Phase 4F — Cross-Module Static Dependency Enforcement", () => {
  const srcDir = path.resolve(__dirname, "..");

  function readSource(relativePath: string): string {
    const fullPath = path.join(srcDir, relativePath);
    return fs.readFileSync(fullPath, "utf-8");
  }

  function extractImportPaths(source: string): string[] {
    const importRegex = /(?:import|export)\s+(?:(?:[\w*\s{},$]+)\s+from\s+)?['"]([^'"]+)['"]/g;
    const dynamicImportRegex = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
    const matches: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = importRegex.exec(source)) !== null) {
      matches.push(m[1]);
    }
    while ((m = dynamicImportRegex.exec(source)) !== null) {
      matches.push(m[1]);
    }
    return matches;
  }

  it("cricket-master-sports.ts must NOT import from badminton or badminton-broadcast", () => {
    const source = readSource("routes/cricket-master-sports.ts");
    const imports = extractImportPaths(source);

    const badmintonImports = imports.filter((p) =>
      p.includes("badminton") || p.includes("badminton-broadcast"),
    );

    expect(badmintonImports).toEqual([]);
  });

  it("cricket-roster.ts must NOT import from badminton implementation", () => {
    const source = readSource("lib/master-sports/cricket-roster.ts");
    const imports = extractImportPaths(source);

    const badmintonImports = imports.filter((p) =>
      p.includes("badminton") && !p.includes("badminton-core"),
    );

    expect(badmintonImports).toEqual([]);
  });

  it("sports-branding.ts must NOT import from sport-specific services or engines", () => {
    const source = readSource("lib/sports-branding.ts");
    const imports = extractImportPaths(source);

    const forbiddenImports = imports.filter((p) =>
      p.includes("badminton") ||
      p.includes("cricket") ||
      p.includes("auction-events") ||
      p.includes("routes/auction") ||
      p.includes("badminton-broadcast") ||
      p.includes("scoring-broadcast"),
    );

    expect(forbiddenImports).toEqual([]);
  });

  it("cricket routes must NOT import badminton services", () => {
    const source = readSource("routes/cricket-master-sports.ts");
    const imports = extractImportPaths(source);

    for (const imp of imports) {
      expect(imp).not.toMatch(/badminton/i);
    }
  });

  it("badminton routes must NOT import cricket services", () => {
    const source = readSource("routes/badminton.ts");
    const imports = extractImportPaths(source);

    for (const imp of imports) {
      expect(imp).not.toMatch(/cricket/i);
    }
  });
});
