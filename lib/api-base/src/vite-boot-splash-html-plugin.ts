import type { Plugin } from "vite";

const BOOT_SPLASH_IMG_RE =
  /<img src="\/favicon\.svg" alt="" width="64" height="64" decoding="async" \/>/g;

function bootSplashImgTag(logoUrl: string): string {
  return `<img src="${logoUrl}" alt="" width="64" height="64" decoding="async" />`;
}

/**
 * Replaces the inline HTML boot splash favicon with the Vite-bundled logo URL
 * so first paint and SPA navigation use the same production-safe /assets/ path.
 */
export function bootSplashHtmlPlugin(): Plugin {
  return {
    name: "bidwar-boot-splash-html",
    transformIndexHtml: {
      order: "post",
      handler(html, ctx) {
        if (ctx.bundle) {
          const asset = Object.values(ctx.bundle).find(
            (item) =>
              item.type === "asset" &&
              typeof item.fileName === "string" &&
              item.fileName.includes("boot-splash-logo"),
          );
          if (asset?.type === "asset") {
            const base = ctx.server?.config.base ?? "/";
            const logoUrl = `${base}${asset.fileName}`.replace(/\/{2,}/g, "/");
            return html.replace(BOOT_SPLASH_IMG_RE, bootSplashImgTag(logoUrl));
          }
        }

        if (ctx.server) {
          const base = ctx.server.config.base.replace(/\/$/, "");
          const logoUrl = `${base}/src/assets/boot-splash-logo.webp`;
          return html.replace(BOOT_SPLASH_IMG_RE, bootSplashImgTag(logoUrl));
        }

        return html;
      },
    },
  };
}
