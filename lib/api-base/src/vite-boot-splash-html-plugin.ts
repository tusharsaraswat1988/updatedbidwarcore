import type { Plugin } from "vite";
import { BRANDING_BOOT_SPLASH_ICON_PATH } from "./branding-assets";
import { injectBrandingIconsIntoHtml } from "./branding-icon-head";
import { getDevApiProxyTarget } from "./vite-proxy";

const BOOT_SPLASH_IMG_RE =
  /<img src="\/favicon\.svg" alt="" width="64" height="64" decoding="async" \/>/g;

const BOOT_SPLASH_PRELOAD_RE =
  /<!-- BOOT_SPLASH_PRELOAD_START -->[\s\S]*?<!-- BOOT_SPLASH_PRELOAD_END -->/;

function bootSplashImgTag(logoUrl: string): string {
  return `<img src="${logoUrl}" alt="" width="64" height="64" decoding="async" />`;
}

function bootSplashPreloadBlock(logoUrl: string): string {
  return `<!-- BOOT_SPLASH_PRELOAD_START -->
    <link rel="preload" href="${logoUrl}" as="image" type="image/svg+xml" />
    <!-- BOOT_SPLASH_PRELOAD_END -->`;
}

function applyBootSplashHtml(html: string, logoUrl: string): string {
  return html
    .replace(BOOT_SPLASH_PRELOAD_RE, bootSplashPreloadBlock(logoUrl))
    .replace(BOOT_SPLASH_IMG_RE, bootSplashImgTag(logoUrl));
}

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
 * Preloads the canonical boot splash icon; in dev also injects versioned favicon links.
 */
export function bootSplashHtmlPlugin(): Plugin {
  return {
    name: "bidwar-boot-splash-html",
    transformIndexHtml: {
      order: "post",
      async handler(html, ctx) {
        const version = ctx.server ? await fetchBrandingIconVersion() : 0;
        const v = version > 0 ? `?v=${version}` : "";
        const logoUrl = `${BRANDING_BOOT_SPLASH_ICON_PATH}${v}`;
        const withIcons = ctx.server ? injectBrandingIconsIntoHtml(html, version) : html;
        return applyBootSplashHtml(withIcons, logoUrl);
      },
    },
  };
}
