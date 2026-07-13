/**
 * Guards against staging Render services using production APP_URL / APP_DOMAIN.
 * When Google OAuth redirect_uri is derived from APP_URL, a misconfigured staging
 * service sends users to https://bidwar.in after account selection.
 */

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
  return h.includes("staging") || h.includes("bidwar-staging");
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
 * If this process is clearly a staging Render service but APP_URL / APP_DOMAIN
 * still point at production, return corrected values so OAuth callbacks stay
 * on staging.
 */
export function correctStagingPublicOriginMismatch(input: {
  appUrlOrigin: string | null;
  appHosts: string[];
  renderExternalOrigin: string | null;
}): PublicOriginCorrection {
  const warnings: string[] = [];
  let publicOrigin: string | null = null;
  let appHosts: string[] | null = null;

  const renderHost = input.renderExternalOrigin
    ? hostnameOfOrigin(input.renderExternalOrigin)
    : null;

  if (!renderHost || !input.renderExternalOrigin || !isStagingLikeHost(renderHost)) {
    return { publicOrigin: null, appHosts: null, warnings };
  }

  const appUrlHost = input.appUrlOrigin ? hostnameOfOrigin(input.appUrlOrigin) : null;

  if (appUrlHost && isProductionBidwarHost(appUrlHost)) {
    publicOrigin = input.renderExternalOrigin;
    warnings.push(
      `APP_URL is ${input.appUrlOrigin} (production) but this Render service host is ${renderHost}. ` +
        `Using ${input.renderExternalOrigin} for OAuth callbacks and public links. ` +
        `Fix Render env: APP_URL=${input.renderExternalOrigin} APP_DOMAIN=${renderHost}`,
    );
  }

  const hostsLower = input.appHosts.map((h) => h.toLowerCase());
  const hasRenderHost = hostsLower.includes(renderHost);
  const onlyProductionHosts =
    input.appHosts.length > 0 && input.appHosts.every((h) => isProductionBidwarHost(h));

  if (!hasRenderHost && (onlyProductionHosts || input.appHosts.length === 0)) {
    appHosts = [renderHost];
    warnings.push(
      `APP_DOMAIN (${input.appHosts.join(",") || "(empty)"}) does not include staging host ${renderHost}. ` +
        `Using APP_DOMAIN=${renderHost}`,
    );
  } else if (!hasRenderHost) {
    appHosts = [...input.appHosts, renderHost];
    warnings.push(`Appended staging host ${renderHost} to APP_DOMAIN for CORS/cookies`);
  }

  return { publicOrigin, appHosts, warnings };
}

/**
 * Pick a public origin for the current HTTP request when the Host header is
 * an allowed APP_DOMAIN entry; otherwise fall back to the canonical origin.
 */
export function resolveTrustedRequestOrigin(input: {
  requestHost: string | undefined;
  appHosts: string[];
  publicScheme: "http" | "https";
  publicOrigin: string;
}): string {
  const host = input.requestHost?.split(":")[0]?.trim().toLowerCase();
  if (!host) return input.publicOrigin;
  if (input.appHosts.some((h) => h.toLowerCase() === host)) {
    return `${input.publicScheme}://${host}`;
  }
  return input.publicOrigin;
}
