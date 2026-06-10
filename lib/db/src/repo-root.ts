import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";

const MARKER = "pnpm-workspace.yaml";

/** Walk up from `startDir` until the monorepo root (contains pnpm-workspace.yaml). */
export function findRepoRoot(startDir: string): string {
  let dir = resolve(startDir);
  while (true) {
    if (existsSync(resolve(dir, MARKER))) return dir;
    const parent = dirname(dir);
    if (parent === dir) {
      throw new Error(
        `Could not find repo root (missing ${MARKER}) starting from ${startDir}`,
      );
    }
    dir = parent;
  }
}
