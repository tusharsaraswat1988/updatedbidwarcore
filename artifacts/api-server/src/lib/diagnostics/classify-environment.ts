/**
 * Classify BidWar deployment environment for diagnostics (no secrets).
 */

export type BidwarEnvironment = "local" | "staging" | "production" | "unknown";

export type ClassifyEnvironmentInput = {
  bidwarEnv?: string | null;
  nodeEnv?: string | null;
  appDomain?: string | null;
  appUrl?: string | null;
};

function includesAny(haystack: string, needles: string[]): boolean {
  const h = haystack.toLowerCase();
  return needles.some((n) => h.includes(n.toLowerCase()));
}

export function classifyEnvironment(input: ClassifyEnvironmentInput): BidwarEnvironment {
  const override = input.bidwarEnv?.trim().toLowerCase();
  if (override === "local" || override === "staging" || override === "production") {
    return override;
  }

  const nodeEnv = input.nodeEnv?.trim().toLowerCase() ?? "";
  const appDomain = input.appDomain?.trim().toLowerCase() ?? "";
  const appUrl = input.appUrl?.trim().toLowerCase() ?? "";
  const combined = `${appDomain} ${appUrl}`;

  if (
    nodeEnv === "development" ||
    includesAny(combined, ["localhost", "127.0.0.1"]) ||
    includesAny(appDomain, [".localhost"])
  ) {
    return "local";
  }

  if (includesAny(combined, ["staging", "bidwar-staging"])) {
    return "staging";
  }

  if (
    includesAny(combined, ["bidwar.in", "updatedbidwarcore.onrender.com"]) ||
    (nodeEnv === "production" && combined.length > 0 && !includesAny(combined, ["staging"]))
  ) {
    return "production";
  }

  return "unknown";
}
