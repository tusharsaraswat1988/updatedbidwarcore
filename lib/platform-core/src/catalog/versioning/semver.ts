export type Semver = {
  major: number;
  minor: number;
  patch: number;
};

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

export function isSemver(value: unknown): boolean {
  return typeof value === "string" && SEMVER_RE.test(value);
}

export function parseSemver(value: string): Semver | null {
  if (!isSemver(value)) return null;
  const match = SEMVER_RE.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
}

export function compareSemver(a: string, b: string): number {
  const left = parseSemver(a);
  const right = parseSemver(b);
  if (!left || !right) {
    throw new Error(`Invalid semver comparison: ${a} vs ${b}`);
  }
  if (left.major !== right.major) return left.major - right.major;
  if (left.minor !== right.minor) return left.minor - right.minor;
  return left.patch - right.patch;
}

/** Same major ⇒ compatible by default policy. */
export function isCompatibleUpgrade(from: string, to: string): boolean {
  const left = parseSemver(from);
  const right = parseSemver(to);
  if (!left || !right) return false;
  if (right.major !== left.major) return false;
  return compareSemver(to, from) >= 0;
}

/**
 * Minimal range support: exact version, or `^MAJOR.MINOR.PATCH` (same major, >= base).
 */
export function satisfiesSemverRange(version: string, range: string): boolean {
  if (isSemver(range)) return version === range;
  if (range.startsWith("^")) {
    const base = range.slice(1);
    const parsed = parseSemver(base);
    const ver = parseSemver(version);
    if (!parsed || !ver) return false;
    return ver.major === parsed.major && compareSemver(version, base) >= 0;
  }
  return false;
}
