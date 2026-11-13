/**
 * Dynamic Portal Theme Resolver
 *
 * Radix portals mount under document.body, so they lose page-level
 * `.bw-organizer-light` or `.lovable-theme` ancestry.
 *
 * This helper dynamically resolves the proper theme class so organiser
 * dialogs, sheets, selects, popovers, and menus inherit crisp light mode,
 * while protected surfaces (OBS, LED, homepage, operator console, scorer live pad)
 * preserve their dark broadcast theme.
 */

export function isOrganizerRoute(pathname?: string): boolean {
  if (typeof window === "undefined") return false;
  let p = pathname ?? window.location.pathname;
  if (p.startsWith("/scoring-app")) {
    p = p.slice("/scoring-app".length) || "/";
  }

  // 1. Explicitly protected routes remain dark:
  if (
    p === "/" ||
    p.startsWith("/bpl") ||
    (p.includes("/auction") && !p.includes("/auction-overview") && !p.includes("/auction-tips")) ||
    p.includes("/obs") ||
    p.includes("/display") ||
    p.includes("/side-display") ||
    p.includes("/score-display") ||
    p.startsWith("/live") ||
    p.startsWith("/fan") ||
    p.startsWith("/fanpage") ||
    p.includes("/register") ||
    p === "/login" ||
    p === "/scoring-app/login" ||
    p.includes("/scorer") ||
    (p.includes("/score/") && p.includes("/live")) ||
    p.includes("/overlay")
  ) {
    return false;
  }

  // 2. Explicitly in-scope organiser routes:
  if (
    p === "/organizer" ||
    p.startsWith("/organizer/") ||
    p === "/tournament/new" ||
    /^\/tournament\/\d+(\/|$)/.test(p) ||
    /^\/cricket\/\d+(\/|$)/.test(p) ||
    /^\/badminton\/\d+(\/|$)/.test(p) ||
    p === "/admin" ||
    p.startsWith("/admin/")
  ) {
    return true;
  }

  // 3. Fallback: check DOM for active organiser surface
  if (typeof document !== "undefined" && document.querySelector('[data-surface="organizer"], .bw-organizer-light')) {
    return true;
  }

  return false;
}

export function syncDocumentSurfaceTheme(pathname?: string): void {
  if (typeof document === "undefined") return;
  const isOrg = isOrganizerRoute(pathname);
  if (isOrg) {
    document.documentElement.classList.add("bw-organizer-light");
    document.documentElement.setAttribute("data-surface", "organizer");
    document.body.classList.add("bw-organizer-light");
    document.body.setAttribute("data-surface", "organizer");
  } else {
    document.documentElement.classList.remove("bw-organizer-light");
    document.documentElement.removeAttribute("data-surface");
    document.body.classList.remove("bw-organizer-light");
    document.body.removeAttribute("data-surface");
  }
}

export function getPortalThemeClass(pathname?: string): string {
  return isOrganizerRoute(pathname) ? "bw-organizer-light" : "lovable-theme dark";
}

/**
 * Backward compatibility: dynamically returns the active portal theme class
 * via valueOf / toString coercion, and as a fallback string.
 */
export const PORTAL_THEME_CLASS = {
  toString() {
    return getPortalThemeClass();
  },
  valueOf() {
    return getPortalThemeClass();
  },
  [Symbol.toPrimitive]() {
    return getPortalThemeClass();
  },
} as unknown as string;
