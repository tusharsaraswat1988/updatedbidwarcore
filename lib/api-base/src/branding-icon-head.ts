import { BRANDING_ICON_PATHS } from "./branding-assets.ts";

const BRANDING_ICONS_RE = /<!-- BRANDING_ICONS_START -->[\s\S]*?<!-- BRANDING_ICONS_END -->/;

export function buildBrandingIconHeadLinks(version: number): string {
  const v = version > 0 ? `?v=${version}` : "";
  return `<!-- BRANDING_ICONS_START -->
    <link rel="icon" href="${BRANDING_ICON_PATHS.faviconIco}${v}" sizes="any" />
    <link rel="icon" type="image/svg+xml" href="${BRANDING_ICON_PATHS.faviconSvg}${v}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${BRANDING_ICON_PATHS.favicon32}${v}" />
    <link rel="icon" type="image/png" sizes="32x32" href="${BRANDING_ICON_PATHS.favicon32x32}${v}" />
    <link rel="shortcut icon" href="${BRANDING_ICON_PATHS.favicon32}${v}" />
    <link rel="apple-touch-icon" sizes="180x180" href="${BRANDING_ICON_PATHS.appleTouchIcon}${v}" />
    <!-- BRANDING_ICONS_END -->`;
}

/** Replace the BRANDING_ICONS marker block with versioned canonical favicon links. */
export function injectBrandingIconsIntoHtml(html: string, version: number): string {
  if (!BRANDING_ICONS_RE.test(html)) return html;
  return html.replace(BRANDING_ICONS_RE, buildBrandingIconHeadLinks(version));
}
