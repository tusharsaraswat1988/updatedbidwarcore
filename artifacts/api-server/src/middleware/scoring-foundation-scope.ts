/**
 * Scoring-foundation routers are mounted before core tournament routes and
 * register a prefix middleware on `/tournaments/:tournamentId`.
 *
 * That prefix also matches auction and settings URLs (`/tournaments/45`,
 * `/tournaments/45/players`). Those requests must fall through. Only the
 * foundation paths owned by each router should run the scoring-module gate.
 */

export type ScoringFoundationScope =
  | "teams"
  | "matches"
  | "fixtures"
  | "scheduling"
  | "runtime-matches";

const SCOPE_PATTERNS: Record<ScoringFoundationScope, RegExp> = {
  // Auction owns `/teams` and `/teams/:teamId`. Foundation owns the extra segments.
  teams: /^\/teams\/(?:identities|aggregate|[^/]+\/(?:identity|configuration|members|validation|history|ready))$/,
  matches: /^\/matches(?:\/.*)?$/,
  fixtures: /^\/fixtures(?:\/.*)?$/,
  scheduling: /^\/scheduling(?:\/.*)?$/,
  "runtime-matches": /^\/runtime-matches(?:\/.*)?$/,
};

/** Path after `/tournaments/:id`, accepting remainder, full, or `/api` URLs. */
export function scoringFoundationRemainder(url: string): string {
  const noQuery = (url.split("?")[0] || "/").trim();
  const withSlash = noQuery.startsWith("/") ? noQuery : `/${noQuery}`;
  const withoutApi = withSlash.replace(/^\/api(?=\/)/, "") || "/";
  const tournamentMatch = withoutApi.match(/\/tournaments\/\d+(?:(\/.*))?$/);
  const remainder = tournamentMatch ? tournamentMatch[1] || "/" : withoutApi;
  const trimmed = remainder.replace(/\/+$/, "");
  return trimmed || "/";
}

export function shouldApplyScoringFoundationGate(
  scope: ScoringFoundationScope,
  url: string,
): boolean {
  return SCOPE_PATTERNS[scope].test(scoringFoundationRemainder(url));
}
