import type { Plugin } from "vite";

const BOOT_SPLASH_IMG_RE =
  /<img src="\/favicon\.svg" alt="" width="64" height="64" decoding="async" \/>/g;

const BOOT_SPLASH_PRELOAD_RE =
  /<!-- BOOT_SPLASH_PRELOAD_START -->[\s\S]*?<!-- BOOT_SPLASH_PRELOAD_END -->/;

function bootSplashImgTag(logoUrl: string): string {
  return `<img src="${logoUrl}" alt="" width="64" height="64" decoding="async" />`;
}

function bootSplashPreloadBlock(logoUrl: string): string {
  return `<!-- BOOT_SPLASH_PRELOAD_START -->
    <link rel="preload" href="${logoUrl}" as="image" type="image/webp" />
    <!-- BOOT_SPLASH_PRELOAD_END -->`;
}

function applyBootSplashHtml(html: string, logoUrl: string): string {
  return html
    .replace(BOOT_SPLASH_PRELOAD_RE, bootSplashPreloadBlock(logoUrl))
    .replace(BOOT_SPLASH_IMG_RE, bootSplashImgTag(logoUrl));
}

function resolveBootSplashLogoUrl(
  ctx: Parameters<NonNullable<Plugin["transformIndexHtml"]>>[1],
): string | null {
  if (ctx.bundle) {
    const asset = Object.values(ctx.bundle).find(
      (item) =>
        item.type === "asset" &&
        typeof item.fileName === "string" &&
        item.fileName.includes("boot-splash-logo"),
    );
    if (asset?.type === "asset") {
      const base = ctx.server?.config.base ?? "/";
      return `${base}${asset.fileName}`.replace(/\/{2,}/g, "/");
    }
  }

  if (ctx.server) {
    const base = ctx.server.config.base.replace(/\/$/, "");
    return `${base}/src/assets/boot-splash-logo.webp`;
  }

  return null;
}

/**
 * Replaces the inline HTML boot splash favicon with the Vite-bundled logo URL
 * and preloads that image in <head> so first paint and SPA navigation reuse cache.
 */
export function bootSplashHtmlPlugin(): Plugin {
  return {
    name: "bidwar-boot-splash-html",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        const logoUrl = resolveBootSplashLogoUrl(ctx);
        if (!logoUrl) return html;
        return applyBootSplashHtml(html, logoUrl);
      },
    },
  };
}
