import type { Plugin } from "vite";
import { injectBrandingIconsIntoHtml } from "./branding-icon-head.ts";
import { getDevApiProxyTarget } from "./vite-proxy.ts";

async function fetchBrandingIconVersion(): Promise<number> {
  try {
    const target = getDevApiProxyTarget();
    const res = await fetch(`${target}/api/branding/icon-version`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!res.ok) return 0;
    const data = (await res.json()) as { version?: number };
    return typeof data.version === "number" && data.version > 0 ? data.version : 0;
  } catch {
    return 0;
  }
}

/**
 * Injects ?v={brandingVersion} into favicon link tags when Vite serves index.html in dev.
 * Production uses the API server's patched cachedHtml instead.
 */
export function brandingIconsDevPlugin(): Plugin {
  return {
    name: "bidwar-branding-icons",
    apply: "serve",
    async transformIndexHtml(html) {
      const version = await fetchBrandingIconVersion();
      return injectBrandingIconsIntoHtml(html, version);
    },
  };
}
