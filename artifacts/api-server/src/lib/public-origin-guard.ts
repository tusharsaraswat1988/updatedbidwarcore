/**
 * Guards against staging Render / Railway services using production APP_URL / APP_DOMAIN.
 * When Google OAuth redirect_uri is derived from APP_URL, a misconfigured staging
 * service sends users to https://bidwar.in after account selection.
 */

export const CANONICAL_STAGING_ORIGIN = "https://stagingbidwar.up.railway.app";
export const CANONICAL_STAGING_HOST = "stagingbidwar.up.railway.app";

export const STAGING_SITE_HOSTS = new Set([
  "stagingbidwar.up.railway.app",
  "updatedbidwarcore-staging.up.railway.app",
  "bidwar-staging.up.railway.app",
  "bidwar-staging.onrender.com",
]);

export type PublicOriginCorrection = {
  /** Corrected APP_URL origin (https://host), or null if no change. */
  publicOrigin: string | null;
  /** Corrected APP_DOMAIN host list, or null if no change. */
  appHosts: string[] | null;
  /** Human-readable warnings for operators (logged at startup). */
  warnings: string[];
};

function hostnameOfOrigin(origin: string): string | null {
  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** True when a hostname looks like a BidWar staging deploy. */
export function isStagingLikeHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.includes("staging") ||
    h.includes("bidwar-staging") ||
    STAGING_SITE_HOSTS.has(h)
  );
}

/** True when a hostname is the production BidWar site. */
export function isProductionBidwarHost(host: string): boolean {
  const h = host.toLowerCase();
  return h === "bidwar.in" || h === "www.bidwar.in";
}

/**
 * Resolve the public URL Render assigns to this service.
 * Prefer RENDER_EXTERNAL_URL; fall back to https://RENDER_EXTERNAL_HOSTNAME.
 */
export function resolveRenderExternalOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  const urlRaw = env.RENDER_EXTERNAL_URL?.trim();
  if (urlRaw) {
    try {
      const url = new URL(urlRaw.includes("://") ? urlRaw : `https://${urlRaw}`);
      if (url.hostname) return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
    } catch {
      /* ignore */
    }
  }
  const host = env.RENDER_EXTERNAL_HOSTNAME?.trim();
  if (host && !host.includes("://") && !host.includes("/")) {
    return `https://${host}`;
  }
  return null;
}

/**
 * Resolve the public URL Railway assigns to this service.
 * Checks RAILWAY_PUBLIC_DOMAIN, RAILWAY_STATIC_URL, RAILWAY_PUBLIC_URL.
 */
export function resolveRailwayExternalOrigin(env: NodeJS.ProcessEnv = process.env): string | null {
  for (const key of ["RAILWAY_PUBLIC_DOMAIN", "RAILWAY_STATIC_URL", "RAILWAY_PUBLIC_URL"] as const) {
    const val = env[key]?.trim();
    if (val) {
      try {
        const url = new URL(val.includes("://") ? val : `https://${val}`);
        if (url.hostname && !isProductionBidwarHost(url.hostname)) {
          return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
        }
      } catch {
        /* ignore */
      }
    }
  }

  for (const [key, value] of Object.entries(env)) {
    if (!key.startsWith("RAILWAY_") || !value) continue;
    if (!value.toLowerCase().includes("up.railway.app")) continue;
    try {
      const url = new URL(value.includes("://") ? value : `https://${value}`);
      if (url.hostname && !isProductionBidwarHost(url.hostname)) {
        return `${url.protocol}//${url.host}`.replace(/\/+$/, "");
      }
    } catch {
      /* ignore */
    }
  }

  if (env.RAILWAY_SERVICE_NAME && env.RAILWAY_ENVIRONMENT_NAME) {
    return `https://${env.RAILWAY_SERVICE_NAME}.up.railway.app`;
  }

  return null;
}

/**
 * If this process is clearly a staging environment but APP_URL / APP_DOMAIN
 * still point at production, return corrected values so OAuth callbacks stay
 * on staging.
 *
 * Staging is detected when:
 * - BIDWAR_ENV=staging, or
 * - RAILWAY_ENVIRONMENT_NAME=staging, or
 * - RENDER_EXTERNAL_* or RAILWAY_* hostname looks like staging, or
 * - APP_DOMAIN contains a staging hostname.
 */
export function correctStagingPublicOriginMismatch(input: {
  appUrlOrigin: string | null;
  appHosts: string[];
  renderExternalOrigin: string | null;
  railwayExternalOrigin?: string | null;
  bidwarEnv?: string | null;
  railwayEnvName?: string | null;
}): PublicOriginCorrection {
  const warnings: string[] = [];
  let publicOrigin: string | null = null;
  let appHosts: string[] | null = null;

  const renderHost = input.renderExternalOrigin
    ? hostnameOfOrigin(input.renderExternalOrigin)
    : null;
  const railwayHost = input.railwayExternalOrigin
    ? hostnameOfOrigin(input.railwayExternalOrigin)
    : null;

  const isStagingEnv =
    input.bidwarEnv?.trim().toLowerCase() === "staging" ||
    input.railwayEnvName?.trim().toLowerCase() === "staging" ||
    (!!renderHost && isStagingLikeHost(renderHost)) ||
    (!!railwayHost && isStagingLikeHost(railwayHost)) ||
    input.appHosts.some(isStagingLikeHost);

  if (!isStagingEnv) {
    return { publicOrigin: null, appHosts: null, warnings };
  }

  const appUrlHost = input.appUrlOrigin ? hostnameOfOrigin(input.appUrlOrigin) : null;
  const hasValidStagingAppUrl = !!(appUrlHost && isStagingLikeHost(appUrlHost) && !isProductionBidwarHost(appUrlHost));

  // Resolve best staging origin without ever falling back to production
  const candidateStagingOrigin =
    (hasValidStagingAppUrl && input.appUrlOrigin) ||
    (input.railwayExternalOrigin && railwayHost && !isProductionBidwarHost(railwayHost) && input.railwayExternalOrigin) ||
    (input.renderExternalOrigin && renderHost && !isProductionBidwarHost(renderHost) && input.renderExternalOrigin) ||
    (input.appHosts.find((h) => isStagingLikeHost(h) && !isProductionBidwarHost(h))
      ? `https://${input.appHosts.find((h) => isStagingLikeHost(h) && !isProductionBidwarHost(h))}`
      : null) ||
    CANONICAL_STAGING_ORIGIN;

  const candidateStagingHost = hostnameOfOrigin(candidateStagingOrigin) ?? CANONICAL_STAGING_HOST;

  if (!hasValidStagingAppUrl) {
    publicOrigin = candidateStagingOrigin;
    warnings.push(
      `APP_URL is ${input.appUrlOrigin || "(unset)"} but this environment is staging. ` +
        `Using ${candidateStagingOrigin} for OAuth callbacks and public links. ` +
        `Fix host env: set APP_URL=${candidateStagingOrigin} APP_DOMAIN=${candidateStagingHost}`,
    );
  }

  // Filter out all production hosts from appHosts so staging never falls back to bidwar.in
  const hadProductionHosts = input.appHosts.some(isProductionBidwarHost);
  const nonProdHosts = input.appHosts.filter((h) => !isProductionBidwarHost(h));
  const targetHost = (publicOrigin ? candidateStagingHost : appUrlHost) ?? candidateStagingHost;
  const targetLower = targetHost.toLowerCase();

  let finalHosts = [...nonProdHosts];
  if (finalHosts.length === 0) {
    finalHosts = [targetHost];
  } else if (!finalHosts.map((h) => h.toLowerCase()).includes(targetLower)) {
    finalHosts.push(targetHost);
  }

  const hostsChanged =
    hadProductionHosts ||
    input.appHosts.length === 0 ||
    finalHosts.length !== input.appHosts.length ||
    finalHosts.some((h, i) => h !== input.appHosts[i]);

  if (hostsChanged) {
    appHosts = finalHosts;
    warnings.push(`Staging APP_DOMAIN configured as: ${finalHosts.join(", ")}`);
  }

  return { publicOrigin, appHosts, warnings };
}

/**
 * Pick a public origin for the current HTTP request.
 * - Staging hosts stay on staging (never fall back to production).
 * - Production hosts stay on production.
 * - Untrusted hosts fall back to the environment canonical origin.
 */
export function resolveTrustedRequestOrigin(input: {
  requestHost: string | undefined;
  appHosts: string[];
  publicScheme: "http" | "https";
  publicOrigin: string;
  bidwarEnv?: string | null;
}): string {
  const host = input.requestHost?.split(":")[0]?.trim().toLowerCase();
  if (!host) return input.publicOrigin;

  // Staging host detection: any verified staging host stays on https://${host}
  const isStagingRequest = isStagingLikeHost(host) || STAGING_SITE_HOSTS.has(host);
  if (isStagingRequest) {
    return `https://${host}`;
  }

  // Production request
  if (isProductionBidwarHost(host)) {
    // A staging process must never redirect back to production even if a header claims bidwar.in
    if (input.bidwarEnv?.trim().toLowerCase() === "staging") {
      return input.publicOrigin;
    }
    return `${input.publicScheme}://${host}`;
  }

  // Explicitly trusted app hosts
  if (input.appHosts.some((h) => h.toLowerCase() === host)) {
    return `${input.publicScheme}://${host}`;
  }

  // Staging safeguard: fallback must never be production
  if (
    input.bidwarEnv?.trim().toLowerCase() === "staging" &&
    isProductionBidwarHost(hostnameOfOrigin(input.publicOrigin) || "")
  ) {
    return CANONICAL_STAGING_ORIGIN;
  }

  return input.publicOrigin;
}

/**
 * Hard-fail message when staging still has production public URLs after correction.
 * Returns null when configuration is acceptable.
 */
export function stagingProductionUrlConflictError(input: {
  bidwarEnv?: string | null;
  publicOrigin: string;
  appHosts: string[];
}): string | null {
  if (input.bidwarEnv?.trim().toLowerCase() !== "staging") return null;
  const originHost = hostnameOfOrigin(input.publicOrigin);
  if (originHost && isProductionBidwarHost(originHost)) {
    return (
      `BIDWAR_ENV=staging but public origin is still ${input.publicOrigin}. ` +
      `Set APP_URL to the staging HTTPS URL (e.g. ${CANONICAL_STAGING_ORIGIN}) ` +
      `or Google OAuth will redirect users to production.`
    );
  }
  if (input.appHosts.some((h) => isProductionBidwarHost(h))) {
    return (
      `BIDWAR_ENV=staging but APP_DOMAIN includes production host(s): ${input.appHosts.join(",")}. ` +
      `Use the staging hostname only.`
    );
  }
  return null;
}
